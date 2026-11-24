// The heroes' AI of "Simular N veces": a quick player that picks, every turn,
// the move worth the most among weapons, cantrips, spells with slots, healing
// and control. It plays with the same rules (and the same information) as a
// player in the combat view: it reads the numbers the engine uses (attack
// bonus vs AC, save DC vs the creature's save, advantage and disadvantage from
// conditions, creature types a spell can't touch) and sends normal actions to
// `playerAction`. It never peeks at dice.
//
// The criterion, in "damage the party stops taking" units:
//  - Damage: expected damage of the option (chance to hit or to fail the save,
//    criticals, half damage on a save, never more than the enemy's HP left),
//    as a share of the enemy's HP, times what that enemy is worth (the damage
//    it would deal in the rounds the fight has left). So it finishes the enemy
//    it can drop and hits the most dangerous one hardest.
//  - Spell slots cost: a slot spell has to beat the best free option (weapon or
//    cantrip) by the slot's cost. The cost grows with the slot's level and is
//    higher for the hero's top level; it drops when it pays to spend (three or
//    more enemies standing, an enemy with lots of HP, the party in trouble).
//    No slot is spent on an enemy the free option would likely drop.
//  - Healing: a hero at 0 HP first (a potion as a Bonus Action, otherwise a
//    healing spell), then whoever is below the threshold, unless the free
//    option would end the fight.
//  - Control (Hold Person, Sleep, Fear...): turns the enemy loses times its
//    damage per round, times the chance it fails the save. Only against an
//    enemy that is dangerous and not almost dead, with at least a 35 % chance,
//    and never while the hero keeps up a concentration spell that still holds
//    someone (casting another one would end it).

import { activeEnemies, openingPending, escapableCondition, concentrationOf, enemySaveBonus, heroUid } from './encounter';
import { attackOptions, attacksPerAction, sneakAttackDice } from './combat';
import { spellRows, slotTable, parseDice, cantripDiceMultiplier } from './spellcasting';
import { attackModifiers, saveModifiers, d20Mode, conditionsOf, hasCondition } from './conditions';
import { healingDice } from './items';
import { spellConditions, TOUCH_SPELLS } from '../data/spellConditions';

const OFFENSIVE = ['attack', 'save', 'auto'];

// spellRows() sorts by name with the locale on every call: the AI asks many times per
// fight, so the rows are kept while the hero's spellcasting (slots, known spells) and
// numbers stay the same object (every change makes a new one)
const rowsCache = new WeakMap();
function castableRows(hero) {
  const casting = hero.spellcasting;
  if (!casting) return [];
  const hit = rowsCache.get(casting);
  if (hit && hit.stats === hero.stats && hit.pb === hero.proficiencyBonus && hit.level === hero.level && hit.inventory === hero.inventory) return hit.rows;
  const rows = spellRows(hero).filter(s => !s.blocked);
  rowsCache.set(casting, { rows, stats: hero.stats, pb: hero.proficiencyBonus, level: hero.level, inventory: hero.inventory });
  return rows;
}

/** How much a slot of each level costs, and the discounts (see the header). */
export const AI_TUNING = {
  slotCost: 2,         // per slot level
  topSlotFactor: 1.6,  // the hero's highest slot level
  cheapFactor: 0.5,    // it pays to spend: 3+ enemies, a big enemy, the party in trouble
  minControlChance: 0.35,
  maxRounds: 5
};

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

function diceAverage(notation, multiplier = 1, extraDice = 0) {
  const d = parseDice(notation);
  if (!d) return { dice: 0, bonus: 0, total: 0 };
  const count = d.count === 0 ? 0 : d.count * multiplier + extraDice;
  const dice = count * (d.sides + 1) / 2;
  return { dice, bonus: d.bonus, total: dice + d.bonus };
}

const withMode = (p, mode) => (mode === 'advantage' ? 1 - (1 - p) ** 2 : mode === 'disadvantage' ? p * p : p);

/** Chance that a d20 + bonus reaches the AC (a 1 always misses, a 20 always hits). */
export function hitChance(bonus, ac, mode = 'normal') {
  return withMode(clamp((21 - (ac - bonus)) / 20, 0.05, 0.95), mode);
}

/** Chance that the creature succeeds on a saving throw against the DC (as the engine rolls it). */
export function saveChance(creature, ability, dc, extra = {}) {
  const mods = saveModifiers(creature, ability, extra);
  if (mods.autoFail) return 0;
  const bonus = enemySaveBonus(creature, ability) - mods.penalty;
  return withMode(clamp((21 - (dc - bonus)) / 20, 0.05, 0.95), d20Mode(mods));
}

const DISABLED = ['incapacitado', 'paralizado', 'aturdido', 'inconsciente', 'petrificado'];
const isDisabled = enemy => DISABLED.some(id => hasCondition(enemy, id))
  || conditionsOf(enemy).some(c => c.id === 'asustado' && c.flees);

/** Damage an enemy would deal in one round (its Multiattack or best attack) against this AC. */
export function enemyThreat(enemy, ac = 14) {
  if (isDisabled(enemy)) return 0;
  const actions = enemy.actions || [];
  const one = a => {
    const dmg = diceAverage(a.damage).total + (a.extra ? diceAverage(a.extra).total : 0);
    return a.kind === 'save' ? dmg * 0.6 : hitChance(a.bonus || 0, ac) * dmg;
  };
  const multi = (enemy.multiattack || []).map(id => actions.find(a => a.id === id)).filter(Boolean);
  if (multi.length) return multi.reduce((s, a) => s + one(a), 0);
  return actions.reduce((best, a) => Math.max(best, one(a)), 0);
}

// ---------------------------------------------------------------------------
// The options of a hero against one target
// ---------------------------------------------------------------------------

/** The slot a spell would spend (castSpell takes the lowest free one of its level or higher), or null. */
function slotFor(hero, spell) {
  if (spell.level === 0) return { level: 0, upcast: 0, free: true };
  if (spell.freeAvailable) return { level: spell.level, upcast: 0, free: true, freeCast: true };
  const row = slotTable(hero.spellcasting).find(r => r.level >= spell.level && r.left > 0);
  return row ? { level: row.level, upcast: row.level - spell.level, free: false } : null;
}

/**
 * Expected damage of a weapon against a target: every attack of the action,
 * criticals (doubled dice; every hit in melee on a paralyzed or unconscious target),
 * Sneak Attack once, and the chance of a hit as the engine rolls it.
 * @returns {{ expected, onHit, pHit }}
 */
function weaponDamage(hero, option, target) {
  const ranged = option.weapon?.kind === 'ranged';
  const mods = attackModifiers(hero, target, { ranged, targetUid: target.uid });
  if (mods.blocked) return null;
  const p = hitChance(option.attackBonus - mods.penalty, target.ac, d20Mode(mods));
  const pCrit = mods.autoCrit ? p : withMode(0.05, d20Mode(mods));
  const dmg = diceAverage(option.damage);
  const perHit = Math.max(1, dmg.total + option.damageBonus);
  const count = attacksPerAction(hero);
  let expected = count * (p * perHit + pCrit * dmg.dice);
  let onHit = perHit;
  const sneak = sneakAttackDice(hero);
  if (sneak && option.weapon && (option.weapon.properties.includes('finesse') || ranged)) {
    const sneakAvg = sneak * 3.5;
    expected += (1 - (1 - p) ** count) * sneakAvg;
    onHit += sneakAvg;
  }
  return { expected, onHit, pHit: 1 - (1 - p) ** count };
}

/** Expected damage of a damaging spell against a target, or null if it can't be cast on it. */
function spellDamage(hero, spell, target, slot) {
  const effects = spellConditions(spell.id);
  if (effects?.types && !effects.types.includes(target.type)) return null;
  const multiplier = spell.level === 0 ? cantripDiceMultiplier(hero) : 1;
  const dmg = diceAverage(spell.damage, multiplier, slot.upcast);
  if (spell.kind === 'auto') return { expected: dmg.total, onHit: dmg.total, pHit: 1 };
  if (spell.kind === 'attack') {
    const mods = attackModifiers(hero, target, { ranged: !TOUCH_SPELLS.includes(spell.id), targetUid: target.uid });
    if (mods.blocked) return null;
    const p = hitChance(spell.attackBonus - mods.penalty, target.ac, d20Mode(mods));
    const pCrit = mods.autoCrit ? p : withMode(0.05, d20Mode(mods));
    return { expected: p * dmg.total + pCrit * dmg.dice, onHit: dmg.total, pHit: p };
  }
  // A saving throw
  if (attackModifiers(hero, target, { targetUid: target.uid }).blocked) return null;
  const immune = effects?.immuneTypes?.includes(target.type);
  const pSave = immune ? 1 : saveChance(target, spell.save, spell.saveDC, effects?.saveAdvantage ? { advantage: ['x'] } : {});
  const share = (1 - pSave) + pSave * (spell.half ? 0.5 : 0);
  return { expected: dmg.total * share, onHit: dmg.total, pHit: 1 - pSave };
}

// How much of a turn each condition takes from an enemy (1 = it loses the turn)
const CONTROL_WEIGHT = { paralizado: 1, inconsciente: 1, incapacitado: 1, aturdido: 1, asustado: 0.9, cegado: 0.4, apresado: 0.45, derribado: 0.2 };

/** Turns of the enemy's damage a control spell takes away (before the chance of the save). */
function controlTurns(spec, pSave, rounds) {
  const weight = CONTROL_WEIGHT[spec.id] || 0;
  if (!weight) return 0;
  const d = spec.duration;
  let turns = 1;
  if (d && typeof d === 'object' && d.save) turns = Math.min(d.maxRounds || rounds, 1 / Math.max(0.15, pSave));
  else if (d && typeof d === 'object' && d.escape) turns = 1.5;
  else if (d === 'permanent' || d === 'linked') turns = rounds * (spec.endsOnDamage ? 0.5 : 1);
  else if (d && typeof d === 'object' && d.rounds) turns = d.rounds;
  if (spec.thenSave) turns += (1 - pSave) * 2;
  if (spec.flees) turns = Math.min(rounds, turns);
  return weight * Math.min(turns, rounds);
}

/** A control spell against a target: chance it fails the save and the conditions, or null. */
function spellControl(hero, spell, target) {
  const effects = spellConditions(spell.id);
  const specs = spell.kind === 'save' ? effects?.onFail : null;
  if (!specs?.length || spell.damage) return null;
  if (effects.types && !effects.types.includes(target.type)) return null;
  if (effects.immuneTypes?.includes(target.type)) return null;
  if (!specs.some(spec => CONTROL_WEIGHT[spec.id])) return null;
  if (attackModifiers(hero, target, { targetUid: target.uid }).blocked) return null;
  const pSave = saveChance(target, spell.save, spell.saveDC, effects.saveAdvantage ? { advantage: ['x'] } : {});
  return { chance: 1 - pSave, pSave, specs };
}

// ---------------------------------------------------------------------------
// The state of the fight
// ---------------------------------------------------------------------------

const hpShare = h => Math.max(0, h.hp) / Math.max(1, h.maxHp);

/** A concentration spell of this hero that still holds a creature. */
function workingConcentration(encounter, hero, party) {
  const conc = concentrationOf(encounter, heroUid(hero));
  if (!conc) return null;
  const holds = c => conditionsOf(c).some(x => x.concentration === conc.token);
  return activeEnemies(encounter).some(holds) || party.some(holds) ? conc : null;
}

function situation(encounter, hero, party, healBelow) {
  const enemies = activeEnemies(encounter);
  const standing = party.filter(h => h.hp > 0);
  const ac = standing.length ? standing.reduce((s, h) => s + (Number(h.ac) || 12), 0) / standing.length : 12;
  const threat = new Map(enemies.map(e => [e.uid, enemyThreat(e, ac)]));
  const enemyHp = enemies.reduce((s, e) => s + Math.max(0, e.hp), 0);
  const trouble = party.some(h => h.hp <= 0) || standing.reduce((s, h) => s + hpShare(h), 0) / Math.max(1, party.length) < Math.max(0.5, healBelow);
  return { enemies, threat, enemyHp, trouble, party };
}

/** What a slot spell costs here (in damage the party stops taking). */
function slotCost(hero, slot, target, state) {
  if (slot.free && !slot.freeCast) return 0;
  const top = slotTable(hero.spellcasting).reduce((max, r) => Math.max(max, r.level), 0);
  let cost = AI_TUNING.slotCost * slot.level * (slot.level === top && top > 1 ? AI_TUNING.topSlotFactor : 1);
  const bigEnemy = target && target.hp >= 40;
  if (state.enemies.length >= 3 || bigEnemy || state.trouble) cost *= AI_TUNING.cheapFactor;
  return cost;
}

// ---------------------------------------------------------------------------
// Choosing
// ---------------------------------------------------------------------------

/**
 * Every offensive option (weapons, cantrips and, unless `useSlots` is false,
 * spells with slots) against every enemy standing, before scoring.
 * @returns {{ action, kind: 'weapon'|'cantrip'|'spell'|'control', slot, target, expected, onHit, pHit, share?, chance? }[]}
 *   share: expected share of the enemy's HP taken (damage options)
 */
function offensiveOptions(encounter, hero, state, { useSlots = true, targets = state.enemies } = {}) {
  const rows = castableRows(hero).filter(s => OFFENSIVE.includes(s.kind));
  const weapons = attackOptions(hero);
  const conc = workingConcentration(encounter, hero, state.party);
  const spells = rows
    .filter(spell => !(spell.level > 0 && !useSlots && !spell.freeAvailable) && !(spell.concentration && conc))
    .map(spell => ({ spell, slot: slotFor(hero, spell) }))
    .filter(x => x.slot);
  const list = [];
  targets.forEach(target => {
    const hp = Math.max(1, target.hp);
    const share = dmg => Math.min(1, dmg.expected * Math.min(1, hp / Math.max(1, dmg.onHit)) / hp);
    weapons.forEach(o => {
      const dmg = weaponDamage(hero, o, target);
      if (dmg) list.push({ action: { type: 'attack', optionId: o.id, targetUid: target.uid }, kind: 'weapon', target, share: share(dmg), ...dmg });
    });
    spells.forEach(({ spell, slot }) => {
      const action = { type: 'spell', spellId: spell.id, targetUid: target.uid };
      if (spell.damage) {
        const dmg = spellDamage(hero, spell, target, slot);
        if (dmg) list.push({ action, kind: spell.level === 0 ? 'cantrip' : 'spell', slot, spell, target, share: share(dmg), ...dmg });
        return;
      }
      const control = spellControl(hero, spell, target);
      if (control && control.chance >= AI_TUNING.minControlChance) list.push({ action, kind: 'control', slot, spell, target, expected: 0, onHit: 0, pHit: control.chance, ...control });
    });
  });
  return list;
}

/** The value of an option when the fight has `rounds` left (damage the party stops taking). */
function scoreOf(option, state, rounds) {
  const threat = state.threat.get(option.target.uid) || 0;
  if (option.kind === 'control') {
    const turns = option.specs.reduce((best, spec) => Math.max(best, controlTurns(spec, option.pSave, rounds)), 0);
    return option.chance * turns * threat;
  }
  return option.share * (threat * rounds + 1);
}

const free = o => o.kind === 'weapon' || o.kind === 'cantrip' || (o.slot && o.slot.free && !o.slot.freeCast);

/** Pick the best offensive move (null if there is none). */
function bestOffense(encounter, hero, state, options = {}) {
  const list = offensiveOptions(encounter, hero, state, options);
  if (!list.length) return null;
  // Rounds the fight has left: the enemies' HP over the party's damage per round
  const standing = state.party.filter(h => h.hp > 0).length || 1;
  const perRound = Math.max(1, ...list.filter(free).map(o => o.expected)) * standing;
  const rounds = clamp(state.enemyHp / perRound, 1, AI_TUNING.maxRounds);
  list.forEach(o => { o.score = scoreOf(o, state, rounds); });
  const bestFreeOn = new Map();
  let best = null;
  list.filter(free).forEach(o => {
    const b = bestFreeOn.get(o.target.uid);
    if (!b || o.score > b.score) bestFreeOn.set(o.target.uid, o);
    if (!best || o.score > best.score) best = o;
  });
  let bestNet = best ? best.score : -Infinity;
  list.filter(o => !free(o)).forEach(o => {
    const freeHere = bestFreeOn.get(o.target.uid);
    // No slot on an almost dead enemy: one the free option would likely drop
    const almostDead = freeHere && freeHere.pHit >= 0.5 && freeHere.onHit >= o.target.hp * 1.25;
    if (almostDead) return;
    // Control only on a dangerous enemy that is not about to fall
    if (o.kind === 'control') {
      const threat = state.threat.get(o.target.uid) || 0;
      if (threat < 3 || (freeHere && freeHere.onHit * 2 >= o.target.hp)) return;
    }
    const net = o.score - slotCost(hero, o.slot, o.target, state);
    if (net > bestNet) { best = o; bestNet = net; }
  });
  return best;
}

/** The healing spell to cast (the cheapest, then the biggest), or null. */
function healSpell(hero) {
  return castableRows(hero)
    .filter(s => s.kind === 'heal' && slotFor(hero, s))
    .sort((a, b) => a.level - b.level || diceAverage(b.heal).total - diceAverage(a.heal).total)[0] || null;
}

/** The best free option against this target: a weapon or a cantrip (spell slots are kept). */
export function bestAttack(hero, target) {
  const state = { enemies: [target], threat: new Map([[target.uid, 1]]), enemyHp: target.hp, trouble: false, party: [hero] };
  const options = offensiveOptions({ enemies: [target], concentrations: {} }, hero, state, { useSlots: false, targets: [target] })
    .filter(o => o.kind === 'weapon' || o.kind === 'cantrip')
    .sort((a, b) => (b.expected || 0) - (a.expected || 0));
  if (!options[0]) return null;
  const { targetUid: _t, ...action } = options[0].action;
  return action;
}

/**
 * A hero's next move (the AI of "Simular N veces", see the header).
 * @param {{ healBelow?: number, allies?: object[], useSlots?: boolean }} [options]
 *   healBelow: share of max HP under which a hero gets healed;
 *   useSlots: false plays like the old simple AI (weapons and cantrips only)
 * @returns the action for `playerAction`, with `ai` (why: 'damage' | 'control' | 'heal' | 'revive' | ...) on it
 */
export function autoAction(encounter, hero, { healBelow = 0.35, allies = [], useSlots = true } = {}) {
  const party = allies.length ? allies : [hero];
  const state = situation(encounter, hero, party, healBelow);
  const tag = (action, ai) => ({ ...action, ai });

  // The opening strike: an offensive move against a surprised enemy if there is one
  if (openingPending(encounter)) {
    const surprised = state.enemies.filter(e => e.surprised);
    const best = bestOffense(encounter, hero, state, { useSlots, targets: surprised.length ? surprised : state.enemies });
    return best && best.kind !== 'control' ? tag(best.action, 'damage') : { type: 'endTurn' };
  }
  const potion = (hero.inventory || []).filter(i => healingDice(i)).sort((a, b) => diceAverage(healingDice(a)).total - diceAverage(healingDice(b)).total)[0];
  const fallen = party.filter(a => heroUid(a) !== heroUid(hero) && a.hp <= 0).sort((a, b) => b.maxHp - a.maxHp)[0];
  if (!encounter.bonusUsed && potion && fallen) return tag({ type: 'potion', itemId: potion.id, targetUid: heroUid(fallen) }, 'revive');
  if (!encounter.bonusUsed && potion && hero.hp < hero.maxHp * healBelow) return { type: 'potion', itemId: potion.id };
  if (encounter.actionUsed || !state.enemies.length) return { type: 'endTurn' };
  if (escapableCondition(hero) && conditionsOf(hero).some(c => c.id === 'apresado')) return { type: 'escape' };

  const offense = bestOffense(encounter, hero, state, { useSlots });
  const heal = useSlots ? healSpell(hero) : null;
  if (heal) {
    // A fallen ally first; then whoever is lowest under the threshold, unless the fight is about to end
    if (fallen) return tag({ type: 'spell', spellId: heal.id, targetUid: heroUid(fallen) }, 'revive');
    const hurt = party.filter(h => h.hp > 0 && hpShare(h) < healBelow).sort((a, b) => hpShare(a) - hpShare(b))[0];
    const finishing = offense && state.enemies.length === 1 && offense.onHit >= offense.target.hp && offense.pHit >= 0.6;
    if (hurt && !finishing) return tag({ type: 'spell', spellId: heal.id, targetUid: heroUid(hurt) }, 'heal');
  }
  if (!offense) return { type: 'dodge' };
  return tag(offense.action, offense.kind === 'control' ? 'control' : 'damage');
}
