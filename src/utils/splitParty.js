// A party that starts apart: each character (or the ones who share an origin
// zone) plays on their own until the story brings them together.
//
// Plain data inside the party (party.js), so it is saved, migrated and shared
// online with it:
//   party.startMode: 'origins' when the campaign started "cada uno desde su
//     origen" (absent: together, as every campaign before).
//   party.split: while somebody is somewhere else:
//     { groups: [group, ...], meetingNodeId, spotlight: { groupId, count } }
//     group: { id, memberIds, nodeId, gold, hook, turns, suggestions }
//       - nodeId: where they are (a node of the world map)
//       - gold: their own purse (party.gold is not used meanwhile)
//       - hook: why they go to the meeting point, once Duncan or the local
//         engine gave them one: { kind: 'mision' | 'rumor' | 'encargo', text, source }
//       - turns: actions narrated in this group's scene
//       - suggestions: Duncan's last suggestions for this scene
//       - common: true for the group that stayed where the party was when a new
//         hero started somewhere else: it goes on with the common chronicle
//   party.prologues: the scenes of the groups that already joined another, kept
//     as history: [{ id, memberIds, names, place }]
//
// Each group has its own scene: the actions, Duncan's replies, rests, shops,
// travels and fights only touch the members who are there. The functions of
// party.js / partyActions.js work on a "scope": a party made only of a group
// (scopeParty), whose result is put back with unscopeParty.
//
// Turns between scenes (the criterion): a scene keeps the spotlight for
// SCENE_TURNS narrated actions in a row; then it passes to the next group
// (in order). Alone, the game switches to the next scene by itself (the player
// can also switch at any moment by choosing a character). Online there are no
// turns between groups: each group is a "system" of its own running in parallel
// (its own queue, its call to Duncan, its fight; see laneQueue), one action at a
// time within the group.
//
// When a group arrives where another one is, both become a single group (the
// purses are added up). When only one group is left, the split ends and the
// party plays together as usual.

import { roundCoins } from './items';

export const SCENE_TURNS = 3;
export const ORIGINS_MODE = 'origins';
export const HOOK_KINDS = ['mision', 'rumor', 'encargo'];
const MAX_SUGGESTIONS = 4;

let counter = 0;
const newGroupId = () => `g_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const isSplit = party => Array.isArray(party?.split?.groups) && party.split.groups.length > 1;
export const groupsOf = party => (isSplit(party) ? party.split.groups : []);
export const groupById = (party, id) => groupsOf(party).find(g => g.id === id) || null;
export const groupOf = (party, memberId) => groupsOf(party).find(g => g.memberIds.includes(memberId)) || null;
/** The scene a member plays in: their group's id, or null when the party is together. */
export const sceneIdOf = (party, memberId = party?.activeId) => groupOf(party, memberId)?.id || null;
/**
 * The chronicle a group writes in: its own (its id) or, for the group that stayed
 * where the party was when somebody started apart (`common`), the common one (null).
 */
export const chronicleKey = group => (group && !group.common ? group.id : null);
export const chronicleKeyOf = (party, memberId = party?.activeId) => chronicleKey(groupOf(party, memberId));
export const isOriginsCampaign = party => party?.startMode === ORIGINS_MODE;

/** The members of a group, in the party's order. */
export const groupMembers = (party, group) => (party?.members || []).filter(m => group.memberIds.includes(m.id));

/** "Kaelen" / "Kaelen y Brog" / "Kaelen, Brog y Lyra" */
export function joinNames(names) {
  const list = (names || []).filter(Boolean);
  return list.length > 1 ? `${list.slice(0, -1).join(', ')} y ${list.at(-1)}` : list[0] || '';
}
export const groupNames = (party, group) => joinNames(groupMembers(party, group).map(m => m.name));

/** The groups that meet, each as a whole: "Ana con Bruno y Cira", "Ana, Bruno y Cira". */
export const meetingNames = list => (list.length === 2 ? `${list[0]} con ${list[1]}` : joinNames(list));

/**
 * The party as seen from a member's scene: only those who are with them, and
 * their group's purse. When the party is together it is the party itself.
 */
export function scopeParty(party, memberId = party?.activeId) {
  const group = groupOf(party, memberId);
  if (!group) return party;
  const members = groupMembers(party, group);
  const activeId = group.memberIds.includes(party.activeId) ? party.activeId
    : group.memberIds.includes(memberId) ? memberId : members[0]?.id || null;
  return { members, activeId, gold: group.gold };
}

/**
 * Put back a scope changed by the usual functions (scopeParty): its members
 * replace those of the group (members gone from it leave the party, new ones join
 * the group), its gold is the group's purse.
 */
export function unscopeParty(party, memberId, scope) {
  const group = groupOf(party, memberId);
  if (!group) return scope;
  if (!scope || scope === party) return party;
  const before = new Set(group.memberIds);
  const byId = new Map(scope.members.map(m => [m.id, m]));
  const known = new Set(party.members.map(m => m.id));
  const members = [
    ...party.members.filter(m => !before.has(m.id) || byId.has(m.id)).map(m => byId.get(m.id) || m),
    ...scope.members.filter(m => !known.has(m.id))
  ];
  const groups = party.split.groups.map(g => (g.id === group.id
    ? { ...g, memberIds: scope.members.map(m => m.id), gold: roundCoins(Math.max(0, Number(scope.gold) || 0)) }
    : g));
  const activeId = before.has(party.activeId) && members.some(m => m.id === scope.activeId) ? scope.activeId
    : members.some(m => m.id === party.activeId) ? party.activeId : members[0]?.id || null;
  return tidySplit({ ...party, members, activeId, split: { ...party.split, groups } });
}

/** Change a member's scene with a function on its scope (scope => scope). */
export const inScope = (party, memberId, change) => unscopeParty(party, memberId, change(scopeParty(party, memberId)));

/**
 * Keep the split consistent: unknown members dropped from the groups, empty
 * groups removed, members in no group put in the first one. One group or none
 * left: the split ends (its purse becomes the party's).
 */
export function tidySplit(party) {
  if (!party?.split) return party;
  const ids = party.members.map(m => m.id);
  const seen = new Set();
  let groups = (party.split.groups || []).map(g => {
    const memberIds = (g.memberIds || []).filter(id => ids.includes(id) && !seen.has(id));
    memberIds.forEach(id => seen.add(id));
    return { ...g, memberIds };
  }).filter(g => g.memberIds.length);
  const orphans = ids.filter(id => !seen.has(id));
  if (orphans.length && groups.length) groups = groups.map((g, i) => (i === 0 ? { ...g, memberIds: [...g.memberIds, ...orphans] } : g));
  if (groups.length <= 1) {
    const rest = { ...party };
    delete rest.split;
    const gold = (party.split.groups || []).reduce((sum, g) => sum + (Number(g.gold) || 0), 0);
    return { ...rest, gold: roundCoins(Math.max(0, gold)) };
  }
  const spotlight = groups.some(g => g.id === party.split.spotlight?.groupId) ? party.split.spotlight : { groupId: groups[0].id, count: 0 };
  return { ...party, split: { ...party.split, groups, spotlight } };
}

const cleanHook = hook => (hook && HOOK_KINDS.includes(hook.kind) && typeof hook.text === 'string' && hook.text.trim()
  ? { kind: hook.kind, text: hook.text.trim().slice(0, 240), source: hook.source === 'duncan' ? 'duncan' : 'local' }
  : null);

/** The split part of a saved party (any version), checked against its members. */
export function normalizeSplit(party, saved = party) {
  const out = { ...party };
  if (saved?.startMode === ORIGINS_MODE) out.startMode = ORIGINS_MODE;
  else delete out.startMode;
  const prologues = Array.isArray(saved?.prologues)
    ? saved.prologues.filter(p => p && typeof p.id === 'string').slice(-12).map(p => ({
      id: p.id,
      memberIds: Array.isArray(p.memberIds) ? p.memberIds.filter(x => typeof x === 'string') : [],
      names: String(p.names || '').slice(0, 120),
      place: String(p.place || '').slice(0, 80)
    }))
    : [];
  if (prologues.length) out.prologues = prologues;
  else delete out.prologues;
  delete out.split;
  const split = saved?.split;
  if (!split || !Array.isArray(split.groups)) return out;
  const groups = split.groups.filter(g => g && typeof g.id === 'string' && Array.isArray(g.memberIds)).map(g => ({
    id: g.id,
    memberIds: g.memberIds.filter(x => typeof x === 'string'),
    nodeId: typeof g.nodeId === 'string' ? g.nodeId : null,
    gold: roundCoins(Math.max(0, Number(g.gold) || 0)),
    hook: cleanHook(g.hook),
    turns: Math.max(0, Math.round(Number(g.turns) || 0)),
    suggestions: Array.isArray(g.suggestions) ? g.suggestions.filter(s => typeof s === 'string').slice(0, MAX_SUGGESTIONS) : [],
    ...(g.common === true ? { common: true } : {})
  }));
  return tidySplit({
    ...out,
    split: {
      groups,
      meetingNodeId: typeof split.meetingNodeId === 'string' ? split.meetingNodeId : null,
      spotlight: split.spotlight && typeof split.spotlight.groupId === 'string'
        ? { groupId: split.spotlight.groupId, count: Math.max(0, Math.round(Number(split.spotlight.count) || 0)) }
        : null
    }
  });
}

/**
 * Start a party apart: members that start in the same zone share a group.
 * @param party        a new party (createParty)
 * @param assignments  { [memberId]: nodeId }  where each one starts
 * @param gold         { [memberId]: number }  the starting gold each brings to their group's purse
 * @param meetingNodeId the common place where the story will bring them together
 */
export function startApart(party, assignments, { gold = {}, meetingNodeId = null } = {}) {
  const byNode = new Map();
  party.members.forEach(m => {
    const node = assignments[m.id] || null;
    if (!byNode.has(node)) byNode.set(node, []);
    byNode.get(node).push(m.id);
  });
  const groups = [...byNode.entries()].map(([nodeId, memberIds]) => ({
    id: newGroupId(),
    memberIds,
    nodeId,
    gold: roundCoins(memberIds.reduce((sum, id) => sum + (Number(gold[id]) || 0), 0)),
    hook: null,
    turns: 0,
    suggestions: []
  }));
  const base = { ...party, startMode: ORIGINS_MODE };
  if (groups.length <= 1) return { ...base, gold: party.gold };
  return tidySplit({ ...base, gold: 0, split: { groups, meetingNodeId, spotlight: { groupId: groups[0].id, count: 0 } } });
}

/**
 * A new member (a player's hero online) starts in their own origin zone. If the
 * party is somewhere else, the party splits; if a group is already there, the
 * newcomer is with them.
 * @param hereNodeId where the party is when it is together
 */
export function placeNewMember(party, memberId, nodeId, { hereNodeId = null, meetingNodeId = null } = {}) {
  if (!nodeId || !party.members.some(m => m.id === memberId)) return party;
  if (!isSplit(party)) {
    if (!hereNodeId || nodeId === hereNodeId) return party;
    const others = party.members.filter(m => m.id !== memberId).map(m => m.id);
    if (!others.length) return party;
    const groups = [
      { id: newGroupId(), memberIds: others, nodeId: hereNodeId, gold: party.gold, hook: null, turns: SCENE_TURNS, suggestions: [], common: true },
      { id: newGroupId(), memberIds: [memberId], nodeId, gold: 0, hook: null, turns: 0, suggestions: [] }
    ];
    return tidySplit({ ...party, gold: 0, split: { groups, meetingNodeId: meetingNodeId || hereNodeId, spotlight: { groupId: groups[1].id, count: 0 } } });
  }
  const without = party.split.groups.map(g => ({ ...g, memberIds: g.memberIds.filter(id => id !== memberId) }));
  const there = without.find(g => g.nodeId === nodeId);
  const groups = there
    ? without.map(g => (g === there ? { ...g, memberIds: [...g.memberIds, memberId] } : g))
    : [...without, { id: newGroupId(), memberIds: [memberId], nodeId, gold: 0, hook: null, turns: 0, suggestions: [] }];
  return tidySplit({ ...party, split: { ...party.split, groups } });
}

/**
 * A group travels to a node. If another group is there, they become one (the
 * scenes of both are kept as prologues).
 * @returns {{ party, met: null | { groupId, joined: { id, names, memberIds, hook }[], names: string[] }, ended: boolean }}
 */
export function moveGroup(party, groupId, nodeId, { placeOf = () => '' } = {}) {
  const group = groupById(party, groupId);
  if (!group) return { party, met: null, ended: false };
  const moved = party.split.groups.map(g => (g.id === groupId ? { ...g, nodeId } : g));
  const here = moved.filter(g => g.nodeId === nodeId);
  if (here.length < 2) return { party: { ...party, split: { ...party.split, groups: moved } }, met: null, ended: false };

  // Each prologue is named after where it was played (the arriving group, where it came from)
  const before = new Map(party.split.groups.map(g => [g.id, g.nodeId]));
  const joined = here.map(g => ({ id: g.id, memberIds: g.memberIds, names: groupNames(party, g), hook: g.hook, place: String(placeOf(before.get(g.id)) || '').slice(0, 80) }));
  const merged = {
    id: newGroupId(),
    memberIds: here.flatMap(g => g.memberIds),
    nodeId,
    gold: roundCoins(here.reduce((sum, g) => sum + (Number(g.gold) || 0), 0)),
    hook: null,
    turns: 0,
    suggestions: [],
    // (joining the group that writes the common chronicle, they go on with it)
    ...(here.some(g => g.common) ? { common: true } : {})
  };
  const groups = [...moved.filter(g => g.nodeId !== nodeId), merged];
  const prologues = [
    ...(party.prologues || []),
    ...joined.filter(j => !here.find(g => g.id === j.id)?.common).map(j => ({ id: j.id, memberIds: j.memberIds, names: j.names, place: j.place }))
  ].slice(-12);
  const next = tidySplit({ ...party, prologues, activeId: group.memberIds[0] || party.activeId, split: { ...party.split, groups, spotlight: { groupId: merged.id, count: 0 } } });
  return {
    party: next,
    met: { groupId: isSplit(next) ? merged.id : null, joined, names: groupMembers(party, merged).map(m => m.name) },
    ended: !isSplit(next)
  };
}

/** Where a group is. */
export const nodeOfGroup = (party, groupId) => groupById(party, groupId)?.nodeId || null;

/** Why a group heads for the meeting point (given once). */
export function setHook(party, groupId, hook) {
  const clean = cleanHook(hook);
  if (!clean || !groupById(party, groupId)) return party;
  return { ...party, split: { ...party.split, groups: party.split.groups.map(g => (g.id === groupId ? { ...g, hook: clean } : g)) } };
}

/** Duncan's last suggestions for a scene. */
export function setSuggestions(party, groupId, suggestions) {
  if (!groupById(party, groupId) || !Array.isArray(suggestions)) return party;
  const list = suggestions.filter(s => typeof s === 'string').slice(0, MAX_SUGGESTIONS);
  return { ...party, split: { ...party.split, groups: party.split.groups.map(g => (g.id === groupId ? { ...g, suggestions: list } : g)) } };
}

/** The group after this one, in order (round robin). */
export function nextGroup(party, groupId) {
  const groups = groupsOf(party);
  if (groups.length < 2) return null;
  const index = groups.findIndex(g => g.id === groupId);
  return groups[(index + 1) % groups.length];
}

/**
 * A scene action was narrated: count it. After SCENE_TURNS in a row the
 * spotlight passes to the next group (`pass`: the group whose turn it is now).
 * @returns {{ party, pass: group | null }}
 */
export function countSceneTurn(party, groupId) {
  const group = groupById(party, groupId);
  if (!group) return { party, pass: null };
  const spot = party.split.spotlight;
  const count = spot?.groupId === groupId ? (spot.count || 0) + 1 : 1;
  const groups = party.split.groups.map(g => (g.id === groupId ? { ...g, turns: (g.turns || 0) + 1 } : g));
  if (count < SCENE_TURNS) return { party: { ...party, split: { ...party.split, groups, spotlight: { groupId, count } } }, pass: null };
  const next = nextGroup(party, groupId);
  return { party: { ...party, split: { ...party.split, groups, spotlight: { groupId: next.id, count: 0 } } }, pass: next };
}

/**
 * The actions of the online queue to play now, one per lane: in each lane (a group
 * apart, or '' for the party together) its oldest action, unless that lane is busy
 * (`busy(lane)`: Duncan is narrating there, dice are rolling, a fight is on). The
 * groups apart run in parallel; within a group, one action at a time, in order.
 * @param queue items with `characterId`
 */
export function laneQueue(queue, party, busy = () => false) {
  const seen = new Set();
  const out = [];
  (queue || []).forEach(item => {
    const lane = sceneIdOf(party, item.characterId) || '';
    if (seen.has(lane)) return;
    seen.add(lane);
    if (!busy(lane)) out.push(item);
  });
  return out;
}

// ---------------------------------------------------------------- the world and the chronicle

/**
 * The world as one scene sees it: the node where that group is is the current
 * one. Together (or for a member in no group) it is the world itself.
 */
export function sceneWorld(world, party, memberId = party?.activeId) {
  const group = groupOf(party, memberId);
  if (!group || !group.nodeId || !world?.mapNodes?.some(n => n.id === group.nodeId)) return world;
  return {
    ...world,
    mapNodes: world.mapNodes.map(n => (n.id === group.nodeId ? { ...n, status: 'current' } : n.status === 'current' ? { ...n, status: 'discovered' } : n))
  };
}

/** The world with `nodeId` as the current node (when the party gets together there). */
export const withCurrentNode = (world, nodeId) => (world?.mapNodes?.some(n => n.id === nodeId)
  ? { ...world, mapNodes: world.mapNodes.map(n => (n.id === nodeId ? { ...n, status: 'current' } : n.status === 'current' ? { ...n, status: 'discovered' } : n)) }
  : world);

/**
 * The messages of a chronicle: those of a scene (`key`: a group's id) or, for
 * the common chronicle (`key` null), those that belong to no scene.
 */
export const sceneMessages = (messages, key = null) => (messages || []).filter(m => (key ? m.groupId === key : !m.groupId));

/**
 * The prologues a viewer may read (`memberIds`: the characters they play, null:
 * all of them, as alone or when the host lets everyone read the others' scenes):
 * those of the characters who are with theirs now (once met, there is no surprise
 * to keep; together, everyone's).
 */
export function readablePrologues(party, memberIds = null) {
  const list = party?.prologues || [];
  if (!memberIds) return list;
  const near = isSplit(party)
    ? groupsOf(party).filter(g => g.memberIds.some(id => memberIds.includes(id))).flatMap(g => g.memberIds)
    : (party?.members || []).map(m => m.id);
  const ids = new Set([...memberIds, ...near]);
  return list.filter(p => p.memberIds.some(id => ids.has(id)));
}

/**
 * The scenes a viewer may follow now: each group with its members' names and
 * place. `memberIds` limits them to those where the viewer plays someone (null: all).
 */
export function visibleScenes(party, world, memberIds = null) {
  return groupsOf(party)
    .filter(g => !memberIds || g.memberIds.some(id => memberIds.includes(id)))
    .map(g => ({
      id: g.id,
      names: groupNames(party, g),
      memberIds: g.memberIds,
      place: world?.mapNodes?.find(n => n.id === g.nodeId)?.name || '',
      nodeId: g.nodeId,
      hook: g.hook,
      key: chronicleKey(g),
      spotlight: party.split.spotlight?.groupId === g.id
    }));
}

/** A message of a scene, tagged with its group (a new member of the chronicle). */
export const tagScene = (message, key) => (key && !message.groupId ? { ...message, groupId: key } : message);

/**
 * Tag the messages added after `prevLength` with the scene they belong to (a
 * list only grows by appending: earlier messages are left as they are).
 */
export function tagNewMessages(prev, next, key) {
  if (!key || !Array.isArray(next) || next.length <= (prev?.length || 0)) return next;
  const from = prev?.length || 0;
  return next.map((m, i) => (i >= from ? tagScene(m, key) : m));
}
