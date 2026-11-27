// The party: one to four characters played in a campaign.
//
// Plain data saved with the campaign (`campaign.party`):
//   { members: [character, ...], activeId, gold }
// - members: full character sheets (inventory, hands, armor, limbs, conditions,
//   spells, XP and level of their own). Each has a unique `id` (it is also the
//   character's id in combat) and `controlledBy`: who plays it. Today it is
//   always LOCAL_CONTROLLER (the person at this screen); in a future online game
//   it would hold a player id.
// - activeId: the member who acts outside combat (the selector next to the text
//   box). In combat, whoever has the turn acts.
// - gold: the party's purse, shared by everyone (shops, rooms, rewards, loot).
//   Members don't keep gold of their own: `memberSheet` hands a sheet with the
//   purse in `gold` to the functions that read or spend it, and `updateMember`
//   writes the gold back to the purse.
//
// Every action goes through these pure functions on the party (and the
// encounter, see encounter.js), not through scattered UI state, so that it can
// be synchronised between players later on.

import { normalizeEquipment, unequipHand, setWornArmor, HANDS, isWorn } from './equipment';
import { normalizeConditions } from './conditions';
import { addItem, roundCoins, formatCoins } from './items';
import { addXp, canLevelUp } from './leveling';
import { characterLevel } from './characterLevel';
import { normalizeSplit, tidySplit } from './splitParty';

export const MAX_PARTY = 4;
/** Who controls a member: today always the local player. */
export const LOCAL_CONTROLLER = 'local';

let counter = 0;
export const newMemberId = () => `pc_${Date.now().toString(36)}_${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const clone = value => JSON.parse(JSON.stringify(value));
const withoutGold = sheet => {
  const rest = { ...sheet };
  delete rest.gold;
  return rest;
};

/**
 * A character ready to be a member: hands, limbs, armor, conditions, a unique id
 * (taken ids get a new one) and who controls it. The gold is dropped (it goes to the purse).
 */
export function toMember(character, takenIds = []) {
  const sheet = normalizeEquipment({ ...character, conditions: normalizeConditions(character?.conditions) });
  const id = sheet.id && !takenIds.includes(sheet.id) ? sheet.id : newMemberId();
  return withoutGold({ ...sheet, id, controlledBy: sheet.controlledBy || LOCAL_CONTROLLER });
}

/**
 * A new party from the characters made for a campaign. Unless `gold` is given,
 * the purse starts with the starting gold of all of them.
 */
export function createParty(characters, { gold = null } = {}) {
  const list = (Array.isArray(characters) ? characters : [characters]).filter(c => c && typeof c === 'object').slice(0, MAX_PARTY);
  const members = [];
  list.forEach(c => members.push(toMember(c, members.map(m => m.id))));
  const purse = gold != null ? gold : list.reduce((sum, c) => sum + (Number(c.gold) || 0), 0);
  return { members, activeId: members[0]?.id || null, gold: roundCoins(Math.max(0, purse)) };
}

/**
 * The party of a campaign saved by any version. Older campaigns have a single
 * `character`: they become a party of one with that hero's gold as the purse.
 * Returns null when there is no character at all.
 */
export function normalizeParty(campaign) {
  const saved = campaign?.party;
  if (saved && Array.isArray(saved.members) && saved.members.some(m => m && typeof m === 'object')) {
    const members = [];
    saved.members.filter(m => m && typeof m === 'object').slice(0, MAX_PARTY)
      .forEach(m => members.push(toMember(m, members.map(x => x.id))));
    const activeId = members.some(m => m.id === saved.activeId) ? saved.activeId : members[0].id;
    // Parties that started apart (see splitParty.js): their groups, checked against the members
    return normalizeSplit({ members, activeId, gold: roundCoins(Math.max(0, Number(saved.gold) || 0)) }, saved);
  }
  const character = campaign?.character;
  if (!character || typeof character !== 'object') return null;
  return createParty([character], { gold: Number(character.gold) || 0 });
}

export const members = party => party?.members || [];
export const memberById = (party, id) => members(party).find(m => m.id === id) || null;

/** A member's sheet with the party's purse as its `gold`. */
export function memberSheet(party, id) {
  const member = memberById(party, id);
  return member ? { ...member, gold: party.gold } : null;
}

/** The member who acts outside combat. */
export const activeSheet = party => memberSheet(party, party?.activeId) || memberSheet(party, members(party)[0]?.id);

/** Every member as a sheet with the purse (for combat, the prompt, the UI). */
export const memberSheets = party => members(party).map(m => ({ ...m, gold: party.gold }));

/**
 * Change one member. `update` is the new sheet or a function (sheet => sheet);
 * the sheet it gets and returns carries the purse in `gold`, which is written
 * back to the party.
 */
export function updateMember(party, id, update) {
  const current = memberSheet(party, id);
  if (!current) return party;
  const next = typeof update === 'function' ? update(current) : update;
  if (!next || next === current) return party;
  const gold = next.gold !== undefined ? roundCoins(Math.max(0, Number(next.gold) || 0)) : party.gold;
  return {
    ...party,
    gold,
    members: party.members.map(m => (m.id === id ? withoutGold({ ...next, id, controlledBy: next.controlledBy || m.controlledBy || LOCAL_CONTROLLER }) : m))
  };
}

/** Change every member with the same function (rests, end of a fight...). */
export const updateEveryone = (party, update) => members(party).reduce((p, m) => updateMember(p, m.id, update), party);

/** Choose who acts outside combat. */
export function setActiveMember(party, id) {
  return memberById(party, id) ? { ...party, activeId: id } : party;
}

/** Put the heroes returned by a fight (encounter.js) back in the party; the purse is kept. */
export function mergeHeroes(party, heroes = []) {
  const byId = new Map((heroes || []).map(h => [h.id, h]));
  return {
    ...party,
    members: party.members.map(m => (byId.has(m.id) ? withoutGold({ ...byId.get(m.id), id: m.id, controlledBy: m.controlledBy }) : m))
  };
}

/** A new member joins (a companion from the story). Their gold stays with them, not in the purse. */
export function addMember(party, character) {
  if (members(party).length >= MAX_PARTY) return { ok: false, error: `El grupo ya tiene ${MAX_PARTY} miembros.` };
  const member = toMember(character, members(party).map(m => m.id));
  return { ok: true, party: { ...party, members: [...party.members, member] }, member };
}

/**
 * A member leaves the party (by the story, or dismissed by the player). They take
 * their own equipment with them; the purse stays. The last member can't leave.
 */
export function removeMember(party, id) {
  const member = memberById(party, id);
  if (!member) return { ok: false, error: 'Ese personaje no está en el grupo.' };
  if (members(party).length <= 1) return { ok: false, error: 'El grupo no puede quedarse sin nadie.' };
  const rest = party.members.filter(m => m.id !== id);
  return { ok: true, party: tidySplit({ ...party, members: rest, activeId: party.activeId === id ? rest[0].id : party.activeId }), member };
}

/** Find a member by name (as Duncan writes it): exact, then by first word. */
export function findMemberByName(party, name) {
  const wanted = String(name || '').trim().toLowerCase();
  if (!wanted) return null;
  const list = members(party);
  return list.find(m => String(m.name || '').toLowerCase() === wanted)
    || list.find(m => String(m.name || '').toLowerCase().split(/\s+/)[0] === wanted.split(/\s+/)[0])
    || null;
}

/**
 * Who a scene effect hits: the names or ids in `targets` (as validated by
 * cleanTargets in dmPrompt.js), "todos" for everyone, or whoever acts
 * (`actorId`) when the list is missing or names nobody of the party.
 * @returns {string[]} member ids
 */
export function resolveTargets(party, targets, actorId) {
  const list = members(party);
  const fallback = list.some(m => m.id === actorId) ? [actorId] : list.slice(0, 1).map(m => m.id);
  if (!Array.isArray(targets) || !targets.length) return fallback;
  if (targets.some(t => String(t).trim().toLowerCase() === 'todos')) return list.map(m => m.id);
  const ids = [...new Set(targets.map(t => (memberById(party, t) || findMemberByName(party, t))?.id).filter(Boolean))];
  return ids.length ? ids : fallback;
}

/**
 * Give an item from one member to another (outside combat). What the giver held
 * or wore is taken off first. Potions stack in the receiver's backpack.
 * @returns {{ ok: true, party, item } | { ok: false, error }}
 */
export function transferItem(party, fromId, toId, itemId) {
  const from = memberById(party, fromId);
  const to = memberById(party, toId);
  if (!from || !to) return { ok: false, error: 'Ese personaje no está en el grupo.' };
  if (fromId === toId) return { ok: false, error: 'Elige a otro miembro del grupo.' };
  const item = (from.inventory || []).find(i => i.id === itemId);
  if (!item) return { ok: false, error: 'Ese objeto no está en su mochila.' };
  let giver = normalizeEquipment(from);
  HANDS.forEach(hand => { if (giver.hands?.[hand] === itemId) giver = unequipHand(giver, hand); });
  if (isWorn(giver, itemId)) giver = setWornArmor(giver, null).character;
  giver = normalizeEquipment({ ...giver, inventory: giver.inventory.filter(i => i.id !== itemId) });
  // A fresh id so it can't collide with the receiver's own items
  const moved = clone(item);
  const taken = new Set((to.inventory || []).map(i => i.id));
  if (taken.has(moved.id)) moved.id = `${moved.id}_${newMemberId().slice(3)}`;
  const receiver = normalizeEquipment({ ...to, inventory: addItem(to.inventory || [], moved) });
  return {
    ok: true,
    item,
    party: { ...party, members: party.members.map(m => (m.id === fromId ? withoutGold(giver) : m.id === toId ? withoutGold(receiver) : m)) }
  };
}

/** The level a new companion joins at: the party's average, rounded down (at least 1). */
export function partyLevel(party) {
  const list = members(party);
  if (!list.length) return 1;
  return Math.max(1, Math.floor(list.reduce((sum, m) => sum + characterLevel(m), 0) / list.length));
}

/**
 * Share experience between the members who took part (in a fight: everyone who
 * was in it, unconscious ones included). Each gets the total divided by how many
 * share it, rounded down.
 * @returns {{ party, share, ready: string[] }}  ready: names of who can now go up a level
 */
export function splitXp(party, total, participantIds = null) {
  const ids = (participantIds || members(party).map(m => m.id)).filter(id => memberById(party, id));
  const amount = Math.max(0, Math.round(Number(total) || 0));
  if (!ids.length || amount <= 0) return { party, share: 0, ready: [] };
  const share = Math.floor(amount / ids.length);
  if (share <= 0) return { party, share: 0, ready: [] };
  const ready = [];
  let next = party;
  ids.forEach(id => {
    const before = memberById(next, id);
    const after = addXp(before, share);
    if (!canLevelUp(before) && canLevelUp(after)) ready.push(after.name);
    next = { ...next, members: next.members.map(m => (m.id === id ? after : m)) };
  });
  return { party: next, share, ready };
}

/** Members who can go up a level now. */
export const readyToLevel = party => members(party).filter(canLevelUp);

/**
 * Short summary of the other members for Duncan's prompt (the acting one gets the full sheet).
 * "Brena (Humana Guerrera nivel 2, 14/18 PG, CA 16, envenenada)"
 */
export function describeCompanions(party, actingId, describeConditions = () => '') {
  return members(party)
    .filter(m => m.id !== actingId)
    .map(m => {
      const conditions = describeConditions(m);
      const down = (Number(m.hp) || 0) <= 0 ? ', inconsciente' : '';
      return `${m.name} (${[m.race, m.className || String(m.class || '').replace(/\s*\(Nivel \d+\)/i, '')].filter(Boolean).join(' ')} nivel ${characterLevel(m)}, ${m.hp}/${m.maxHp} PG, CA ${m.ac}${down}${conditions ? `; ${conditions}` : ''})`;
    })
    .join('; ');
}

/** "4 po" etc. for the purse (shown in the party header). */
export const describePurse = party => formatCoins(party?.gold || 0);

/** Who controls each member (for a future online game, today always local). */
export const controllerOf = (party, id) => memberById(party, id)?.controlledBy || LOCAL_CONTROLLER;
