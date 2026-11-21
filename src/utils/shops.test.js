import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  settlementOf, shopsAt, openShop, generateStock, seededRng, buyItem, sellItem, sellPrice, shopBuys, shopRows,
  normalizeShops, describeShopsForPrompt, SETTLEMENTS
} from './shops';
import { makeItem, catalogByKey, formatCoins, drinkPotion, healingDice, addItem, catalogEntry, inventoryWeight } from './items';
import { normalizeEquipment, equipItem, setWornArmor } from './equipment';
import { saveCampaign, getCampaignById, migrateCampaign } from './campaignStorage';
import { PRESET_WORLDS, PRESET_CHARACTERS } from '../data/gameData';
import { POTIONS } from '../data/gear';

const oakhaven = PRESET_WORLDS.find(w => w.id === 'oakhaven');
const tavern = oakhaven.mapNodes.find(n => n.id === 'tavern');
const dock = oakhaven.mapNodes.find(n => n.id === 'dock');
const city = { id: 'capital', name: 'Ciudad de Brumavera', status: 'current' };
const customWorld = { id: 'custom-1', name: 'Mi mundo', mapNodes: [city] };

const hero = (gold = 100, inventory = []) => normalizeEquipment({
  name: 'Brega', classId: 'fighter', stats: { fue: 15, des: 12, con: 14, int: 10, sab: 10, car: 10 },
  hp: 10, maxHp: 20, gold, inventory, hands: { main: null, off: null }, wornArmor: null
});

describe('settlements', () => {
  it('preset nodes say what they are; older saves without the field get it from the preset', () => {
    expect(settlementOf(tavern, oakhaven)).toBe('tavern');
    expect(settlementOf(dock, oakhaven)).toBe('port');
    const { settlement: _s, ...oldDock } = dock;
    expect(settlementOf(oldDock, oakhaven)).toBe('port');
    const { settlement: _r, ...oldRuins } = oakhaven.mapNodes.find(n => n.id === 'ruins');
    expect(settlementOf(oldRuins, oakhaven)).toBeNull();
  });

  it('custom worlds are read from the place name; wild places have no shops', () => {
    expect(settlementOf(city, customWorld)).toBe('city');
    expect(settlementOf({ id: 'x', name: 'Posada del Cuervo' }, customWorld)).toBe('tavern');
    expect(settlementOf({ id: 'x', name: 'Puerto Ceniza' }, customWorld)).toBe('port');
    expect(settlementOf({ id: 'x', name: 'Alrededores Prohibidos' }, customWorld)).toBeNull();
    expect(shopsAt(city, customWorld)).toEqual(['smith', 'alchemist', 'general']);
    expect(shopsAt({ id: 'x', name: 'Bosque' }, customWorld)).toEqual([]);
    expect(describeShopsForPrompt(tavern, oakhaven)).toMatch(/Tienda general \("general"\), Boticario \("alquimista"\)/);
  });
});

describe('stock', () => {
  it('depends on the type of shop and the size of the place', () => {
    const smallSmith = generateStock('smith', 1, seededRng('a'));
    const citySmith = generateStock('smith', 3, seededRng('a'));
    const kinds = stock => new Set(stock.map(s => catalogByKey(s.key).kind));
    expect([...kinds(smallSmith)].sort()).toEqual(['armor', 'weapon']);
    expect(smallSmith.some(s => s.key === 'armor:chainMail')).toBe(false);
    expect(smallSmith.every(s => s.key.startsWith('armor:') || catalogByKey(s.key).data.category === 'simple')).toBe(true);
    expect(citySmith.some(s => s.key === 'weapon:longsword')).toBe(true);
    expect(citySmith.some(s => s.key === 'armor:splint')).toBe(true);

    const villageAlchemist = generateStock('alchemist', 1, seededRng('b'));
    expect(villageAlchemist.find(s => s.key === 'potion:healing').qty).toBeGreaterThanOrEqual(2);
    expect(villageAlchemist.some(s => s.key === 'potion:greaterHealing')).toBe(false);
    for (let i = 0; i < 30; i++) {
      expect(generateStock('alchemist', 3, seededRng(`c${i}`)).some(s => s.key === 'potion:supremeHealing')).toBe(false);
    }
    expect(generateStock('general', 1, seededRng('d')).every(s => s.key.startsWith('gear:'))).toBe(true);
  });

  it('is generated once and kept: entering again shows the same counter', () => {
    const first = openShop({}, { node: tavern, world: oakhaven, type: 'general' });
    const again = openShop(first.shops, { node: tavern, world: oakhaven, type: 'general', rng: () => 0.99 });
    expect(again.shop).toBe(first.shop);
    expect(first.shop).toMatchObject({ key: 'tavern:general', place: 'Taberna del Jabalí', size: 1 });
    // The first stock is seeded: the same world and shop give the same counter
    expect(openShop({}, { node: tavern, world: oakhaven, type: 'general' }).shop.stock).toEqual(first.shop.stock);
    expect(openShop({}, { node: tavern, world: oakhaven, type: 'nope' })).toBeNull();
  });

  it('a shop Duncan opens away from any settlement is a small stall', () => {
    const { shop } = openShop({}, { node: { id: 'ruins', name: 'Ruinas' }, world: customWorld, type: 'smith' });
    expect(shop.size).toBe(1);
  });
});

describe('buying and selling', () => {
  const smith = () => ({ key: 'tavern:smith', type: 'smith', place: 'Aquí', size: 2, stock: [{ key: 'weapon:longsword', qty: 1 }, { key: 'armor:plate', qty: 1 }] });
  const alchemist = () => ({ key: 'tavern:alchemist', type: 'alchemist', place: 'Aquí', size: 1, stock: [{ key: 'potion:healing', qty: 3 }] });

  it('buys at the SRD price, takes it out of the stock and puts it in the backpack', () => {
    const result = buyItem(hero(20), smith(), 'weapon:longsword');
    expect(result.ok).toBe(true);
    expect(result.price).toBe(15);
    expect(result.character.gold).toBe(5);
    expect(result.character.inventory.at(-1)).toMatchObject({ name: 'Espada Larga', type: 'weapon', weaponId: 'longsword' });
    expect(shopRows(result.shop).map(r => r.key)).toEqual(['armor:plate']);
    expect(buyItem(result.character, result.shop, 'weapon:longsword').ok).toBe(false);
  });

  it('refuses when the hero can not pay', () => {
    const result = buyItem(hero(100), smith(), 'armor:plate');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/cuesta 1500 po/);
  });

  it('potions stack in one item', () => {
    let shop = alchemist();
    let character = hero(200);
    for (let i = 0; i < 2; i++) ({ character, shop } = buyItem(character, shop, 'potion:healing'));
    const potions = character.inventory.filter(i => i.potionId === 'healing');
    expect(potions).toHaveLength(1);
    expect(potions[0].uses).toBe(2);
    expect(character.gold).toBe(100);
  });

  it('sells at half price: whole items, one potion at a time; only what the shop deals in', () => {
    const daggers = { id: 'd', name: 'Dagas (2)', type: 'weapon' };
    const potion = { ...makeItem('potion:healing', { id: 'p' }), uses: 3 };
    const relic = { id: 'r', name: 'Collar de Dientes de Oso', type: 'relic' };
    const character = hero(0, [daggers, potion, relic]);
    expect(sellPrice(smith(), daggers)).toBe(2); // 2 × 2 po / 2
    expect(sellPrice(alchemist(), potion)).toBe(25);
    expect(shopBuys(smith(), potion)).toBe(false);
    expect(sellPrice(smith(), relic)).toBeNull();

    const sold = sellItem(character, alchemist(), 'p');
    expect(sold.character.gold).toBe(25);
    expect(sold.character.inventory.find(i => i.id === 'p').uses).toBe(2);
    expect(sold.shop.stock[0].qty).toBe(4);
    expect(sellItem(character, smith(), 'r').ok).toBe(false);
  });

  it('cheap things are paid in silver and copper', () => {
    const club = makeItem('weapon:club', { id: 'c' });
    const result = sellItem(hero(0, [club]), smith(), 'c');
    expect(result.character.gold).toBe(0.05);
    expect(formatCoins(result.character.gold)).toBe('5 pc');
    expect(formatCoins(14.53)).toBe('14 po 5 pp 3 pc');
    expect(formatCoins(20000)).toBe('20.000 po');
  });

  it('what is in a hand or worn can not be sold', () => {
    let character = hero(0, [makeItem('weapon:longsword', { id: 's' }), makeItem('armor:chainMail', { id: 'a' })]);
    character = equipItem(character, 's', 'main').character;
    character = setWornArmor(character, 'a').character;
    expect(sellItem(character, smith(), 's').error).toMatch(/mochila/);
    expect(sellItem(character, smith(), 'a').ok).toBe(false);
  });
});

describe('potions', () => {
  it('has the four Potions of Healing of the SRD with their healing and price', () => {
    expect(POTIONS.map(p => [p.id, p.heal, p.price])).toEqual([
      ['healing', '2d4+2', 50], ['greaterHealing', '4d4+4', 200], ['superiorHealing', '8d4+8', 2000], ['supremeHealing', '10d4+20', 20000]
    ]);
  });

  it('heal by their own dice and spend one use', () => {
    const potion = { ...makeItem('potion:superiorHealing', { id: 'p' }), uses: 2 };
    const result = drinkPotion({ ...hero(0, [potion]), hp: 1, maxHp: 60 }, 'p', () => 4);
    expect(result.roll.total).toBe(8 * 4 + 8);
    expect(result.character.hp).toBe(41);
    expect(result.character.inventory[0].uses).toBe(1);
    const last = drinkPotion(result.character, 'p', () => 1);
    expect(last.character.inventory).toHaveLength(0);
    expect(last.character.hp).toBe(57);
  });

  it('older consumables that heal still work; the others are not potions', () => {
    expect(healingDice({ name: 'Poción de Curación Menor', type: 'consumable', uses: 2 })).toBe('2d4+2');
    expect(healingDice({ name: 'Agua Bendita de San Rafael', type: 'consumable', effect: 'Cura 2d4+4 o daña no-muertos', uses: 1 })).toBe('2d4+4');
    expect(healingDice({ name: 'Útiles de sanador', type: 'consumable', effect: 'Venda heridas y estabiliza a los caídos', uses: 10 })).toBeNull();
    expect(healingDice({ name: 'Licor de Raíz Negra', type: 'consumable', effect: '+2 a tiradas de Fuerza por 1 hora', uses: 1 })).toBeNull();
  });
});

describe('weight', () => {
  it('adds the SRD weight of what the hero carries', () => {
    const character = hero(0, [makeItem('armor:chainMail'), { name: 'Hachas de mano (4)', type: 'weapon' }, { name: 'Recuerdo', type: 'relic' }]);
    expect(inventoryWeight(character)).toEqual({ kg: 31.5, unknown: 1 });
    expect(catalogEntry(addItem([], makeItem('potion:healing'))[0]).kind).toBe('potion');
  });
});

describe('saving', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('the shops are saved with the campaign and come back as they were', () => {
    const { shops } = openShop({}, { node: tavern, world: oakhaven, type: 'alchemist' });
    const saved = saveCampaign({ id: 'c1', world: oakhaven, character: PRESET_CHARACTERS[0], messages: [], shops });
    expect(saved).toBeTruthy();
    expect(getCampaignById('c1').shops).toEqual(shops);
  });

  it('older campaigns load with no shops, and broken entries are dropped', () => {
    expect(migrateCampaign({ world: oakhaven, character: PRESET_CHARACTERS[0] }).shops).toEqual({});
    expect(normalizeShops({ a: { type: 'nope', stock: [] }, b: { type: 'general', stock: [{ key: 'gear:rope', qty: 2 }, { key: 'gear:dragon', qty: 1 }] } }))
      .toEqual({ b: { type: 'general', stock: [{ key: 'gear:rope', qty: 2 }] } });
    expect(Object.keys(SETTLEMENTS)).toContain('tavern');
  });
});
