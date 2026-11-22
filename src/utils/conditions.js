// Conditions of the 2024 rules (SRD 5.2.1) and their mechanical effects on the
// d20 tests the game rolls by itself: attacks, saving throws and ability checks.
//
// This file includes material from the System Reference Document 5.2.1
// ("SRD 5.2.1") by Wizards of the Coast LLC, available at
// https://www.dndbeyond.com/srd, licensed under the Creative Commons
// Attribution 4.0 International License. Descriptions are our own summaries.
//
// A creature (the hero or an enemy) keeps its conditions in `conditions`:
//   { key, id, source?, sourceUid?, duration, level?, group?, cause?,
//     concentration?, endsOnDamage?, saveOnDamage?, endsOnAttack?, flees?,
//     keepsWithoutSource?, thenSave? }
// Durations (`duration.type`):
//   turns     { at: 'start' | 'end', of: uid, remaining, next? } – ends after `remaining`
//             starts/ends of that creature's turns ('player' is the hero)
//   save      { ability, dc, maxRounds?, rounds, fails, worsen? } – the creature repeats
//             the save at the end of each of its turns (the game rolls it)
//   escape    { dc } – until it breaks free (an action: Athletics or Acrobatics check)
//   prone     – derribado: it stands up at the start of its turn when it can move
//   linked    – lasts while another condition of the same `group` lasts
//   rest      { rest: 'short' | 'long' } – until a rest of that kind (a long rest also counts as short)
//   permanent – until something removes it (a spell, Duncan, the end of a fight for combat effects)
//
// Adaptations to this game (no map, no exact distances): every creature of a
// fight can see the others and the hero is always within reach, so "while the
// source is in sight" always holds in combat and a melee attack is always made
// within 1,5 m. Pure functions; dice come from a `rollDie(sides)` callback.

import { armorDisadvantage } from './equipment';

export const EXHAUSTION_MAX = 6;

/** Every condition: name, icon for the badges and what it does in this game. */
export const CONDITIONS = {
  agarrado: {
    id: 'agarrado', name: 'Agarrado', icon: '🤼',
    effect: 'Velocidad 0 (no puede huir). Desventaja en los ataques contra cualquiera que no sea quien lo agarra. Se libera con una acción (Atletismo o Acrobacias contra la CD) o si quien lo agarra cae o queda incapacitado.'
  },
  apresado: {
    id: 'apresado', name: 'Apresado', icon: '⛓️',
    effect: 'Velocidad 0. Desventaja en sus ataques y en las salvaciones de Destreza; los ataques contra él tienen ventaja.'
  },
  asustado: {
    id: 'asustado', name: 'Asustado', icon: '😱',
    effect: 'Desventaja en las tiradas de ataque y en las pruebas de característica mientras ve la fuente de su miedo (en combate, siempre).'
  },
  aturdido: {
    id: 'aturdido', name: 'Aturdido', icon: '💫', implies: ['incapacitado'],
    effect: 'Incapacitado: no puede actuar. Falla automáticamente las salvaciones de Fuerza y Destreza; los ataques contra él tienen ventaja.'
  },
  cegado: {
    id: 'cegado', name: 'Cegado', icon: '🙈',
    effect: 'Falla las pruebas que requieren ver. Sus ataques tienen desventaja y los ataques contra él, ventaja.'
  },
  derribado: {
    id: 'derribado', name: 'Derribado', icon: '⬇️',
    effect: 'Desventaja en sus ataques. Los ataques cuerpo a cuerpo contra él tienen ventaja y los ataques a distancia, desventaja. Se levanta al empezar su turno si puede moverse.'
  },
  encantado: {
    id: 'encantado', name: 'Encantado', icon: '💞',
    effect: 'No puede atacar a quien lo ha encantado, y este tiene ventaja en las interacciones sociales con él.'
  },
  ensordecido: {
    id: 'ensordecido', name: 'Ensordecido', icon: '🔇',
    effect: 'No oye nada: falla las pruebas que requieren oír. No cambia las tiradas de combate.'
  },
  envenenado: {
    id: 'envenenado', name: 'Envenenado', icon: '🤢',
    effect: 'Desventaja en las tiradas de ataque y en las pruebas de característica.'
  },
  incapacitado: {
    id: 'incapacitado', name: 'Incapacitado', icon: '😵',
    effect: 'No puede hacer acciones ni acciones adicionales (pierde el turno) y pierde la concentración. Tira la iniciativa con desventaja.'
  },
  inconsciente: {
    id: 'inconsciente', name: 'Inconsciente', icon: '💤', implies: ['incapacitado', 'derribado'],
    effect: 'Incapacitado y derribado. Falla automáticamente las salvaciones de Fuerza y Destreza; los ataques contra él tienen ventaja y los que impactan cuerpo a cuerpo son críticos.'
  },
  invisible: {
    id: 'invisible', name: 'Invisible', icon: '👻',
    effect: 'Ventaja en la iniciativa y en sus ataques; los ataques contra él tienen desventaja.'
  },
  paralizado: {
    id: 'paralizado', name: 'Paralizado', icon: '🧊', implies: ['incapacitado'],
    effect: 'Incapacitado y con velocidad 0. Falla automáticamente las salvaciones de Fuerza y Destreza; los ataques contra él tienen ventaja y los que impactan cuerpo a cuerpo son críticos.'
  },
  petrificado: {
    id: 'petrificado', name: 'Petrificado', icon: '🗿', implies: ['incapacitado'],
    effect: 'Convertido en piedra: incapacitado y con velocidad 0, falla las salvaciones de Fuerza y Destreza, los ataques contra él tienen ventaja, resiste todo el daño y es inmune al veneno.'
  },
  agotamiento: {
    id: 'agotamiento', name: 'Agotamiento', icon: '🥱',
    effect: 'Cada nivel resta 2 a todas las tiradas de d20 (ataques, salvaciones y pruebas) y 1,5 m a la velocidad. Un descanso largo quita un nivel. Con 6 niveles el héroe se desploma.'
  }
};

export const CONDITION_IDS = Object.keys(CONDITIONS);
export const conditionName = id => CONDITIONS[id]?.name || id;
const lower = id => conditionName(id).toLowerCase();

/** Kinds of creature immune to some conditions (an approximation of their SRD stat blocks). */
export const TYPE_IMMUNITIES = {
  'muerto viviente': ['envenenado', 'agotamiento'],
  constructo: ['encantado', 'asustado', 'paralizado', 'petrificado', 'envenenado', 'agotamiento'],
  elemental: ['envenenado', 'paralizado', 'petrificado', 'inconsciente', 'agotamiento'],
  cieno: ['cegado', 'encantado', 'ensordecido', 'asustado', 'derribado', 'agotamiento']
};

export const isImmune = (creature, id) => (TYPE_IMMUNITIES[creature?.type] || []).includes(id)
  || (creature?.conditionImmunities || []).includes(id);

// ---------------------------------------------------------------------------
// Reading a creature's conditions
// ---------------------------------------------------------------------------

export const conditionsOf = creature => (Array.isArray(creature?.conditions) ? creature.conditions : []);

/** Ids of the conditions in effect, with the ones they imply (paralyzed -> incapacitated...). */
export function activeIds(creature) {
  const ids = new Set();
  conditionsOf(creature).forEach(c => {
    ids.add(c.id);
    (CONDITIONS[c.id]?.implies || []).forEach(id => ids.add(id));
  });
  // A petrified creature is immune to poison
  if (ids.has('petrificado')) ids.delete('envenenado');
  return ids;
}

export const hasCondition = (creature, id) => activeIds(creature).has(id);
export const isIncapacitated = creature => hasCondition(creature, 'incapacitado');

export function exhaustionLevel(creature) {
  return conditionsOf(creature)
    .filter(c => c.id === 'agotamiento')
    .reduce((max, c) => Math.max(max, Number(c.level) || 1), 0);
}

/** Every d20 test is reduced by 2 per level of Exhaustion. */
export const d20Penalty = creature => 2 * exhaustionLevel(creature);

const SPEED_ZERO = ['agarrado', 'apresado', 'paralizado', 'petrificado', 'inconsciente'];
/** Why the creature cannot move (null if it can). */
export function speedZeroReason(creature) {
  const ids = activeIds(creature);
  const id = SPEED_ZERO.find(c => ids.has(c));
  return id ? conditionName(id) : null;
}

/**
 * Speed in metres once conditions apply: 0 when grappled, restrained, paralyzed...;
 * 1,5 m less per level of Exhaustion (never below 0).
 * @param {number} base  speed without conditions (see speedInMetres in equipment.js)
 */
export function speedWithConditions(creature, base) {
  if (speedZeroReason(creature)) return 0;
  return Math.max(0, base - 1.5 * exhaustionLevel(creature));
}

// ---------------------------------------------------------------------------
// d20 tests: advantage, disadvantage, automatic failures
// ---------------------------------------------------------------------------

/** 'advantage' | 'disadvantage' | 'normal': one of each cancels out. */
export function d20Mode({ advantage = [], disadvantage = [] } = {}) {
  if (advantage.length && !disadvantage.length) return 'advantage';
  if (disadvantage.length && !advantage.length) return 'disadvantage';
  return 'normal';
}

/**
 * Roll a d20 with advantage (higher of two) or disadvantage (lower of two).
 * @returns {{ raw, rolls, mode }}
 */
export function rollD20(rollDie, modifiers = {}) {
  const mode = d20Mode(modifiers);
  if (mode === 'normal') {
    const raw = rollDie(20);
    return { raw, rolls: [raw], mode };
  }
  const rolls = [rollDie(20), rollDie(20)];
  return { raw: mode === 'advantage' ? Math.max(...rolls) : Math.min(...rolls), rolls, mode };
}

/** " (con ventaja: objetivo paralizado)" for the combat log. */
export function describeMode({ mode, advantage = [], disadvantage = [] }) {
  if (mode === 'advantage') return ` (con ventaja: ${advantage.join(', ')})`;
  if (mode === 'disadvantage') return ` (con desventaja: ${disadvantage.join(', ')})`;
  if (advantage.length && disadvantage.length) return ' (ventaja y desventaja se anulan)';
  return '';
}

const grapplers = creature => conditionsOf(creature).filter(c => c.id === 'agarrado').map(c => c.sourceUid);
const charmers = creature => conditionsOf(creature).filter(c => c.id === 'encantado').map(c => c.sourceUid).filter(Boolean);

/**
 * Advantage and disadvantage of an attack roll from the conditions of both sides.
 * @param {object} attacker / target  creatures (hero or enemy) with `conditions`
 * @param {{ ranged?: boolean, targetUid?: string, dodging?: boolean }} options
 *   ranged: the attack is made from a distance (a melee attack is always within 1,5 m here)
 *   dodging: the target took the Dodge action (lost when incapacitated or at speed 0)
 * @returns {{ advantage: string[], disadvantage: string[], autoCrit: boolean, penalty: number, blocked: string | null }}
 *   blocked: why the attacker cannot attack this target at all (charmed by it)
 */
export function attackModifiers(attacker, target, { ranged = false, targetUid = null, dodging = false } = {}) {
  const advantage = [];
  const disadvantage = [];
  const mine = activeIds(attacker);
  const theirs = activeIds(target);

  ['cegado', 'envenenado', 'asustado', 'derribado', 'apresado'].forEach(id => { if (mine.has(id)) disadvantage.push(lower(id)); });
  if (mine.has('agarrado') && targetUid && !grapplers(attacker).includes(targetUid)) disadvantage.push('agarrado por otro');
  if (mine.has('invisible')) advantage.push('invisible');

  if (theirs.has('cegado')) advantage.push('objetivo cegado');
  if (theirs.has('invisible')) disadvantage.push('objetivo invisible');
  ['paralizado', 'aturdido', 'inconsciente', 'petrificado', 'apresado'].forEach(id => { if (theirs.has(id)) advantage.push(`objetivo ${lower(id)}`); });
  if (theirs.has('derribado')) {
    if (ranged) disadvantage.push('objetivo derribado, a distancia');
    else advantage.push('objetivo derribado');
  }
  if (dodging && !theirs.has('incapacitado') && !speedZeroReason(target)) disadvantage.push('el objetivo esquiva');

  const autoCrit = !ranged && (theirs.has('paralizado') || theirs.has('inconsciente'));
  const blocked = targetUid && charmers(attacker).includes(targetUid) ? 'está encantado por su objetivo' : null;
  return { advantage: [...new Set(advantage)], disadvantage: [...new Set(disadvantage)], autoCrit, penalty: d20Penalty(attacker), blocked };
}

const AUTO_FAIL_STR_DEX = ['paralizado', 'aturdido', 'petrificado', 'inconsciente'];

/**
 * Modifiers of a saving throw.
 * @returns {{ autoFail: string | null, advantage: string[], disadvantage: string[], penalty: number }}
 */
export function saveModifiers(creature, ability, { advantage: extraAdvantage = [] } = {}) {
  const ids = activeIds(creature);
  const advantage = [...extraAdvantage];
  const disadvantage = [];
  let autoFail = null;
  if (ability === 'fue' || ability === 'des') {
    const id = AUTO_FAIL_STR_DEX.find(c => ids.has(c));
    if (id) autoFail = lower(id);
  }
  if (ability === 'des' && ids.has('apresado')) disadvantage.push('apresado');
  const armor = armorDisadvantage(creature, { ability });
  if (armor) disadvantage.push(armor);
  return { autoFail, advantage, disadvantage, penalty: d20Penalty(creature) };
}

/**
 * Modifiers of an ability check (skills, fleeing, breaking free, initiative).
 * Includes the armor without training (PR #3), so every check goes through here.
 * @returns {{ advantage: string[], disadvantage: string[], penalty: number }}
 */
export function checkModifiers(creature, { ability = null, skillId = null, initiative = false } = {}) {
  const ids = activeIds(creature);
  const advantage = [];
  const disadvantage = [];
  if (ids.has('envenenado')) disadvantage.push('envenenado');
  if (ids.has('asustado')) disadvantage.push('asustado');
  if (initiative && ids.has('invisible')) advantage.push('invisible');
  if (initiative && ids.has('incapacitado')) disadvantage.push('incapacitado');
  const armor = armorDisadvantage(creature, { ability, skillId });
  if (armor) disadvantage.push(armor);
  return { advantage, disadvantage, penalty: d20Penalty(creature) };
}

/**
 * Roll a saving throw with every condition applied.
 * Natural 20 always succeeds and natural 1 always fails (as the rest of the game does).
 * @returns {{ raw, rolls, mode, total, success, autoFail, text }}
 */
export function rollSave(creature, ability, bonus, dc, rollDie, extra = {}) {
  const mods = saveModifiers(creature, ability, extra);
  if (mods.autoFail) {
    return { raw: null, rolls: [], mode: 'normal', total: null, success: false, autoFail: mods.autoFail, text: `falla automáticamente (${mods.autoFail})` };
  }
  const roll = rollD20(rollDie, mods);
  const total = roll.raw + bonus - mods.penalty;
  const success = roll.raw !== 1 && (roll.raw === 20 || total >= dc);
  const sign = n => `${n >= 0 ? '+' : '−'}${Math.abs(n)}`;
  const text = `${roll.raw}${sign(bonus - mods.penalty)} = ${total} vs CD ${dc}${describeMode({ ...roll, ...mods })}`;
  return { ...roll, total, success, autoFail: null, text };
}

// ---------------------------------------------------------------------------
// Creating, adding and removing conditions
// ---------------------------------------------------------------------------

let keyCounter = 0;
const newKey = id => `${id}-${Date.now().toString(36)}-${(keyCounter++).toString(36)}`;

/**
 * Turn a data spec (monster attack, spell, Duncan) into a condition.
 * @param {object} spec  { id, duration?, level?, group?, cause?, endsOnDamage?, saveOnDamage?, endsOnAttack?,
 *                         flees?, keepsWithoutSource?, thenSave? }
 *   duration: 'endOfTargetNextTurn' | 'startOfSourceNextTurn' | 'endOfSourceNextTurn' | 'permanent' | 'linked'
 *             | { save: { ability, dc }, maxRounds?, worsen? } | { escape: dc } | { rest } | { rounds: n }
 * @param {{ sourceUid?, source?, targetUid, actorUid?, concentration? }} context
 *   actorUid: whose turn it is now ("until the end of its next turn" skips the turn in progress)
 */
export function createCondition(spec, { sourceUid = null, source = '', targetUid = 'player', actorUid = null, concentration = null } = {}) {
  const raw = spec.duration;
  let duration;
  const turns = (at, of, next = true, remaining = 1) => ({ type: 'turns', at, of, remaining: remaining + (at === 'end' && of === actorUid ? 1 : 0), next });
  if (raw === 'endOfTargetNextTurn') duration = turns('end', targetUid);
  else if (raw === 'startOfSourceNextTurn') duration = turns('start', sourceUid || targetUid);
  else if (raw === 'endOfSourceNextTurn') duration = turns('end', sourceUid || targetUid);
  else if (raw === 'linked') duration = { type: 'linked' };
  else if (raw === 'permanent') duration = { type: 'permanent' };
  else if (raw && typeof raw === 'object' && raw.save) {
    duration = { type: 'save', ability: raw.save.ability, dc: raw.save.dc, maxRounds: raw.maxRounds || null, rounds: 0, fails: 0, worsen: raw.worsen || null };
  } else if (raw && typeof raw === 'object' && raw.escape) duration = { type: 'escape', dc: raw.escape };
  else if (raw && typeof raw === 'object' && raw.rest) duration = { type: 'rest', rest: raw.rest === 'short' ? 'short' : 'long' };
  else if (raw && typeof raw === 'object' && raw.rounds) duration = turns('end', targetUid, false, raw.rounds);
  else if (raw && typeof raw === 'object' && raw.type) duration = { ...raw };
  else duration = spec.id === 'derribado' ? { type: 'prone' } : { type: 'permanent' };

  return {
    key: newKey(spec.id),
    id: spec.id,
    ...(source ? { source } : {}),
    ...(sourceUid ? { sourceUid } : {}),
    duration,
    ...(spec.id === 'agotamiento' ? { level: Math.min(EXHAUSTION_MAX, Math.max(1, Number(spec.level) || 1)) } : {}),
    ...(spec.group ? { group: spec.group } : {}),
    ...(spec.cause ? { cause: spec.cause } : {}),
    ...(concentration ? { concentration } : {}),
    ...(spec.endsOnDamage ? { endsOnDamage: true } : {}),
    ...(spec.saveOnDamage ? { saveOnDamage: true } : {}),
    ...(spec.endsOnAttack ? { endsOnAttack: true } : {}),
    ...(spec.flees ? { flees: true } : {}),
    ...(spec.keepsWithoutSource ? { keepsWithoutSource: true } : {}),
    ...(spec.thenSave ? { thenSave: spec.thenSave } : {})
  };
}

/**
 * Add a condition to a creature.
 * - Immune creatures (by type) are not affected.
 * - Prone does not stack; Exhaustion adds levels to the single entry (up to 6).
 * - The same condition from the same source replaces the older one.
 * @returns {{ creature, added: boolean, immune: boolean, condition }}
 */
export function addCondition(creature, condition) {
  if (isImmune(creature, condition.id)) return { creature, added: false, immune: true, condition };
  const list = conditionsOf(creature);
  if (condition.id === 'derribado' && list.some(c => c.id === 'derribado')) return { creature, added: false, immune: false, condition };
  if (condition.id === 'agotamiento') {
    const current = list.find(c => c.id === 'agotamiento');
    if (current) {
      const merged = { ...current, level: Math.min(EXHAUSTION_MAX, (Number(current.level) || 1) + (Number(condition.level) || 1)) };
      return { creature: { ...creature, conditions: list.map(c => (c === current ? merged : c)) }, added: true, immune: false, condition: merged };
    }
  }
  const kept = list.filter(c => !(c.id === condition.id && condition.sourceUid && c.sourceUid === condition.sourceUid));
  return { creature: { ...creature, conditions: [...kept, condition] }, added: true, immune: false, condition };
}

/** Drop 'linked' conditions whose group has nothing else left. */
function dropOrphans(list) {
  return list.filter(c => c.duration?.type !== 'linked' || list.some(o => o !== c && o.group === c.group && o.duration?.type !== 'linked'));
}

/**
 * Remove the conditions matching `predicate` (and the ones linked to them).
 * @returns {{ creature, removed: object[] }}
 */
export function removeConditions(creature, predicate) {
  const list = conditionsOf(creature);
  const kept = dropOrphans(list.filter(c => !predicate(c)));
  const removed = list.filter(c => !kept.includes(c));
  if (!removed.length) return { creature, removed };
  return { creature: { ...creature, conditions: kept }, removed };
}

/** Lower Exhaustion by `levels` (removed at 0). */
export function reduceExhaustion(creature, levels = 1) {
  const current = conditionsOf(creature).find(c => c.id === 'agotamiento');
  if (!current) return { creature, before: 0, after: 0 };
  const before = Number(current.level) || 1;
  const after = Math.max(0, before - levels);
  const conditions = after === 0
    ? conditionsOf(creature).filter(c => c !== current)
    : conditionsOf(creature).map(c => (c === current ? { ...c, level: after } : c));
  return { creature: { ...creature, conditions }, before, after };
}

/** Conditions that only make sense inside a fight (turns, saves, grapples, prone...). */
export const isCombatOnly = condition => !['rest', 'permanent'].includes(condition.duration?.type) || Boolean(condition.sourceUid) || Boolean(condition.concentration);

/** When a fight ends, the effects that lasted turns or depended on the enemies end too. */
export function endCombatConditions(creature) {
  return removeConditions(creature, isCombatOnly);
}

/**
 * Rests: a short rest ends conditions that last "until a short rest"; a long rest
 * also ends those that last "until a long rest" and lowers Exhaustion by one level.
 * @returns {{ creature, removed: object[], exhaustion: { before, after } }}
 */
export function restConditions(creature, kind) {
  const ends = c => isCombatOnly(c) || (c.duration?.type === 'rest' && (kind === 'long' || c.duration.rest === 'short'));
  const { creature: rested, removed } = removeConditions(creature, ends);
  if (kind !== 'long') return { creature: rested, removed, exhaustion: { before: exhaustionLevel(creature), after: exhaustionLevel(creature) } };
  const { creature: next, before, after } = reduceExhaustion(rested, 1);
  return { creature: next, removed, exhaustion: { before, after } };
}

// ---------------------------------------------------------------------------
// Turns
// ---------------------------------------------------------------------------

/**
 * A turn starts or ends: count down the durations tied to that moment.
 * @param {'start' | 'end'} at
 * @param {string} uid  whose turn it is ('player' for the hero)
 * @returns {{ creature, expired: object[] }}
 */
export function tickDurations(creature, at, uid) {
  const list = conditionsOf(creature);
  if (!list.some(c => c.duration?.type === 'turns' && c.duration.at === at && c.duration.of === uid)) return { creature, expired: [] };
  const ticked = list.map(c => (c.duration?.type === 'turns' && c.duration.at === at && c.duration.of === uid
    ? { ...c, duration: { ...c.duration, remaining: c.duration.remaining - 1 } }
    : c));
  const { creature: next, removed } = removeConditions({ ...creature, conditions: ticked }, c => c.duration?.type === 'turns' && c.duration.remaining <= 0);
  return { creature: next, expired: removed };
}

/** Normalize the conditions stored in a save (older saves have none). */
export function normalizeConditions(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter(c => c && typeof c === 'object' && CONDITIONS[c.id] && c.duration && typeof c.duration.type === 'string')
    .map(c => ({ ...c, key: c.key || newKey(c.id), ...(c.id === 'agotamiento' ? { level: Math.min(EXHAUSTION_MAX, Math.max(1, Number(c.level) || 1)) } : {}) }));
}

// ---------------------------------------------------------------------------
// Texts
// ---------------------------------------------------------------------------

const ABILITY_NAMES = { fue: 'Fuerza', des: 'Destreza', con: 'Constitución', int: 'Inteligencia', sab: 'Sabiduría', car: 'Carisma' };
export const abilityName = id => ABILITY_NAMES[id] || id;

/**
 * How long a condition lasts, in words.
 * @param {(uid: string) => string} nameOf  the name of a creature of the fight ('player' -> the hero)
 */
export function describeDuration(condition, nameOf = uid => uid) {
  const d = condition.duration || {};
  if (condition.id === 'agotamiento') return 'hasta que se recupere: cada descanso largo quita un nivel';
  switch (d.type) {
    case 'turns': {
      const moment = d.at === 'start' ? 'el inicio' : 'el final';
      if (d.next && d.remaining <= 2) {
        return d.of === 'player' ? `hasta ${moment} de tu próximo turno` : `hasta ${moment} del próximo turno de ${nameOf(d.of)}`;
      }
      const whose = d.of === 'player' ? 'tuyos' : `de ${nameOf(d.of)}`;
      return `${d.remaining} turnos más ${whose}`;
    }
    case 'save': {
      const extra = d.worsen ? ` (si falla ${d.worsen.after} veces, queda ${lower(d.worsen.to)})` : '';
      return `hasta superar una salvación de ${abilityName(d.ability)} CD ${d.dc}, que repite al final de cada turno${d.maxRounds ? ` (máximo ${d.maxRounds} turnos)` : ''}${extra}`;
    }
    case 'escape': return `hasta liberarse: acción, Atletismo o Acrobacias CD ${d.dc}${condition.keepsWithoutSource ? '' : ', o si quien lo sujeta cae'}`;
    case 'prone': return 'hasta que se levante (al empezar su turno, si puede moverse)';
    case 'linked': return 'mientras dure el efecto que lo causa';
    case 'rest': return d.rest === 'short' ? 'hasta un descanso corto o largo' : 'hasta un descanso largo';
    default: return 'hasta que algo lo cure';
  }
}

/** Extra notes of a condition for the tooltip (sleep that ends with damage, concentration...). */
function conditionNotes(condition) {
  return [
    condition.concentration && 'depende de la concentración de quien lo lanzó',
    condition.endsOnDamage && 'termina si recibe daño',
    condition.saveOnDamage && 'repite la salvación cada vez que recibe daño',
    condition.endsOnAttack && 'termina al atacar o lanzar un conjuro',
    condition.flees && 'pasa sus turnos huyendo'
  ].filter(Boolean);
}

/** Badge data for the UI: [{ key, id, icon, label, tooltip }] (Exhaustion shows its level). */
export function conditionBadges(creature, nameOf = uid => uid) {
  const seen = new Set();
  return conditionsOf(creature)
    .filter(c => CONDITIONS[c.id])
    .filter(c => {
      // One badge per condition and source
      const id = `${c.id}|${c.sourceUid || ''}|${c.source || ''}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map(c => {
      const info = CONDITIONS[c.id];
      const label = c.id === 'agotamiento' ? `${info.name} ${c.level || 1}` : info.name;
      const from = c.source ? ` Causa: ${c.source}${c.cause ? ` (${c.cause})` : ''}.` : c.cause ? ` Causa: ${c.cause}.` : '';
      const notes = conditionNotes(c);
      const exhaustion = c.id === 'agotamiento' ? ` Ahora: −${2 * (c.level || 1)} a las tiradas de d20.` : '';
      return {
        key: c.key || `${c.id}|${c.sourceUid || ''}`,
        id: c.id,
        icon: info.icon,
        label,
        tooltip: `${label}: ${info.effect}${exhaustion} Dura ${describeDuration(c, nameOf)}.${notes.length ? ` ${notes.join('; ')}.` : ''}${from}`
      };
    });
}

/** "Envenenado (hasta un descanso largo), Agotamiento 2" for Duncan's prompt. */
export function describeConditionsForPrompt(creature) {
  const list = conditionsOf(creature);
  if (!list.length) return '';
  return list
    .map(c => `${c.id === 'agotamiento' ? `${conditionName(c.id)} nivel ${c.level || 1}` : conditionName(c.id)} (${describeDuration(c, () => 'un enemigo')}${c.cause ? `; ${c.cause}` : ''})`)
    .join(', ');
}

/**
 * A fact for the campaign memory when an important condition changes:
 * Exhaustion, or any condition that lasts until a rest or longer. Null otherwise.
 * @param {{ id, action: 'add' | 'remove', level?, condition? }} change
 */
export function conditionFact(name, change) {
  const c = change.condition;
  const lasting = c && ['rest', 'permanent'].includes(c.duration?.type) && !c.sourceUid;
  if (change.id !== 'agotamiento' && !lasting) return null;
  const cause = c?.cause ? ` (${c.cause})` : '';
  if (change.id === 'agotamiento') {
    if (!change.level) return `${name} se recupera del agotamiento`;
    return change.action === 'add'
      ? `${name} sufre agotamiento de nivel ${change.level}${cause}`
      : `El agotamiento de ${name} baja a nivel ${change.level}`;
  }
  return change.action === 'add'
    ? `${name} queda ${lower(change.id)}${cause}, ${describeDuration(c)}`
    : `${name} ya no está ${lower(change.id)}`;
}

// ---------------------------------------------------------------------------
// Conditions from the story (Duncan's structured reply)
// ---------------------------------------------------------------------------

/**
 * Conditions Duncan may give the hero outside combat. Prone, grappled, restrained,
 * incapacitated and unconscious only make sense turn by turn: the fights handle them.
 */
export const STORY_CONDITION_IDS = ['agotamiento', 'envenenado', 'cegado', 'ensordecido', 'asustado', 'encantado', 'paralizado', 'petrificado', 'aturdido', 'invisible'];

/**
 * Apply the changes of a scene to the hero.
 * @param {{ id, action: 'add' | 'remove', duration?: { rest } | 'permanent', level?, cause? }[]} changes
 *   (validated by cleanConditionChanges in dmPrompt.js). Exhaustion adds or removes levels;
 *   the other conditions last until a long rest unless the change says otherwise.
 * @returns {{ character, applied: { id, action, level, condition }[], collapsed: boolean }}
 *   collapsed: Exhaustion reached level 6
 */
export function applyConditionChanges(character, changes = []) {
  let next = character;
  const applied = [];
  for (const change of Array.isArray(changes) ? changes : []) {
    if (!CONDITIONS[change?.id]) continue;
    if (change.action === 'add') {
      if (!STORY_CONDITION_IDS.includes(change.id)) continue;
      const duration = change.id === 'agotamiento' ? 'permanent' : change.duration || { rest: 'long' };
      const condition = createCondition({ id: change.id, level: change.level, cause: change.cause, duration }, { targetUid: 'player' });
      const result = addCondition(next, condition);
      if (!result.added) continue;
      next = result.creature;
      applied.push({ id: change.id, action: 'add', level: change.id === 'agotamiento' ? result.condition.level : null, condition: result.condition });
    } else if (change.action === 'remove') {
      if (change.id === 'agotamiento') {
        const current = conditionsOf(next).find(c => c.id === 'agotamiento');
        const tired = reduceExhaustion(next, change.level || EXHAUSTION_MAX);
        if (tired.before === tired.after) continue;
        next = tired.creature;
        applied.push({ id: 'agotamiento', action: 'remove', level: tired.after, condition: current });
        continue;
      }
      const { creature, removed } = removeConditions(next, c => c.id === change.id);
      if (!removed.length) continue;
      next = creature;
      applied.push({ id: change.id, action: 'remove', level: null, condition: removed[0] });
    }
  }
  return { character: next, applied, collapsed: exhaustionLevel(next) >= EXHAUSTION_MAX };
}

/** The line shown in the chronicle for a change of conditions. */
export function describeConditionChange(name, change) {
  const info = CONDITIONS[change.id];
  if (change.id === 'agotamiento') {
    if (change.action === 'add') return `${info.icon} ${name} sufre agotamiento: nivel ${change.level} (−${2 * change.level} a las tiradas de d20).`;
    return change.level ? `${info.icon} El agotamiento de ${name} baja a nivel ${change.level}.` : `${info.icon} ${name} ya no sufre agotamiento.`;
  }
  if (change.action === 'add') {
    return `${info.icon} ${name} queda ${lower(change.id)}${change.condition?.cause ? ` (${change.condition.cause})` : ''}: ${info.effect} Dura ${describeDuration(change.condition)}.`;
  }
  return `${info.icon} ${name} ya no está ${lower(change.id)}.`;
}
