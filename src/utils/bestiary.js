// Bestiary helpers: looking up creatures, encounter difficulty and suggested
// encounters for the hero's level and the world being played.

import { MONSTERS } from '../data/monsters';

export { MONSTERS };
export const getMonster = id => MONSTERS.find(m => m.id === id) || null;

/**
 * XP budget of an encounter for one character, by level: [low, moderate, high]
 * (the encounter-building guideline of the 2024 rules).
 */
export const XP_BUDGET = {
  1: [50, 75, 100], 2: [100, 150, 200], 3: [150, 225, 400], 4: [250, 375, 500], 5: [500, 750, 1100],
  6: [600, 1000, 1400], 7: [750, 1300, 1700], 8: [1000, 1700, 2100], 9: [1300, 2000, 2600], 10: [1600, 2300, 3100],
  11: [1900, 2900, 4100], 12: [2200, 3700, 4700], 13: [2600, 4200, 5400], 14: [2900, 4900, 6200], 15: [3300, 5400, 7800],
  16: [3800, 6100, 9800], 17: [4500, 7200, 11700], 18: [5000, 8700, 14200], 19: [5500, 10700, 17200], 20: [6400, 13200, 22000]
};

export const DIFFICULTIES = [
  { id: 'low', name: 'Fácil', index: 0 },
  { id: 'moderate', name: 'Moderado', index: 1 },
  { id: 'high', name: 'Difícil', index: 2 }
];

const budgetFor = level => XP_BUDGET[Math.min(20, Math.max(1, Number(level) || 1))];

/** Total XP of an encounter: [{ monster, count }]. */
export const encounterXp = groups => groups.reduce((sum, g) => sum + (g.monster?.xp || 0) * (g.count || 1), 0);

/** How hard an encounter is for a hero of this level. */
export function difficultyOf(level, xp) {
  const [low, moderate, high] = budgetFor(level);
  if (xp <= 0) return { id: 'none', name: 'Sin enemigos' };
  if (xp < low * 0.5) return { id: 'trivial', name: 'Trivial' };
  if (xp <= low) return { id: 'low', name: 'Fácil' };
  if (xp <= moderate) return { id: 'moderate', name: 'Moderado' };
  if (xp <= high) return { id: 'high', name: 'Difícil' };
  if (xp <= high * 1.5) return { id: 'deadly', name: 'Mortal' };
  return { id: 'suicidal', name: 'Suicida' };
}

/** Where each preset world's encounters come from. Custom worlds use every creature. */
export const WORLD_TAGS = {
  oakhaven: ['bosque', 'taberna', 'ruinas', 'pantano'],
  'cinder-citadel': ['montaña', 'subterráneo', 'ciudad', 'planos'],
  'neon-2099': ['ciudad', 'taberna', 'subterráneo'],
  'sunken-abyss': ['mar', 'costa', 'ruinas']
};

const formatCr = cr => (cr === 0.125 ? '1/8' : cr === 0.25 ? '1/4' : cr === 0.5 ? '1/2' : String(cr));
export { formatCr };

/**
 * Creatures matching a search, for the manual encounter builder.
 * @param {{ text?: string, maxCr?: number, tags?: string[] }} filters
 */
export function searchMonsters({ text = '', maxCr = Infinity, tags = null } = {}) {
  const query = text.trim().toLowerCase();
  return MONSTERS
    .filter(m => m.cr <= maxCr)
    .filter(m => !query || m.name.toLowerCase().includes(query) || m.type.includes(query))
    .filter(m => !tags || tags.length === 0 || (m.tags || []).some(t => tags.includes(t)))
    .sort((a, b) => a.cr - b.cr || a.name.localeCompare(b.name, 'es'));
}

/**
 * A random encounter for the hero: one kind of creature (sometimes with a
 * stronger one leading them) that fits the XP budget of the difficulty.
 * @returns {{ monster, count }[]}
 */
export function suggestEncounter(level, { difficulty = 'moderate', tags = null, rng = Math.random } = {}) {
  const index = DIFFICULTIES.find(d => d.id === difficulty)?.index ?? 1;
  const budget = budgetFor(level)[index];
  const pool = tags ? MONSTERS.filter(m => (m.tags || []).some(t => tags.includes(t))) : MONSTERS;
  const usable = (pool.length >= 5 ? pool : MONSTERS).filter(m => m.xp > 0 && m.xp <= budget);
  if (usable.length === 0) return [];

  // Prefer creatures that show up in groups of 1 to 6
  const fitting = usable.filter(m => m.xp >= budget / 6);
  const candidates = fitting.length ? fitting : usable;
  const main = candidates[Math.floor(rng() * candidates.length)];
  const count = Math.max(1, Math.min(6, Math.floor(budget / main.xp)));
  const groups = [{ monster: main, count }];

  // Room left for a single stronger creature of the same kind of place?
  const left = budget - main.xp * count;
  const leaders = usable.filter(m => m.id !== main.id && m.xp <= left && m.xp > main.xp && m.type === main.type);
  if (leaders.length && rng() < 0.5) {
    groups.unshift({ monster: leaders[Math.floor(rng() * leaders.length)], count: 1 });
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Encounters started by the Dungeon Master (AI or local engine)
// ---------------------------------------------------------------------------

export const MAX_CANDIDATES = 14;
export const MAX_PER_GROUP = 6;
const NAME_MAX = 40;
const TRAIT_MAX = 90;

/**
 * A short list of creatures that suit the hero's level and the world, sent to
 * the Dungeon Master so it can start fights with real stat blocks (kept short
 * to save tokens). Also returns the XP budgets used to size the fight.
 * @returns {{ creatures: {id, name, cr, xp, type}[], budget: { low, moderate, high } }}
 */
export function encounterCandidates(level, { tags = null, rng = Math.random } = {}) {
  const [low, moderate, high] = budgetFor(level);
  const inWorld = tags ? MONSTERS.filter(m => (m.tags || []).some(t => tags.includes(t))) : MONSTERS;
  const pool = (inWorld.length >= 6 ? inWorld : MONSTERS).filter(m => m.xp > 0 && m.xp <= high && m.xp >= low / 8);
  // Spread the picks over the whole CR range instead of only the weakest
  const sorted = [...pool].sort((a, b) => a.cr - b.cr || rng() - 0.5);
  const step = Math.max(1, sorted.length / MAX_CANDIDATES);
  const picks = [];
  for (let i = 0; i < sorted.length && picks.length < MAX_CANDIDATES; i += step) picks.push(sorted[Math.floor(i)]);
  return {
    creatures: [...new Set(picks)].map(m => ({ id: m.id, name: m.name, cr: m.cr, xp: m.xp, type: m.type })),
    budget: { low, moderate, high }
  };
}

/** A tougher, named version of a creature: more HP, +1 to hit, more XP. */
export function eliteVersion(monster) {
  return {
    ...monster,
    hp: Math.round(monster.hp * 1.5),
    xp: Math.round(monster.xp * 1.5),
    actions: monster.actions.map(a => (a.kind === 'save' ? { ...a, dc: a.dc + 1 } : { ...a, bonus: a.bonus + 1 }))
  };
}

const cleanText = (value, max) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '');

/**
 * Turn the Dungeon Master's request ({ enemigos: [{ id, cantidad, nombre?, rasgo?, elite? }] })
 * into encounter groups. Unknown creatures are dropped; counts are clamped and the
 * total is trimmed to a "deadly" budget for a solo hero. Named creatures come alone.
 * @returns {{ monster, count, name?, trait?, elite? }[]} (empty if nothing usable)
 */
export function resolveCombatRequest(request, level) {
  const list = Array.isArray(request?.enemigos) ? request.enemigos : [];
  const cap = budgetFor(level)[2] * 1.5;
  const groups = [];
  list.slice(0, 4).forEach(entry => {
    const base = getMonster(entry?.id);
    if (!base) return;
    const name = cleanText(entry.nombre, NAME_MAX);
    const elite = entry.elite === true;
    const monster = elite ? eliteVersion(base) : base;
    const count = name ? 1 : Math.max(1, Math.min(MAX_PER_GROUP, Math.round(Number(entry.cantidad) || 1)));
    groups.push({ monster, count, ...(name ? { name } : {}), ...(cleanText(entry.rasgo, TRAIT_MAX) ? { trait: cleanText(entry.rasgo, TRAIT_MAX) } : {}), ...(elite ? { elite } : {}) });
  });
  // Too much for one hero: remove creatures from the biggest groups first, keep at least one
  const total = () => encounterXp(groups);
  while (total() > cap && groups.reduce((n, g) => n + g.count, 0) > 1) {
    const biggest = groups.reduce((best, g) => (g.count > 1 && (!best || g.monster.xp * g.count > best.monster.xp * best.count) ? g : best), null);
    if (biggest) biggest.count -= 1;
    else groups.splice(groups.findIndex(g => g === groups.reduce((a, b) => (a.monster.xp >= b.monster.xp ? a : b))), 1);
  }
  return groups;
}
