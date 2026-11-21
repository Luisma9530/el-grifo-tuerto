// Combat encounters resolved entirely by the game (no AI): initiative, the
// player's turn, enemy turns, morale (fleeing / surrendering) and experience.
//
// Pure functions. Dice come from a `rollDie(sides)` callback. Every function
// returns new objects; the encounter is plain data so it can be saved with the
// campaign and resumed later.

import { resolveAttack } from './combat';
import { castSpell, parseDice } from './spellcasting';
import { drinkPotion, healingDice } from './items';
import { setHands, describeHands, fleeDC, setLimbStatus, normalizeEquipment, limbWithArticle, limbStatusLabel, LIMB_IDS } from './equipment';

const ABILITY_NAMES = { fue: 'Fuerza', des: 'Destreza', con: 'Constitución', int: 'Inteligencia', sab: 'Sabiduría', car: 'Carisma' };
const mod = score => Math.floor(((Number(score) || 10) - 10) / 2);
/** "14+3" or "7−2" */
const withBonus = (roll, bonus) => `${roll}${bonus >= 0 ? '+' : '−'}${Math.abs(bonus)}`;

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
        actions: monster.actions,
        multiattack: monster.multiattack || null,
        fearless: Boolean(monster.fearless),
        status: 'active', // active | dead | fled | surrendered
        skipTurns: 0,
        moraleChecked: false,
        recharge: Object.fromEntries((monster.actions || []).filter(a => a.recharge).map(a => [a.id, true])),
        initiative: rollDie(20) + (monster.initiative ?? mod(monster.stats?.des))
      });
    }
  });

  const playerInitiative = rollDie(20) + playerInitiativeBonus(character);
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

/** Apply damage to an enemy, then death and morale. */
function damageEnemy(encounter, uid, amount, rollDie) {
  const enemy = encounter.enemies.find(e => e.uid === uid);
  if (!enemy || amount <= 0) return encounter;
  const hp = Math.max(0, enemy.hp - amount);
  let next = updateEnemy(encounter, uid, { hp });

  if (hp === 0) {
    next = updateEnemy(next, uid, { status: 'dead' });
    next = pushLog(next, 'down', `${enemy.name} cae y no se levanta.`, { uid, leader: isLeaderOf(encounter, uid) });
    // A leader (a creature stronger than all the others) falling shakes the rest
    const isLeader = isLeaderOf(encounter, uid);
    const others = activeEnemies(next);
    if (isLeader) {
      others.forEach(o => { next = moraleCheck(next, o.uid, rollDie, `ve caer a ${enemy.name}`); });
    }
    return next;
  }
  if (hp <= enemy.maxHp / 2) next = moraleCheck(next, uid, rollDie, 'está malherido');
  return next;
}

// ---------------------------------------------------------------------------
// Player turn
// ---------------------------------------------------------------------------

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
 * hero drinks or ends it with { type: 'endTurn' }.
 * @param {object} action
 *   { type: 'attack', optionId, targetUid, raging? }   action
 *   { type: 'spell', spellId, targetUid? }             action
 *   { type: 'equip', hands: { main, off } }            action (change what is in hand)
 *   { type: 'dodge' } | { type: 'flee' }               action
 *   { type: 'potion', itemId }                         Bonus Action
 *   { type: 'endTurn' }                                end the turn now
 * @returns {{ ok: false, error } | { ok: true, encounter, character, animations }}
 *   animations: the player's dice to show with the 3D dice, in order:
 *   [{ sides, value, modifier?, dc?, success?, label } | { dice: [{sides, value}], modifier, label }]
 */
export function playerAction(encounter, character, action, rollDie) {
  if (!isPlayerTurn(encounter)) return { ok: false, error: 'No es tu turno.' };
  const isBonus = action.type === 'potion';
  if (action.type === 'endTurn') return endPlayerTurn(encounter, character, rollDie, []);
  if (isBonus && encounter.bonusUsed) return { ok: false, error: 'Ya has usado tu acción adicional este turno.' };
  if (!isBonus && encounter.actionUsed) return { ok: false, error: 'Ya has hecho tu acción este turno: bebe una poción o termina el turno.' };
  // A dodge lasts until the start of the hero's next turn
  const startOfTurn = !encounter.actionUsed && !encounter.bonusUsed;
  let next = startOfTurn ? { ...encounter, dodging: false } : { ...encounter };
  let hero = character;
  const animations = [];
  const target = next.enemies.find(e => e.uid === action.targetUid && e.status === 'active');

  if (action.type === 'attack') {
    if (!target) return { ok: false, error: 'Elige un enemigo en pie.' };
    const result = resolveAttack(hero, action.optionId, rollDie, { targetAC: target.ac, raging: action.raging });
    if (!result.ok) return result;
    const { attack } = result;
    attack.rolls.forEach((r, i) => {
      animations.push({
        sides: 20, value: r.raw, modifier: r.total - r.raw, dc: target.ac, success: r.hit,
        label: `${attack.option.name} · ataque${attack.rolls.length > 1 ? ` ${i + 1}` : ''}`
      });
      next = pushLog(next, r.crit ? 'crit' : r.hit ? 'hit' : 'miss',
        `${hero.name} ataca a ${target.name} con ${attack.option.name.toLowerCase()}: ${withBonus(r.raw, r.total - r.raw)} = ${r.total} vs CA ${target.ac}${attack.disadvantage ? ' (con desventaja)' : ''} → ${r.crit ? `¡crítico! ${r.damage.total} de daño` : r.hit ? `${r.damage.total} de daño` : r.fumble ? 'pifia' : 'falla'}.`);
    });
    const damageDice = [
      ...attack.rolls.flatMap(r => r.damage?.dice.map(value => ({ sides: r.damage.sides, value })) || []),
      ...(attack.sneak?.dice.map(value => ({ sides: 6, value })) || [])
    ];
    if (damageDice.length) {
      animations.push({ dice: damageDice, modifier: attack.totalDamage - damageDice.reduce((s, d) => s + d.value, 0), label: `${attack.option.name} · daño` });
    }
    if (attack.sneak) next = pushLog(next, 'hit', `Ataque Furtivo: +${attack.sneak.total} de daño.`);
    next = damageEnemy(next, target.uid, attack.totalDamage, rollDie);
  } else if (action.type === 'spell') {
    const result = castSpell(hero, action.spellId, rollDie);
    if (!result.ok) return result;
    const { cast } = result;
    const { spell } = cast;
    hero = result.character;
    const needsTarget = ['attack', 'save', 'auto'].includes(spell.kind);
    if (needsTarget && !target) return { ok: false, error: 'Elige un enemigo en pie como objetivo.' };
    const dmgDice = cast.damage?.dice.map(value => ({ sides: cast.damage.sides, value })) || [];
    const prefix = `${hero.name} lanza ${spell.name}${target && needsTarget ? ` sobre ${target.name}` : ''}`;

    if (spell.kind === 'attack') {
      const { raw, total, isNat20, isNat1 } = cast.attack;
      const hit = isNat20 || (!isNat1 && total >= target.ac);
      animations.push({ sides: 20, value: raw, modifier: total - raw, dc: target.ac, success: hit, label: `${spell.name} · ataque` });
      if (hit && dmgDice.length) animations.push({ dice: dmgDice, modifier: cast.damage.bonus, label: `${spell.name} · daño` });
      next = pushLog(next, isNat20 ? 'crit' : hit ? 'hit' : 'miss',
        `${prefix}: ${withBonus(raw, total - raw)} = ${total} vs CA ${target.ac} → ${hit ? `${cast.damage.total} de daño ${cast.damage.type}` : 'falla'}.`);
      if (hit) next = damageEnemy(next, target.uid, cast.damage.total, rollDie);
    } else if (spell.kind === 'save') {
      const roll = rollDie(20);
      const save = roll + enemySaveBonus(target, spell.save);
      const resisted = roll !== 1 && (roll === 20 || save >= cast.saveDC);
      if (dmgDice.length) animations.push({ dice: dmgDice, modifier: cast.damage.bonus, label: `${spell.name} · daño` });
      const amount = cast.damage ? (resisted ? (spell.half ? Math.floor(cast.damage.total / 2) : 0) : cast.damage.total) : 0;
      next = pushLog(next, resisted ? 'miss' : 'hit',
        `${prefix}: salvación de ${ABILITY_NAMES[spell.save]} ${roll}+${save - roll} = ${save} vs CD ${cast.saveDC} → ${resisted ? 'resiste' : 'no resiste'}${cast.damage ? ` (${amount} de daño ${cast.damage.type})` : ''}.`);
      if (amount > 0) next = damageEnemy(next, target.uid, amount, rollDie);
      // Control spells without damage (Sleep, Hold Person...): the target loses its next turn
      if (!cast.damage && !resisted && next.enemies.find(e => e.uid === target.uid)?.status === 'active') {
        next = updateEnemy(next, target.uid, { skipTurns: 1 });
        next = pushLog(next, 'info', `${target.name} queda fuera de combate durante un turno.`);
      }
    } else if (spell.kind === 'auto') {
      if (dmgDice.length) animations.push({ dice: dmgDice, modifier: cast.damage.bonus, label: `${spell.name} · daño` });
      next = pushLog(next, 'hit', `${prefix}: impacto seguro, ${cast.damage.total} de daño ${cast.damage.type}.`);
      next = damageEnemy(next, target.uid, cast.damage.total, rollDie);
    } else if (spell.kind === 'heal') {
      if (cast.heal.dice.length) animations.push({ dice: cast.heal.dice.map(value => ({ sides: cast.heal.sides, value })), modifier: cast.heal.bonus, label: `${spell.name} · curación` });
      next = pushLog(next, 'heal', `${prefix}: recupera ${cast.heal.applied} puntos de golpe.`);
    } else {
      next = pushLog(next, 'info', `${prefix}. ${spell.desc}`);
    }
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
  } else if (action.type === 'flee') {
    // Injured legs make it harder (+5 each); with both legs injured there is no running away
    const dc = fleeDC(hero);
    if (dc == null) return { ok: false, error: 'Con las dos piernas heridas no puedes huir.' };
    const roll = rollDie(20);
    const total = roll + mod(hero.stats?.des);
    animations.push({ sides: 20, value: roll, modifier: total - roll, dc, success: total >= dc, label: 'Huida' });
    if (total >= dc) {
      const xp = overcomeXp(next, false);
      next = pushLog({ ...next, status: 'fled', xp }, 'end', `${hero.name} logra escapar (${withBonus(roll, total - roll)} = ${total} vs CD ${dc}).${xp ? ` +${xp} PX por los enemigos abatidos.` : ''}`);
      return { ok: true, encounter: next, character: hero, animations };
    }
    next = pushLog(next, 'miss', `${hero.name} intenta huir pero le cortan el paso (${total} vs CD ${dc}).`);
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

/** End the hero's turn: the enemies act until it is the hero's turn again. */
function endPlayerTurn(encounter, hero, rollDie, animations) {
  let next = encounter;
  if (!next.actionUsed) next = pushLog(next, 'info', `${hero.name} termina su turno sin hacer nada más.`);
  const after = runEnemyTurns(advanceTurn({ ...next, actionUsed: false, bonusUsed: false }), hero, rollDie);
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

function enemyAttack(encounter, enemy, attackAction, character, rollDie) {
  let next = encounter;
  let hero = character;
  const roll = encounter.dodging ? Math.min(rollDie(20), rollDie(20)) : rollDie(20);
  const total = roll + attackAction.bonus;
  const crit = roll === 20;
  const hit = crit || (roll !== 1 && total >= (hero.ac || 10));
  if (!hit) {
    return { encounter: pushLog(next, 'enemyMiss', `${enemy.name} ataca con ${attackAction.name.toLowerCase()}: ${withBonus(roll, attackAction.bonus)} = ${total} vs CA ${hero.ac} → falla.`), character: hero };
  }
  const damage = rollNotation(attackAction.damage, rollDie, crit ? 2 : 1);
  const extra = attackAction.extra ? rollNotation(attackAction.extra, rollDie, crit ? 2 : 1) : null;
  const amount = Math.max(1, damage.total) + (extra?.total || 0);
  hero = { ...hero, hp: Math.max(0, hero.hp - amount) };
  next = pushLog(next, crit ? 'enemyCrit' : 'enemyHit',
    `${enemy.name} ataca con ${attackAction.name.toLowerCase()}: ${withBonus(roll, attackAction.bonus)} = ${total} vs CA ${character.ac} → ${crit ? '¡crítico! ' : ''}${amount} de daño ${attackAction.type}${extra ? ` y ${attackAction.extraType}` : ''}.`,
    { playerDamage: amount });
  if (crit && attackAction.type === INJURY_DAMAGE_TYPE) {
    ({ encounter: next, character: hero } = graveWound(next, enemy, hero, rollDie));
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
  const roll = rollDie(20);
  const total = roll + playerSaveBonus(character, saveAction.save);
  const saved = roll !== 1 && (roll === 20 || total >= saveAction.dc);
  const damage = saveAction.damage ? rollNotation(saveAction.damage, rollDie) : null;
  const amount = damage ? (saved ? (saveAction.half ? Math.floor(damage.total / 2) : 0) : damage.total) : 0;
  const hero = { ...character, hp: Math.max(0, character.hp - amount) };
  const next = pushLog(encounter, amount > 0 ? 'enemyHit' : 'enemyMiss',
    `${enemy.name} usa ${saveAction.name}: tu salvación de ${ABILITY_NAMES[saveAction.save]} ${withBonus(roll, total - roll)} = ${total} vs CD ${saveAction.dc} → ${saved ? 'la superas' : 'fallas'}${damage ? ` (${amount} de daño ${saveAction.type})` : ''}.`,
    { playerDamage: amount });
  return { encounter: next, character: hero };
}

/** What a creature does on its turn: a ready recharge ability, its Multiattack, or its best attack. */
function chooseActions(enemy) {
  const ready = enemy.actions.find(a => a.kind === 'save' && (!a.recharge || enemy.recharge[a.id]));
  if (ready && (ready.recharge || !enemy.actions.some(a => a.kind === 'melee' || a.kind === 'ranged'))) return [ready];
  if (enemy.multiattack?.length) {
    const list = enemy.multiattack.map(id => enemy.actions.find(a => a.id === id)).filter(Boolean);
    if (list.length) return list;
  }
  const attacks = enemy.actions.filter(a => a.kind === 'melee' || a.kind === 'ranged');
  if (attacks.length) return [attacks.reduce((best, a) => (averageOf(a.damage) > averageOf(best.damage) ? a : best))];
  return ready ? [ready] : [];
}

/**
 * Let the enemies act in initiative order until it is the player's turn or the
 * combat ends. Call it after createEncounter if enemies won initiative.
 * @returns {{ encounter, character }}
 */
export function runEnemyTurns(encounter, character, rollDie) {
  let next = encounter;
  let hero = character;
  let guard = 0;

  while (next.status === 'active' && next.order[next.turn]?.kind !== 'player' && guard++ < 200) {
    const enemy = next.enemies.find(e => e.uid === next.order[next.turn].uid);
    if (enemy?.status === 'active') {
      if (enemy.skipTurns > 0) {
        next = updateEnemy(next, enemy.uid, { skipTurns: enemy.skipTurns - 1 });
        next = pushLog(next, 'info', `${enemy.name} no puede actuar este turno.`);
      } else {
        // Recharge rolls at the start of its turn
        const recharge = { ...enemy.recharge };
        enemy.actions.filter(a => a.recharge && !recharge[a.id]).forEach(a => {
          if (a.recharge.includes(rollDie(6))) recharge[a.id] = true;
        });
        const current = { ...enemy, recharge };
        for (const act of chooseActions(current)) {
          const result = act.kind === 'save'
            ? enemySaveAction(next, current, act, hero, rollDie)
            : enemyAttack(next, current, act, hero, rollDie);
          next = result.encounter;
          hero = result.character;
          if (act.recharge) recharge[act.id] = false;
          if (hero.hp <= 0) break;
        }
        next = updateEnemy(next, enemy.uid, { recharge });
      }
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
