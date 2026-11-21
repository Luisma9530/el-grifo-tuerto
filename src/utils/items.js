// What an inventory item is worth and weighs, how to make new items for the
// shops and the loot, coins, and healing potions. Pure functions.
//
// The game sets every price from the SRD tables (data/weapons.js, armor.js,
// gear.js): the AI never decides prices or gold.

import { WEAPONS, WEAPON_COSTS, PROPERTY_NAMES } from '../data/weapons';
import { ARMORS, ARMOR_CATEGORY_NAMES } from '../data/armor';
import { POTIONS, POTION_NAME_HINTS, GEAR, GEAR_NAME_HINTS } from '../data/gear';
import { weaponForItem, armorForItem } from './equipment';

// ---------------------------------------------------------------------------
// Coins: the sheet keeps gold pieces with copper precision (0,01 po)
// ---------------------------------------------------------------------------

export const roundCoins = value => Math.round((Number(value) || 0) * 100) / 100;

/** Spanish style: 1500, 20.000 (four-digit numbers are not grouped). */
const groupThousands = n => (n >= 10000 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : String(n));

/** "14 po", "14 po 5 pp", "3 pp 2 pc", "0 po", "20.000 po" */
export function formatCoins(value) {
  const cp = Math.max(0, Math.round((Number(value) || 0) * 100));
  const gp = Math.floor(cp / 100);
  const sp = Math.floor((cp % 100) / 10);
  const c = cp % 10;
  const parts = [gp ? `${groupThousands(gp)} po` : '', sp ? `${sp} pp` : '', c ? `${c} pc` : ''].filter(Boolean);
  return parts.length ? parts.join(' ') : '0 po';
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const getPotion = id => POTIONS.find(p => p.id === id) || null;
export const getGear = id => GEAR.find(g => g.id === id) || null;

/** The healing potion an item is (null when it isn't one). */
export function potionForItem(item) {
  if (!item) return null;
  if (item.potionId) return getPotion(item.potionId);
  if (item.type !== 'consumable') return null;
  const name = String(item.name || '').toLowerCase();
  const hint = POTION_NAME_HINTS.find(([words]) => name.includes(words));
  return hint ? getPotion(hint[1]) : null;
}

const DICE_IN_TEXT = /(\d+d\d+(?:\s*\+\s*\d+)?)/i;

/**
 * Dice a consumable heals ("2d4+2"), or null. SRD potions, items with `heal`,
 * and older consumables whose effect says they heal ("Cura 2d4+4...").
 */
export function healingDice(item) {
  if (!item || item.type !== 'consumable' || (item.uses !== undefined && item.uses <= 0)) return null;
  if (item.heal) return String(item.heal);
  const potion = potionForItem(item);
  if (potion) return potion.heal;
  const effect = String(item.effect || '');
  if (/cur|recupera/i.test(effect)) {
    const match = effect.match(DICE_IN_TEXT);
    if (match) return match[1].replace(/\s+/g, '');
  }
  return null;
}

/** "(4)" in "Hachas de mano (4)": how many of the thing the item is. */
function countInName(item) {
  const match = String(item?.name || '').match(/\((\d+)\)\s*$/);
  return match ? Math.max(1, Number(match[1])) : 1;
}

/**
 * What an item is in the SRD tables.
 * @returns {{ kind: 'weapon'|'armor'|'potion'|'gear', id, name, price, weight, count } | null}
 *   price and weight are for one unit; count: units in the item (uses of a
 *   potion, "(4)" in a name). null for items the tables don't know (relics...).
 */
export function catalogEntry(item) {
  if (!item) return null;
  const potion = potionForItem(item);
  if (potion) return { kind: 'potion', id: potion.id, name: potion.name, price: potion.price, weight: potion.weight, count: Math.max(1, Number(item.uses) || 1) };
  const weapon = weaponForItem(item);
  if (weapon) {
    const [price, weight] = WEAPON_COSTS[weapon.id] || [0, 0];
    return { kind: 'weapon', id: weapon.id, name: weapon.name, price, weight, count: countInName(item) };
  }
  const armor = armorForItem(item);
  if (armor) return { kind: 'armor', id: armor.id, name: armor.name, price: armor.price, weight: armor.weight, count: 1 };
  let gear = item.gearId ? getGear(item.gearId) : null;
  if (!gear) {
    const name = String(item.name || '').toLowerCase();
    const hint = GEAR_NAME_HINTS.find(([words]) => name.includes(words));
    gear = hint ? getGear(hint[1]) : null;
  }
  if (gear) {
    // Gear with charges (Healer's Kit): its price is for the full kit
    const count = gear.uses ? Math.max(0, Number(item.uses ?? gear.uses)) / gear.uses : countInName(item);
    return { kind: 'gear', id: gear.id, name: gear.name, price: gear.price, weight: gear.weight, count };
  }
  return null;
}

/** The SRD entry for a catalog key "kind:id" (shops and loot use these keys). */
export function catalogByKey(key) {
  const [kind, id] = String(key).split(':');
  if (kind === 'weapon') {
    const weapon = WEAPONS.find(w => w.id === id);
    if (!weapon) return null;
    const [price, weight] = WEAPON_COSTS[id] || [0, 0];
    return { kind, id, name: weapon.name, price, weight, data: weapon };
  }
  if (kind === 'armor') {
    const armor = ARMORS.find(a => a.id === id);
    return armor ? { kind, id, name: armor.name, price: armor.price, weight: armor.weight, data: armor } : null;
  }
  if (kind === 'potion') {
    const potion = getPotion(id);
    return potion ? { kind, id, name: potion.name, price: potion.price, weight: potion.weight, data: potion } : null;
  }
  if (kind === 'gear') {
    const gear = getGear(id);
    return gear ? { kind, id, name: gear.name, price: gear.price, weight: gear.weight, data: gear } : null;
  }
  return null;
}

export const catalogKeyOf = item => {
  const entry = catalogEntry(item);
  return entry ? `${entry.kind}:${entry.id}` : null;
};

const signed = n => (n >= 0 ? `+${n}` : `${n}`);

/** One-line description of a catalog entry, as the sheet and the shop show it. */
export function describeEntry(entry) {
  if (!entry) return '';
  const { kind, data } = entry;
  if (kind === 'weapon') {
    const props = data.properties.map(p => PROPERTY_NAMES[p]).filter(Boolean);
    if (data.versatile) props.push(`versátil (${data.versatile})`);
    return `${data.damage} ${data.type}${props.length ? ` · ${props.join(', ')}` : ''}`;
  }
  if (kind === 'armor') {
    if (data.category === 'shield') return `${signed(data.ac)} a la CA mientras esté en una mano`;
    const dex = data.dexCap === 0 ? '' : data.dexCap ? ' + Des (máx. 2)' : ' + Des';
    const notes = [`Armadura ${ARMOR_CATEGORY_NAMES[data.category]}`, `CA ${data.ac}${dex}`];
    if (data.strength) notes.push(`Fue ${data.strength}`);
    if (data.stealth) notes.push('desventaja en Sigilo');
    return notes.join(' · ');
  }
  if (kind === 'potion') return `Recupera ${data.heal} PG (${data.rarity})`;
  return data.desc || data.effect || '';
}

let itemCounter = 0;
const newItemId = () => `item_${Date.now().toString(36)}_${(itemCounter++).toString(36)}`;

/**
 * A new inventory item for a catalog key ("weapon:longsword", "potion:healing"...).
 * @returns {object | null}
 */
export function makeItem(key, { id = newItemId() } = {}) {
  const entry = catalogByKey(key);
  if (!entry) return null;
  const base = { id, name: entry.name, desc: describeEntry(entry) };
  if (entry.kind === 'weapon') return { ...base, type: 'weapon', weaponId: entry.id };
  if (entry.kind === 'armor') return { ...base, type: 'armor', armorId: entry.id };
  if (entry.kind === 'potion') {
    const { desc, ...rest } = base;
    return { ...rest, type: 'consumable', potionId: entry.id, heal: entry.data.heal, effect: desc, uses: 1 };
  }
  const gear = entry.data;
  return {
    ...base,
    type: gear.type,
    gearId: gear.id,
    ...(gear.uses ? { uses: gear.uses, effect: gear.effect } : {})
  };
}

/**
 * Add an item to the inventory. Potions of the same kind stack in one item
 * (its `uses`); everything else is a new item.
 */
export function addItem(inventory, item) {
  const list = Array.isArray(inventory) ? inventory : [];
  if (item.potionId) {
    const same = list.find(i => potionForItem(i)?.id === item.potionId && i.uses !== undefined);
    if (same) return list.map(i => (i === same ? { ...i, uses: (Number(i.uses) || 0) + (Number(item.uses) || 1) } : i));
  }
  return [...list, item];
}

// ---------------------------------------------------------------------------
// Weight
// ---------------------------------------------------------------------------

/** Weight of an item in kg (0 for items the tables don't know). */
export function itemWeight(item) {
  const entry = catalogEntry(item);
  return entry ? entry.weight * entry.count : 0;
}

/** Total weight carried, in kg, and how many items have no known weight. */
export function inventoryWeight(character) {
  const items = character?.inventory || [];
  const total = items.reduce((sum, item) => sum + itemWeight(item), 0);
  return { kg: Math.round(total * 10) / 10, unknown: items.filter(i => !catalogEntry(i)).length };
}

export const formatKg = kg => `${String(Math.round(kg * 100) / 100).replace('.', ',')} kg`;

// ---------------------------------------------------------------------------
// Drinking a healing potion (in or out of combat)
// ---------------------------------------------------------------------------

/**
 * Drink a healing potion (or any consumable that heals): roll its dice, add
 * the hit points and spend one use.
 * @param {(sides: number) => number} rollDie
 * @returns {{ ok: false, error } | { ok: true, character, item, roll: { dice, sides, bonus, total }, healed }}
 */
export function drinkPotion(character, itemId, rollDie) {
  const item = (character?.inventory || []).find(i => i.id === itemId);
  const notation = healingDice(item);
  if (!item || !notation) return { ok: false, error: 'No tienes esa poción.' };
  const match = notation.match(/^(\d+)d(\d+)(?:\+(\d+))?$/i);
  if (!match) return { ok: false, error: 'Esa poción no cura.' };
  const [count, sides, bonus] = [Number(match[1]), Number(match[2]), Number(match[3] || 0)];
  const dice = Array.from({ length: count }, () => rollDie(sides));
  const total = dice.reduce((a, b) => a + b, 0) + bonus;
  const maxHp = Math.max(1, Number(character.maxHp) || 1);
  const hp = Math.min(maxHp, Math.max(0, Number(character.hp) || 0) + total);
  const inventory = character.inventory
    .map(i => (i.id === item.id && i.uses !== undefined ? { ...i, uses: i.uses - 1 } : i))
    .filter(i => i.id !== item.id || i.uses === undefined || i.uses > 0)
    // A consumable without uses is spent in one go
    .filter(i => i.id !== item.id || i.uses !== undefined);
  return {
    ok: true,
    character: { ...character, hp, inventory },
    item,
    roll: { dice, sides, bonus, total },
    healed: hp - (Number(character.hp) || 0)
  };
}
