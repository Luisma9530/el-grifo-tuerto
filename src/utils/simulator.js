// Combat simulator: practice fights with the campaign's own combat engine,
// on copies. Nothing here reads or writes saved campaigns and nothing calls
// the AI: the functions take a hero and enemy groups and return new objects.
//
// - Heroes: a copy of a saved one, a preset, or a quick hero of a class and
//   level (built like "Héroe al azar" and levelled up with simple choices),
//   then adjusted (HP, hands, armor, potions, spell slots, prepared spells,
//   starting conditions, level).
// - A fight summary from the log (rounds, damage, potions, spells, conditions).
// - "Simular N veces": a simple AI plays the hero (heal below a threshold,
//   otherwise the best attack against the weakest enemy) and the win rate is
//   reported, to balance encounters.

import { createEncounter, runEnemyTurns, playerAction, activeEnemies, isPlayerTurn, escapableCondition, PLAYER } from './encounter';
import { attackOptions } from './combat';
import { spellRows, slotTable, parseDice, cantripDiceMultiplier, getSpell } from './spellcasting';
import { normalizeEquipment } from './equipment';
import { normalizeConditions, createCondition, addCondition, removeConditions, conditionsOf, conditionName, EXHAUSTION_MAX } from './conditions';
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
// Fights
// ---------------------------------------------------------------------------

/**
 * Start a practice fight (the enemies that won initiative act first).
 * @returns {{ encounter, character }}
 */
export function startSimulation(character, groups, rollDie) {
  const hero = simulatorHero(character);
  const encounter = { ...createEncounter(groups, hero, rollDie), simulation: true };
  return runEnemyTurns(encounter, hero, rollDie);
}

const potionUses = hero => (hero.inventory || []).filter(i => healingDice(i)).reduce((s, i) => s + (i.uses === undefined ? 1 : Number(i.uses) || 0), 0);
const slotsUsed = hero => slotTable(hero.spellcasting).reduce((s, r) => s + r.used, 0);

/**
 * What happened in a finished (or ongoing) fight.
 * @returns {{ status, rounds, dealt, taken, potions, slots, spells: string[], conditions: string[], enemies }}
 */
export function fightSummary(encounter, startHero, endHero) {
  const name = endHero?.name || startHero?.name || '';
  const log = encounter.log || [];
  const spells = log
    .filter(e => e.text?.startsWith(`${name} lanza `))
    .map(e => e.text.slice(name.length + 7).split(/ sobre |: |\.\s|\.$/)[0]);
  const conditions = [...new Set(log.filter(e => e.kind === 'condition' && e.change === 'add' && e.target === PLAYER).map(e => conditionName(e.condition)))];
  return {
    status: encounter.status,
    rounds: encounter.round,
    dealt: encounter.enemies.reduce((sum, e) => sum + Math.max(0, e.maxHp - Math.max(0, e.hp)), 0),
    taken: log.reduce((sum, e) => sum + (Number(e.playerDamage) || 0), 0),
    potions: Math.max(0, potionUses(startHero) - potionUses(endHero)),
    slots: Math.max(0, slotsUsed(endHero) - slotsUsed(startHero)),
    spells,
    conditions,
    hpLeft: Math.max(0, endHero.hp),
    enemies: encounter.enemies.map(e => ({ name: e.name, status: e.status, hp: Math.max(0, e.hp), maxHp: e.maxHp }))
  };
}

// ---------------------------------------------------------------------------
// Simple AI for the hero ("Simular N veces")
// ---------------------------------------------------------------------------

const average = notation => {
  const d = parseDice(notation);
  return d ? d.count * (d.sides + 1) / 2 + d.bonus : 0;
};
const hitChance = (bonus, ac) => Math.max(0.05, Math.min(0.95, (21 - (ac - bonus)) / 20));

/** The best damaging option against this target: a weapon or a cantrip (spell slots are kept). */
export function bestAttack(hero, target) {
  const weapons = attackOptions(hero).map(o => ({
    action: { type: 'attack', optionId: o.id },
    expected: hitChance(o.attackBonus, target.ac) * Math.max(1, average(o.damage) + o.damageBonus)
  }));
  const cantrips = spellRows(hero)
    .filter(s => !s.blocked && s.level === 0 && s.damage && ['attack', 'save', 'auto'].includes(s.kind))
    .map(s => {
      const dmg = average(s.damage) * cantripDiceMultiplier(hero);
      const expected = s.kind === 'attack' ? hitChance(s.attackBonus, target.ac) * dmg : s.kind === 'auto' ? dmg : dmg * 0.55;
      return { action: { type: 'spell', spellId: s.id }, expected };
    });
  return [...weapons, ...cantrips].sort((a, b) => b.expected - a.expected)[0]?.action || null;
}

/**
 * The hero's next move: drink a potion below `healBelow` (share of max HP),
 * break free when held, otherwise hit the weakest enemy with the best option.
 */
export function autoAction(encounter, hero, { healBelow = 0.35 } = {}) {
  const potion = (hero.inventory || []).filter(i => healingDice(i)).sort((a, b) => average(healingDice(a)) - average(healingDice(b)))[0];
  if (!encounter.bonusUsed && potion && hero.hp < hero.maxHp * healBelow) return { type: 'potion', itemId: potion.id };
  if (encounter.actionUsed) return { type: 'endTurn' };
  const target = [...activeEnemies(encounter)].sort((a, b) => a.hp - b.hp)[0];
  if (!target) return { type: 'endTurn' };
  if (escapableCondition(hero) && conditionsOf(hero).some(c => c.id === 'apresado')) return { type: 'escape' };
  const attack = bestAttack(hero, target);
  return attack ? { ...attack, targetUid: target.uid } : { type: 'dodge' };
}

/** Play a whole fight with the simple AI. @returns {{ encounter, character }} */
export function autoFight(character, groups, rollDie, options = {}) {
  let { encounter, character: hero } = startSimulation(character, groups, rollDie);
  let guard = 0;
  while (encounter.status === 'active' && guard++ < 400) {
    if (!isPlayerTurn(encounter)) break;
    let result = playerAction(encounter, hero, autoAction(encounter, hero, options), rollDie);
    // An action the engine refuses (charmed, wrong target...): dodge, or end the turn
    if (!result.ok) result = playerAction(encounter, hero, { type: encounter.actionUsed ? 'endTurn' : 'dodge' }, rollDie);
    if (!result.ok) result = playerAction(encounter, hero, { type: 'endTurn' }, rollDie);
    if (!result.ok) break;
    ({ encounter, character: hero } = result);
  }
  if (encounter.status === 'active') encounter = { ...encounter, status: 'timeout' };
  return { encounter, character: hero };
}

/** A die from a random number generator. */
export const dieFrom = rng => sides => 1 + Math.floor(rng() * sides);

/**
 * Fight the same encounter `runs` times with the simple AI.
 * @returns {{ runs, victory, defeat, fled, timeout, winRate, avgRounds, avgHpLeft, avgPotions }}
 */
export function simulateMany(character, groups, runs = 100, { rng = Math.random, healBelow = 0.35 } = {}) {
  const n = Math.max(1, Math.min(1000, Math.round(Number(runs) || 1)));
  const rollDie = dieFrom(rng);
  const totals = { victory: 0, defeat: 0, fled: 0, timeout: 0, rounds: 0, hpLeft: 0, potions: 0 };
  for (let i = 0; i < n; i++) {
    const start = simulatorHero(character);
    const { encounter, character: end } = autoFight(start, groups, rollDie, { healBelow });
    totals[encounter.status] = (totals[encounter.status] || 0) + 1;
    totals.rounds += encounter.round;
    if (encounter.status === 'victory') totals.hpLeft += Math.max(0, end.hp) / Math.max(1, end.maxHp);
    totals.potions += Math.max(0, potionUses(start) - potionUses(end));
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
    avgPotions: totals.potions / n
  };
}
