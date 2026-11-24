// Combat simulator: practice fights with the campaign's own combat engine,
// on copies. Nothing here reads or writes saved campaigns and nothing calls
// the AI: the functions take a hero and enemy groups and return new objects.
//
// - Heroes: a copy of a saved one, a preset, or a quick hero of a class and
//   level (built like "Héroe al azar" and levelled up with simple choices),
//   then adjusted (HP, hands, armor, potions, spell slots, prepared spells,
//   starting conditions, level).
// - A fight summary from the log (rounds, damage, potions, spells, conditions).
// - "Simular N veces": an AI plays the heroes (weapons, cantrips, spells with
//   slots, healing and control; see simulatorAI.js) and the win rate is
//   reported, with how the AI played, to balance encounters.

import {
  createEncounter, runEnemyTurns, playerAction, isPlayerTurn, currentHeroUid, PLAYER, addOpening, openingPending
} from './encounter';
import { detectOpeningStrike } from './surprise';
import { slotTable, getSpell } from './spellcasting';
import { autoAction, bestAttack } from './simulatorAI';
import { normalizeEquipment } from './equipment';
import { normalizeConditions, createCondition, addCondition, removeConditions, conditionName, EXHAUSTION_MAX } from './conditions';
import { healingDice, potionForItem, makeItem, addItem } from './items';
import { buildCharacter, randomDraft } from './characterBuilder';
import { levelHeroTo, quickLevelUpChoices } from './leveling';

export { levelHeroTo, quickLevelUpChoices };

const clone = value => JSON.parse(JSON.stringify(value));

/** A copy of a hero ready for the simulator (the original is never touched). */
export function simulatorHero(character) {
  const copy = clone(character);
  return normalizeEquipment({ ...copy, conditions: normalizeConditions(copy.conditions) });
}

// ---------------------------------------------------------------------------
// Quick heroes and levels
// ---------------------------------------------------------------------------

/** A random hero of this class (built like "Héroe al azar"), at this level. */
export function quickHero({ classId, level = 1, rng = Math.random }) {
  let draft = null;
  for (let i = 0; i < 400; i++) {
    const candidate = randomDraft(rng);
    if (!classId || candidate.classId === classId) { draft = candidate; break; }
  }
  if (!draft) throw new Error('No se pudo crear el héroe de esa clase.');
  return simulatorHero(levelHeroTo(buildCharacter(draft, { id: `sim_${Date.now()}` }), level));
}

// ---------------------------------------------------------------------------
// Adjustments before a fight
// ---------------------------------------------------------------------------

export const setHp = (hero, hp) => ({ ...hero, hp: Math.max(1, Math.min(hero.maxHp, Math.round(Number(hp) || 1))) });

/** Potions of healing of this kind (uses of every stack). */
export function potionCount(hero, potionId = 'healing') {
  return (hero.inventory || [])
    .filter(i => potionForItem(i)?.id === potionId && healingDice(i))
    .reduce((sum, i) => sum + (i.uses === undefined ? 1 : Number(i.uses) || 0), 0);
}

/** Exactly `count` potions of this kind in the backpack (one stack). */
export function setPotions(hero, potionId, count) {
  const n = Math.max(0, Math.min(20, Math.round(Number(count) || 0)));
  const rest = (hero.inventory || []).filter(i => potionForItem(i)?.id !== potionId);
  if (n === 0) return { ...hero, inventory: rest };
  const item = makeItem(`potion:${potionId}`, { id: `sim_potion_${potionId}` });
  return { ...hero, inventory: addItem(rest, { ...item, uses: n }) };
}

/** Add a weapon or armor from the SRD catalog ("weapon:longsword", "armor:chainMail"). */
export function addCatalogItem(hero, key) {
  const item = makeItem(key, { id: `sim_${key.replace(':', '_')}_${(hero.inventory || []).length}` });
  if (!item) return hero;
  return normalizeEquipment({ ...hero, inventory: [...(hero.inventory || []), item] });
}

/** Spell slots of one level already spent. */
export function setSlotsUsed(hero, level, used) {
  const casting = hero.spellcasting;
  const rows = slotTable(casting);
  if (!rows.some(r => r.level === Number(level))) return hero;
  const levels = Object.fromEntries(rows.map(r => [r.level, {
    max: r.max,
    used: r.level === Number(level) ? Math.max(0, Math.min(r.max, Math.round(Number(used) || 0))) : r.used
  }]));
  return { ...hero, spellcasting: { ...casting, slots: { recovery: casting.slots.recovery || 'long', levels } } };
}

/** Prepare or unprepare a known spell (cantrips and always-prepared spells stay). */
export function setPrepared(hero, spellId, prepared) {
  const casting = hero.spellcasting;
  if (!casting) return hero;
  return {
    ...hero,
    spellcasting: { ...casting, known: casting.known.map(k => (k.id === spellId && getSpell(k.id)?.level > 0 && !k.freeCast ? { ...k, prepared: Boolean(prepared) } : k)) }
  };
}

/** Conditions the hero can start a practice fight with (they last the whole fight). */
export const START_CONDITIONS = [
  { id: 'envenenado', spec: { id: 'envenenado', duration: { rest: 'long' } } },
  { id: 'cegado', spec: { id: 'cegado', duration: { rest: 'long' } } },
  { id: 'ensordecido', spec: { id: 'ensordecido', duration: { rest: 'long' } } },
  { id: 'asustado', spec: { id: 'asustado', duration: { rest: 'long' } } },
  { id: 'derribado', spec: { id: 'derribado' } },
  { id: 'invisible', spec: { id: 'invisible', duration: { rest: 'long' }, endsOnAttack: true } },
  { id: 'agotamiento', spec: { id: 'agotamiento', duration: { rest: 'long' } } }
].map(c => ({ ...c, name: conditionName(c.id) }));

/** Turn a starting condition on or off (`level` for Exhaustion, 1-5). */
export function setStartCondition(hero, id, on, level = 1) {
  const entry = START_CONDITIONS.find(c => c.id === id);
  if (!entry) return hero;
  const without = removeConditions(hero, c => c.id === id).creature;
  if (!on) return without;
  const spec = id === 'agotamiento' ? { ...entry.spec, level: Math.max(1, Math.min(EXHAUSTION_MAX - 1, Number(level) || 1)) } : entry.spec;
  return addCondition(without, createCondition(spec, { targetUid: PLAYER })).creature;
}

// ---------------------------------------------------------------------------
// Fights (one hero or a party of up to four)
// ---------------------------------------------------------------------------

export const MAX_SIM_PARTY = 4;
const asList = party => (Array.isArray(party) ? party : [party]).filter(Boolean).slice(0, MAX_SIM_PARTY);

/**
 * Copies of the heroes for a practice fight, each with a unique id (two copies
 * of the same hero, or quick heroes made in the same instant, would share one).
 */
export function simulatorParty(party) {
  const taken = new Set();
  return asList(party).map((hero, index) => {
    const copy = simulatorHero(hero);
    let id = copy.id || `sim_hero_${index}`;
    while (taken.has(id)) id = `${id}_${index}`;
    taken.add(id);
    return { ...copy, id };
  });
}

/** Surprise options of the simulator: nobody, the party surprises the enemies, or an ambush on the party. */
export const SIM_SURPRISE = [
  { id: 'none', label: 'Sin sorpresa' },
  { id: 'enemies', label: 'A favor: el grupo sorprende (golpe de apertura)' },
  { id: 'heroes', label: 'En contra: emboscada al grupo' }
];

/**
 * Start a practice fight (the enemies that won initiative act first).
 * @param {object | object[]} party  one hero or up to four
 * @param {{ surprise?: 'none' | 'enemies' | 'heroes' }} [options]
 *   'enemies': every enemy is surprised and the first hero plays an opening
 *   strike before the initiative (chosen in the combat view); 'heroes': the whole party is ambushed
 * @returns {{ encounter, heroes, character }}
 */
export function startSimulation(party, groups, rollDie, { surprise = 'none' } = {}) {
  const heroes = Array.isArray(party) ? simulatorParty(party) : simulatorHero(party);
  const side = ['enemies', 'heroes'].includes(surprise) ? surprise : null;
  let encounter = { ...createEncounter(groups, heroes, rollDie, { surprise: side ? { side } : null }), simulation: true };
  // The first hero opens; the weapon in hand and a lone target come preselected
  if (side === 'enemies') encounter = addOpening(encounter, heroes, detectOpeningStrike('', heroes[0], encounter.enemies) || { heroUid: heroes[0]?.id || PLAYER });
  if (openingPending(encounter)) return { encounter, heroes, character: heroes[0] };
  return runEnemyTurns(encounter, heroes, rollDie);
}

const potionUses = hero => (hero.inventory || []).filter(i => healingDice(i)).reduce((s, i) => s + (i.uses === undefined ? 1 : Number(i.uses) || 0), 0);
const slotsUsed = hero => slotTable(hero.spellcasting).reduce((s, r) => s + r.used, 0);
const sum = (list, fn) => list.reduce((total, x) => total + fn(x), 0);

/**
 * What happened in a finished (or ongoing) fight.
 * @param startParty / endParty  the hero (or heroes) at the start and at the end
 * @returns {{ status, rounds, dealt, taken, potions, slots, spells: string[], conditions: string[], enemies, hpLeft, heroes }}
 */
export function fightSummary(encounter, startParty, endParty) {
  const start = asList(startParty);
  const end = asList(endParty);
  const log = encounter.log || [];
  const ids = new Set([...end.map(h => h.id || PLAYER), PLAYER]);
  const spells = [...new Set(end.flatMap(hero => log
    .filter(e => e.text?.startsWith(`${hero.name} lanza `))
    .map(e => e.text.slice(hero.name.length + 7).split(/ sobre |: |\.\s|\.$/)[0])))];
  const conditions = [...new Set(log.filter(e => e.kind === 'condition' && e.change === 'add' && ids.has(e.target)).map(e => conditionName(e.condition)))];
  const startOf = hero => start.find(h => (h.id || PLAYER) === (hero.id || PLAYER)) || hero;
  return {
    status: encounter.status,
    rounds: encounter.round,
    dealt: encounter.enemies.reduce((total, e) => total + Math.max(0, e.maxHp - Math.max(0, e.hp)), 0),
    taken: log.reduce((total, e) => total + (Number(e.playerDamage) || 0), 0),
    potions: Math.max(0, sum(start, potionUses) - sum(end, potionUses)),
    slots: Math.max(0, sum(end, slotsUsed) - sum(start, slotsUsed)),
    spells,
    conditions,
    hpLeft: Math.max(0, end[0]?.hp || 0),
    heroes: end.map(h => ({ name: h.name, avatar: h.avatar, hp: Math.max(0, h.hp), maxHp: h.maxHp, taken: log.filter(e => e.target === (h.id || PLAYER)).reduce((t, e) => t + (Number(e.playerDamage) || 0), 0), potionsUsed: Math.max(0, potionUses(startOf(h)) - potionUses(h)) })),
    enemies: encounter.enemies.map(e => ({ name: e.name, status: e.status, hp: Math.max(0, e.hp), maxHp: e.maxHp }))
  };
}

// ---------------------------------------------------------------------------
// The heroes' AI ("Simular N veces", see simulatorAI.js)
// ---------------------------------------------------------------------------

export { autoAction, bestAttack };

/**
 * Play a whole fight with the AI.
 * @returns {{ encounter, heroes, character, ai }}
 *   ai: how it played: { casts: { [spellName]: times }, slots, heals, revives, controls }
 */
export function autoFight(party, groups, rollDie, options = {}) {
  const single = !Array.isArray(party);
  let { encounter, heroes } = startSimulation(party, groups, rollDie, { surprise: options.surprise });
  const ai = { casts: {}, slots: 0, heals: 0, revives: 0, controls: 0 };
  let guard = 0;
  while (encounter.status === 'active' && guard++ < 800) {
    if (!isPlayerTurn(encounter)) break;
    const uid = currentHeroUid(encounter);
    const hero = heroes.find(h => (h.id || PLAYER) === uid) || heroes[0];
    const input = single ? heroes[0] : heroes;
    const action = autoAction(encounter, hero, { ...options, allies: heroes });
    let result = playerAction(encounter, input, action, rollDie);
    if (result.ok && action.type === 'spell') {
      const after = result.heroes.find(h => (h.id || PLAYER) === uid) || result.heroes[0];
      const name = getSpell(action.spellId)?.name || action.spellId;
      ai.casts[name] = (ai.casts[name] || 0) + 1;
      ai.slots += Math.max(0, slotsUsed(after) - slotsUsed(hero));
      if (action.ai === 'heal') ai.heals += 1;
      if (action.ai === 'revive') ai.revives += 1;
      if (action.ai === 'control') ai.controls += 1;
    }
    // An action the engine refuses (charmed, wrong target...): dodge, or end the turn
    if (!result.ok) result = playerAction(encounter, input, { type: encounter.actionUsed ? 'endTurn' : 'dodge' }, rollDie);
    if (!result.ok) result = playerAction(encounter, input, { type: 'endTurn' }, rollDie);
    if (!result.ok) break;
    ({ encounter, heroes } = result);
  }
  if (encounter.status === 'active') encounter = { ...encounter, status: 'timeout' };
  return { encounter, heroes, character: heroes[0], ai };
}

/** A die from a random number generator. */
export const dieFrom = rng => sides => 1 + Math.floor(rng() * sides);

/**
 * Fight the same encounter `runs` times with the AI.
 * @param {object | object[]} party  one hero or up to four
 * @param {{ useSlots?: boolean }} [options]  useSlots: false = the old AI (weapons and cantrips only)
 * @returns {{ runs, victory, defeat, fled, timeout, winRate, avgRounds, avgHpLeft, avgPotions, avgFallen, ai }}
 *   avgHpLeft: share of the party's HP left after a victory; avgFallen: heroes at 0 HP at the end of a victory;
 *   ai: how the AI played, per fight on average:
 *   { topSpells: [{ name, perFight }] (up to 3), avgCasts, avgSlots, avgHeals, avgRevives, avgControls }
 */
export function simulateMany(party, groups, runs = 100, { rng = Math.random, healBelow = 0.35, surprise = 'none', useSlots = true } = {}) {
  const n = Math.max(1, Math.min(1000, Math.round(Number(runs) || 1)));
  const rollDie = dieFrom(rng);
  const totals = { victory: 0, defeat: 0, fled: 0, timeout: 0, rounds: 0, hpLeft: 0, potions: 0, fallen: 0, slots: 0, heals: 0, revives: 0, controls: 0 };
  const casts = {};
  for (let i = 0; i < n; i++) {
    const start = Array.isArray(party) ? simulatorParty(party) : simulatorHero(party);
    const { encounter, heroes: end, ai } = autoFight(start, groups, rollDie, { healBelow, surprise, useSlots });
    Object.entries(ai.casts).forEach(([name, times]) => { casts[name] = (casts[name] || 0) + times; });
    ['slots', 'heals', 'revives', 'controls'].forEach(key => { totals[key] += ai[key]; });
    totals[encounter.status] = (totals[encounter.status] || 0) + 1;
    totals.rounds += encounter.round;
    if (encounter.status === 'victory') {
      totals.hpLeft += sum(end, h => Math.max(0, h.hp)) / Math.max(1, sum(end, h => h.maxHp));
      totals.fallen += end.filter(h => h.hp <= 0).length;
    }
    totals.potions += Math.max(0, sum(asList(start), potionUses) - sum(end, potionUses));
  }
  return {
    runs: n,
    victory: totals.victory,
    defeat: totals.defeat,
    fled: totals.fled,
    timeout: totals.timeout,
    winRate: totals.victory / n,
    avgRounds: totals.rounds / n,
    avgHpLeft: totals.victory ? totals.hpLeft / totals.victory : 0,
    avgPotions: totals.potions / n,
    avgFallen: totals.victory ? totals.fallen / totals.victory : 0,
    ai: {
      topSpells: Object.entries(casts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, times]) => ({ name, perFight: times / n })),
      avgCasts: Object.values(casts).reduce((a, b) => a + b, 0) / n,
      avgSlots: totals.slots / n,
      avgHeals: totals.heals / n,
      avgRevives: totals.revives / n,
      avgControls: totals.controls / n
    }
  };
}
