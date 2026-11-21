// Combat encounters resolved entirely by the game (no AI): initiative, the
// player's turn, enemy turns, conditions, morale (fleeing / surrendering) and experience.
//
// Pure functions. Dice come from a `rollDie(sides)` callback. Every function
// returns new objects; the encounter is plain data so it can be saved with the
// campaign and resumed later.
//
// Conditions (see conditions.js) live on the hero (`character.conditions`, kept
// after the fight only when they last until a rest or longer) and on each enemy
// (`enemy.conditions`). Turn hooks: at the start of a turn the durations tied to
// it count down and a prone creature stands up; a creature that is incapacitated
// loses its turn; at the end of a turn it repeats its saving throws and the
// durations tied to the end of that turn count down.

import { resolveAttack } from './combat';
import { castSpell, parseDice } from './spellcasting';
import { drinkPotion, healingDice } from './items';
import { setHands, describeHands, fleeDC, setLimbStatus, normalizeEquipment, limbWithArticle, limbStatusLabel, LIMB_IDS } from './equipment';
import { skillModifier } from './characterBuilder';
import {
  attackModifiers, checkModifiers, rollD20, rollSave, describeMode, createCondition, addCondition, removeConditions,
  tickDurations, conditionsOf, hasCondition, isIncapacitated, speedZeroReason, activeIds, conditionName, describeDuration,
  abilityName
} from './conditions';
import { actionsWithConditions } from '../data/monsterConditions';
import { spellConditions } from '../data/spellConditions';

const mod = score => Math.floor(((Number(score) || 10) - 10) / 2);
/** "14+3" or "7−2" */
const withBonus = (roll, bonus) => `${roll}${bonus >= 0 ? '+' : '−'}${Math.abs(bonus)}`;
const lower = id => conditionName(id).toLowerCase();

/** The hero's id in turn order and condition durations. */
export const PLAYER = 'player';

/** Creatures that give up by running away rather than surrendering. */
const FLEEING_TYPES = ['bestia', 'monstruosidad', 'dragón', 'elemental', 'planta', 'feérico'];
export const MORALE_DC = 10;
export { FLEE_DC } from './equipment';
export const POTION_HEAL = '2d4+2';

/**
 * Grave wounds (house rule, rare on purpose): when an enemy lands a critical hit
 * with slashing damage, the game rolls a d20; on INJURY_THRESHOLD or less (1-2,
 * a 10 % of those criticals) a random limb (d4: right arm, left arm, right leg,
 * left leg) is disabled, or lost if it already was. If that hit also drops the
 * hero to 0 HP, the threshold is INJURY_THRESHOLD_DOWN (1-4, 20 %).
 */
export const INJURY_THRESHOLD = 2;
export const INJURY_THRESHOLD_DOWN = 4;
export const INJURY_DAMAGE_TYPE = 'cortante';

// ---------------------------------------------------------------------------
// Dice helpers
// ---------------------------------------------------------------------------

function rollNotation(notation, rollDie, multiplier = 1) {
  const parsed = parseDice(notation);
  if (!parsed) return { dice: [], sides: 0, bonus: 0, total: 0 };
  const dice = Array.from({ length: parsed.count * multiplier }, () => rollDie(parsed.sides));
  return { dice, sides: parsed.sides, bonus: parsed.bonus, total: dice.reduce((a, b) => a + b, 0) + parsed.bonus };
}

const averageOf = notation => {
  const parsed = parseDice(notation);
  return parsed ? Math.floor(parsed.count * (parsed.sides + 1) / 2) + parsed.bonus : 0;
};

/** Petrified creatures resist all damage (half, rounded down). */
const afterResistance = (creature, amount) => (hasCondition(creature, 'petrificado') ? Math.floor(amount / 2) : amount);

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

/** A creature's saving throw bonus (listed save, or its ability modifier). */
export const enemySaveBonus = (enemy, ability) => enemy.saves?.[ability] ?? mod(enemy.stats?.[ability]);

/** The player's saving throw bonus (ability modifier + proficiency if proficient). */
export function playerSaveBonus(character, ability) {
  const proficient = (character.savingThrows || []).includes(ability);
  return mod(character.stats?.[ability]) + (proficient ? Number(character.proficiencyBonus) || 2 : 0);
}

const playerInitiativeBonus = character => mod(character.stats?.des)
  + ((character.feats || []).some(f => /alerta/i.test(f)) ? Number(character.proficiencyBonus) || 2 : 0);

/**
 * Start an encounter.
 * @param {{monster: object, count?: number, name?: string}[]} groups  creatures (from the bestiary)
 * @param {object} character
 * @param {(sides: number) => number} rollDie
 * @returns the encounter state (it is the player's turn or the enemies act first:
 *          call `runEnemyTurns` right after to let them act until the player's turn)
 */
export function createEncounter(groups, character, rollDie) {
  const enemies = [];
  groups.forEach(({ monster, count = 1, name, trait, elite }) => {
    for (let n = 1; n <= count; n++) {
      const label = name || monster.name;
      enemies.push({
        uid: `${monster.id}-${enemies.length + 1}`,
        monsterId: monster.id,
        name: count > 1 ? `${label} ${n}` : label,
        baseName: monster.name,
        trait: trait || null,
        elite: Boolean(elite),
        type: monster.type,
        cr: monster.cr,
        xp: monster.xp,
        ac: monster.ac,
        hp: monster.hp,
        maxHp: monster.hp,
        stats: monster.stats,
        saves: monster.saves || {},
        actions: actionsWithConditions(monster.id, monster.actions),
        multiattack: monster.multiattack || null,
        fearless: Boolean(monster.fearless),
        status: 'active', // active | dead | fled | surrendered
        conditions: [],
        moraleChecked: false,
        recharge: Object.fromEntries((monster.actions || []).filter(a => a.recharge).map(a => [a.id, true])),
        initiative: rollDie(20) + (monster.initiative ?? mod(monster.stats?.des))
      });
    }
  });

  // Initiative is a Dexterity check: poisoned, invisible, incapacitated, exhausted...
  const initiativeMods = checkModifiers(character, { ability: 'des', initiative: true });
  const playerInitiative = rollD20(rollDie, initiativeMods).raw + playerInitiativeBonus(character) - initiativeMods.penalty;
  const order = [
    { kind: 'player', initiative: playerInitiative },
    ...enemies.map(e => ({ kind: 'enemy', uid: e.uid, initiative: e.initiative }))
  ].sort((a, b) => b.initiative - a.initiative || (a.kind === 'player' ? -1 : 1));

  return {
    round: 1,
    turn: 0,
    order,
    enemies,
    status: 'active', // active | victory | defeat | fled
    dodging: false,
    concentration: null, // { spellId, name, token } while the hero concentrates on a spell
    immunities: [],      // "uid:actionId": the hero resisted it and is immune for this fight
    xp: 0,
    log: [{ round: 1, kind: 'info', text: `¡Comienza el combate! Iniciativa: ${order.map(o => (o.kind === 'player' ? `${character.name} ${o.initiative}` : `${enemies.find(e => e.uid === o.uid).name} ${o.initiative}`)).join(', ')}.` }]
  };
}

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

export const activeEnemies = encounter => encounter.enemies.filter(e => e.status === 'active');
export const isPlayerTurn = encounter => encounter.status === 'active' && encounter.order[encounter.turn]?.kind === 'player';

const pushLog = (encounter, kind, text, extra = {}) => ({
  ...encounter,
  log: [...encounter.log, { round: encounter.round, kind, text, ...extra }]
});

const updateEnemy = (encounter, uid, patch) => ({
  ...encounter,
  enemies: encounter.enemies.map(e => (e.uid === uid ? { ...e, ...patch } : e))
});

/** The creature with this uid ('player' = the hero). */
const creatureOf = (encounter, hero, uid) => (uid === PLAYER ? hero : encounter.enemies.find(e => e.uid === uid));

/** Replace a creature of the fight. */
const putCreature = (encounter, hero, uid, creature) => (uid === PLAYER
  ? { encounter, hero: creature }
  : { encounter: { ...encounter, enemies: encounter.enemies.map(e => (e.uid === uid ? creature : e)) }, hero });

const nameIn = (encounter, hero) => uid => creatureOf(encounter, hero, uid)?.name || 'alguien';
const saveBonusOf = (creature, uid, ability) => (uid === PLAYER ? playerSaveBonus(creature, ability) : enemySaveBonus(creature, ability));

/** XP of the creatures the hero overcame (killed, routed or captured). */
const overcomeXp = (encounter, includeRouted = true) => encounter.enemies
  .filter(e => e.status === 'dead' || (includeRouted && (e.status === 'fled' || e.status === 'surrendered')))
  .reduce((sum, e) => sum + (e.xp || 0), 0);

function checkEnd(encounter, character) {
  if (encounter.status !== 'active') return encounter;
  if (character.hp <= 0) {
    return pushLog({ ...encounter, status: 'defeat', xp: 0 }, 'end', `${character.name} cae inconsciente. El combate ha terminado.`);
  }
  if (activeEnemies(encounter).length === 0) {
    const xp = overcomeXp(encounter);
    return pushLog({ ...encounter, status: 'victory', xp }, 'end', `¡Victoria! No queda ningún enemigo en pie. +${xp} PX.`);
  }
  return encounter;
}

// ---------------------------------------------------------------------------
// Conditions in a fight
// ---------------------------------------------------------------------------

/** Log lines for conditions that ended. */
function logEnded(encounter, who, removed, why = '') {
  let next = encounter;
  const seen = new Set();
  removed.forEach(c => {
    if (seen.has(c.id)) return;
    seen.add(c.id);
    next = pushLog(next, 'conditionEnd', `${who} ya no está ${lower(c.id)}${why}.`, { condition: c.id, change: 'end' });
  });
  return next;
}

/**
 * Apply condition specs (monster attack, spell...) to a creature of the fight.
 * A spec with `save` lets the target resist it with that saving throw.
 * @returns {{ encounter, hero, applied: object[] }}
 */
function applySpecs(encounter, hero, targetUid, specs, { sourceUid = null, actorUid = null, concentration = null, rollDie }) {
  let next = encounter;
  let h = hero;
  const applied = [];
  const suffix = `${sourceUid || 'x'}-${next.round}-${next.log.length}`;
  const source = sourceUid ? nameIn(next, h)(sourceUid) : '';
  for (const spec of specs) {
    let target = creatureOf(next, h, targetUid);
    if (!target || (targetUid !== PLAYER && target.status !== 'active')) break;
    if (spec.save) {
      const save = rollSave(target, spec.save.ability, saveBonusOf(target, targetUid, spec.save.ability), spec.save.dc, rollDie);
      next = pushLog(next, save.success ? 'miss' : 'condition',
        `${target.name}: salvación de ${abilityName(spec.save.ability)} ${save.text} → ${save.success ? `evita quedar ${lower(spec.id)}` : 'falla'}.`);
      if (save.success) continue;
    }
    const condition = createCondition({ ...spec, ...(spec.group ? { group: `${spec.group}-${suffix}` } : {}) }, { sourceUid, source, targetUid, actorUid, concentration });
    const result = addCondition(target, condition);
    if (result.immune) {
      next = pushLog(next, 'info', `${target.name} es inmune a la condición ${lower(spec.id)}.`);
      continue;
    }
    if (!result.added) continue;
    target = result.creature;
    ({ encounter: next, hero: h } = putCreature(next, h, targetUid, target));
    applied.push(result.condition);
    const level = result.condition.id === 'agotamiento' ? ` (nivel ${result.condition.level})` : '';
    next = pushLog(next, 'condition', `${target.name} queda ${lower(spec.id)}${level}: ${describeDuration(result.condition, nameIn(next, h))}.`, { condition: spec.id, change: 'add', target: targetUid });
  }
  // Linked conditions whose main condition was resisted are dropped
  const target = creatureOf(next, h, targetUid);
  if (target) {
    const { creature, removed } = removeConditions(target, () => false);
    if (removed.length) ({ encounter: next, hero: h } = putCreature(next, h, targetUid, creature));
  }
  return { encounter: next, hero: h, applied };
}

/** End the hero's concentration: the conditions of that spell end on every creature. */
function endConcentration(encounter, hero, why) {
  const conc = encounter.concentration;
  if (!conc) return { encounter, hero };
  let next = pushLog({ ...encounter, concentration: null }, 'conditionEnd', `${hero.name} pierde la concentración en ${conc.name}${why ? ` (${why})` : ''}.`);
  let h = hero;
  [PLAYER, ...next.enemies.map(e => e.uid)].forEach(uid => {
    const creature = creatureOf(next, h, uid);
    const { creature: freed, removed } = removeConditions(creature, c => c.concentration === conc.token);
    if (!removed.length) return;
    ({ encounter: next, hero: h } = putCreature(next, h, uid, freed));
    next = logEnded(next, creature.name, removed);
  });
  return { encounter: next, hero: h };
}

/** The hero takes damage while concentrating: Constitution save, DC 10 or half the damage (max 30). */
function concentrationCheck(encounter, hero, amount, rollDie) {
  if (!encounter.concentration || amount <= 0 || hero.hp <= 0) return { encounter, hero };
  const dc = Math.min(30, Math.max(10, Math.floor(amount / 2)));
  const save = rollSave(hero, 'con', playerSaveBonus(hero, 'con'), dc, rollDie);
  if (save.success) {
    return { encounter: pushLog(encounter, 'info', `${hero.name} mantiene la concentración en ${encounter.concentration.name} (Constitución ${save.text}).`), hero };
  }
  return endConcentration(encounter, hero, `Constitución ${save.text}`);
}

/** A creature takes damage: sleep and charms end, some effects allow a new save. */
function conditionsAfterDamage(encounter, hero, uid, rollDie) {
  let next = encounter;
  let h = hero;
  let creature = creatureOf(next, h, uid);
  if (!creature || !conditionsOf(creature).length) return { encounter: next, hero: h };
  const ended = removeConditions(creature, c => c.endsOnDamage);
  if (ended.removed.length) {
    creature = ended.creature;
    ({ encounter: next, hero: h } = putCreature(next, h, uid, creature));
    next = logEnded(next, creature.name, ended.removed, ' (el daño rompe el efecto)');
  }
  for (const c of conditionsOf(creature).filter(x => x.saveOnDamage && x.duration?.type === 'save')) {
    creature = creatureOf(next, h, uid);
    const extra = c.saveOnDamage === 'advantage' ? { advantage: ['por el daño'] } : {};
    const save = rollSave(creature, c.duration.ability, saveBonusOf(creature, uid, c.duration.ability), c.duration.dc, rollDie, extra);
    if (!save.success) {
      next = pushLog(next, 'info', `${creature.name} repite la salvación al recibir daño: ${abilityName(c.duration.ability)} ${save.text} → sigue ${lower(c.id)}.`);
      continue;
    }
    const { creature: freed, removed } = removeConditions(creature, x => x.key === c.key);
    ({ encounter: next, hero: h } = putCreature(next, h, uid, freed));
    next = logEnded(next, creature.name, removed, ` (supera la salvación de ${abilityName(c.duration.ability)} al recibir daño: ${save.text})`);
  }
  return { encounter: next, hero: h };
}

/**
 * Conditions that depend on another creature end when it is gone: a grapple ends if
 * the grappler falls, flees or is incapacitated; fear and charm end when their
 * source is no longer in the fight. Also the hero's concentration ends if the hero
 * is incapacitated.
 */
function cleanupSources(encounter, hero) {
  let next = encounter;
  let h = hero;
  const gone = uid => {
    if (!uid || uid === PLAYER) return false;
    const src = next.enemies.find(e => e.uid === uid);
    return !src || src.status !== 'active';
  };
  [PLAYER, ...next.enemies.filter(e => e.status === 'active').map(e => e.uid)].forEach(uid => {
    const creature = creatureOf(next, h, uid);
    const { creature: freed, removed } = removeConditions(creature, c => {
      if (!c.sourceUid || c.keepsWithoutSource) return false;
      if (gone(c.sourceUid)) return true;
      if (c.id === 'agarrado' && c.sourceUid !== PLAYER) return isIncapacitated(next.enemies.find(e => e.uid === c.sourceUid));
      return false;
    });
    if (!removed.length) return;
    ({ encounter: next, hero: h } = putCreature(next, h, uid, freed));
    next = logEnded(next, creature.name, removed, ' (su causa ya no está)');
  });
  if (next.concentration && isIncapacitated(h)) ({ encounter: next, hero: h } = endConcentration(next, h, 'está incapacitado'));
  return { encounter: next, hero: h };
}

/** A turn starts or ends: count down the durations tied to it on every creature. Sleep may deepen. */
function tickAll(encounter, hero, at, uid, rollDie) {
  let next = encounter;
  let h = hero;
  for (const target of [PLAYER, ...next.enemies.filter(e => e.status === 'active').map(e => e.uid)]) {
    const creature = creatureOf(next, h, target);
    const { creature: ticked, expired } = tickDurations(creature, at, uid);
    if (!expired.length) continue;
    ({ encounter: next, hero: h } = putCreature(next, h, target, ticked));
    next = logEnded(next, creature.name, expired);
    // Sleep: when the first effect ends, a second save or it falls Unconscious
    for (const c of expired.filter(x => x.thenSave?.save)) {
      const current = creatureOf(next, h, target);
      const { ability, dc } = c.thenSave.save;
      const save = rollSave(current, ability, saveBonusOf(current, target, ability), dc, rollDie);
      next = pushLog(next, save.success ? 'info' : 'condition', `${current.name} repite la salvación de ${abilityName(ability)}: ${save.text} → ${save.success ? 'se sacude el efecto' : 'falla'}.`);
      if (!save.success) {
        ({ encounter: next, hero: h } = applySpecs(next, h, target, c.thenSave.apply, { sourceUid: c.sourceUid, actorUid: uid, concentration: c.concentration, rollDie }));
      }
    }
  }
  return { encounter: next, hero: h };
}

/** Repeated saving throws at the end of a creature's turn. */
function endOfTurnSaves(encounter, hero, uid, rollDie) {
  let next = encounter;
  let h = hero;
  const pending = conditionsOf(creatureOf(next, h, uid)).filter(c => c.duration?.type === 'save');
  for (const c of pending) {
    const creature = creatureOf(next, h, uid);
    if (!conditionsOf(creature).some(x => x.key === c.key)) continue;
    const d = c.duration;
    const save = rollSave(creature, d.ability, saveBonusOf(creature, uid, d.ability), d.dc, rollDie);
    const rounds = (d.rounds || 0) + 1;
    const fails = (d.fails || 0) + (save.success ? 0 : 1);
    const successes = (d.successes || 0) + (save.success ? 1 : 0);
    const needed = d.worsen ? 3 : 1;
    const label = `${creature.name} repite la salvación de ${abilityName(d.ability)} (${lower(c.id)}): ${save.text}`;
    if (successes >= needed) {
      const { creature: freed, removed } = removeConditions(creature, x => x.key === c.key);
      ({ encounter: next, hero: h } = putCreature(next, h, uid, freed));
      next = pushLog(next, 'info', `${label} → la supera.`);
      next = logEnded(next, creature.name, removed);
      continue;
    }
    if (d.worsen && fails >= d.worsen.after) {
      const { creature: freed } = removeConditions(creature, x => x.key === c.key);
      ({ encounter: next, hero: h } = putCreature(next, h, uid, freed));
      next = pushLog(next, 'condition', `${label} → falla por ${fails}.ª vez.`);
      ({ encounter: next, hero: h } = applySpecs(next, h, uid, [{ id: d.worsen.to, duration: 'permanent' }], { sourceUid: c.sourceUid, actorUid: uid, rollDie }));
      continue;
    }
    if (d.maxRounds && rounds >= d.maxRounds) {
      const { creature: freed, removed } = removeConditions(creature, x => x.key === c.key);
      ({ encounter: next, hero: h } = putCreature(next, h, uid, freed));
      next = logEnded(next, creature.name, removed, ' (se acaba la duración)');
      continue;
    }
    const updated = { ...c, duration: { ...d, rounds, fails, successes } };
    ({ encounter: next, hero: h } = putCreature(next, h, uid, { ...creature, conditions: conditionsOf(creature).map(x => (x.key === c.key ? updated : x)) }));
    next = pushLog(next, 'info', `${label} → ${save.success ? `la supera (${successes} de ${needed})` : `falla y sigue ${lower(c.id)}`}.`);
  }
  return { encounter: next, hero: h };
}

/** A creature able to move stands up from prone at the start of its turn (half its movement). */
function standUp(encounter, hero, uid) {
  const creature = creatureOf(encounter, hero, uid);
  if (!conditionsOf(creature).some(c => c.id === 'derribado' && c.duration?.type === 'prone')) return { encounter, hero };
  if (isIncapacitated(creature) || speedZeroReason(creature)) return { encounter, hero };
  const { creature: up } = removeConditions(creature, c => c.id === 'derribado' && c.duration?.type === 'prone');
  const placed = putCreature(encounter, hero, uid, up);
  return { encounter: pushLog(placed.encounter, 'conditionEnd', `${creature.name} se levanta del suelo (gasta la mitad de su movimiento).`, { condition: 'derribado', change: 'end' }), hero: placed.hero };
}

/** Start of a creature's turn. */
function beginTurn(encounter, hero, uid, rollDie) {
  let next = encounter;
  let h = hero;
  ({ encounter: next, hero: h } = tickAll(next, h, 'start', uid, rollDie));
  ({ encounter: next, hero: h } = standUp(next, h, uid));
  return cleanupSources(next, h);
}

/** End of a creature's turn. */
function finishTurn(encounter, hero, uid, rollDie) {
  let next = encounter;
  let h = hero;
  ({ encounter: next, hero: h } = endOfTurnSaves(next, h, uid, rollDie));
  ({ encounter: next, hero: h } = tickAll(next, h, 'end', uid, rollDie));
  return cleanupSources(next, h);
}

const turnKey = encounter => `${encounter.round}:${encounter.turn}`;

/** Start the hero's turn once (the Dodge ends, durations tick, the hero stands up). */
function beginPlayerTurn(encounter, hero, rollDie) {
  if (encounter.turnStarted === turnKey(encounter)) return { encounter, hero };
  const started = { ...encounter, turnStarted: turnKey(encounter), dodging: false };
  return beginTurn(started, hero, PLAYER, rollDie);
}

/** Why the creature loses its turn (null if it can act). */
function lostTurnReason(creature) {
  const ids = activeIds(creature);
  const id = ['petrificado', 'paralizado', 'aturdido', 'inconsciente', 'incapacitado'].find(c => ids.has(c));
  return id ? lower(id) : null;
}

/** Morale: a hurt creature (or one whose leader fell) may flee or surrender. */
function moraleCheck(encounter, uid, rollDie, reason) {
  const enemy = encounter.enemies.find(e => e.uid === uid);
  if (!enemy || enemy.status !== 'active' || enemy.fearless || enemy.moraleChecked) return encounter;
  const roll = rollDie(20);
  const total = roll + enemySaveBonus(enemy, 'sab');
  let next = updateEnemy(encounter, uid, { moraleChecked: true });
  if (total >= MORALE_DC) {
    return pushLog(next, 'morale', `${enemy.name} ${reason} pero aguanta (moral ${withBonus(roll, total - roll)} = ${total} vs CD ${MORALE_DC}).`);
  }
  const flees = FLEEING_TYPES.includes(enemy.type);
  next = updateEnemy(next, uid, { status: flees ? 'fled' : 'surrendered' });
  return pushLog(next, 'morale', `${enemy.name} ${reason} y se viene abajo: ${flees ? 'huye despavorido' : 'suelta las armas y se rinde'} (moral ${total} vs CD ${MORALE_DC}).`, { uid, outcome: flees ? 'fled' : 'surrendered' });
}

/** A leader is stronger than every other creature of the encounter, or a named elite. */
function isLeaderOf(encounter, uid) {
  const enemy = encounter.enemies.find(e => e.uid === uid);
  if (!enemy || encounter.enemies.length < 2) return false;
  return enemy.elite || encounter.enemies.every(e => e.uid === uid || e.cr < enemy.cr);
}

/** Apply damage to an enemy, then death, morale and the conditions that end with damage. */
function damageEnemy(encounter, hero, uid, rawAmount, rollDie) {
  const enemy = encounter.enemies.find(e => e.uid === uid);
  if (!enemy || rawAmount <= 0) return { encounter, hero };
  const amount = afterResistance(enemy, rawAmount);
  let next = encounter;
  if (amount < rawAmount) next = pushLog(next, 'info', `${enemy.name} está petrificado y solo recibe ${amount} de daño.`);
  const hp = Math.max(0, enemy.hp - amount);
  next = updateEnemy(next, uid, { hp });

  if (hp === 0) {
    next = updateEnemy(next, uid, { status: 'dead' });
    next = pushLog(next, 'down', `${enemy.name} cae y no se levanta.`, { uid, leader: isLeaderOf(encounter, uid) });
    // A leader (a creature stronger than all the others) falling shakes the rest
    const isLeader = isLeaderOf(encounter, uid);
    const others = activeEnemies(next);
    if (isLeader) {
      others.forEach(o => { next = moraleCheck(next, o.uid, rollDie, `ve caer a ${enemy.name}`); });
    }
    return cleanupSources(next, hero);
  }
  let h = hero;
  ({ encounter: next, hero: h } = conditionsAfterDamage(next, h, uid, rollDie));
  // A creature that can't act can't run away either
  if (hp <= enemy.maxHp / 2 && !isIncapacitated(next.enemies.find(e => e.uid === uid))) next = moraleCheck(next, uid, rollDie, 'está malherido');
  return cleanupSources(next, h);
}

/** The hero takes damage: concentration, effects that end with damage. */
function damageHero(encounter, hero, amount, rollDie) {
  let next = encounter;
  let h = { ...hero, hp: Math.max(0, hero.hp - amount) };
  if (amount <= 0) return { encounter: next, hero: h };
  ({ encounter: next, hero: h } = concentrationCheck(next, h, amount, rollDie));
  return conditionsAfterDamage(next, h, PLAYER, rollDie);
}

/** Invisibility ends when the hero attacks or casts a spell. */
function revealHero(encounter, hero) {
  const { creature, removed } = removeConditions(hero, c => c.endsOnAttack);
  if (!removed.length) return { encounter, hero };
  return { encounter: logEnded(encounter, hero.name, removed, ' (al atacar se deja ver)'), hero: creature };
}

/** Turn a spell's condition spec into one with numbers: the repeated save and escape DC are the caster's. */
function spellSpec(spec, spell, dc) {
  const d = spec.duration;
  let duration = d;
  if (d && typeof d === 'object' && d.save === true) duration = { ...d, save: { ability: spell.save, dc } };
  if (d && typeof d === 'object' && d.escape === 'dc') duration = { escape: dc };
  return {
    ...spec,
    duration,
    ...(spec.thenSave ? { thenSave: { ...spec.thenSave, save: { ability: spell.save, dc } } } : {})
  };
}

// ---------------------------------------------------------------------------
// Player turn
// ---------------------------------------------------------------------------

/** What the hero can use to break free: the better of Athletics and Acrobatics. */
export function escapeBonus(character) {
  const athletics = skillModifier(character, 'athletics');
  const acrobatics = skillModifier(character, 'acrobatics');
  return athletics >= acrobatics
    ? { skillId: 'athletics', ability: 'fue', bonus: athletics, name: 'Atletismo' }
    : { skillId: 'acrobatics', ability: 'des', bonus: acrobatics, name: 'Acrobacias' };
}

/** The condition the hero can try to break free from (grappled first), or null. */
export const escapableCondition = character => {
  const list = conditionsOf(character).filter(c => c.duration?.type === 'escape');
  return list.find(c => c.id === 'agarrado') || list[0] || null;
};

/**
 * Resolve the player's action, then the enemies act until it is the player's
 * turn again (or the combat ends).
 *
 * The turn has an action and a Bonus Action (2024 rules). The only Bonus
 * Action here is drinking a potion, before or after the action, once per turn:
 *  - `encounter.actionUsed`: the hero already acted this turn;
 *  - `encounter.bonusUsed`: the hero already drank a potion this turn.
 * The turn ends by itself once nothing else can be done (action used, and the
 * Bonus Action used or no potion left); otherwise it stays open until the
 * hero drinks or ends it with { type: 'endTurn' }. An incapacitated hero
 * (paralyzed, stunned...) loses the turn whatever the action.
 * @param {object} action
 *   { type: 'attack', optionId, targetUid, raging? }   action
 *   { type: 'spell', spellId, targetUid? }             action
 *   { type: 'equip', hands: { main, off } }            action (change what is in hand)
 *   { type: 'dodge' } | { type: 'flee' }               action
 *   { type: 'escape' }                                 action (break free of a grapple or restraint)
 *   { type: 'potion', itemId }                         Bonus Action
 *   { type: 'endTurn' }                                end the turn now
 * @returns {{ ok: false, error } | { ok: true, encounter, character, animations }}
 *   animations: the player's dice to show with the 3D dice, in order:
 *   [{ sides, value, modifier?, dc?, success?, label } | { dice: [{sides, value}], modifier, label }]
 */
export function playerAction(encounter, character, action, rollDie) {
  if (!isPlayerTurn(encounter)) return { ok: false, error: 'No es tu turno.' };
  const begun = beginPlayerTurn(encounter, character, rollDie);
  let next = begun.encounter;
  let hero = begun.hero;
  const lost = lostTurnReason(hero);
  if (lost) {
    next = pushLog(next, 'info', `${hero.name} está ${lost} y no puede actuar este turno.`);
    return endPlayerTurn({ ...next, actionUsed: true }, hero, rollDie, []);
  }
  const isBonus = action.type === 'potion';
  if (action.type === 'endTurn') return endPlayerTurn(next, hero, rollDie, []);
  if (isBonus && next.bonusUsed) return { ok: false, error: 'Ya has usado tu acción adicional este turno.' };
  if (!isBonus && next.actionUsed) return { ok: false, error: 'Ya has hecho tu acción este turno: bebe una poción o termina el turno.' };
  const animations = [];
  const target = next.enemies.find(e => e.uid === action.targetUid && e.status === 'active');
  const charmedBy = target && conditionsOf(hero).some(c => c.id === 'encantado' && c.sourceUid === target.uid);

  if (action.type === 'attack') {
    if (!target) return { ok: false, error: 'Elige un enemigo en pie.' };
    if (charmedBy) return { ok: false, error: `No puedes atacar a ${target.name}: estás encantado por esa criatura.` };
    const result = resolveAttack(hero, action.optionId, rollDie, { targetAC: target.ac, raging: action.raging, target, targetUid: target.uid });
    if (!result.ok) return result;
    const { attack } = result;
    const how = describeMode({ mode: attack.mode, advantage: attack.advantage ? attack.advantage.split(', ') : [], disadvantage: attack.disadvantage ? attack.disadvantage.split(', ') : [] });
    attack.rolls.forEach((r, i) => {
      animations.push({
        sides: 20, value: r.raw, modifier: r.total - r.raw, dc: target.ac, success: r.hit,
        label: `${attack.option.name} · ataque${attack.rolls.length > 1 ? ` ${i + 1}` : ''}`
      });
      const crit = r.crit ? (r.raw === 20 ? `¡crítico! ${r.damage.total} de daño` : `¡crítico automático! ${r.damage.total} de daño`) : null;
      next = pushLog(next, r.crit ? 'crit' : r.hit ? 'hit' : 'miss',
        `${hero.name} ataca a ${target.name} con ${attack.option.name.toLowerCase()}: ${r.dice.length > 1 ? `[${r.dice.join(', ')}] ` : ''}${withBonus(r.raw, r.total - r.raw)} = ${r.total} vs CA ${target.ac}${how} → ${crit || (r.hit ? `${r.damage.total} de daño` : r.fumble ? 'pifia' : 'falla')}.`);
    });
    const damageDice = [
      ...attack.rolls.flatMap(r => r.damage?.dice.map(value => ({ sides: r.damage.sides, value })) || []),
      ...(attack.sneak?.dice.map(value => ({ sides: 6, value })) || [])
    ];
    if (damageDice.length) {
      animations.push({ dice: damageDice, modifier: attack.totalDamage - damageDice.reduce((s, d) => s + d.value, 0), label: `${attack.option.name} · daño` });
    }
    if (attack.sneak) next = pushLog(next, 'hit', `Ataque Furtivo: +${attack.sneak.total} de daño.`);
    ({ encounter: next, hero } = revealHero(next, hero));
    ({ encounter: next, hero } = damageEnemy(next, hero, target.uid, attack.totalDamage, rollDie));
  } else if (action.type === 'spell') {
    const effects = spellConditions(action.spellId);
    const result = castSpell(hero, action.spellId, rollDie, { target, targetUid: target?.uid });
    if (!result.ok) return result;
    const { cast } = result;
    const { spell } = cast;
    const needsTarget = ['attack', 'save', 'auto'].includes(spell.kind);
    if (needsTarget && !target) return { ok: false, error: 'Elige un enemigo en pie como objetivo.' };
    if (needsTarget && charmedBy) return { ok: false, error: `No puedes lanzar conjuros contra ${target.name}: estás encantado por esa criatura.` };
    if (needsTarget && effects?.types && !effects.types.includes(target.type)) {
      return { ok: false, error: `${spell.name} solo afecta a criaturas de tipo ${effects.types.join(' o ')}, y ${target.name} es ${target.type}.` };
    }
    hero = result.character;
    ({ encounter: next, hero } = revealHero(next, hero));
    // A new concentration spell ends the previous one
    if (spell.concentration && next.concentration) ({ encounter: next, hero } = endConcentration(next, hero, `ahora se concentra en ${spell.name}`));
    const token = spell.concentration ? `conc-${spell.id}-${next.round}-${next.log.length}` : null;
    let applied = [];
    const dmgDice = cast.damage?.dice.map(value => ({ sides: cast.damage.sides, value })) || [];
    const prefix = `${hero.name} lanza ${spell.name}${target && needsTarget ? ` sobre ${target.name}` : ''}`;

    if (spell.kind === 'attack') {
      const { raw, total, isNat20, isNat1 } = cast.attack;
      const hit = isNat20 || (!isNat1 && total >= target.ac);
      // Touch spells hitting a paralyzed or unconscious target: critical (double the dice)
      let damage = cast.damage;
      if (hit && damage && cast.attack.autoCrit && !isNat20) {
        const extra = Array.from({ length: damage.dice.length }, () => rollDie(damage.sides));
        damage = { ...damage, dice: [...damage.dice, ...extra], total: damage.total + extra.reduce((a, b) => a + b, 0) };
      }
      const how = describeMode({ mode: cast.attack.mode, advantage: cast.attack.advantage ? [cast.attack.advantage] : [], disadvantage: cast.attack.disadvantage ? [cast.attack.disadvantage] : [] });
      animations.push({ sides: 20, value: raw, modifier: total - raw, dc: target.ac, success: hit, label: `${spell.name} · ataque` });
      if (hit && damage?.dice.length) animations.push({ dice: damage.dice.map(value => ({ sides: damage.sides, value })), modifier: damage.bonus, label: `${spell.name} · daño` });
      next = pushLog(next, isNat20 || (hit && damage !== cast.damage) ? 'crit' : hit ? 'hit' : 'miss',
        `${prefix}: ${withBonus(raw, total - raw)} = ${total} vs CA ${target.ac}${how} → ${hit ? `${damage !== cast.damage ? '¡crítico automático! ' : ''}${damage.total} de daño ${damage.type}` : 'falla'}.`);
      if (hit && effects?.onHit) {
        ({ encounter: next, hero, applied } = applySpecs(next, hero, target.uid, effects.onHit.map(s => spellSpec(s, spell, cast.saveDC)), { sourceUid: PLAYER, actorUid: PLAYER, concentration: token, rollDie }));
      }
      if (hit) ({ encounter: next, hero } = damageEnemy(next, hero, target.uid, damage.total, rollDie));
    } else if (spell.kind === 'save') {
      const immune = effects?.immuneTypes?.includes(target.type);
      const save = immune
        ? { success: true, text: `${target.name} es inmune (${target.type})` }
        : rollSave(target, spell.save, enemySaveBonus(target, spell.save), cast.saveDC, rollDie, effects?.saveAdvantage ? { advantage: ['está luchando contra ti'] } : {});
      const resisted = save.success;
      if (dmgDice.length) animations.push({ dice: dmgDice, modifier: cast.damage.bonus, label: `${spell.name} · daño` });
      const amount = cast.damage ? (resisted ? (spell.half ? Math.floor(cast.damage.total / 2) : 0) : cast.damage.total) : 0;
      next = pushLog(next, resisted ? 'miss' : 'hit',
        `${prefix}: ${immune ? save.text : `salvación de ${abilityName(spell.save)} ${save.text}`} → ${resisted ? 'resiste' : 'no resiste'}${cast.damage ? ` (${amount} de daño ${cast.damage.type})` : ''}.`);
      if (!resisted && effects?.onFail) {
        ({ encounter: next, hero, applied } = applySpecs(next, hero, target.uid, effects.onFail.map(s => spellSpec(s, spell, cast.saveDC)), { sourceUid: PLAYER, actorUid: PLAYER, concentration: token, rollDie }));
      } else if (!resisted && !cast.damage && !effects) {
        // Other control spells (adaptation): the target loses its next turn
        ({ encounter: next, hero, applied } = applySpecs(next, hero, target.uid, [{ id: 'incapacitado', duration: 'endOfTargetNextTurn' }], { sourceUid: PLAYER, actorUid: PLAYER, concentration: token, rollDie }));
      }
      if (amount > 0) ({ encounter: next, hero } = damageEnemy(next, hero, target.uid, amount, rollDie));
    } else if (spell.kind === 'auto') {
      if (dmgDice.length) animations.push({ dice: dmgDice, modifier: cast.damage.bonus, label: `${spell.name} · daño` });
      next = pushLog(next, 'hit', `${prefix}: impacto seguro, ${cast.damage.total} de daño ${cast.damage.type}.`);
      ({ encounter: next, hero } = damageEnemy(next, hero, target.uid, cast.damage.total, rollDie));
    } else if (spell.kind === 'heal') {
      if (cast.heal.dice.length) animations.push({ dice: cast.heal.dice.map(value => ({ sides: cast.heal.sides, value })), modifier: cast.heal.bonus, label: `${spell.name} · curación` });
      next = pushLog(next, 'heal', `${prefix}: recupera ${cast.heal.applied} puntos de golpe.`);
    } else {
      next = pushLog(next, 'info', `${prefix}. ${spell.desc}`);
    }
    if (effects?.self) {
      ({ encounter: next, hero, applied } = applySpecs(next, hero, PLAYER, effects.self, { sourceUid: null, actorUid: PLAYER, concentration: token, rollDie }));
    }
    if (cast.cured?.length) next = pushLog(next, 'conditionEnd', `${hero.name} se libra de: ${cast.cured.join(', ')}.`, { change: 'end' });
    if (token && applied.length) next = { ...next, concentration: { spellId: spell.id, name: spell.name, token } };
  } else if (action.type === 'potion') {
    const drink = drinkPotion(hero, action.itemId, rollDie);
    if (!drink.ok) return drink;
    const { roll, item } = drink;
    animations.push({ dice: roll.dice.map(value => ({ sides: roll.sides, value })), modifier: roll.bonus, label: `${item.name} · curación` });
    hero = drink.character;
    next = pushLog({ ...next, bonusUsed: true }, 'heal',
      `${hero.name} bebe ${item.name} como acción adicional y recupera ${drink.healed} puntos de golpe.${next.actionUsed ? '' : ' Aún puede hacer su acción.'}`);
  } else if (action.type === 'equip') {
    // House rule: changing what you hold takes the whole turn
    const result = setHands(hero, action.hands);
    if (!result.ok) return result;
    if (!result.changed) return { ok: false, error: 'Ya llevas eso en las manos.' };
    hero = result.character;
    next = pushLog(next, 'info', `${hero.name} cambia de equipo y ahora lleva ${describeHands(hero)}. Gasta su acción en ello.`);
  } else if (action.type === 'dodge') {
    next = pushLog({ ...next, dodging: true }, 'info', `${hero.name} se pone a la defensiva: los ataques que reciba tendrán desventaja hasta su próximo turno.`);
  } else if (action.type === 'escape') {
    const held = escapableCondition(hero);
    if (!held) return { ok: false, error: 'No hay nada de lo que liberarte.' };
    const skill = escapeBonus(hero);
    const mods = checkModifiers(hero, { ability: skill.ability, skillId: skill.skillId });
    const roll = rollD20(rollDie, mods);
    const total = roll.raw + skill.bonus - mods.penalty;
    const dc = held.duration.dc;
    animations.push({ sides: 20, value: roll.raw, modifier: total - roll.raw, dc, success: total >= dc, label: `Liberarse · ${skill.name}` });
    const text = `${hero.name} intenta liberarse (${lower(held.id)}${held.source ? `, ${held.source}` : ''}) con ${skill.name}: ${withBonus(roll.raw, total - roll.raw)} = ${total} vs CD ${dc}${describeMode({ ...roll, ...mods })}`;
    if (total >= dc) {
      const { creature, removed } = removeConditions(hero, c => c.key === held.key);
      hero = creature;
      next = logEnded(pushLog(next, 'hit', `${text} → ¡se suelta!`), hero.name, removed);
    } else {
      next = pushLog(next, 'miss', `${text} → no lo consigue.`);
    }
  } else if (action.type === 'flee') {
    // Speed 0 (grappled, restrained...) means no running away; injured legs make it harder (+5 each)
    const stuck = speedZeroReason(hero);
    if (stuck) return { ok: false, error: `No puedes huir: estás ${stuck.toLowerCase()} (velocidad 0).` };
    const dc = fleeDC(hero);
    if (dc == null) return { ok: false, error: 'Con las dos piernas heridas no puedes huir.' };
    const mods = checkModifiers(hero, { ability: 'des' });
    const d20 = rollD20(rollDie, mods);
    const roll = d20.raw;
    const total = roll + mod(hero.stats?.des) - mods.penalty;
    const how = describeMode({ ...d20, ...mods });
    animations.push({ sides: 20, value: roll, modifier: total - roll, dc, success: total >= dc, label: 'Huida' });
    if (total >= dc) {
      const xp = overcomeXp(next, false);
      next = pushLog({ ...next, status: 'fled', xp }, 'end', `${hero.name} logra escapar (${withBonus(roll, total - roll)} = ${total} vs CD ${dc}${how}).${xp ? ` +${xp} PX por los enemigos abatidos.` : ''}`);
      return { ok: true, encounter: next, character: hero, animations };
    }
    next = pushLog(next, 'miss', `${hero.name} intenta huir pero le cortan el paso (${total} vs CD ${dc}${how}).`);
  } else {
    return { ok: false, error: 'Acción desconocida.' };
  }

  if (!isBonus) next = { ...next, actionUsed: true };
  next = checkEnd(next, hero);
  if (next.status !== 'active') return { ok: true, encounter: next, character: hero, animations };

  // The turn stays open while there is still something to do: the action, or a potion to drink
  const canDrink = !next.bonusUsed && (hero.inventory || []).some(item => healingDice(item));
  if (!next.actionUsed || canDrink) return { ok: true, encounter: next, character: hero, animations };
  return endPlayerTurn(next, hero, rollDie, animations);
}

/** End the hero's turn: saves and durations of the end of the turn, then the enemies act. */
function endPlayerTurn(encounter, hero, rollDie, animations) {
  let next = encounter;
  let h = hero;
  if (!next.actionUsed) next = pushLog(next, 'info', `${h.name} termina su turno sin hacer nada más.`);
  ({ encounter: next, hero: h } = finishTurn(next, h, PLAYER, rollDie));
  next = checkEnd(next, h);
  if (next.status !== 'active') return { ok: true, encounter: next, character: h, animations };
  const after = runEnemyTurns(advanceTurn({ ...next, actionUsed: false, bonusUsed: false }), h, rollDie);
  return { ok: true, encounter: after.encounter, character: after.character, animations };
}

// ---------------------------------------------------------------------------
// Enemy turns
// ---------------------------------------------------------------------------

function advanceTurn(encounter) {
  const turn = encounter.turn + 1;
  if (turn < encounter.order.length) return { ...encounter, turn };
  return { ...encounter, turn: 0, round: encounter.round + 1 };
}

/** Conditions an action applies: the first ids of onHit / onFail. */
const actionConditionIds = action => [...(action.onHit || []), ...(action.onFail || [])].filter(s => s.duration !== 'linked').map(s => s.id);

function enemyAttack(encounter, enemy, attackAction, character, rollDie) {
  let next = encounter;
  let hero = character;
  const ranged = attackAction.kind === 'ranged';
  const mods = attackModifiers(enemy, hero, { ranged, targetUid: PLAYER, dodging: encounter.dodging });
  if (mods.blocked) {
    return { encounter: pushLog(next, 'info', `${enemy.name} no puede atacar a ${hero.name}: ${mods.blocked}.`), character: hero };
  }
  const d20 = rollD20(rollDie, mods);
  const roll = d20.raw;
  const bonus = attackAction.bonus - mods.penalty;
  const total = roll + bonus;
  const hit = roll === 20 || (roll !== 1 && total >= (hero.ac || 10));
  const crit = roll === 20 || (hit && mods.autoCrit);
  const how = describeMode({ ...d20, ...mods });
  const dice = d20.rolls.length > 1 ? `[${d20.rolls.join(', ')}] ` : '';
  if (!hit) {
    return { encounter: pushLog(next, 'enemyMiss', `${enemy.name} ataca con ${attackAction.name.toLowerCase()}: ${dice}${withBonus(roll, bonus)} = ${total} vs CA ${hero.ac}${how} → falla.`), character: hero };
  }
  const damage = rollNotation(attackAction.damage, rollDie, crit ? 2 : 1);
  const extra = attackAction.extra ? rollNotation(attackAction.extra, rollDie, crit ? 2 : 1) : null;
  const amount = afterResistance(hero, Math.max(1, damage.total) + (extra?.total || 0));
  const critText = crit ? (roll === 20 ? '¡crítico! ' : '¡crítico automático! ') : '';
  next = pushLog(next, crit ? 'enemyCrit' : 'enemyHit',
    `${enemy.name} ataca con ${attackAction.name.toLowerCase()}: ${dice}${withBonus(roll, bonus)} = ${total} vs CA ${character.ac}${how} → ${critText}${amount} de daño ${attackAction.type}${extra ? ` y ${attackAction.extraType}` : ''}.`,
    { playerDamage: amount });
  ({ encounter: next, hero } = damageHero(next, hero, amount, rollDie));
  if (crit && attackAction.type === INJURY_DAMAGE_TYPE) {
    ({ encounter: next, character: hero } = graveWound(next, enemy, hero, rollDie));
  }
  if (attackAction.onHit && hero.hp > 0) {
    ({ encounter: next, hero } = applySpecs(next, hero, PLAYER, attackAction.onHit, { sourceUid: enemy.uid, actorUid: enemy.uid, rollDie }));
  }
  return { encounter: next, character: hero };
}

/** Grave wound check after a slashing critical (see INJURY_THRESHOLD). */
function graveWound(encounter, enemy, character, rollDie) {
  const roll = rollDie(20);
  const threshold = character.hp <= 0 ? INJURY_THRESHOLD_DOWN : INJURY_THRESHOLD;
  if (roll > threshold) return { encounter, character };
  const limb = LIMB_IDS[Math.min(LIMB_IDS.length, Math.max(1, rollDie(4))) - 1];
  const sheet = normalizeEquipment(character);
  const current = sheet.limbs[limb];
  if (current === 'lost') return { encounter, character };
  const status = current === 'ok' ? 'disabled' : 'lost';
  const result = setLimbStatus(sheet, limb, status);
  const part = limbWithArticle(limb);
  const dropped = result.dropped.length ? ` ${result.dropped.join(' y ')} cae${result.dropped.length > 1 ? 'n' : ''} a la mochila.` : '';
  const text = status === 'lost'
    ? `¡Herida terrible! El golpe de ${enemy.name} cercena ${part} de ${character.name}.${dropped}`
    : `¡Herida grave! El golpe de ${enemy.name} deja ${limbStatusLabel(limb, 'disabled').toLowerCase()} ${part} de ${character.name}.${dropped}`;
  return {
    encounter: pushLog(encounter, 'injury', text, { injury: { limb, status }, by: enemy.name }),
    character: result.character
  };
}

/** Grave wounds suffered in these log entries: [{ limb, status, by }] */
export const injuriesIn = (entries = []) => entries
  .filter(e => e.kind === 'injury' && e.injury)
  .map(e => ({ ...e.injury, by: e.by || '' }));

function enemySaveAction(encounter, enemy, saveAction, character, rollDie) {
  const save = rollSave(character, saveAction.save, playerSaveBonus(character, saveAction.save), saveAction.dc, rollDie);
  const saved = save.success;
  const damage = saveAction.damage ? rollNotation(saveAction.damage, rollDie) : null;
  const amount = damage ? afterResistance(character, saved ? (saveAction.half ? Math.floor(damage.total / 2) : 0) : damage.total) : 0;
  let next = pushLog(encounter, amount > 0 || (!saved && saveAction.onFail) ? 'enemyHit' : 'enemyMiss',
    `${enemy.name} usa ${saveAction.name}: tu salvación de ${abilityName(saveAction.save)} ${save.text} → ${saved ? 'la superas' : 'fallas'}${damage ? ` (${amount} de daño ${saveAction.type})` : ''}.`,
    { playerDamage: amount });
  let hero;
  ({ encounter: next, hero } = damageHero(next, character, amount, rollDie));
  if (saved && saveAction.immuneOnSave) {
    next = { ...next, immunities: [...(next.immunities || []), `${enemy.uid}:${saveAction.id}`] };
    next = pushLog(next, 'info', `${hero.name} ya no teme a ${saveAction.name.toLowerCase()} de ${enemy.name} durante este combate.`);
  }
  if (!saved && saveAction.onFail && hero.hp > 0) {
    ({ encounter: next, hero } = applySpecs(next, hero, PLAYER, saveAction.onFail, { sourceUid: enemy.uid, actorUid: enemy.uid, rollDie }));
  }
  return { encounter: next, character: hero };
}

/**
 * What a creature does on its turn: an attack that would apply a condition the hero
 * doesn't have yet (`prefer`), a ready recharge ability, its Multiattack, or its best attack.
 * Actions the hero is immune to (resisted a gaze) and condition-only abilities that
 * would add nothing are skipped.
 */
function chooseActions(enemy, hero, encounter) {
  const immune = (encounter.immunities || []);
  const useful = a => !immune.includes(`${enemy.uid}:${a.id}`)
    && !(a.kind === 'save' && !a.damage && actionConditionIds(a).length && actionConditionIds(a).every(id => hasCondition(hero, id)));
  const actions = enemy.actions.filter(useful);
  const preferred = actions.find(a => a.prefer && actionConditionIds(a).some(id => !hasCondition(hero, id)));
  if (preferred) return [preferred];
  const ready = actions.find(a => a.kind === 'save' && (!a.recharge || enemy.recharge[a.id]));
  if (ready && (ready.recharge || !actions.some(a => a.kind === 'melee' || a.kind === 'ranged'))) return [ready];
  if (enemy.multiattack?.length) {
    const list = enemy.multiattack.map(id => actions.find(a => a.id === id)).filter(Boolean);
    if (list.length) return list;
  }
  const attacks = actions.filter(a => a.kind === 'melee' || a.kind === 'ranged');
  if (attacks.length) return [attacks.reduce((best, a) => (averageOf(a.damage) > averageOf(best.damage) ? a : best))];
  return ready ? [ready] : [];
}

/** Why an enemy that can act still doesn't attack this turn (null if it does). */
function enemyHoldsBack(enemy) {
  const list = conditionsOf(enemy);
  if (list.some(c => c.id === 'encantado' && c.sourceUid === PLAYER)) return 'está encantado y no quiere hacerte daño';
  if (list.some(c => c.id === 'asustado' && c.flees)) return 'huye aterrorizado y no ataca';
  return null;
}

/** A restrained enemy uses its action to break free (Strength or Dexterity check against the DC). */
function enemyEscape(encounter, hero, enemy, held, rollDie) {
  const bonus = Math.max(mod(enemy.stats?.fue), mod(enemy.stats?.des));
  const mods = checkModifiers(enemy, { ability: 'fue' });
  const roll = rollD20(rollDie, mods);
  const total = roll.raw + bonus - mods.penalty;
  const text = `${enemy.name} intenta liberarse (${lower(held.id)}): ${withBonus(roll.raw, bonus - mods.penalty)} = ${total} vs CD ${held.duration.dc}${describeMode({ ...roll, ...mods })}`;
  if (total < held.duration.dc) return { encounter: pushLog(encounter, 'info', `${text} → sigue atrapado.`), hero };
  const { creature, removed } = removeConditions(enemy, c => c.key === held.key);
  const placed = putCreature(pushLog(encounter, 'info', `${text} → se suelta.`), hero, enemy.uid, creature);
  return { encounter: logEnded(placed.encounter, enemy.name, removed), hero: placed.hero };
}

/** One enemy's turn: start hooks, its actions (if it can act), end hooks. */
function enemyTurn(encounter, hero, uid, rollDie) {
  let next = encounter;
  let h = hero;
  ({ encounter: next, hero: h } = beginTurn(next, h, uid, rollDie));
  let enemy = next.enemies.find(e => e.uid === uid);
  if (enemy.status !== 'active') return { encounter: next, hero: h };

  // Recharge rolls at the start of its turn
  const recharge = { ...enemy.recharge };
  enemy.actions.filter(a => a.recharge && !recharge[a.id]).forEach(a => {
    if (a.recharge.includes(rollDie(6))) recharge[a.id] = true;
  });

  const lost = lostTurnReason(enemy);
  const holdsBack = enemyHoldsBack(enemy);
  const held = conditionsOf(enemy).find(c => c.duration?.type === 'escape' && c.sourceUid === PLAYER);
  if (enemy.skipTurns > 0) {
    // Encounters saved before conditions existed
    next = updateEnemy(next, uid, { skipTurns: enemy.skipTurns - 1 });
    next = pushLog(next, 'info', `${enemy.name} no puede actuar este turno.`);
  } else if (lost) {
    next = pushLog(next, 'info', `${enemy.name} está ${lost} y no puede actuar.`);
  } else if (holdsBack) {
    next = pushLog(next, 'info', `${enemy.name} ${holdsBack}.`);
  } else if (held) {
    ({ encounter: next, hero: h } = enemyEscape(next, h, enemy, held, rollDie));
  } else {
    const current = { ...enemy, recharge };
    for (const act of chooseActions(current, h, next)) {
      const result = act.kind === 'save'
        ? enemySaveAction(next, current, act, h, rollDie)
        : enemyAttack(next, current, act, h, rollDie);
      next = result.encounter;
      h = result.character;
      if (act.recharge) recharge[act.id] = false;
      if (h.hp <= 0) break;
    }
  }
  next = updateEnemy(next, uid, { recharge });
  if (h.hp <= 0) return { encounter: next, hero: h };
  enemy = next.enemies.find(e => e.uid === uid);
  if (enemy.status !== 'active') return { encounter: next, hero: h };
  return finishTurn(next, h, uid, rollDie);
}

/**
 * Let the enemies act in initiative order until it is the player's turn or the
 * combat ends. Call it after createEncounter if enemies won initiative. A hero
 * who can't act (paralyzed, stunned...) loses the turn here and the enemies go on.
 * @returns {{ encounter, character }}
 */
export function runEnemyTurns(encounter, character, rollDie) {
  let next = encounter;
  let hero = character;
  let guard = 0;

  while (next.status === 'active' && guard++ < 200) {
    const slot = next.order[next.turn];
    if (slot?.kind === 'player') {
      ({ encounter: next, hero } = beginPlayerTurn(next, hero, rollDie));
      next = checkEnd(next, hero);
      if (next.status !== 'active') break;
      const lost = lostTurnReason(hero);
      if (!lost) break; // the player's turn: wait for the player
      next = pushLog(next, 'info', `${hero.name} está ${lost} y pierde su turno.`);
      ({ encounter: next, hero } = finishTurn(next, hero, PLAYER, rollDie));
    } else {
      const enemy = next.enemies.find(e => e.uid === slot?.uid);
      if (enemy?.status === 'active') ({ encounter: next, hero } = enemyTurn(next, hero, enemy.uid, rollDie));
    }
    next = checkEnd(next, hero);
    if (next.status !== 'active') break;
    next = advanceTurn(next);
  }
  return { encounter: next, character: hero };
}

/** Short summary of a finished combat, for the chronicle. */
export function describeEncounterResult(encounter, character) {
  const by = status => encounter.enemies.filter(e => e.status === status).map(e => e.name);
  const dead = by('dead');
  const fled = by('fled');
  const surrendered = by('surrendered');
  const parts = [];
  if (encounter.status === 'victory') parts.push(`⚔️ ${character.name} gana el combate en ${encounter.round} ${encounter.round === 1 ? 'ronda' : 'rondas'}.`);
  if (encounter.status === 'defeat') parts.push(`💀 ${character.name} cae derrotado en combate.`);
  if (encounter.status === 'fled') parts.push(`🏃 ${character.name} huye del combate.`);
  if (dead.length) parts.push(`Abatidos: ${dead.join(', ')}.`);
  if (surrendered.length) parts.push(`Se rinden: ${surrendered.join(', ')}.`);
  if (fled.length) parts.push(`Huyen: ${fled.join(', ')}.`);
  if (encounter.xp) parts.push(`+${encounter.xp} PX.`);
  return parts.join(' ');
}
