// Combat encounters resolved entirely by the game (no AI): initiative, the
// heroes' turns, enemy turns, conditions, morale (fleeing / surrendering) and experience.
//
// Pure functions. Dice come from a `rollDie(sides)` callback. Every function
// returns new objects; the encounter is plain data so it can be saved with the
// campaign and resumed later.
//
// The party: one to four heroes, each with its own turn in the initiative. A
// hero is identified in the fight (turn order, condition sources and
// durations) by `heroUid(hero)`: its `id`, or 'player' (PLAYER) for a lone hero
// without one. The functions accept one hero or an array of heroes and always
// return the whole party as `heroes` (and `character`: the acting hero, or the
// only one).
//
// Conditions (see conditions.js) live on each hero (`character.conditions`, kept
// after the fight only when they last until a rest or longer) and on each enemy
// (`enemy.conditions`). Turn hooks: at the start of a turn the durations tied to
// it count down and a prone creature stands up; a creature that is incapacitated
// loses its turn; at the end of a turn it repeats its saving throws and the
// durations tied to the end of that turn count down.
//
// A hero who drops to 0 HP falls unconscious (condition `inconsciente`, duration
// 'down'): no death saving throws in this game; enemies leave them alone and
// pick another target; a healing spell or a potion from an ally wakes them up,
// and at the end of a won fight they get up with 1 HP. The fight is lost only
// when every hero is down.
//
// Enemy targets (simple and predictable): an enemy attacks the hero who hit it
// last; if nobody has hit it (or that hero is down or can't be attacked, e.g.
// it is charmed by them), it keeps the hero it attacked before, otherwise it
// picks one at random among the conscious heroes it can attack.

import { resolveAttack, attackOptions } from './combat';
import { castSpell, parseDice, spellRows } from './spellcasting';
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

/** The id of a lone hero without an id (older saves, tests). */
export const PLAYER = 'player';

/** How a hero is known in the fight. */
export const heroUid = hero => hero?.id || PLAYER;

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
// The party
// ---------------------------------------------------------------------------

const asList = heroes => (Array.isArray(heroes) ? heroes : [heroes]);
const isDown = hero => (Number(hero?.hp) || 0) <= 0;
/** Heroes still standing. */
export const consciousHeroes = heroes => asList(heroes).filter(h => !isDown(h));

/** The value returned to the caller: the whole party, and the acting (or only) hero. */
const out = (input, heroes, actorUid = null) => ({
  heroes,
  character: Array.isArray(input) ? (heroes.find(h => heroUid(h) === actorUid) || heroes[0]) : heroes[0]
});

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

/** A creature's saving throw bonus (listed save, or its ability modifier). */
export const enemySaveBonus = (enemy, ability) => enemy.saves?.[ability] ?? mod(enemy.stats?.[ability]);

/** A hero's saving throw bonus (ability modifier + proficiency if proficient). */
export function playerSaveBonus(character, ability) {
  const proficient = (character.savingThrows || []).includes(ability);
  return mod(character.stats?.[ability]) + (proficient ? Number(character.proficiencyBonus) || 2 : 0);
}

const playerInitiativeBonus = character => mod(character.stats?.des)
  + ((character.feats || []).some(f => /alerta/i.test(f)) ? Number(character.proficiencyBonus) || 2 : 0);

/**
 * Start an encounter.
 * @param {{monster: object, count?: number, name?: string}[]} groups  creatures (from the bestiary)
 * @param {object | object[]} party  the hero, or the heroes (each with its own `id`)
 * @param {(sides: number) => number} rollDie
 * @param {{ surprise?: object, opening?: object }} [options]
 *   surprise: who doesn't see the fight coming (see "Surprise and the opening strike" below):
 *     { side: 'enemies' | 'heroes', who?: 'all' | string[], reason?, check? }
 *     who: monster ids, enemy uids or names (side 'enemies'); hero ids or names (side 'heroes')
 *     check: { skill: 'stealth' | 'deception', heroUid } (the party hides or lies) or
 *            { skill: 'stealth' } (the enemies lie in wait): the game rolls it against
 *            the passive Perception of each creature of the other side
 *   opening: { heroUid, suggest?, needs? } the hero who started the fight with an
 *     attack: that attack is played before the initiative (see openingAction)
 * @returns the encounter state (a hero's turn, or the enemies act first:
 *          call `runEnemyTurns` right after to let them act until a hero's turn;
 *          with a pending opening strike it is that hero's move)
 */
export function createEncounter(groups, party, rollDie, { surprise = null, opening = null } = {}) {
  const heroes = asList(party);
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
        targetUid: null, // the hero it goes for (see the enemy targets rule above)
        recharge: Object.fromEntries((monster.actions || []).filter(a => a.recharge).map(a => [a.id, true])),
        initiative: monster.initiative ?? mod(monster.stats?.des) // + the d20, below
      });
    }
  });

  // Surprise: who is caught off guard (after the hidden side's check, if any).
  // A surprised creature rolls its initiative with Disadvantage (2024 rules).
  const caught = surprisedUids(surprise, enemies, heroes, rollDie);
  enemies.forEach(e => {
    const surprised = caught.uids.includes(e.uid);
    e.initiative += surprised ? rollD20(rollDie, { disadvantage: ['sorprendido'] }).raw : rollDie(20);
    if (surprised) e.surprised = true;
  });

  // Initiative is a Dexterity check: poisoned, invisible, incapacitated, exhausted... and surprised
  const heroSlots = heroes.map((hero, index) => {
    const initiativeMods = checkModifiers(hero, { ability: 'des', initiative: true });
    if (caught.uids.includes(heroUid(hero))) initiativeMods.disadvantage.push('sorprendido');
    const initiative = rollD20(rollDie, initiativeMods).raw + playerInitiativeBonus(hero) - initiativeMods.penalty;
    return { kind: 'player', uid: heroUid(hero), initiative, index };
  });
  const order = [
    ...heroSlots,
    ...enemies.map(e => ({ kind: 'enemy', uid: e.uid, initiative: e.initiative }))
  ]
    .sort((a, b) => b.initiative - a.initiative || (a.kind === b.kind ? (a.index ?? 0) - (b.index ?? 0) : a.kind === 'player' ? -1 : 1))
    .map(slot => { const copy = { ...slot }; delete copy.index; return copy; });
  const nameOfSlot = o => (o.kind === 'player' ? heroes.find(h => heroUid(h) === o.uid)?.name : enemies.find(e => e.uid === o.uid)?.name);

  const encounter = {
    round: 1,
    turn: 0,
    order,
    enemies,
    heroIds: heroes.map(heroUid),
    status: 'active', // active | victory | defeat | fled
    dodging: [],         // heroes that took the Dodge action (until their next turn)
    concentrations: {},  // heroUid -> { spellId, name, token } while that hero concentrates on a spell
    immunities: [],      // "enemyUid:actionId:heroUid": that hero resisted it and is immune for this fight
    xp: 0,
    ...(caught.side ? {
      surprise: {
        side: caught.side,
        uids: caught.uids,
        names: caught.uids.map(uid => nameOfSlot({ kind: caught.side === 'enemies' ? 'enemy' : 'player', uid })),
        reason: caught.reason,
        check: caught.check
      }
    } : {}),
    log: [
      { round: 1, kind: 'info', text: `¡Comienza el combate! Iniciativa: ${order.map(o => `${nameOfSlot(o)} ${o.initiative}`).join(', ')}.` },
      ...caught.log.map(text => ({ round: 1, kind: 'surprise', text }))
    ]
  };
  return addOpening(encounter, heroes, opening);
}

/**
 * Give a new encounter its opening strike (see below): the hero who started the
 * fight attacking plays it before the initiative. Nothing changes without a
 * hero of the fight, or once the fight has begun.
 * @param {{ heroUid, suggest?, needs?, choices? }} opening  see detectOpeningStrike in surprise.js
 */
export function addOpening(encounter, party, opening) {
  const heroes = asList(party);
  if (!opening?.heroUid || !isHeroUid(heroes, opening.heroUid) || encounter.opening || encounter.status !== 'active') return encounter;
  const attacker = heroOf(heroes, opening.heroUid);
  const caught = encounter.surprise?.side === 'enemies' && encounter.surprise.uids?.length;
  return pushLog(
    {
      ...encounter,
      opening: { heroUid: opening.heroUid, done: false, suggest: opening.suggest || null, needs: opening.needs || null, choices: opening.choices || null }
    },
    'opening', `⚡ Golpe de apertura: ${attacker.name} ataca antes de la iniciativa${caught ? ', con ventaja contra quien no lo ve venir' : ''}.`
  );
}

// ---------------------------------------------------------------------------
// Surprise and the opening strike
// ---------------------------------------------------------------------------
//
// SURPRISE (2024 rules): a creature that doesn't see the fight coming rolls its
// initiative with Disadvantage. Who is surprised is decided by Duncan (validated,
// see cleanSurprise in surprise.js) or by the local engine (an attack in a quiet
// scene; an ambush while exploring). When the hidden side makes a check (Stealth
// to sneak up, Deception to strike mid-conversation, the ambushers' Stealth), a
// creature whose passive Perception (10 + Wisdom modifier, + Perception for a
// hero) is equal or higher than the check notices it and is not surprised.
//
// THE OPENING STRIKE: the attack the player wrote to start the fight ("le clavo
// la daga al tabernero") is played by the game before the initiative, and it is
// that hero's turn of round 1 (their slot of round 1 is skipped; from round 2 on they
// act in their normal order; giving it up keeps the turn): a
// weapon attack or an offensive spell (attack roll, saving throw or automatic
// hit) against one enemy. Against a surprised enemy the attack roll has
// Advantage ("objetivo desprevenido"). Its damage, conditions and concentration
// count: the target may start the fight hurt or dead. While it is pending the
// fight waits for that hero (currentHeroUid is that hero): see openingAction.

/** Passive Perception: 10 + Wisdom modifier (+ Perception for a hero). */
export const passivePerception = (creature, isHero) => 10 + (isHero ? skillModifier(creature, 'perception') : mod(creature.stats?.sab));

const SKILL_NAMES = { stealth: 'Sigilo', deception: 'Engaño' };

/** Who is surprised: { side, uids, log, reason, check } (side null: nobody). */
function surprisedUids(surprise, enemies, heroes, rollDie) {
  const none = { side: null, uids: [], log: [], reason: '', check: null };
  if (!surprise || !['enemies', 'heroes'].includes(surprise.side)) return none;
  const side = surprise.side;
  const list = Array.isArray(surprise.who) ? surprise.who.map(w => String(w).toLowerCase()) : [];
  const all = !list.length || list.includes('all') || list.includes('todos');
  const matches = (...keys) => all || keys.some(k => k && list.includes(String(k).toLowerCase()));
  let candidates = side === 'enemies'
    ? enemies.filter(e => matches(e.monsterId, e.uid, e.name, e.baseName))
    : heroes.filter(h => matches(heroUid(h), h.name));
  if (!candidates.length) return none;
  const reason = typeof surprise.reason === 'string' ? surprise.reason.trim().replace(/\s+/g, ' ').slice(0, 120) : '';
  const log = [];
  let check = null;
  const skill = SKILL_NAMES[surprise.check?.skill] ? surprise.check.skill : null;
  if (skill) {
    let bonus;
    let by;
    let mods = { advantage: [], disadvantage: [], penalty: 0 };
    if (side === 'enemies') {
      // The hero who sneaks up or lies
      const hero = heroOf(heroes, surprise.check.heroUid) || heroes[0];
      bonus = skillModifier(hero, skill);
      mods = checkModifiers(hero, { ability: skill === 'stealth' ? 'des' : 'car', skillId: skill });
      by = hero.name;
    } else {
      // The ambushers: one roll with the worst Dexterity among them (as quiet as the clumsiest)
      bonus = Math.min(...enemies.map(e => mod(e.stats?.des)));
      by = 'Los atacantes';
    }
    const roll = rollD20(rollDie, mods);
    const total = roll.raw + bonus - mods.penalty;
    check = { skill, total, by };
    const noticed = [];
    candidates = candidates.filter(c => {
      const pp = passivePerception(c, side === 'heroes');
      if (pp >= total) noticed.push(`${c.name} (${pp})`);
      return pp < total;
    });
    log.push(`${by} ${side === 'enemies' ? `tira ${SKILL_NAMES[skill]}` : 'tiran Sigilo'}: ${withBonus(roll.raw, bonus - mods.penalty)} = ${total}${describeMode({ ...roll, ...mods })} contra la Percepción pasiva${noticed.length ? `; se dan cuenta: ${noticed.join(', ')}` : ': nadie se da cuenta'}.`);
  }
  if (!candidates.length) return { ...none, side, log: [...log, 'Nadie queda sorprendido.'], reason, check };
  const names = candidates.map(c => c.name);
  const many = names.length > 1;
  const whoText = side === 'enemies'
    ? `${names.join(', ')} ${many ? 'no lo ven venir: quedan sorprendidos' : 'no lo ve venir: queda sorprendido'}`
    : heroes.length > 1 && candidates.length === heroes.length
      ? 'El grupo cae en una emboscada: quedan sorprendidos'
      : `${names.join(', ')} ${many ? 'caen en una emboscada: quedan sorprendidos' : 'cae en una emboscada: queda sorprendido'}`;
  log.push(`😱 ¡Sorpresa! ${whoText}${reason ? ` (${reason})` : ''} y ${many ? 'tiran' : 'tira'} la iniciativa con desventaja.`);
  return { side, uids: candidates.map(c => (side === 'enemies' ? c.uid : heroUid(c))), log, reason, check };
}

/** The opening strike is still to be played. */
export const openingPending = encounter => Boolean(encounter?.status === 'active' && encounter.opening && !encounter.opening.done);

/** Spells that can open a fight: an attack roll, a saving throw or an automatic hit, against an enemy. */
export const OFFENSIVE_KINDS = ['attack', 'save', 'auto'];

/**
 * Play (or give up) the opening strike, then the initiative starts: the enemies
 * that won it act until a hero's turn. Same results as playerAction.
 * @param {object} action  { type: 'attack', optionId, targetUid, raging? } | { type: 'spell', spellId, targetUid }
 *   | { type: 'endTurn' } (the hero gives it up)
 */
function openingAction(encounter, party, action, rollDie) {
  const heroes = asList(party);
  const uid = encounter.opening.heroUid;
  const hero = heroOf(heroes, uid);
  let next = encounter;
  let hs = heroes;
  let animations = [];
  let result;
  const lost = lostTurnReason(hero);
  if (lost || action.type === 'endTurn') {
    next = pushLog(next, 'opening', lost ? `${hero.name} está ${lost} y no llega a atacar.` : `${hero.name} se lo piensa mejor y no ataca antes de la iniciativa.`);
    result = { skipped: true };
  } else {
    const spell = action.type === 'spell' ? spellRows(hero).find(s => s.id === action.spellId) : null;
    if (!['attack', 'spell'].includes(action.type) || (spell && !OFFENSIVE_KINDS.includes(spell.kind))) {
      return { ok: false, error: 'El golpe de apertura tiene que ser un ataque o un conjuro ofensivo.' };
    }
    const target = next.enemies.find(e => e.uid === action.targetUid && e.status === 'active');
    if (!target) return { ok: false, error: 'Elige a qué enemigo atacas.' };
    // A surprised target is caught off guard: Advantage on the attack roll (see attackModifiers)
    next = updateEnemy(next, target.uid, { unaware: Boolean(target.surprised) });
    const res = resolveHeroAction(next, hs, uid, action, rollDie);
    if (!res.ok) return res;
    ({ encounter: next, heroes: hs, animations } = res);
    next = { ...next, enemies: next.enemies.map(e => { const { unaware: _u, ...rest } = e; return rest; }) };
    const after = next.enemies.find(e => e.uid === target.uid);
    const damage = Math.max(0, target.hp - Math.max(0, after.hp));
    const used = spell?.name || attackOptions(hero).find(o => o.id === action.optionId)?.name || 'su arma';
    result = {
      targetUid: target.uid, target: target.name, with: used, damage, hp: Math.max(0, after.hp), maxHp: after.maxHp,
      status: after.status, surprised: Boolean(target.surprised)
    };
    const outcome = after.status === 'dead' ? `${target.name} cae antes de poder reaccionar`
      : after.status !== 'active' ? `${target.name} ${after.status === 'fled' ? 'huye' : 'se rinde'} antes de que empiece la pelea`
        : damage ? `${target.name} empieza el combate herido (${after.hp}/${after.maxHp} PG)` : `${target.name} sale ileso`;
    next = pushLog(next, 'opening', `⚡ Golpe de apertura de ${hero.name} (${used.toLowerCase()}): ${damage ? `${damage} de daño` : 'no hace daño'}; ${outcome}.`, { uid: target.uid });
  }
  next = { ...next, opening: { ...next.opening, done: true, result }, actionUsed: false, bonusUsed: false };
  next = checkEnd(next, hs);
  if (next.status !== 'active') return { ok: true, encounter: next, ...out(party, hs, uid), animations };
  const ran = runTurns(next, hs, rollDie);
  return { ok: true, encounter: ran.encounter, ...out(party, ran.heroes, uid), animations };
}

/** One line for the chronicle and the campaign memory: who surprised whom, and the opening strike ('' if neither). */
export function describeSurprise(encounter, party) {
  const heroes = asList(party);
  const parts = [];
  const s = encounter?.surprise;
  if (s?.uids?.length) {
    parts.push(s.side === 'enemies'
      ? `${heroes.length > 1 ? 'el grupo' : heroes[0]?.name || 'el héroe'} sorprende a ${s.names.join(', ')}`
      : `${s.names.join(', ')} ${s.names.length > 1 ? 'caen' : 'cae'} en una emboscada`);
  }
  const r = encounter?.opening?.result;
  const who = heroOf(heroes, encounter?.opening?.heroUid)?.name;
  if (r && !r.skipped && who) {
    parts.push(`golpe de apertura de ${who} contra ${r.target} (${r.with.toLowerCase()}): ${r.damage ? `${r.damage} de daño` : 'sin daño'}${r.status === 'dead' ? `, y ${r.target} cae` : ''}`);
  }
  if (!parts.length) return '';
  const text = parts.join('; ');
  return `${text[0].toUpperCase()}${text.slice(1)}.`;
}

// ---------------------------------------------------------------------------
// Saves
// ---------------------------------------------------------------------------

const UID_KEYS = new Set(['sourceUid', 'of', 'target', 'targetUid', 'actorUid', 'uid']);

/** Replace a creature id in condition sources, durations and log targets (deep). */
function renameUid(value, from, to) {
  if (Array.isArray(value)) return value.map(v => renameUid(v, from, to));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, UID_KEYS.has(k) && v === from ? to : renameUid(v, from, to)]));
}

/** Rename the lone hero's old id ('player') in a hero's own conditions. */
export const renameHeroUid = (hero, from, to) => (from === to ? hero : { ...hero, conditions: renameUid(hero.conditions || [], from, to) });

/**
 * Bring a fight in progress saved by an older version (one hero, known as
 * 'player') up to date for the party whose ids are `heroIds` (the first one is
 * the old hero): turn order slots, condition sources and durations, the Dodge,
 * concentration and gaze immunities. Fights already in the new format are kept.
 */
export function normalizeEncounter(encounter, heroIds = []) {
  if (!encounter || typeof encounter !== 'object' || !Array.isArray(encounter.order)) return encounter;
  const lead = heroIds[0] || PLAYER;
  const old = !Array.isArray(encounter.heroIds);
  if (!old) return encounter;
  const enemies = renameUid(encounter.enemies || [], PLAYER, lead);
  const order = encounter.order.map(slot => (slot.kind === 'player' ? { ...slot, uid: slot.uid || lead } : slot));
  const conc = encounter.concentration;
  const { concentration: _c, ...rest } = encounter;
  return {
    ...rest,
    enemies,
    order,
    heroIds: [lead],
    dodging: Array.isArray(encounter.dodging) ? encounter.dodging : encounter.dodging ? [lead] : [],
    concentrations: encounter.concentrations || (conc ? { [lead]: conc } : {}),
    immunities: (encounter.immunities || []).map(i => (String(i).split(':').length === 2 ? `${i}:${lead}` : i)),
    log: renameUid(encounter.log || [], PLAYER, lead)
  };
}

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

export const activeEnemies = encounter => encounter.enemies.filter(e => e.status === 'active');
/** A hero acts now: their turn, or the opening strike before the initiative. */
export const isPlayerTurn = encounter => encounter.status === 'active' && (openingPending(encounter) || encounter.order[encounter.turn]?.kind === 'player');
/** The hero whose turn it is (uid; the attacker while the opening strike is pending), or null on an enemy's turn. */
export const currentHeroUid = encounter => (openingPending(encounter) ? encounter.opening.heroUid
  : isPlayerTurn(encounter) ? encounter.order[encounter.turn].uid || PLAYER : null);
/** The spell a hero concentrates on ({ spellId, name, token }) or null. */
export const concentrationOf = (encounter, uid) => encounter?.concentrations?.[uid] || null;
export const isDodging = (encounter, uid) => Array.isArray(encounter.dodging) && encounter.dodging.includes(uid);

const pushLog = (encounter, kind, text, extra = {}) => ({
  ...encounter,
  log: [...encounter.log, { round: encounter.round, kind, text, ...extra }]
});

const updateEnemy = (encounter, uid, patch) => ({
  ...encounter,
  enemies: encounter.enemies.map(e => (e.uid === uid ? { ...e, ...patch } : e))
});

const heroOf = (heroes, uid) => heroes.find(h => heroUid(h) === uid) || null;
const isHeroUid = (heroes, uid) => Boolean(uid) && heroes.some(h => heroUid(h) === uid);

/** The creature with this uid (a hero or an enemy). */
const creatureOf = (encounter, heroes, uid) => heroOf(heroes, uid) || encounter.enemies.find(e => e.uid === uid);

/** Replace a creature of the fight. */
const putCreature = (encounter, heroes, uid, creature) => (isHeroUid(heroes, uid)
  ? { encounter, heroes: heroes.map(h => (heroUid(h) === uid ? creature : h)) }
  : { encounter: { ...encounter, enemies: encounter.enemies.map(e => (e.uid === uid ? creature : e)) }, heroes });

const nameIn = (encounter, heroes) => uid => creatureOf(encounter, heroes, uid)?.name || 'alguien';
const saveBonusOf = (heroes, creature, uid, ability) => (isHeroUid(heroes, uid) ? playerSaveBonus(creature, ability) : enemySaveBonus(creature, ability));
const allUids = (encounter, heroes, { activeOnly = true } = {}) => [
  ...heroes.map(heroUid),
  ...encounter.enemies.filter(e => !activeOnly || e.status === 'active').map(e => e.uid)
];

/** XP of the creatures the party overcame (killed, routed or captured). */
const overcomeXp = (encounter, includeRouted = true) => encounter.enemies
  .filter(e => e.status === 'dead' || (includeRouted && (e.status === 'fled' || e.status === 'surrendered')))
  .reduce((sum, e) => sum + (e.xp || 0), 0);

function checkEnd(encounter, heroes) {
  if (encounter.status !== 'active') return encounter;
  if (heroes.every(isDown)) {
    const text = heroes.length === 1
      ? `${heroes[0].name} cae inconsciente. El combate ha terminado.`
      : 'Todo el grupo ha caído. El combate ha terminado.';
    return pushLog({ ...encounter, status: 'defeat', xp: 0 }, 'end', text);
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
 * @returns {{ encounter, heroes, applied: object[] }}
 */
function applySpecs(encounter, heroes, targetUid, specs, { sourceUid = null, actorUid = null, concentration = null, rollDie }) {
  let next = encounter;
  let hs = heroes;
  const applied = [];
  const suffix = `${sourceUid || 'x'}-${next.round}-${next.log.length}`;
  const source = sourceUid ? nameIn(next, hs)(sourceUid) : '';
  const targetIsHero = isHeroUid(hs, targetUid);
  for (const spec of specs) {
    let target = creatureOf(next, hs, targetUid);
    if (!target || (!targetIsHero && target.status !== 'active')) break;
    if (spec.save) {
      const save = rollSave(target, spec.save.ability, saveBonusOf(hs, target, targetUid, spec.save.ability), spec.save.dc, rollDie);
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
    ({ encounter: next, heroes: hs } = putCreature(next, hs, targetUid, target));
    applied.push(result.condition);
    const level = result.condition.id === 'agotamiento' ? ` (nivel ${result.condition.level})` : '';
    next = pushLog(next, 'condition', `${target.name} queda ${lower(spec.id)}${level}: ${describeDuration(result.condition, nameIn(next, hs))}.`, { condition: spec.id, change: 'add', target: targetUid });
  }
  // Linked conditions whose main condition was resisted are dropped
  const target = creatureOf(next, hs, targetUid);
  if (target) {
    const { creature, removed } = removeConditions(target, () => false);
    if (removed.length) ({ encounter: next, heroes: hs } = putCreature(next, hs, targetUid, creature));
  }
  return { encounter: next, heroes: hs, applied };
}

const setConcentration = (encounter, uid, value) => {
  const map = { ...(encounter.concentrations || {}) };
  if (value) map[uid] = value;
  else delete map[uid];
  return { ...encounter, concentrations: map };
};

/** End a hero's concentration: the conditions of that spell end on every creature. */
function endConcentration(encounter, heroes, uid, why) {
  const conc = concentrationOf(encounter, uid);
  if (!conc) return { encounter, heroes };
  const caster = heroOf(heroes, uid);
  let next = pushLog(setConcentration(encounter, uid, null), 'conditionEnd', `${caster?.name || 'Alguien'} pierde la concentración en ${conc.name}${why ? ` (${why})` : ''}.`);
  let hs = heroes;
  allUids(next, hs, { activeOnly: false }).forEach(id => {
    const creature = creatureOf(next, hs, id);
    const { creature: freed, removed } = removeConditions(creature, c => c.concentration === conc.token);
    if (!removed.length) return;
    ({ encounter: next, heroes: hs } = putCreature(next, hs, id, freed));
    next = logEnded(next, creature.name, removed);
  });
  return { encounter: next, heroes: hs };
}

/** A hero takes damage while concentrating: Constitution save, DC 10 or half the damage (max 30). */
function concentrationCheck(encounter, heroes, uid, amount, rollDie) {
  const conc = concentrationOf(encounter, uid);
  const hero = heroOf(heroes, uid);
  if (!conc || amount <= 0 || !hero || hero.hp <= 0) return { encounter, heroes };
  const dc = Math.min(30, Math.max(10, Math.floor(amount / 2)));
  const save = rollSave(hero, 'con', playerSaveBonus(hero, 'con'), dc, rollDie);
  if (save.success) {
    return { encounter: pushLog(encounter, 'info', `${hero.name} mantiene la concentración en ${conc.name} (Constitución ${save.text}).`), heroes };
  }
  return endConcentration(encounter, heroes, uid, `Constitución ${save.text}`);
}

/** A creature takes damage: sleep and charms end, some effects allow a new save. */
function conditionsAfterDamage(encounter, heroes, uid, rollDie) {
  let next = encounter;
  let hs = heroes;
  let creature = creatureOf(next, hs, uid);
  if (!creature || !conditionsOf(creature).length) return { encounter: next, heroes: hs };
  const ended = removeConditions(creature, c => c.endsOnDamage);
  if (ended.removed.length) {
    creature = ended.creature;
    ({ encounter: next, heroes: hs } = putCreature(next, hs, uid, creature));
    next = logEnded(next, creature.name, ended.removed, ' (el daño rompe el efecto)');
  }
  for (const c of conditionsOf(creature).filter(x => x.saveOnDamage && x.duration?.type === 'save')) {
    creature = creatureOf(next, hs, uid);
    const extra = c.saveOnDamage === 'advantage' ? { advantage: ['por el daño'] } : {};
    const save = rollSave(creature, c.duration.ability, saveBonusOf(hs, creature, uid, c.duration.ability), c.duration.dc, rollDie, extra);
    if (!save.success) {
      next = pushLog(next, 'info', `${creature.name} repite la salvación al recibir daño: ${abilityName(c.duration.ability)} ${save.text} → sigue ${lower(c.id)}.`);
      continue;
    }
    const { creature: freed, removed } = removeConditions(creature, x => x.key === c.key);
    ({ encounter: next, heroes: hs } = putCreature(next, hs, uid, freed));
    next = logEnded(next, creature.name, removed, ` (supera la salvación de ${abilityName(c.duration.ability)} al recibir daño: ${save.text})`);
  }
  return { encounter: next, heroes: hs };
}

/**
 * Conditions that depend on another creature end when it is gone: a grapple ends if
 * the grappler falls, flees or is incapacitated; fear and charm end when their
 * source is no longer in the fight. Also a hero's concentration ends if that hero
 * is incapacitated (unconscious included).
 */
function cleanupSources(encounter, heroes) {
  let next = encounter;
  let hs = heroes;
  const gone = uid => {
    if (!uid || isHeroUid(hs, uid) || uid === PLAYER) return false;
    const src = next.enemies.find(e => e.uid === uid);
    return !src || src.status !== 'active';
  };
  allUids(next, hs).forEach(uid => {
    const creature = creatureOf(next, hs, uid);
    const { creature: freed, removed } = removeConditions(creature, c => {
      if (!c.sourceUid || c.keepsWithoutSource) return false;
      if (gone(c.sourceUid)) return true;
      if (c.id === 'agarrado') {
        const grappler = creatureOf(next, hs, c.sourceUid);
        return Boolean(grappler) && isIncapacitated(grappler);
      }
      return false;
    });
    if (!removed.length) return;
    ({ encounter: next, heroes: hs } = putCreature(next, hs, uid, freed));
    next = logEnded(next, creature.name, removed, ' (su causa ya no está)');
  });
  hs.forEach(hero => {
    const uid = heroUid(hero);
    if (concentrationOf(next, uid) && isIncapacitated(heroOf(hs, uid))) {
      ({ encounter: next, heroes: hs } = endConcentration(next, hs, uid, 'está incapacitado'));
    }
  });
  return { encounter: next, heroes: hs };
}

/** A turn starts or ends: count down the durations tied to it on every creature. Sleep may deepen. */
function tickAll(encounter, heroes, at, uid, rollDie) {
  let next = encounter;
  let hs = heroes;
  for (const target of allUids(next, hs)) {
    const creature = creatureOf(next, hs, target);
    const { creature: ticked, expired } = tickDurations(creature, at, uid);
    if (!expired.length) continue;
    ({ encounter: next, heroes: hs } = putCreature(next, hs, target, ticked));
    next = logEnded(next, creature.name, expired);
    // Sleep: when the first effect ends, a second save or it falls Unconscious
    for (const c of expired.filter(x => x.thenSave?.save)) {
      const current = creatureOf(next, hs, target);
      const { ability, dc } = c.thenSave.save;
      const save = rollSave(current, ability, saveBonusOf(hs, current, target, ability), dc, rollDie);
      next = pushLog(next, save.success ? 'info' : 'condition', `${current.name} repite la salvación de ${abilityName(ability)}: ${save.text} → ${save.success ? 'se sacude el efecto' : 'falla'}.`);
      if (!save.success) {
        ({ encounter: next, heroes: hs } = applySpecs(next, hs, target, c.thenSave.apply, { sourceUid: c.sourceUid, actorUid: uid, concentration: c.concentration, rollDie }));
      }
    }
  }
  return { encounter: next, heroes: hs };
}

/** Repeated saving throws at the end of a creature's turn. */
function endOfTurnSaves(encounter, heroes, uid, rollDie) {
  let next = encounter;
  let hs = heroes;
  const pending = conditionsOf(creatureOf(next, hs, uid)).filter(c => c.duration?.type === 'save');
  for (const c of pending) {
    const creature = creatureOf(next, hs, uid);
    if (!conditionsOf(creature).some(x => x.key === c.key)) continue;
    const d = c.duration;
    const save = rollSave(creature, d.ability, saveBonusOf(hs, creature, uid, d.ability), d.dc, rollDie);
    const rounds = (d.rounds || 0) + 1;
    const fails = (d.fails || 0) + (save.success ? 0 : 1);
    const successes = (d.successes || 0) + (save.success ? 1 : 0);
    const needed = d.worsen ? 3 : 1;
    const label = `${creature.name} repite la salvación de ${abilityName(d.ability)} (${lower(c.id)}): ${save.text}`;
    if (successes >= needed) {
      const { creature: freed, removed } = removeConditions(creature, x => x.key === c.key);
      ({ encounter: next, heroes: hs } = putCreature(next, hs, uid, freed));
      next = pushLog(next, 'info', `${label} → la supera.`);
      next = logEnded(next, creature.name, removed);
      continue;
    }
    if (d.worsen && fails >= d.worsen.after) {
      const { creature: freed } = removeConditions(creature, x => x.key === c.key);
      ({ encounter: next, heroes: hs } = putCreature(next, hs, uid, freed));
      next = pushLog(next, 'condition', `${label} → falla por ${fails}.ª vez.`);
      ({ encounter: next, heroes: hs } = applySpecs(next, hs, uid, [{ id: d.worsen.to, duration: 'permanent' }], { sourceUid: c.sourceUid, actorUid: uid, rollDie }));
      continue;
    }
    if (d.maxRounds && rounds >= d.maxRounds) {
      const { creature: freed, removed } = removeConditions(creature, x => x.key === c.key);
      ({ encounter: next, heroes: hs } = putCreature(next, hs, uid, freed));
      next = logEnded(next, creature.name, removed, ' (se acaba la duración)');
      continue;
    }
    const updated = { ...c, duration: { ...d, rounds, fails, successes } };
    ({ encounter: next, heroes: hs } = putCreature(next, hs, uid, { ...creature, conditions: conditionsOf(creature).map(x => (x.key === c.key ? updated : x)) }));
    next = pushLog(next, 'info', `${label} → ${save.success ? `la supera (${successes} de ${needed})` : `falla y sigue ${lower(c.id)}`}.`);
  }
  return { encounter: next, heroes: hs };
}

/** A creature able to move stands up from prone at the start of its turn (half its movement). */
function standUp(encounter, heroes, uid) {
  const creature = creatureOf(encounter, heroes, uid);
  if (!conditionsOf(creature).some(c => c.id === 'derribado' && c.duration?.type === 'prone')) return { encounter, heroes };
  if (isIncapacitated(creature) || speedZeroReason(creature)) return { encounter, heroes };
  const { creature: up } = removeConditions(creature, c => c.id === 'derribado' && c.duration?.type === 'prone');
  const placed = putCreature(encounter, heroes, uid, up);
  return { encounter: pushLog(placed.encounter, 'conditionEnd', `${creature.name} se levanta del suelo (gasta la mitad de su movimiento).`, { condition: 'derribado', change: 'end' }), heroes: placed.heroes };
}

/** Start of a creature's turn. */
function beginTurn(encounter, heroes, uid, rollDie) {
  let next = encounter;
  let hs = heroes;
  ({ encounter: next, heroes: hs } = tickAll(next, hs, 'start', uid, rollDie));
  ({ encounter: next, heroes: hs } = standUp(next, hs, uid));
  return cleanupSources(next, hs);
}

/** End of a creature's turn. */
function finishTurn(encounter, heroes, uid, rollDie) {
  let next = encounter;
  let hs = heroes;
  ({ encounter: next, heroes: hs } = endOfTurnSaves(next, hs, uid, rollDie));
  ({ encounter: next, heroes: hs } = tickAll(next, hs, 'end', uid, rollDie));
  return cleanupSources(next, hs);
}

const turnKey = encounter => `${encounter.round}:${encounter.turn}`;

/** Start a hero's turn once (their Dodge ends, durations tick, they stand up). */
function beginPlayerTurn(encounter, heroes, uid, rollDie) {
  if (encounter.turnStarted === turnKey(encounter)) return { encounter, heroes };
  const started = { ...encounter, turnStarted: turnKey(encounter), dodging: (encounter.dodging || []).filter(id => id !== uid) };
  return beginTurn(started, heroes, uid, rollDie);
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

/** Apply damage to an enemy (dealt by the hero `byUid`), then death, morale and the conditions that end with damage. */
function damageEnemy(encounter, heroes, uid, rawAmount, rollDie, byUid = null) {
  const enemy = encounter.enemies.find(e => e.uid === uid);
  if (!enemy || rawAmount <= 0) return { encounter, heroes };
  const amount = afterResistance(enemy, rawAmount);
  let next = encounter;
  if (amount < rawAmount) next = pushLog(next, 'info', `${enemy.name} está petrificado y solo recibe ${amount} de daño.`);
  const hp = Math.max(0, enemy.hp - amount);
  // It goes for whoever hurt it last
  next = updateEnemy(next, uid, { hp, ...(byUid ? { targetUid: byUid } : {}) });

  if (hp === 0) {
    next = updateEnemy(next, uid, { status: 'dead' });
    next = pushLog(next, 'down', `${enemy.name} cae y no se levanta.`, { uid, leader: isLeaderOf(encounter, uid), by: byUid });
    // A leader (a creature stronger than all the others) falling shakes the rest
    const isLeader = isLeaderOf(encounter, uid);
    const others = activeEnemies(next);
    if (isLeader) {
      others.forEach(o => { next = moraleCheck(next, o.uid, rollDie, `ve caer a ${enemy.name}`); });
    }
    return cleanupSources(next, heroes);
  }
  let hs = heroes;
  ({ encounter: next, heroes: hs } = conditionsAfterDamage(next, hs, uid, rollDie));
  // A creature that can't act can't run away either
  if (hp <= enemy.maxHp / 2 && !isIncapacitated(next.enemies.find(e => e.uid === uid))) next = moraleCheck(next, uid, rollDie, 'está malherido');
  return cleanupSources(next, hs);
}

/** The condition of a hero at 0 HP. */
const DOWN_SPEC = { id: 'inconsciente', duration: { type: 'down' } };
export const isDownCondition = c => c?.id === 'inconsciente' && c.duration?.type === 'down';

/** A hero at 0 HP gets hit points back: they wake up. */
export function wakeUp(hero) {
  if (isDown(hero)) return hero;
  return removeConditions(hero, isDownCondition).creature;
}

/** A hero drops to 0 HP: unconscious until healed. */
function knockDown(encounter, heroes, uid) {
  const hero = heroOf(heroes, uid);
  if (!hero || !isDown(hero) || conditionsOf(hero).some(isDownCondition)) return { encounter, heroes };
  const { creature } = addCondition(hero, createCondition(DOWN_SPEC, { targetUid: uid }));
  const placed = putCreature(encounter, heroes, uid, creature);
  const others = consciousHeroes(placed.heroes).length;
  const next = pushLog(placed.encounter, 'herodown', `${hero.name} cae a 0 PG y queda inconsciente.${others ? ' Sus compañeros siguen luchando: una curación o una poción lo levantaría.' : ''}`, { condition: 'inconsciente', change: 'add', target: uid });
  return cleanupSources(next, placed.heroes);
}

/** A hero takes damage: concentration, effects that end with damage, unconscious at 0 HP. */
function damageHero(encounter, heroes, uid, amount, rollDie) {
  const hero = heroOf(heroes, uid);
  let next = encounter;
  let hs = heroes.map(h => (heroUid(h) === uid ? { ...h, hp: Math.max(0, h.hp - amount) } : h));
  if (amount <= 0 || !hero) return { encounter: next, heroes: hs };
  ({ encounter: next, heroes: hs } = concentrationCheck(next, hs, uid, amount, rollDie));
  ({ encounter: next, heroes: hs } = conditionsAfterDamage(next, hs, uid, rollDie));
  return knockDown(next, hs, uid);
}

/** A hero gets hit points (healed by an ally, a potion...): an unconscious hero wakes up. */
function healHero(encounter, heroes, uid, amount) {
  const hero = heroOf(heroes, uid);
  if (!hero || amount <= 0) return { encounter, heroes, healed: 0 };
  const maxHp = Math.max(1, Number(hero.maxHp) || 1);
  const hp = Math.min(maxHp, Math.max(0, Number(hero.hp) || 0) + amount);
  const wasDown = isDown(hero);
  const woken = wakeUp({ ...hero, hp });
  const placed = putCreature(encounter, heroes, uid, woken);
  const next = wasDown ? pushLog(placed.encounter, 'conditionEnd', `${hero.name} recupera el sentido.`, { condition: 'inconsciente', change: 'end' }) : placed.encounter;
  return { encounter: next, heroes: placed.heroes, healed: hp - (Number(hero.hp) || 0) };
}

/** Invisibility ends when the hero attacks or casts a spell. */
function revealHero(encounter, heroes, uid) {
  const hero = heroOf(heroes, uid);
  const { creature, removed } = removeConditions(hero, c => c.endsOnAttack);
  if (!removed.length) return { encounter, heroes };
  const placed = putCreature(encounter, heroes, uid, creature);
  return { encounter: logEnded(placed.encounter, hero.name, removed, ' (al atacar se deja ver)'), heroes: placed.heroes };
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
// A hero's turn
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
 * Resolve the action of the hero whose turn it is, then the enemies (and the
 * heroes who can't act) go on until it is a hero's turn again or the combat ends.
 *
 * The turn has an action and a Bonus Action (2024 rules). The only Bonus
 * Action here is a potion: drunk, or given to an ally (who wakes up if they
 * were unconscious), before or after the action, once per turn:
 *  - `encounter.actionUsed`: the hero already acted this turn;
 *  - `encounter.bonusUsed`: the hero already used a potion this turn.
 * The turn ends by itself once nothing else can be done (action used, and the
 * Bonus Action used or no potion left); otherwise it stays open until the
 * hero uses a potion or ends it with { type: 'endTurn' }. An incapacitated hero
 * (paralyzed, stunned, unconscious...) loses the turn whatever the action.
 * @param {object} action
 *   { type: 'attack', optionId, targetUid, raging? }   action
 *   { type: 'spell', spellId, targetUid? }             action (a healing spell may target an ally)
 *   { type: 'equip', hands: { main, off } }            action (change what is in hand)
 *   { type: 'dodge' } | { type: 'flee' }               action (a successful flight gets the whole party out)
 *   { type: 'escape' }                                 action (break free of a grapple or restraint)
 *   { type: 'potion', itemId, targetUid? }             Bonus Action (targetUid: an ally)
 *   { type: 'endTurn' }                                end the turn now
 * @returns {{ ok: false, error } | { ok: true, encounter, heroes, character, animations }}
 *   character: the acting hero (or the only one)
 *   animations: the hero's dice to show with the 3D dice, in order:
 *   [{ sides, value, modifier?, dc?, success?, label } | { dice: [{sides, value}], modifier, label }]
 */
export function playerAction(encounter, party, action, rollDie) {
  if (!isPlayerTurn(encounter)) return { ok: false, error: 'No es tu turno.' };
  const uid = currentHeroUid(encounter);
  if (!isHeroUid(asList(party), uid)) return { ok: false, error: 'Ese héroe no está en este combate.' };
  if (openingPending(encounter)) return openingAction(encounter, party, action, rollDie);
  const done = (enc, hs, animations) => ({ ok: true, encounter: enc, ...out(party, hs, uid), animations });

  const begun = beginPlayerTurn(encounter, asList(party), uid, rollDie);
  let next = begun.encounter;
  let hs = begun.heroes;
  const me = () => heroOf(hs, uid);
  const lost = lostTurnReason(me());
  if (lost) {
    next = pushLog(next, 'info', `${me().name} está ${lost} y no puede actuar este turno.`);
    return endHeroTurn({ ...next, actionUsed: true }, hs, uid, rollDie, [], party);
  }
  const isBonus = action.type === 'potion';
  if (action.type === 'endTurn') return endHeroTurn(next, hs, uid, rollDie, [], party);
  if (isBonus && next.bonusUsed) return { ok: false, error: 'Ya has usado tu acción adicional este turno.' };
  if (!isBonus && next.actionUsed) return { ok: false, error: 'Ya has hecho tu acción este turno: usa una poción o termina el turno.' };
  const res = resolveHeroAction(next, hs, uid, action, rollDie);
  if (!res.ok) return res;
  ({ encounter: next, heroes: hs } = res);
  const { animations } = res;
  if (res.finished) return done(next, hs, animations);

  if (!isBonus) next = { ...next, actionUsed: true };
  next = checkEnd(next, hs);
  if (next.status !== 'active') return done(next, hs, animations);

  // The turn stays open while there is still something to do: the action, or a potion to use
  const canDrink = !next.bonusUsed && (me().inventory || []).some(item => healingDice(item));
  if (!next.actionUsed || canDrink) return done(next, hs, animations);
  return endHeroTurn(next, hs, uid, rollDie, animations, party);
}

/**
 * The effect of one hero action (see playerAction): rolls, damage, conditions,
 * the log. No turn bookkeeping here (that is playerAction's, or the opening strike's).
 * @returns {{ ok: false, error } | { ok: true, encounter, heroes, animations, finished? }}
 *   finished: the party got away (a successful flight)
 */
function resolveHeroAction(encounter, heroes, uid, action, rollDie) {
  let next = encounter;
  let hs = heroes;
  const me = () => heroOf(hs, uid);
  const animations = [];
  const target = next.enemies.find(e => e.uid === action.targetUid && e.status === 'active');
  const ally = isHeroUid(hs, action.targetUid) ? heroOf(hs, action.targetUid) : null;
  const charmedBy = target && conditionsOf(me()).some(c => c.id === 'encantado' && c.sourceUid === target.uid);
  const putMe = hero => { hs = hs.map(h => (heroUid(h) === uid ? hero : h)); };

  if (action.type === 'attack') {
    if (!target) return { ok: false, error: 'Elige un enemigo en pie.' };
    if (charmedBy) return { ok: false, error: `No puedes atacar a ${target.name}: estás encantado por esa criatura.` };
    const result = resolveAttack(me(), action.optionId, rollDie, { targetAC: target.ac, raging: action.raging, target, targetUid: target.uid });
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
        `${me().name} ataca a ${target.name} con ${attack.option.name.toLowerCase()}: ${r.dice.length > 1 ? `[${r.dice.join(', ')}] ` : ''}${withBonus(r.raw, r.total - r.raw)} = ${r.total} vs CA ${target.ac}${how} → ${crit || (r.hit ? `${r.damage.total} de daño` : r.fumble ? 'pifia' : 'falla')}.`);
    });
    const damageDice = [
      ...attack.rolls.flatMap(r => r.damage?.dice.map(value => ({ sides: r.damage.sides, value })) || []),
      ...(attack.sneak?.dice.map(value => ({ sides: 6, value })) || [])
    ];
    if (damageDice.length) {
      animations.push({ dice: damageDice, modifier: attack.totalDamage - damageDice.reduce((s, d) => s + d.value, 0), label: `${attack.option.name} · daño` });
    }
    if (attack.sneak) next = pushLog(next, 'hit', `Ataque Furtivo: +${attack.sneak.total} de daño.`);
    ({ encounter: next, heroes: hs } = revealHero(next, hs, uid));
    ({ encounter: next, heroes: hs } = damageEnemy(next, hs, target.uid, attack.totalDamage, rollDie, uid));
  } else if (action.type === 'spell') {
    const effects = spellConditions(action.spellId);
    const result = castSpell(me(), action.spellId, rollDie, { target, targetUid: target?.uid });
    if (!result.ok) return result;
    const { cast } = result;
    const { spell } = cast;
    const needsTarget = ['attack', 'save', 'auto'].includes(spell.kind);
    if (needsTarget && !target) return { ok: false, error: 'Elige un enemigo en pie como objetivo.' };
    if (needsTarget && charmedBy) return { ok: false, error: `No puedes lanzar conjuros contra ${target.name}: estás encantado por esa criatura.` };
    if (needsTarget && effects?.types && !effects.types.includes(target.type)) {
      return { ok: false, error: `${spell.name} solo afecta a criaturas de tipo ${effects.types.join(' o ')}, y ${target.name} es ${target.type}.` };
    }
    // A healing spell on an ally: the caster keeps their own hit points
    const healsAlly = spell.kind === 'heal' && ally && heroUid(ally) !== uid;
    putMe(healsAlly ? { ...result.character, hp: me().hp } : wakeUp(result.character));
    ({ encounter: next, heroes: hs } = revealHero(next, hs, uid));
    // A new concentration spell ends the previous one
    if (spell.concentration && concentrationOf(next, uid)) ({ encounter: next, heroes: hs } = endConcentration(next, hs, uid, `ahora se concentra en ${spell.name}`));
    const token = spell.concentration ? `conc-${spell.id}-${next.round}-${next.log.length}` : null;
    let applied = [];
    const dmgDice = cast.damage?.dice.map(value => ({ sides: cast.damage.sides, value })) || [];
    const prefix = `${me().name} lanza ${spell.name}${target && needsTarget ? ` sobre ${target.name}` : healsAlly ? ` sobre ${ally.name}` : ''}`;

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
        ({ encounter: next, heroes: hs, applied } = applySpecs(next, hs, target.uid, effects.onHit.map(s => spellSpec(s, spell, cast.saveDC)), { sourceUid: uid, actorUid: uid, concentration: token, rollDie }));
      }
      if (hit) ({ encounter: next, heroes: hs } = damageEnemy(next, hs, target.uid, damage.total, rollDie, uid));
    } else if (spell.kind === 'save') {
      const immune = effects?.immuneTypes?.includes(target.type);
      const save = immune
        ? { success: true, text: `${target.name} es inmune (${target.type})` }
        : rollSave(target, spell.save, enemySaveBonus(target, spell.save), cast.saveDC, rollDie, effects?.saveAdvantage ? { advantage: [hs.length > 1 ? 'está luchando contra vosotros' : 'está luchando contra ti'] } : {});
      const resisted = save.success;
      if (dmgDice.length) animations.push({ dice: dmgDice, modifier: cast.damage.bonus, label: `${spell.name} · daño` });
      const amount = cast.damage ? (resisted ? (spell.half ? Math.floor(cast.damage.total / 2) : 0) : cast.damage.total) : 0;
      next = pushLog(next, resisted ? 'miss' : 'hit',
        `${prefix}: ${immune ? save.text : `salvación de ${abilityName(spell.save)} ${save.text}`} → ${resisted ? 'resiste' : 'no resiste'}${cast.damage ? ` (${amount} de daño ${cast.damage.type})` : ''}.`);
      if (!resisted && effects?.onFail) {
        ({ encounter: next, heroes: hs, applied } = applySpecs(next, hs, target.uid, effects.onFail.map(s => spellSpec(s, spell, cast.saveDC)), { sourceUid: uid, actorUid: uid, concentration: token, rollDie }));
      } else if (!resisted && !cast.damage && !effects) {
        // Other control spells (adaptation): the target loses its next turn
        ({ encounter: next, heroes: hs, applied } = applySpecs(next, hs, target.uid, [{ id: 'incapacitado', duration: 'endOfTargetNextTurn' }], { sourceUid: uid, actorUid: uid, concentration: token, rollDie }));
      }
      if (amount > 0) ({ encounter: next, heroes: hs } = damageEnemy(next, hs, target.uid, amount, rollDie, uid));
    } else if (spell.kind === 'auto') {
      if (dmgDice.length) animations.push({ dice: dmgDice, modifier: cast.damage.bonus, label: `${spell.name} · daño` });
      next = pushLog(next, 'hit', `${prefix}: impacto seguro, ${cast.damage.total} de daño ${cast.damage.type}.`);
      ({ encounter: next, heroes: hs } = damageEnemy(next, hs, target.uid, cast.damage.total, rollDie, uid));
    } else if (spell.kind === 'heal') {
      if (cast.heal.dice.length) animations.push({ dice: cast.heal.dice.map(value => ({ sides: cast.heal.sides, value })), modifier: cast.heal.bonus, label: `${spell.name} · curación` });
      if (healsAlly) {
        let healed;
        ({ encounter: next, heroes: hs, healed } = healHero(next, hs, heroUid(ally), cast.heal.total));
        next = pushLog(next, 'heal', `${prefix}: ${ally.name} recupera ${healed} puntos de golpe.`);
      } else {
        next = pushLog(next, 'heal', `${prefix}: recupera ${cast.heal.applied} puntos de golpe.`);
      }
    } else {
      next = pushLog(next, 'info', `${prefix}. ${spell.desc}`);
    }
    if (effects?.self) {
      ({ encounter: next, heroes: hs, applied } = applySpecs(next, hs, uid, effects.self, { sourceUid: null, actorUid: uid, concentration: token, rollDie }));
    }
    if (cast.cured?.length) next = pushLog(next, 'conditionEnd', `${me().name} se libra de: ${cast.cured.join(', ')}.`, { change: 'end' });
    if (token && applied.length) next = setConcentration(next, uid, { spellId: spell.id, name: spell.name, token });
  } else if (action.type === 'potion') {
    if (ally && heroUid(ally) !== uid) {
      // Given to an ally (2024: a potion can be administered as a Bonus Action)
      const drink = drinkPotion({ ...ally, inventory: me().inventory }, action.itemId, rollDie);
      if (!drink.ok) return drink;
      const { roll, item } = drink;
      animations.push({ dice: roll.dice.map(value => ({ sides: roll.sides, value })), modifier: roll.bonus, label: `${item.name} · curación` });
      putMe({ ...me(), inventory: drink.character.inventory });
      let healed;
      ({ encounter: next, heroes: hs, healed } = healHero({ ...next, bonusUsed: true }, hs, heroUid(ally), roll.total));
      next = pushLog(next, 'heal',
        `${me().name} da ${item.name} a ${ally.name} como acción adicional: recupera ${healed} puntos de golpe.${next.actionUsed ? '' : ` ${me().name} aún puede hacer su acción.`}`);
    } else {
      const drink = drinkPotion(me(), action.itemId, rollDie);
      if (!drink.ok) return drink;
      const { roll, item } = drink;
      animations.push({ dice: roll.dice.map(value => ({ sides: roll.sides, value })), modifier: roll.bonus, label: `${item.name} · curación` });
      putMe(drink.character);
      next = pushLog({ ...next, bonusUsed: true }, 'heal',
        `${me().name} bebe ${item.name} como acción adicional y recupera ${drink.healed} puntos de golpe.${next.actionUsed ? '' : ' Aún puede hacer su acción.'}`);
    }
  } else if (action.type === 'equip') {
    // House rule: changing what you hold takes the whole turn
    const result = setHands(me(), action.hands);
    if (!result.ok) return result;
    if (!result.changed) return { ok: false, error: 'Ya llevas eso en las manos.' };
    putMe(result.character);
    next = pushLog(next, 'info', `${me().name} cambia de equipo y ahora lleva ${describeHands(me())}. Gasta su acción en ello.`);
  } else if (action.type === 'dodge') {
    next = pushLog({ ...next, dodging: [...new Set([...(next.dodging || []), uid])] }, 'info', `${me().name} se pone a la defensiva: los ataques que reciba tendrán desventaja hasta su próximo turno.`);
  } else if (action.type === 'escape') {
    const hero = me();
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
      putMe(creature);
      next = logEnded(pushLog(next, 'hit', `${text} → ¡se suelta!`), hero.name, removed);
    } else {
      next = pushLog(next, 'miss', `${text} → no lo consigue.`);
    }
  } else if (action.type === 'flee') {
    // Speed 0 (grappled, restrained...) means no running away; injured legs make it harder (+5 each)
    const hero = me();
    const stuck = speedZeroReason(hero);
    if (stuck) return { ok: false, error: `No puedes huir: estás ${stuck.toLowerCase()} (velocidad 0).` };
    const dc = fleeDC(hero);
    if (dc == null) return { ok: false, error: 'Con las dos piernas heridas no puedes huir.' };
    const mods = checkModifiers(hero, { ability: 'des' });
    const d20 = rollD20(rollDie, mods);
    const roll = d20.raw;
    const total = roll + mod(hero.stats?.des) - mods.penalty;
    const how = describeMode({ ...d20, ...mods });
    const group = hs.length > 1;
    animations.push({ sides: 20, value: roll, modifier: total - roll, dc, success: total >= dc, label: 'Huida' });
    if (total >= dc) {
      const xp = overcomeXp(next, false);
      next = pushLog({ ...next, status: 'fled', xp }, 'end', `${hero.name} ${group ? 'abre paso y el grupo logra escapar (cargando con los caídos)' : 'logra escapar'} (${withBonus(roll, total - roll)} = ${total} vs CD ${dc}${how}).${xp ? ` +${xp} PX por los enemigos abatidos.` : ''}`);
      return { ok: true, encounter: next, heroes: hs, animations, finished: true };
    }
    next = pushLog(next, 'miss', `${hero.name} intenta ${group ? 'abrir una vía de escape' : 'huir'} pero le cortan el paso (${total} vs CD ${dc}${how}).`);
  } else {
    return { ok: false, error: 'Acción desconocida.' };
  }

  return { ok: true, encounter: next, heroes: hs, animations };
}

/** End a hero's turn: saves and durations of the end of the turn, then the others act. */
function endHeroTurn(encounter, heroes, uid, rollDie, animations, input) {
  let next = encounter;
  let hs = heroes;
  if (!next.actionUsed) next = pushLog(next, 'info', `${heroOf(hs, uid).name} termina su turno sin hacer nada más.`);
  ({ encounter: next, heroes: hs } = finishTurn(next, hs, uid, rollDie));
  next = checkEnd(next, hs);
  if (next.status !== 'active') return { ok: true, encounter: next, ...out(input, hs, uid), animations };
  const after = runTurns(advanceTurn({ ...next, actionUsed: false, bonusUsed: false }), hs, rollDie);
  return { ok: true, encounter: after.encounter, ...out(input, after.heroes, uid), animations };
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

const charmedByHero = (enemy, uid) => conditionsOf(enemy).some(c => c.id === 'encantado' && c.sourceUid === uid);

/**
 * The hero an enemy attacks now (see the rule at the top of the file), or null
 * when it can't attack anyone (every conscious hero charmed it). A die is rolled
 * only when there is more than one hero to choose from.
 */
function chooseTarget(encounter, heroes, enemy, rollDie) {
  const candidates = consciousHeroes(heroes).map(heroUid).filter(uid => !charmedByHero(enemy, uid));
  if (!candidates.length) return null;
  if (enemy.targetUid && candidates.includes(enemy.targetUid)) return enemy.targetUid;
  if (candidates.length === 1) return candidates[0];
  const index = Math.min(candidates.length, Math.max(1, rollDie(candidates.length))) - 1;
  return candidates[index];
}

function enemyAttack(encounter, enemy, attackAction, heroes, uid, rollDie) {
  let next = encounter;
  let hs = heroes;
  const hero = heroOf(hs, uid);
  const ranged = attackAction.kind === 'ranged';
  const mods = attackModifiers(enemy, hero, { ranged, targetUid: uid, dodging: isDodging(encounter, uid) });
  if (mods.blocked) {
    return { encounter: pushLog(next, 'info', `${enemy.name} no puede atacar a ${hero.name}: ${mods.blocked}.`), heroes: hs };
  }
  const d20 = rollD20(rollDie, mods);
  const roll = d20.raw;
  const bonus = attackAction.bonus - mods.penalty;
  const total = roll + bonus;
  const hit = roll === 20 || (roll !== 1 && total >= (hero.ac || 10));
  const crit = roll === 20 || (hit && mods.autoCrit);
  const how = describeMode({ ...d20, ...mods });
  const dice = d20.rolls.length > 1 ? `[${d20.rolls.join(', ')}] ` : '';
  const at = hs.length > 1 ? ` a ${hero.name}` : '';
  if (!hit) {
    return { encounter: pushLog(next, 'enemyMiss', `${enemy.name} ataca${at} con ${attackAction.name.toLowerCase()}: ${dice}${withBonus(roll, bonus)} = ${total} vs CA ${hero.ac}${how} → falla.`, { target: uid }), heroes: hs };
  }
  const damage = rollNotation(attackAction.damage, rollDie, crit ? 2 : 1);
  const extra = attackAction.extra ? rollNotation(attackAction.extra, rollDie, crit ? 2 : 1) : null;
  const amount = afterResistance(hero, Math.max(1, damage.total) + (extra?.total || 0));
  const critText = crit ? (roll === 20 ? '¡crítico! ' : '¡crítico automático! ') : '';
  next = pushLog(next, crit ? 'enemyCrit' : 'enemyHit',
    `${enemy.name} ataca${at} con ${attackAction.name.toLowerCase()}: ${dice}${withBonus(roll, bonus)} = ${total} vs CA ${hero.ac}${how} → ${critText}${amount} de daño ${attackAction.type}${extra ? ` y ${attackAction.extraType}` : ''}.`,
    { playerDamage: amount, target: uid });
  ({ encounter: next, heroes: hs } = damageHero(next, hs, uid, amount, rollDie));
  if (crit && attackAction.type === INJURY_DAMAGE_TYPE) {
    ({ encounter: next, heroes: hs } = graveWound(next, enemy, hs, uid, rollDie));
  }
  if (attackAction.onHit && heroOf(hs, uid).hp > 0) {
    ({ encounter: next, heroes: hs } = applySpecs(next, hs, uid, attackAction.onHit, { sourceUid: enemy.uid, actorUid: enemy.uid, rollDie }));
  }
  return { encounter: next, heroes: hs };
}

/** Grave wound check after a slashing critical (see INJURY_THRESHOLD). */
function graveWound(encounter, enemy, heroes, uid, rollDie) {
  const character = heroOf(heroes, uid);
  const roll = rollDie(20);
  const threshold = character.hp <= 0 ? INJURY_THRESHOLD_DOWN : INJURY_THRESHOLD;
  if (roll > threshold) return { encounter, heroes };
  const limb = LIMB_IDS[Math.min(LIMB_IDS.length, Math.max(1, rollDie(4))) - 1];
  const sheet = normalizeEquipment(character);
  const current = sheet.limbs[limb];
  if (current === 'lost') return { encounter, heroes };
  const status = current === 'ok' ? 'disabled' : 'lost';
  const result = setLimbStatus(sheet, limb, status);
  const part = limbWithArticle(limb);
  const dropped = result.dropped.length ? ` ${result.dropped.join(' y ')} cae${result.dropped.length > 1 ? 'n' : ''} a la mochila.` : '';
  const text = status === 'lost'
    ? `¡Herida terrible! El golpe de ${enemy.name} cercena ${part} de ${character.name}.${dropped}`
    : `¡Herida grave! El golpe de ${enemy.name} deja ${limbStatusLabel(limb, 'disabled').toLowerCase()} ${part} de ${character.name}.${dropped}`;
  return {
    encounter: pushLog(encounter, 'injury', text, { injury: { limb, status }, by: enemy.name, target: uid, heroName: character.name }),
    heroes: heroes.map(h => (heroUid(h) === uid ? result.character : h))
  };
}

/** Grave wounds suffered in these log entries: [{ limb, status, by, target, heroName }] */
export const injuriesIn = (entries = []) => entries
  .filter(e => e.kind === 'injury' && e.injury)
  .map(e => ({ ...e.injury, by: e.by || '', target: e.target || null, heroName: e.heroName || '' }));

function enemySaveAction(encounter, enemy, saveAction, heroes, uid, rollDie) {
  const character = heroOf(heroes, uid);
  const save = rollSave(character, saveAction.save, playerSaveBonus(character, saveAction.save), saveAction.dc, rollDie);
  const saved = save.success;
  const damage = saveAction.damage ? rollNotation(saveAction.damage, rollDie) : null;
  const amount = damage ? afterResistance(character, saved ? (saveAction.half ? Math.floor(damage.total / 2) : 0) : damage.total) : 0;
  const whose = heroes.length > 1 ? `la salvación de ${abilityName(saveAction.save)} de ${character.name}` : `tu salvación de ${abilityName(saveAction.save)}`;
  const verdict = heroes.length > 1 ? (saved ? 'la supera' : 'falla') : (saved ? 'la superas' : 'fallas');
  let next = pushLog(encounter, amount > 0 || (!saved && saveAction.onFail) ? 'enemyHit' : 'enemyMiss',
    `${enemy.name} usa ${saveAction.name}: ${whose} ${save.text} → ${verdict}${damage ? ` (${amount} de daño ${saveAction.type})` : ''}.`,
    { playerDamage: amount, target: uid });
  let hs;
  ({ encounter: next, heroes: hs } = damageHero(next, heroes, uid, amount, rollDie));
  if (saved && saveAction.immuneOnSave) {
    next = { ...next, immunities: [...(next.immunities || []), `${enemy.uid}:${saveAction.id}:${uid}`] };
    next = pushLog(next, 'info', `${character.name} ya no teme a ${saveAction.name.toLowerCase()} de ${enemy.name} durante este combate.`);
  }
  if (!saved && saveAction.onFail && heroOf(hs, uid).hp > 0) {
    ({ encounter: next, heroes: hs } = applySpecs(next, hs, uid, saveAction.onFail, { sourceUid: enemy.uid, actorUid: enemy.uid, rollDie }));
  }
  return { encounter: next, heroes: hs };
}

/**
 * What a creature does on its turn against a hero: an attack that would apply a
 * condition the hero doesn't have yet (`prefer`), a ready recharge ability, its
 * Multiattack, or its best attack. Actions the hero is immune to (resisted a gaze)
 * and condition-only abilities that would add nothing are skipped.
 */
function chooseActions(enemy, hero, encounter) {
  const immune = (encounter.immunities || []);
  const uid = heroUid(hero);
  const useful = a => !immune.includes(`${enemy.uid}:${a.id}:${uid}`)
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
  if (list.some(c => c.id === 'asustado' && c.flees)) return 'huye aterrorizado y no ataca';
  return null;
}

/** A restrained enemy uses its action to break free (Strength or Dexterity check against the DC). */
function enemyEscape(encounter, heroes, enemy, held, rollDie) {
  const bonus = Math.max(mod(enemy.stats?.fue), mod(enemy.stats?.des));
  const mods = checkModifiers(enemy, { ability: 'fue' });
  const roll = rollD20(rollDie, mods);
  const total = roll.raw + bonus - mods.penalty;
  const text = `${enemy.name} intenta liberarse (${lower(held.id)}): ${withBonus(roll.raw, bonus - mods.penalty)} = ${total} vs CD ${held.duration.dc}${describeMode({ ...roll, ...mods })}`;
  if (total < held.duration.dc) return { encounter: pushLog(encounter, 'info', `${text} → sigue atrapado.`), heroes };
  const { creature, removed } = removeConditions(enemy, c => c.key === held.key);
  const placed = putCreature(pushLog(encounter, 'info', `${text} → se suelta.`), heroes, enemy.uid, creature);
  return { encounter: logEnded(placed.encounter, enemy.name, removed), heroes: placed.heroes };
}

/** One enemy's turn: start hooks, its actions (if it can act), end hooks. */
function enemyTurn(encounter, heroes, uid, rollDie) {
  let next = encounter;
  let hs = heroes;
  ({ encounter: next, heroes: hs } = beginTurn(next, hs, uid, rollDie));
  let enemy = next.enemies.find(e => e.uid === uid);
  if (enemy.status !== 'active') return { encounter: next, heroes: hs };

  // Recharge rolls at the start of its turn
  const recharge = { ...enemy.recharge };
  enemy.actions.filter(a => a.recharge && !recharge[a.id]).forEach(a => {
    if (a.recharge.includes(rollDie(6))) recharge[a.id] = true;
  });

  const lost = lostTurnReason(enemy);
  const holdsBack = enemyHoldsBack(enemy);
  const held = conditionsOf(enemy).find(c => c.duration?.type === 'escape' && (isHeroUid(hs, c.sourceUid) || c.sourceUid === PLAYER));
  if (enemy.skipTurns > 0) {
    // Encounters saved before conditions existed
    next = updateEnemy(next, uid, { skipTurns: enemy.skipTurns - 1 });
    next = pushLog(next, 'info', `${enemy.name} no puede actuar este turno.`);
  } else if (lost) {
    next = pushLog(next, 'info', `${enemy.name} está ${lost} y no puede actuar.`);
  } else if (holdsBack) {
    next = pushLog(next, 'info', `${enemy.name} ${holdsBack}.`);
  } else if (held) {
    ({ encounter: next, heroes: hs } = enemyEscape(next, hs, enemy, held, rollDie));
  } else {
    let targetUid = chooseTarget(next, hs, enemy, rollDie);
    if (!targetUid) {
      next = pushLog(next, 'info', hs.length > 1
        ? `${enemy.name} está encantado y no quiere hacer daño a nadie del grupo.`
        : `${enemy.name} está encantado y no quiere hacerte daño.`);
    } else {
      next = updateEnemy(next, uid, { targetUid });
      const current = { ...enemy, targetUid, recharge };
      for (const act of chooseActions(current, heroOf(hs, targetUid), next)) {
        // Its target fell: the rest of its attacks go to another hero
        if (isDown(heroOf(hs, targetUid))) {
          targetUid = chooseTarget(next, hs, { ...current, targetUid: null }, rollDie);
          if (!targetUid) break;
          next = updateEnemy(next, uid, { targetUid });
        }
        const result = act.kind === 'save'
          ? enemySaveAction(next, current, act, hs, targetUid, rollDie)
          : enemyAttack(next, current, act, hs, targetUid, rollDie);
        next = result.encounter;
        hs = result.heroes;
        if (act.recharge) recharge[act.id] = false;
        if (hs.every(isDown)) break;
      }
    }
  }
  next = updateEnemy(next, uid, { recharge });
  if (hs.every(isDown)) return { encounter: next, heroes: hs };
  enemy = next.enemies.find(e => e.uid === uid);
  if (enemy.status !== 'active') return { encounter: next, heroes: hs };
  return finishTurn(next, hs, uid, rollDie);
}

/** The hero played the opening strike and their slot of round 1 comes now: that turn is already spent. */
const spentOnOpening = (encounter, uid) => {
  const o = encounter.opening;
  return encounter.round === 1 && Boolean(o?.done) && o.heroUid === uid && !o.turnSpent && Boolean(o.result) && !o.result.skipped;
};

/** Let the turns go on until a hero who can act has the turn, or the fight ends. */
function runTurns(encounter, heroes, rollDie) {
  let next = encounter;
  let hs = heroes;
  let guard = 0;

  while (next.status === 'active' && guard++ < 400) {
    const slot = next.order[next.turn];
    if (slot?.kind === 'player') {
      const uid = slot.uid || PLAYER;
      const hero = heroOf(hs, uid);
      if (hero && spentOnOpening(next, uid)) {
        // The opening strike was this hero's turn of round 1: from round 2 on, the normal order
        next = pushLog({ ...next, opening: { ...next.opening, turnSpent: true } }, 'info', `${hero.name} ya actuó en esta ronda con su golpe de apertura.`);
      } else if (hero) {
        ({ encounter: next, heroes: hs } = beginPlayerTurn(next, hs, uid, rollDie));
        next = checkEnd(next, hs);
        if (next.status !== 'active') break;
        const lost = lostTurnReason(heroOf(hs, uid));
        if (!lost) break; // this hero's turn: wait for the player
        // Unconscious heroes pass their turn quietly (once per round is enough noise)
        if (!isDown(heroOf(hs, uid))) next = pushLog(next, 'info', `${heroOf(hs, uid).name} está ${lost} y pierde su turno.`);
        ({ encounter: next, heroes: hs } = finishTurn(next, hs, uid, rollDie));
      }
    } else {
      const enemy = next.enemies.find(e => e.uid === slot?.uid);
      if (enemy?.status === 'active') ({ encounter: next, heroes: hs } = enemyTurn(next, hs, enemy.uid, rollDie));
    }
    next = checkEnd(next, hs);
    if (next.status !== 'active') break;
    next = advanceTurn(next);
  }
  return { encounter: next, heroes: hs };
}

/**
 * Let the enemies (and the heroes who can't act) go in initiative order until it
 * is the turn of a hero who can act, or the combat ends. Call it after
 * createEncounter if enemies won initiative.
 * @returns {{ encounter, heroes, character }}
 */
export function runEnemyTurns(encounter, party, rollDie) {
  const { encounter: next, heroes } = runTurns(encounter, asList(party), rollDie);
  return { encounter: next, ...out(party, heroes, currentHeroUid(next)) };
}

/**
 * After the fight: unconscious heroes of a won (or fled) fight get up with 1 HP.
 * (A lost fight is settled by Duncan's rescue.)
 */
export function wakeAfterFight(heroes) {
  return asList(heroes).map(h => (isDown(h) ? wakeUp({ ...h, hp: 1 }) : wakeUp(h)));
}

/** Short summary of a finished combat, for the chronicle. */
export function describeEncounterResult(encounter, party) {
  const heroes = asList(party);
  const who = heroes.length === 1 ? heroes[0].name : 'El grupo';
  const by = status => encounter.enemies.filter(e => e.status === status).map(e => e.name);
  const dead = by('dead');
  const fled = by('fled');
  const surrendered = by('surrendered');
  const fallen = heroes.length > 1 ? heroes.filter(isDown).map(h => h.name) : [];
  const parts = [];
  if (encounter.status === 'victory') parts.push(`⚔️ ${who} gana el combate en ${encounter.round} ${encounter.round === 1 ? 'ronda' : 'rondas'}.`);
  if (encounter.status === 'defeat') parts.push(`💀 ${who} cae derrotado en combate.`);
  if (encounter.status === 'fled') parts.push(`🏃 ${who} huye del combate.`);
  if (dead.length) parts.push(`Abatidos: ${dead.join(', ')}.`);
  if (surrendered.length) parts.push(`Se rinden: ${surrendered.join(', ')}.`);
  if (fled.length) parts.push(`Huyen: ${fled.join(', ')}.`);
  if (fallen.length && encounter.status !== 'defeat') parts.push(`Cayeron inconscientes: ${fallen.join(', ')}.`);
  if (encounter.xp) parts.push(`+${encounter.xp} PX${heroes.length > 1 ? ' para repartir' : ''}.`);
  const surprise = describeSurprise(encounter, heroes);
  if (surprise) parts.push(surprise);
  return parts.join(' ');
}
