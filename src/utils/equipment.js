// What the hero carries in each hand, the state of their limbs and the Armor
// Class that follows from them. Pure functions over the character sheet.
//
// Sheet fields (saved with the campaign):
//   hands:  { main: itemId | null, off: itemId | null }
//           main = right hand, off = left hand. An item held with both hands
//           (a two-handed weapon, or a versatile one gripped with two hands)
//           has its id in both slots.
//   limbs:  { rightArm, leftArm, rightLeg, leftLeg }: 'ok' | 'disabled' | 'lost'
//   acBase: Armor Class without a shield (armour, Dexterity, Unarmored Defense).
//   ac:     acBase + 2 while a shield is held. Kept in sync by normalizeEquipment.
// Everything in the inventory that is not in a hand is in the backpack.

import { WEAPONS, WEAPON_NAME_HINTS } from '../data/weapons';

export const HANDS = ['main', 'off'];
export const HAND_LABELS = { main: 'Mano principal (derecha)', off: 'Mano secundaria (izquierda)' };
export const HAND_LIMB = { main: 'rightArm', off: 'leftArm' };

export const LIMBS = [
  { id: 'rightArm', name: 'Brazo derecho', kind: 'arm', feminine: false },
  { id: 'leftArm', name: 'Brazo izquierdo', kind: 'arm', feminine: false },
  { id: 'rightLeg', name: 'Pierna derecha', kind: 'leg', feminine: true },
  { id: 'leftLeg', name: 'Pierna izquierda', kind: 'leg', feminine: true }
];
export const LIMB_IDS = LIMBS.map(l => l.id);
export const LIMB_STATUSES = ['ok', 'disabled', 'lost'];
export const LIMB_STATUS_LABELS = { ok: 'Sano', disabled: 'Inutilizado', lost: 'Perdido' };
export const limbName = id => LIMBS.find(l => l.id === id)?.name || id;
const isFeminine = id => Boolean(LIMBS.find(l => l.id === id)?.feminine);
/** "el brazo derecho" / "la pierna izquierda" */
export const limbWithArticle = id => `${isFeminine(id) ? 'la' : 'el'} ${limbName(id).toLowerCase()}`;
/** "Sano" / "Sana", "Inutilizado" / "Inutilizada"... agreeing with the limb. */
export const limbStatusLabel = (id, status) => {
  const label = LIMB_STATUS_LABELS[status] || status;
  return isFeminine(id) ? label.replace(/o$/, 'a') : label;
};

export const SHIELD_BONUS = 2;
export const FLEE_DC = 12;
/** Each injured (disabled or lost) leg makes fleeing harder; with both, the hero cannot flee. */
export const FLEE_DC_PER_LEG = 5;

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export const getWeapon = id => WEAPONS.find(w => w.id === id) || null;

/** The weapon an inventory item is (null for non-weapons). */
export function weaponForItem(item) {
  if (!item) return null;
  if (item.weaponId) return getWeapon(item.weaponId);
  if (item.type && item.type !== 'weapon') return null;
  const name = String(item.name || '').toLowerCase();
  const hint = WEAPON_NAME_HINTS.find(([words]) => name.includes(words));
  return hint ? getWeapon(hint[1]) : null;
}

export const isShield = item => Boolean(item) && !weaponForItem(item) && /escudo/i.test(item.name || '');

// Things you carry in a hand besides weapons and shields: foci, lights, instruments
const HOLDABLE_NAMES = /antorcha|linterna|l[aá]mpara|farol|orbe|cristal arcano|s[ií]mbolo sagrado|varita|\bvara\b|cetro|instrumento|ramita de mu[eé]rdago|amuleto|relicario|la[uú]d|flauta/i;

/** Can this item go in a hand? Weapons, shields, foci, torches... (or anything marked `holdable`). */
export function isHoldable(item) {
  if (!item) return false;
  if (item.holdable === true) return true;
  if (item.holdable === false || item.type === 'consumable') return false;
  return Boolean(weaponForItem(item)) || isShield(item)
    || HOLDABLE_NAMES.test(item.name || '') || /\bfoco\b/i.test(item.desc || '');
}

/** 'two' (always both hands), 'versatile' (one or two) or 'one'. */
export function gripOf(item) {
  const weapon = weaponForItem(item);
  if (weapon?.properties.includes('twoHanded')) return 'two';
  if (weapon?.versatile) return 'versatile';
  return 'one';
}

// ---------------------------------------------------------------------------
// Limbs
// ---------------------------------------------------------------------------

export function normalizeLimbs(limbs) {
  return Object.fromEntries(LIMB_IDS.map(id => [id, LIMB_STATUSES.includes(limbs?.[id]) ? limbs[id] : 'ok']));
}

const limbsOf = character => normalizeLimbs(character?.limbs);
export const isHandUsable = (character, hand) => limbsOf(character)[HAND_LIMB[hand]] === 'ok';
export const injuredLegs = character => ['rightLeg', 'leftLeg'].filter(id => limbsOf(character)[id] !== 'ok').length;

/** DC to flee a fight (null when the hero cannot flee at all). */
export function fleeDC(character) {
  const legs = injuredLegs(character);
  return legs >= 2 ? null : FLEE_DC + legs * FLEE_DC_PER_LEG;
}

/** Walking speed in metres: halved with one injured leg, crawling (1,5 m) with both. */
export function speedInMetres(character) {
  const metres = (Number(character?.speed) || 30) * 0.3;
  const legs = injuredLegs(character);
  if (legs >= 2) return 1.5;
  return legs === 1 ? Math.floor(metres / 2 / 1.5) * 1.5 : metres;
}

// ---------------------------------------------------------------------------
// Hands
// ---------------------------------------------------------------------------

const itemById = (character, id) => (id ? (character.inventory || []).find(i => i.id === id) || null : null);

/** Make a hands configuration valid for these limbs and this inventory. */
function validHands(character, hands) {
  const limbs = limbsOf(character);
  const usable = hand => limbs[HAND_LIMB[hand]] === 'ok';
  let main = usable('main') ? hands?.main ?? null : null;
  let off = usable('off') ? hands?.off ?? null : null;
  const valid = id => isHoldable(itemById(character, id));
  if (!valid(main)) main = null;
  if (!valid(off)) off = null;

  // An item held with both hands needs both arms; one-handed items use one slot
  [main, off].forEach(id => {
    if (!id) return;
    const grip = gripOf(itemById(character, id));
    const both = main === id && off === id;
    if (grip === 'two' && !both) {
      // A two-handed weapon in a single slot: take the other hand if it is free, or drop it
      if (main === id && usable('off') && !off) off = id;
      else if (off === id && usable('main') && !main) main = id;
      else { if (main === id) main = null; if (off === id) off = null; }
    }
    if (grip === 'one' && both) off = null;
  });
  return { main, off };
}

/**
 * The hands an older save starts with: its first usable weapon (both hands if it
 * is two-handed) and its shield; anything marked `equipped: false` stays packed.
 */
export function defaultHands(character) {
  const items = (character.inventory || []).filter(item => item.equipped !== false && isHoldable(item));
  const usable = hand => isHandUsable(character, hand);
  const hands = { main: null, off: null };
  const free = () => HANDS.filter(h => usable(h) && !hands[h]);

  const weapon = items.find(item => weaponForItem(item) && (gripOf(item) !== 'two' || free().length === 2));
  if (weapon) {
    if (gripOf(weapon) === 'two') { hands.main = weapon.id; hands.off = weapon.id; }
    else if (free().length) hands[free()[0]] = weapon.id;
  }
  const shield = items.find(isShield);
  if (shield && free().length) hands[free().at(-1)] = shield.id;
  return hands;
}

/** Ids of the items in the hero's hands. */
export function heldItemIds(character) {
  const hands = handsOf(character);
  return [...new Set([hands.main, hands.off].filter(Boolean))];
}

export const isHeld = (character, itemId) => heldItemIds(character).includes(itemId);
export const holdsShield = character => heldItemIds(character).some(id => isShield(itemById(character, id)));
const handsOf = character => (character.hands ? validHands(character, character.hands) : defaultHands(character));

/** True when both hands hold this item. */
export const isTwoHanded = (character, itemId) => {
  const hands = handsOf(character);
  return Boolean(itemId) && hands.main === itemId && hands.off === itemId;
};

/** The weapons in hand: [{ item, weapon, twoHands }] */
export function heldWeapons(character) {
  return heldItemIds(character)
    .map(id => itemById(character, id))
    .map(item => ({ item, weapon: weaponForItem(item), twoHands: isTwoHanded(character, item.id) }))
    .filter(entry => entry.weapon);
}

export const hasFreeHand = character => {
  const hands = handsOf(character);
  return HANDS.some(h => isHandUsable(character, h) && !hands[h]);
};

/** Unarmed strikes need a free hand, except for monks (kicks, knees, elbows...). */
export const canStrikeUnarmed = character => character.classId === 'monk' || hasFreeHand(character);

export const armorClass = character => (Number(character.acBase) || 10) + (holdsShield(character) ? SHIELD_BONUS : 0);

/**
 * Bring a sheet up to date: limbs, item ids, valid hands and Armor Class.
 * Older saves have no hands: they get a valid set (first weapon + shield) and
 * healthy limbs, and keep their Armor Class. Safe to call many times.
 */
export function normalizeEquipment(character) {
  if (!character || typeof character !== 'object') return character;
  const legacy = !character.hands;
  let n = 0;
  const inventory = (Array.isArray(character.inventory) ? character.inventory : []).filter(i => i && typeof i === 'object')
    .map(item => (item.id ? item : { ...item, id: `item_m${n++}` }));
  const limbs = normalizeLimbs(character.limbs);
  let sheet = { ...character, inventory, limbs };

  const hands = legacy ? validHands(sheet, defaultHands(sheet)) : validHands(sheet, sheet.hands);
  let acBase = Number(sheet.acBase);
  if (!Number.isFinite(acBase) || sheet.acBase == null) {
    // The stored AC of an older save already counts its shield if it was equipped
    const hadShield = legacy
      ? inventory.some(i => isShield(i) && i.equipped !== false)
      : heldItemIds(sheet).some(id => isShield(itemById(sheet, id)));
    acBase = (Number(sheet.ac) || 10) - (hadShield ? SHIELD_BONUS : 0);
  }
  sheet = {
    ...sheet,
    inventory: inventory.map(item => {
      if (!('equipped' in item)) return item;
      const { equipped: _drop, ...rest } = item;
      return rest;
    }),
    hands,
    acBase
  };
  return { ...sheet, ac: armorClass(sheet) };
}

const withHands = (character, hands) => normalizeEquipment({ ...character, hands });

/**
 * Put an item in a hand. A two-handed weapon takes both hands; a versatile one
 * takes both with `twoHands`. Whatever was in the way goes back to the backpack.
 * @returns {{ ok: true, character } | { ok: false, error }}
 */
export function equipItem(character, itemId, hand, { twoHands = false } = {}) {
  const sheet = normalizeEquipment(character);
  const item = itemById(sheet, itemId);
  if (!item) return { ok: false, error: 'No tienes ese objeto.' };
  if (!isHoldable(item)) return { ok: false, error: `${item.name} no se lleva en la mano.` };
  if (!HANDS.includes(hand)) return { ok: false, error: 'Elige una mano.' };
  const grip = gripOf(item);
  const both = grip === 'two' || (grip === 'versatile' && twoHands);
  if (both && !(isHandUsable(sheet, 'main') && isHandUsable(sheet, 'off'))) {
    return { ok: false, error: `${item.name} necesita las dos manos y no puedes usar las dos.` };
  }
  if (!both && !isHandUsable(sheet, hand)) {
    return { ok: false, error: `Tu ${limbName(HAND_LIMB[hand]).toLowerCase()} no puede sostener nada.` };
  }

  const hands = { ...sheet.hands };
  // Take the item out of wherever it was
  HANDS.forEach(h => { if (hands[h] === itemId) hands[h] = null; });
  const clear = h => {
    const id = hands[h];
    if (!id) return;
    // Something held with both hands leaves both
    HANDS.forEach(other => { if (hands[other] === id) hands[other] = null; });
  };
  if (both) {
    HANDS.forEach(clear);
    hands.main = itemId;
    hands.off = itemId;
  } else {
    clear(hand);
    hands[hand] = itemId;
  }
  return { ok: true, character: withHands(sheet, hands) };
}

/** Put whatever is in this hand back into the backpack (both hands if it was held with both). */
export function unequipHand(character, hand) {
  const sheet = normalizeEquipment(character);
  const id = sheet.hands[hand];
  if (!id) return sheet;
  return withHands(sheet, Object.fromEntries(HANDS.map(h => [h, sheet.hands[h] === id ? null : sheet.hands[h]])));
}

/** Grip a versatile weapon already in hand with one or both hands. */
export function setTwoHandedGrip(character, itemId, twoHands) {
  const sheet = normalizeEquipment(character);
  const hand = HANDS.find(h => sheet.hands[h] === itemId);
  if (!hand) return { ok: false, error: 'No tienes ese objeto en la mano.' };
  if (twoHands) return equipItem(sheet, itemId, hand, { twoHands: true });
  if (gripOf(itemById(sheet, itemId)) === 'two') return { ok: false, error: 'Esa arma solo se puede usar a dos manos.' };
  const both = sheet.hands.main === itemId && sheet.hands.off === itemId;
  return { ok: true, character: both ? withHands(sheet, { main: itemId, off: null }) : sheet };
}

/**
 * Replace the whole hands configuration (used by the combat "change weapons" action).
 * The configuration must already be valid: nothing is dropped or moved silently.
 * @returns {{ ok: true, character, changed: boolean } | { ok: false, error }}
 */
export function setHands(character, hands) {
  const sheet = normalizeEquipment(character);
  const wanted = { main: hands?.main || null, off: hands?.off || null };
  const valid = validHands(sheet, wanted);
  if (valid.main !== wanted.main || valid.off !== wanted.off) {
    return { ok: false, error: 'Ese reparto de manos no es posible.' };
  }
  const changed = valid.main !== sheet.hands.main || valid.off !== sheet.hands.off;
  return { ok: true, character: withHands(sheet, valid), changed };
}

/** One line for the chronicle or the combat log: "Espada larga y Escudo", "Espadón (a dos manos)", "nada". */
export function describeHands(character) {
  const sheet = normalizeEquipment(character);
  const { main, off } = sheet.hands;
  if (main && main === off) return `${itemById(sheet, main).name} (a dos manos)`;
  const names = [main, off].filter(Boolean).map(id => itemById(sheet, id).name);
  return names.length ? names.join(' y ') : 'las manos vacías';
}

/** What a slot of the equipment menu shows. */
export function handSlots(character) {
  const sheet = normalizeEquipment(character);
  return HANDS.map(hand => {
    const limb = HAND_LIMB[hand];
    const id = sheet.hands[hand];
    return {
      hand,
      label: HAND_LABELS[hand],
      limb,
      limbStatus: sheet.limbs[limb],
      blocked: sheet.limbs[limb] !== 'ok',
      item: itemById(sheet, id),
      twoHands: Boolean(id) && sheet.hands.main === id && sheet.hands.off === id
    };
  });
}

/** Items that could go in this hand (everything holdable; two-handed ones only with both arms). */
export function itemsForHand(character, hand) {
  const sheet = normalizeEquipment(character);
  if (!isHandUsable(sheet, hand)) return [];
  const bothArms = isHandUsable(sheet, 'main') && isHandUsable(sheet, 'off');
  return sheet.inventory.filter(item => isHoldable(item) && (gripOf(item) !== 'two' || bothArms));
}

// ---------------------------------------------------------------------------
// Injuries
// ---------------------------------------------------------------------------

/**
 * Change the state of a limb. A hand whose arm is no longer healthy drops what
 * it held (to the backpack); a two-handed weapon can't be held with one arm.
 * @returns {{ character, changed: boolean, dropped: string[] }}  names of the items dropped
 */
export function setLimbStatus(character, limbId, status) {
  const sheet = normalizeEquipment(character);
  if (!LIMB_IDS.includes(limbId) || !LIMB_STATUSES.includes(status) || sheet.limbs[limbId] === status) {
    return { character: sheet, changed: false, dropped: [] };
  }
  const next = normalizeEquipment({ ...sheet, limbs: { ...sheet.limbs, [limbId]: status } });
  const after = heldItemIds(next);
  const dropped = heldItemIds(sheet).filter(id => !after.includes(id)).map(id => itemById(sheet, id).name);
  return { character: next, changed: true, dropped };
}

/**
 * Apply several limb changes (from Duncan's structured reply or a combat injury).
 * @param {{limb, status}[]} changes
 * @returns {{ character, applied: {limb, status, dropped}[] }}
 */
export function applyLimbChanges(character, changes = []) {
  let sheet = normalizeEquipment(character);
  const applied = [];
  (changes || []).forEach(({ limb, status }) => {
    const result = setLimbStatus(sheet, limb, status);
    if (!result.changed) return;
    sheet = result.character;
    applied.push({ limb, status, dropped: result.dropped });
  });
  return { character: sheet, applied };
}

/** A fact for the campaign memory: "Brega pierde el brazo izquierdo (en combate contra Orco)". */
export function limbFact(name, { limb, status }, cause = '') {
  const part = limbWithArticle(limb);
  const text = status === 'lost' ? `${name} pierde ${part}`
    : status === 'disabled' ? `${name} tiene ${part} ${limbStatusLabel(limb, 'disabled').toLowerCase()}`
    : `${name} recupera el uso ${part.replace(/^el /, 'del ').replace(/^la /, 'de la ')}`;
  return cause ? `${text} (${cause})` : text;
}

/** Equipment lines for the Dungeon Master's prompt. */
export function describeEquipmentForPrompt(character) {
  const sheet = normalizeEquipment(character);
  const injured = LIMBS.filter(l => sheet.limbs[l.id] !== 'ok')
    .map(l => `${l.name.toLowerCase()} ${limbStatusLabel(l.id, sheet.limbs[l.id]).toLowerCase()}`);
  return `En las manos: ${describeHands(sheet)}.${injured.length ? ` Extremidades heridas: ${injured.join(', ')}.` : ''}`;
}
