// Snapshots of the start of each fight of a campaign, so any of them (a lost
// one above all) can be fought again in the combat simulator.
//
// A snapshot is plain data saved with the campaign (`campaign.combatSnapshots`,
// newest first, at most MAX_SNAPSHOTS): a copy of the hero as it was when the
// fight started (sheet, inventory, potions, spell slots, conditions, limbs)
// and the enemy groups by bestiary id (with their elite flag, name and trait),
// plus when and where it happened and how it ended. Pure functions.

export const MAX_SNAPSHOTS = 10;

export const RESULT_LABELS = {
  victory: 'Victoria',
  defeat: 'Derrota',
  fled: 'Huida',
  timeout: 'Sin final'
};

const clone = value => JSON.parse(JSON.stringify(value));

export const newSnapshotId = () => `fight_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** Encounter groups ({ monster, count, name?, trait?, elite? }) as data that only names the creatures. */
export function groupsToData(groups = []) {
  return groups
    .filter(g => g?.monster?.id || g?.monsterId)
    .map(g => ({
      monsterId: g.monster?.id || g.monsterId,
      monsterName: g.monster?.name || g.monsterName || g.monster?.id || g.monsterId,
      count: Math.max(1, Math.round(Number(g.count) || 1)),
      ...(g.name ? { name: String(g.name) } : {}),
      ...(g.trait ? { trait: String(g.trait) } : {}),
      ...(g.elite ? { elite: true } : {})
    }));
}

/**
 * Turn group data back into encounter groups with real stat blocks.
 * `getMonster` and `eliteVersion` come from the bestiary (loaded on demand).
 * Creatures the bestiary no longer knows are dropped.
 */
export function groupsFromData(data = [], { getMonster, eliteVersion }) {
  return (Array.isArray(data) ? data : []).flatMap(g => {
    const base = getMonster(g?.monsterId);
    if (!base) return [];
    return [{
      monster: g.elite ? eliteVersion(base) : base,
      count: Math.max(1, Math.round(Number(g.count) || 1)),
      ...(g.name ? { name: g.name } : {}),
      ...(g.trait ? { trait: g.trait } : {}),
      ...(g.elite ? { elite: true } : {})
    }];
  });
}

/** Short list of the enemies: "2 × Goblin, Grak (Osgo, élite)". */
export function describeGroups(data = []) {
  return (Array.isArray(data) ? data : []).map(g => {
    const label = g.monsterName || g.monsterId;
    const named = g.name ? `${g.name} (${label}${g.elite ? ', élite' : ''})` : `${label}${g.elite ? ' (élite)' : ''}`;
    return g.count > 1 ? `${g.count} × ${named}` : named;
  }).join(', ');
}

/**
 * A snapshot of the start of a fight.
 * @param {{ character, groups, world?, place?, byDuncan?, date?, id? }} input
 */
export function makeSnapshot({ character, groups, world = null, place = '', byDuncan = false, date = new Date().toISOString(), id = newSnapshotId() }) {
  return {
    id,
    date,
    place: place || '',
    worldId: world?.id || null,
    worldName: world?.name || '',
    byDuncan: Boolean(byDuncan),
    heroName: character?.name || 'Héroe',
    level: Number(character?.level) || 1,
    character: clone(character),
    groups: groupsToData(groups),
    result: null,
    rounds: null
  };
}

/** Add a snapshot (newest first) and keep the last `max`. */
export function addSnapshot(list, snapshot, max = MAX_SNAPSHOTS) {
  return [snapshot, ...normalizeSnapshots(list).filter(s => s.id !== snapshot.id)].slice(0, max);
}

/** Record how the fight of a snapshot ended. */
export function setSnapshotResult(list, id, { status, round }) {
  if (!id) return normalizeSnapshots(list);
  return normalizeSnapshots(list).map(s => (s.id === id
    ? { ...s, result: RESULT_LABELS[status] ? status : null, rounds: Number(round) || null }
    : s));
}

/** Snapshots of a campaign saved by any version (older saves have none). */
export function normalizeSnapshots(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter(s => s && typeof s === 'object' && s.character && typeof s.character === 'object' && Array.isArray(s.groups) && s.groups.length > 0)
    .map(s => ({
      ...s,
      id: s.id || newSnapshotId(),
      date: s.date || null,
      place: s.place || '',
      heroName: s.heroName || s.character.name || 'Héroe',
      level: Number(s.level || s.character.level) || 1,
      result: RESULT_LABELS[s.result] ? s.result : null,
      rounds: Number(s.rounds) || null
    }))
    .slice(0, MAX_SNAPSHOTS);
}

/** Every snapshot of these campaigns, newest first, with the campaign it belongs to. */
export function recentFights(campaigns = []) {
  return campaigns
    .flatMap(c => normalizeSnapshots(c?.combatSnapshots).map(s => ({ ...s, campaignId: c.id, campaignTitle: c.title || '' })))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}
