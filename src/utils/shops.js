// Shops in the settlements of the map: what each one sells, buying and selling.
// Pure functions. The game sets every price from the SRD tables (buy at the
// listed price, sell at half); the AI only opens a shop, it never decides
// prices or gold.
//
// Campaign field (saved with the campaign):
//   shops: { [shopKey]: { key, type, nodeId, place, size, stock: [{ key, qty }] } }
//   shopKey = `${nodeId}:${type}`. The stock is generated the first time the
//   hero enters and kept from then on: buying takes items out of it and
//   selling puts them in.

import { WEAPONS } from '../data/weapons';
import { GEAR } from '../data/gear';
import { PRESET_WORLDS } from '../data/gameData';
import { catalogByKey, catalogEntry, makeItem, addItem, roundCoins, formatCoins } from './items';
import { isHeld, isWorn } from './equipment';

/**
 * Kinds of settlement. size: 1 small (tavern, hamlet), 2 medium (town, port),
 * 3 large (city). It decides which shops there are and how much they stock.
 */
export const SETTLEMENTS = {
  tavern: { name: 'Taberna', size: 1, shops: ['general', 'alchemist'] },
  village: { name: 'Aldea', size: 1, shops: ['general', 'smith'] },
  town: { name: 'Pueblo', size: 2, shops: ['smith', 'alchemist', 'general'] },
  port: { name: 'Puerto', size: 2, shops: ['smith', 'alchemist', 'general'] },
  city: { name: 'Ciudad', size: 3, shops: ['smith', 'alchemist', 'general'] }
};

/** Shop types. `reply`: the id Duncan uses in his structured reply. `kinds`: catalog kinds it sells and buys. */
export const SHOP_TYPES = {
  smith: { name: 'Herrería y armería', short: 'Herrero', reply: 'herrero', icon: '⚒️', kinds: ['weapon', 'armor'] },
  alchemist: { name: 'Boticario', short: 'Boticario', reply: 'alquimista', icon: '⚗️', kinds: ['potion'], gear: ['healersKit', 'antitoxin', 'holyWater'] },
  general: { name: 'Tienda general', short: 'Tienda', reply: 'general', icon: '🎒', kinds: ['gear'] }
};
export const SHOP_REPLY_IDS = Object.fromEntries(Object.entries(SHOP_TYPES).map(([id, t]) => [t.reply, id]));

/** Size of the stall a shop opened away from any settlement has (a pedlar, a camp...). */
export const WANDERING_SIZE = 1;

// ---------------------------------------------------------------------------
// Settlements on the map
// ---------------------------------------------------------------------------

const SETTLEMENT_WORDS = [
  ['tavern', /\b(taberna|posada|mes[oó]n|cantina|bar|tavern|inn)\b/i],
  ['city', /\b(ciudad|capital|metr[oó]poli|ciudadela|urbe|puertas)\b/i],
  ['port', /\b(puerto|muelle|d[aá]rsena|embarcadero|astillero)\b/i],
  ['town', /\b(pueblo|villa|mercado|bazar|plaza|burgo)\b/i],
  ['village', /\b(aldea|caser[ií]o|granja|campamento|alquer[ií]a)\b/i]
];

/**
 * What kind of settlement a map node is (null for wild places, ruins...).
 * Order: the node's own `settlement`, the preset world it comes from (older
 * saves keep a copy of the world without that field), the words in its name.
 */
export function settlementOf(node, world = null) {
  if (!node) return null;
  if (node.settlement !== undefined) return SETTLEMENTS[node.settlement] ? node.settlement : null;
  const preset = PRESET_WORLDS.find(w => w.id === world?.id)?.mapNodes.find(n => n.id === node.id);
  if (preset) return SETTLEMENTS[preset.settlement] ? preset.settlement : null;
  const found = SETTLEMENT_WORDS.find(([, words]) => words.test(node.name || ''));
  if (found) return found[0];
  return node.id === 'tavern' ? 'tavern' : null;
}

export const currentNode = world => world?.mapNodes?.find(n => n.status === 'current') || null;

/** Shop types at a node ([] for wild places). */
export function shopsAt(node, world = null) {
  const kind = settlementOf(node, world);
  return kind ? SETTLEMENTS[kind].shops : [];
}

export const shopKey = (nodeId, type) => `${nodeId || 'camino'}:${type}`;

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

/** Small seeded generator, so the same shop key always gives the same first stock. */
export function seededRng(seedText) {
  let h = 1779033703 ^ String(seedText).length;
  for (const ch of String(seedText)) {
    h = Math.imul(h ^ ch.charCodeAt(0), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
const pickSome = (rng, list, count) => {
  const pool = [...list];
  const out = [];
  while (out.length < count && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
};

const SMALL_GEAR = ['backpack', 'bedroll', 'rope', 'torches', 'rations', 'waterskin', 'tinderbox', 'oil', 'arrows', 'bolts', 'crowbar', 'healersKit'];
const MEDIUM_ARMOR_TOWN = ['hide', 'chainShirt', 'scaleMail'];
const HEAVY_ARMOR_TOWN = ['ringMail', 'chainMail'];

/**
 * What a shop has when the hero first walks in.
 *  - Smith: size 1 sells simple weapons and light armor, hide and shields;
 *    size 2 adds some martial weapons, chain shirts, scale, ring and chain mail;
 *    size 3 sells every weapon and armor (plate only sometimes, one piece).
 *  - Alchemist: Potions of Healing (more in bigger places); greater ones from
 *    size 2, superior ones only sometimes in cities; supreme ones are never sold.
 *  - General store: basic adventuring gear (all of it from size 2).
 * @returns {{ key, qty }[]}
 */
export function generateStock(type, size, rng = Math.random) {
  const stock = [];
  const add = (key, qty) => { if (qty > 0 && catalogByKey(key)) stock.push({ key, qty }); };
  if (type === 'smith') {
    const simple = WEAPONS.filter(w => w.category === 'simple').map(w => w.id);
    const martial = WEAPONS.filter(w => w.category === 'martial').map(w => w.id);
    const weapons = size >= 3 ? [...simple, ...martial]
      : size === 2 ? [...pickSome(rng, simple, 7), ...pickSome(rng, martial, 8)]
      : pickSome(rng, simple, 6);
    weapons.forEach(id => add(`weapon:${id}`, between(rng, 1, size + 1)));
    const armors = ['padded', 'leather', 'hide', 'shield'];
    if (size >= 2) armors.push('studdedLeather', ...MEDIUM_ARMOR_TOWN, ...HEAVY_ARMOR_TOWN);
    if (size >= 3) armors.push('breastplate', 'halfPlate', 'splint');
    armors.forEach(id => add(`armor:${id}`, between(rng, 1, size)));
    if (size >= 3 && rng() < 0.6) add('armor:plate', 1);
  } else if (type === 'alchemist') {
    add('potion:healing', between(rng, 2, 4) * size);
    if (size >= 2) add('potion:greaterHealing', between(rng, 0, size));
    if (size >= 3 && rng() < 0.35) add('potion:superiorHealing', 1);
    SHOP_TYPES.alchemist.gear.forEach(id => add(`gear:${id}`, between(rng, 0, size + 1)));
  } else if (type === 'general') {
    const gear = size >= 2 ? GEAR.map(g => g.id) : SMALL_GEAR;
    gear.forEach(id => add(`gear:${id}`, between(rng, 1, 2 + size * 2)));
  }
  return stock;
}

/**
 * The shop of this type at this node, from the saved shops or new (with a
 * stock generated once). Returns the updated shops too: save them.
 * @param {object} shops       campaign.shops
 * @param {{ node, world, type, rng? }} where
 * @returns {{ shops, shop } | null}  null for an unknown shop type
 */
export function openShop(shops, { node, world, type, rng = null }) {
  if (!SHOP_TYPES[type]) return null;
  const saved = shops && typeof shops === 'object' ? shops : {};
  const key = shopKey(node?.id, type);
  if (saved[key]) return { shops: saved, shop: saved[key] };
  const kind = settlementOf(node, world);
  const size = kind ? SETTLEMENTS[kind].size : WANDERING_SIZE;
  const shop = {
    key,
    type,
    nodeId: node?.id || null,
    place: node?.name || 'el camino',
    size,
    stock: generateStock(type, size, rng || seededRng(`${world?.id || ''}:${key}`))
  };
  return { shops: { ...saved, [key]: shop }, shop };
}

/** Valid saved shops only (older saves have none). */
export function normalizeShops(shops) {
  if (!shops || typeof shops !== 'object' || Array.isArray(shops)) return {};
  return Object.fromEntries(Object.entries(shops).filter(([, shop]) => shop && SHOP_TYPES[shop.type] && Array.isArray(shop.stock))
    .map(([key, shop]) => [key, { ...shop, stock: shop.stock.filter(s => s && catalogByKey(s.key) && Number(s.qty) >= 0) }]));
}

// ---------------------------------------------------------------------------
// Buying and selling
// ---------------------------------------------------------------------------

export const buyPrice = key => catalogByKey(key)?.price ?? null;

/** Rows of the shop's counter: what is left, price and description. */
export function shopRows(shop) {
  return (shop?.stock || []).filter(s => s.qty > 0).map(s => {
    const entry = catalogByKey(s.key);
    return { key: s.key, qty: s.qty, name: entry.name, kind: entry.kind, price: entry.price, weight: entry.weight, data: entry.data };
  });
}

/** Does this shop deal in this item? */
export function shopBuys(shop, item) {
  const entry = catalogEntry(item);
  if (!entry || !shop) return false;
  const type = SHOP_TYPES[shop.type];
  return type.kinds.includes(entry.kind) || (entry.kind === 'gear' && (type.gear || []).includes(entry.id));
}

/**
 * What the shop pays for an item: half its SRD price. Potions are sold one at
 * a time; anything else whole ("Dagas (2)" is two daggers).
 * @returns {number | null}  gold pieces, null if the shop doesn't want it
 */
export function sellPrice(shop, item) {
  if (!shopBuys(shop, item)) return null;
  const entry = catalogEntry(item);
  const units = entry.kind === 'potion' ? 1 : entry.count;
  return roundCoins((entry.price * units) / 2);
}

const updateStock = (shop, key, delta) => {
  const found = shop.stock.some(s => s.key === key);
  const stock = found
    ? shop.stock.map(s => (s.key === key ? { ...s, qty: Math.max(0, s.qty + delta) } : s))
    : [...shop.stock, { key, qty: Math.max(0, delta) }];
  return { ...shop, stock };
};

/**
 * Buy one unit of a stock row.
 * @returns {{ ok: true, character, shop, item, price } | { ok: false, error }}
 */
export function buyItem(character, shop, key) {
  const row = shop?.stock?.find(s => s.key === key);
  const price = buyPrice(key);
  if (!row || row.qty <= 0 || price == null) return { ok: false, error: 'Eso ya no está a la venta.' };
  const gold = roundCoins(character.gold);
  if (gold < price) return { ok: false, error: `No te llega: cuesta ${formatCoins(price)} y tienes ${formatCoins(gold)}.` };
  const item = makeItem(key);
  return {
    ok: true,
    character: { ...character, gold: roundCoins(gold - price), inventory: addItem(character.inventory, item) },
    shop: updateStock(shop, key, -1),
    item,
    price
  };
}

/**
 * Sell an item from the backpack (a potion: one of its uses). Items in a hand
 * or worn can't be sold until they are put away.
 * @returns {{ ok: true, character, shop, item, price } | { ok: false, error }}
 */
export function sellItem(character, shop, itemId) {
  const item = (character.inventory || []).find(i => i.id === itemId);
  if (!item) return { ok: false, error: 'No tienes ese objeto.' };
  if (isHeld(character, itemId) || isWorn(character, itemId)) return { ok: false, error: `Primero guarda ${item.name} en la mochila (menú Equipo).` };
  const price = sellPrice(shop, item);
  if (price == null) return { ok: false, error: `Aquí no compran ${item.name}.` };
  const entry = catalogEntry(item);
  const onePotion = entry.kind === 'potion' && Number(item.uses) > 1;
  const inventory = onePotion
    ? character.inventory.map(i => (i.id === itemId ? { ...i, uses: i.uses - 1 } : i))
    : character.inventory.filter(i => i.id !== itemId);
  const units = entry.kind === 'potion' ? 1 : Math.max(1, Math.round(entry.count));
  return {
    ok: true,
    character: { ...character, gold: roundCoins((Number(character.gold) || 0) + price), inventory },
    shop: updateStock(shop, `${entry.kind}:${entry.id}`, units),
    item,
    price
  };
}

/** One line for the chronicle: "🛒 Compra Espada larga por 15 po en la Herrería y armería." */
export function describeTrade(kind, item, price, shop) {
  return `🛒 ${kind === 'buy' ? 'Compra' : 'Vende'} ${item.name} por ${formatCoins(price)} en ${SHOP_TYPES[shop.type].name.toLowerCase()} (${shop.place}).`;
}

/** For the Dungeon Master's prompt: the shops at the hero's location. */
export function describeShopsForPrompt(node, world) {
  const types = shopsAt(node, world);
  if (!types.length) return '';
  return `En ${node.name} hay: ${types.map(t => `${SHOP_TYPES[t].name} ("${SHOP_TYPES[t].reply}")`).join(', ')}.`;
}

