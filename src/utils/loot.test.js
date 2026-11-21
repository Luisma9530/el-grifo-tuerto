import { describe, it, expect } from 'vitest';
import { generateLoot, describeLoot, coinsFor, weaponOfAction, MAX_WEAPONS } from './loot';
import { MONSTERS } from '../data/monsters';

/** An encounter already finished, with these creatures in this state. */
const fight = (entries, status = 'victory') => ({
  status,
  enemies: entries.map(([id, state = 'dead', extra = {}], n) => {
    const m = MONSTERS.find(x => x.id === id);
    return { uid: `${id}-${n}`, monsterId: id, name: m.name, type: m.type, cr: m.cr, actions: m.actions, status: state, ...extra };
  })
});

/** rng that returns these values in order, then the last one forever. */
const seq = (...values) => () => (values.length > 1 ? values.shift() : values[0]);

describe('loot of a fight', () => {
  it('nothing when the hero loses or flees, and nothing from the ones that ran away', () => {
    expect(generateLoot(fight([['bandit']], 'defeat'), () => 0)).toEqual({ coins: 0, items: [] });
    expect(generateLoot(fight([['bandit']], 'fled'), () => 0)).toEqual({ coins: 0, items: [] });
    expect(generateLoot(fight([['bandit', 'fled']]), () => 0)).toEqual({ coins: 0, items: [] });
  });

  it('beasts and oozes carry no coins nor gear', () => {
    expect(generateLoot(fight([['wolf'], ['wolf'], ['grayOoze']]), () => 0)).toEqual({ coins: 0, items: [] });
  });

  it('humanoids drop coins by CR, the weapons they fought with, their armor and maybe a potion', () => {
    // rng 0: every chance succeeds and every die rolls 1
    const loot = generateLoot(fight([['bandit'], ['bandit', 'surrendered']]), () => 0);
    expect(loot.coins).toBe(0.6); // CR 1/8: 3d6 pp each, all ones
    const names = loot.items.map(i => i.name);
    expect(names.filter(n => n === 'Cimitarra')).toHaveLength(2);
    expect(names).toContain('Armadura de cuero');
    expect(names).toContain('Poción de curación');
    expect(loot.items.every(i => i.id)).toBe(true);
  });

  it('caps what one fight can give', () => {
    const many = fight(Array.from({ length: 8 }, () => ['guard']));
    const loot = generateLoot(many, () => 0);
    expect(loot.items.filter(i => i.type === 'weapon').length).toBe(MAX_WEAPONS);
    expect(loot.items.filter(i => i.type === 'armor').length).toBe(1);
    expect(loot.items.filter(i => i.potionId).length).toBe(1);
  });

  it('with bad luck there is only the coins', () => {
    const loot = generateLoot(fight([['knight']]), () => 0.99);
    expect(loot.items).toEqual([]);
    expect(loot.coins).toBe(18); // CR 3: 3d6 po, all sixes
  });

  it('coins grow with the challenge rating; elites carry double', () => {
    const ones = () => 0;
    expect(coinsFor(0, ones)).toBe(0.3);
    expect(coinsFor(2, ones)).toBe(3);
    expect(coinsFor(8, ones)).toBe(20);
    expect(coinsFor(12, ones)).toBe(200);
    expect(coinsFor(20, ones)).toBe(2000);
    expect(generateLoot(fight([['knight', 'dead', { elite: true }]]), () => 0.99).coins).toBe(36);
  });

  it('only real SRD weapons are dropped; giants keep their huge ones', () => {
    expect(weaponOfAction({ kind: 'melee', name: 'Mandoble' })).toBe('greatsword');
    expect(weaponOfAction({ kind: 'melee', name: 'Mordisco' })).toBeNull();
    expect(weaponOfAction({ kind: 'save', name: 'Aliento de Fuego' })).toBeNull();
    const giant = generateLoot(fight([['ogre']]), seq(0));
    expect(giant.items.some(i => i.type === 'weapon')).toBe(false);
  });

  it('high CR fights may give stronger potions', () => {
    const loot = generateLoot(fight([['archmage']]), seq(0, 0, 0, 0, 0, 0, 0.1, 0.9));
    expect(loot.items.find(i => i.potionId)?.potionId).toMatch(/Healing$/);
  });

  it('is told in one line', () => {
    expect(describeLoot({ coins: 12.5, items: [{ name: 'Cimitarra' }, { name: 'Poción de curación' }] })).toBe('12 po 5 pp, Cimitarra y Poción de curación');
    expect(describeLoot({ coins: 0, items: [] })).toBe('nada de valor');
  });
});
