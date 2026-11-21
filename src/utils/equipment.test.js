import { describe, it, expect } from 'vitest';
import {
  normalizeEquipment, defaultHands, equipItem, unequipHand, setTwoHandedGrip, setHands, setLimbStatus, applyLimbChanges,
  heldItemIds, isHoldable, isShield, gripOf, canStrikeUnarmed, armorClass, fleeDC, speedInMetres, handSlots,
  itemsForHand, describeHands, describeEquipmentForPrompt, limbFact
} from './equipment';
import { attackOptions } from './combat';
import { buildCharacter, emptyDraft, sanitizeDraft, randomDraft, computeArmorClass, getClass } from './characterBuilder';
import { CLASSES } from '../data/srd';
import { PRESET_CHARACTERS } from '../data/gameData';

const CLASS_SKILLS = { paladin: ['insight', 'medicine'], fighter: ['acrobatics', 'survival'], barbarian: ['animalHandling', 'survival'] };
const hero = (classId, extra = {}) => buildCharacter(sanitizeDraft({
  ...emptyDraft(), classId, backgroundId: 'soldier', speciesId: 'orc', classSkills: CLASS_SKILLS[classId],
  baseScores: { ...CLASSES.find(c => c.id === classId).suggestedArray },
  bonus: { mode: 'twoOne', plus2: 'fue', plus1: 'des' }, name: 'Prueba', languages: ['Enano', 'Élfico'], ...extra
}));
const idOf = (character, name) => character.inventory.find(i => i.name.includes(name)).id;
const ok = result => {
  if (!result.ok) throw new Error(result.error);
  return result.character;
};

const paladin = () => hero('paladin', { spells: { class: { cantrips: [], spells: ['bless', 'cureWounds'] } } });

describe('what can go in a hand', () => {
  it('weapons, shields, foci and lights, but not potions or armour', () => {
    expect(isHoldable({ name: 'Espada larga', type: 'weapon' })).toBe(true);
    expect(isHoldable({ name: 'Escudo', type: 'armor' })).toBe(true);
    expect(isShield({ name: 'Escudo de Acero con Emblema Solar', type: 'armor' })).toBe(true);
    expect(isHoldable({ name: 'Antorcha', type: 'gear' })).toBe(true);
    expect(isHoldable({ name: 'Orbe arcano', type: 'tool', desc: 'Tu foco para lanzar conjuros' })).toBe(true);
    expect(isHoldable({ name: 'Instrumento musical', type: 'tool' })).toBe(true);
    expect(isHoldable({ name: 'Poción de Curación', type: 'consumable' })).toBe(false);
    expect(isHoldable({ name: 'Cota de mallas', type: 'armor' })).toBe(false);
    // An explorer's pack mentions torches but is not a torch
    expect(isHoldable({ name: 'Equipo de explorador', type: 'gear', desc: 'Mochila, cuerda, yesquero y antorchas' })).toBe(false);
  });

  it('knows how many hands a weapon needs', () => {
    expect(gripOf({ name: 'Espadón', type: 'weapon' })).toBe('two');
    expect(gripOf({ name: 'Arco largo y 20 flechas', type: 'weapon' })).toBe('two');
    expect(gripOf({ name: 'Espada larga', type: 'weapon' })).toBe('versatile');
    expect(gripOf({ name: 'Daga', type: 'weapon' })).toBe('one');
    expect(gripOf({ name: 'Escudo', type: 'armor' })).toBe('one');
  });
});

describe('starting hands', () => {
  it('new heroes hold their first weapon and their shield', () => {
    const p = paladin();
    expect(p.hands).toEqual({ main: idOf(p, 'Espada larga'), off: idOf(p, 'Escudo') });
    expect(p.limbs).toEqual({ rightArm: 'ok', leftArm: 'ok', rightLeg: 'ok', leftLeg: 'ok' });
    expect(p.ac).toBe(p.acBase + 2);
    const f = hero('fighter');
    expect(f.hands).toEqual({ main: idOf(f, 'Espadón'), off: idOf(f, 'Espadón') }); // two-handed
    const b = hero('barbarian');
    expect(b.hands.main).toBe(b.hands.off);
  });

  it('every class starts with a valid set and the Armor Class of its sheet', () => {
    let seed = 7;
    const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const seen = new Set();
    for (let i = 0; i < 120; i++) {
      const h = buildCharacter(randomDraft(rng));
      seen.add(h.classId);
      expect(normalizeEquipment(h)).toEqual(h); // already normalised
      expect({ cls: h.classId, ac: h.ac }).toEqual({ cls: h.classId, ac: computeArmorClass(getClass(h.classId), h.stats) });
      expect(armorClass(h)).toBe(h.ac);
    }
    expect(seen.size).toBe(CLASSES.length);
  });
});

describe('equipping', () => {
  it('a two-handed weapon takes both hands and sends the shield to the backpack', () => {
    let p = paladin();
    p = { ...p, inventory: [...p.inventory, { id: 'gs', name: 'Espadón', type: 'weapon' }] };
    const next = ok(equipItem(p, 'gs', 'main'));
    expect(next.hands).toEqual({ main: 'gs', off: 'gs' });
    expect(next.ac).toBe(p.acBase); // no shield, no +2
    expect(heldItemIds(next)).toEqual(['gs']);
  });

  it('a versatile weapon goes in one hand or in both', () => {
    const p = paladin();
    const sword = idOf(p, 'Espada larga');
    const twoHands = ok(equipItem(p, sword, 'main', { twoHands: true }));
    expect(twoHands.hands).toEqual({ main: sword, off: sword });
    const oneHand = ok(setTwoHandedGrip(twoHands, sword, false));
    expect(oneHand.hands).toEqual({ main: sword, off: null });
    expect(ok(setTwoHandedGrip(oneHand, sword, true)).hands).toEqual({ main: sword, off: sword });
  });

  it('moving an item to the other hand frees the first one', () => {
    const p = paladin();
    const sword = idOf(p, 'Espada larga');
    const moved = ok(equipItem(p, sword, 'off'));
    expect(moved.hands).toEqual({ main: null, off: sword }); // the shield went back to the backpack
    expect(moved.ac).toBe(p.ac - 2);
  });

  it('the shield only gives AC while it is in a hand', () => {
    const p = paladin();
    const packed = unequipHand(p, 'off');
    expect(packed.ac).toBe(p.ac - 2);
    expect(ok(equipItem(packed, idOf(p, 'Escudo'), 'off')).ac).toBe(p.ac);
  });

  it('rejects what cannot be held', () => {
    const p = paladin();
    expect(equipItem(p, idOf(p, 'Cota de mallas'), 'main')).toMatchObject({ ok: false });
    expect(equipItem(p, 'nope', 'main')).toMatchObject({ ok: false, error: 'No tienes ese objeto.' });
  });

  it('setHands only accepts valid sets', () => {
    const f = hero('fighter');
    const flail = idOf(f, 'Mangual');
    const greatsword = idOf(f, 'Espadón');
    expect(setHands(f, { main: flail, off: null })).toMatchObject({ ok: true, changed: true });
    expect(setHands(f, { main: greatsword, off: greatsword })).toMatchObject({ ok: true, changed: false });
    expect(setHands(f, { main: greatsword, off: flail }).ok).toBe(false); // two-handed + something else
    expect(setHands(f, { main: idOf(f, 'Cota'), off: null }).ok).toBe(false);
  });

  it('unarmed strikes need a free hand (monks excepted)', () => {
    const f = hero('fighter');
    expect(canStrikeUnarmed(f)).toBe(false);
    expect(canStrikeUnarmed(unequipHand(f, 'main'))).toBe(true);
    expect(canStrikeUnarmed({ ...f, classId: 'monk' })).toBe(true);
  });

  it('describes the hands', () => {
    const p = paladin();
    expect(describeHands(p)).toBe('Espada larga y Escudo');
    expect(describeHands(hero('fighter'))).toBe('Espadón (a dos manos)');
    expect(describeHands(unequipHand(unequipHand(p, 'main'), 'off'))).toBe('las manos vacías');
    expect(describeEquipmentForPrompt(p)).toBe('En las manos: Espada larga y Escudo.');
  });
});

describe('limbs', () => {
  it('a disabled arm blocks its hand and drops what it held', () => {
    const p = paladin();
    const { character, dropped, changed } = setLimbStatus(p, 'leftArm', 'disabled');
    expect(changed).toBe(true);
    expect(dropped).toEqual(['Escudo']);
    expect(character.hands.off).toBeNull();
    expect(character.ac).toBe(p.ac - 2);
    expect(character.inventory).toHaveLength(p.inventory.length); // still in the backpack
    expect(equipItem(character, idOf(p, 'Escudo'), 'off')).toMatchObject({ ok: false });
    expect(handSlots(character)[1]).toMatchObject({ blocked: true, limbStatus: 'disabled', item: null });
    expect(itemsForHand(character, 'off')).toEqual([]);
  });

  it('a two-handed weapon cannot be held with one arm', () => {
    const f = hero('fighter');
    const { character, dropped } = setLimbStatus(f, 'rightArm', 'lost');
    expect(dropped).toEqual(['Espadón']);
    expect(character.hands).toEqual({ main: null, off: null });
    expect(equipItem(character, idOf(f, 'Espadón'), 'off')).toMatchObject({ ok: false });
    expect(itemsForHand(character, 'off').some(i => i.name === 'Espadón')).toBe(false);
    expect(ok(equipItem(character, idOf(f, 'Mangual'), 'off')).hands).toEqual({ main: null, off: idOf(f, 'Mangual') });
  });

  it('a versatile weapon held with both hands stays in the healthy one', () => {
    const p = paladin();
    const sword = idOf(p, 'Espada larga');
    const both = ok(equipItem(p, sword, 'main', { twoHands: true }));
    const { character, dropped } = setLimbStatus(both, 'leftArm', 'lost');
    expect(dropped).toEqual([]);
    expect(character.hands).toEqual({ main: sword, off: null });
    expect(attackOptions(character).find(o => o.itemId === sword).damage).toBe('1d8');
  });

  it('ignores unknown limbs and repeated states; healing a limb frees the slot', () => {
    const p = paladin();
    expect(setLimbStatus(p, 'tail', 'lost').changed).toBe(false);
    expect(setLimbStatus(p, 'leftArm', 'ok').changed).toBe(false);
    const { character, applied } = applyLimbChanges(p, [
      { limb: 'leftArm', status: 'lost' }, { limb: 'leftArm', status: 'lost' }, { limb: 'rightLeg', status: 'disabled' }
    ]);
    expect(applied.map(a => a.limb)).toEqual(['leftArm', 'rightLeg']);
    const healed = setLimbStatus(character, 'leftArm', 'ok').character;
    expect(ok(equipItem(healed, idOf(p, 'Escudo'), 'off')).ac).toBe(p.ac);
  });

  it('injured legs slow the hero and make fleeing harder', () => {
    const p = paladin();
    expect(fleeDC(p)).toBe(12);
    expect(speedInMetres(p)).toBe(9);
    const one = setLimbStatus(p, 'rightLeg', 'disabled').character;
    expect(fleeDC(one)).toBe(17);
    expect(speedInMetres(one)).toBe(4.5);
    const both = setLimbStatus(one, 'leftLeg', 'lost').character;
    expect(fleeDC(both)).toBeNull();
    expect(speedInMetres(both)).toBe(1.5);
  });

  it('writes facts for the campaign memory', () => {
    expect(limbFact('Brega', { limb: 'leftArm', status: 'lost' }, 'en combate contra Orco')).toBe('Brega pierde el brazo izquierdo (en combate contra Orco)');
    expect(limbFact('Brega', { limb: 'rightLeg', status: 'disabled' })).toBe('Brega tiene la pierna derecha inutilizada');
    expect(limbFact('Brega', { limb: 'rightArm', status: 'disabled' })).toBe('Brega tiene el brazo derecho inutilizado');
    expect(limbFact('Brega', { limb: 'rightArm', status: 'ok' })).toBe('Brega recupera el uso del brazo derecho');
    expect(limbFact('Brega', { limb: 'leftLeg', status: 'ok' })).toBe('Brega recupera el uso de la pierna izquierda');
    expect(describeEquipmentForPrompt(setLimbStatus(paladin(), 'leftLeg', 'lost').character)).toContain('pierna izquierda perdida');
  });
});

describe('older saves', () => {
  it('get a valid set of hands, healthy limbs and keep their Armor Class', () => {
    const valeria = PRESET_CHARACTERS.find(c => c.id === 'valeria'); // AC 18 with sword and shield
    const migrated = normalizeEquipment(valeria);
    expect(migrated.hands).toEqual({ main: 'espada', off: 'escudo' });
    expect(migrated).toMatchObject({ acBase: 16, ac: 18 });
    expect(migrated.limbs).toEqual({ rightArm: 'ok', leftArm: 'ok', rightLeg: 'ok', leftLeg: 'ok' });
    expect(normalizeEquipment(migrated)).toEqual(migrated);

    const brog = normalizeEquipment(PRESET_CHARACTERS.find(c => c.id === 'brog'));
    expect(brog.hands).toEqual({ main: 'gran_hacha', off: 'gran_hacha' });
    expect(brog.ac).toBe(14);
  });

  it('respect weapons and shields that were unequipped', () => {
    const old = {
      name: 'Viejo', ac: 16,
      inventory: [
        { id: 'a', name: 'Espada larga', type: 'weapon', equipped: false },
        { id: 'b', name: 'Maza', type: 'weapon' },
        { id: 'c', name: 'Escudo', type: 'armor', equipped: false }
      ]
    };
    const migrated = normalizeEquipment(old);
    expect(migrated.hands).toEqual({ main: 'b', off: null });
    expect(migrated).toMatchObject({ acBase: 16, ac: 16 }); // the stored AC had no shield
    expect(migrated.inventory.some(i => 'equipped' in i)).toBe(false);
  });

  it('give ids to items without one and survive odd data', () => {
    const migrated = normalizeEquipment({ name: 'X', ac: 12, inventory: [{ name: 'Daga', type: 'weapon' }, null] });
    expect(migrated.inventory).toHaveLength(1);
    expect(migrated.hands.main).toBe(migrated.inventory[0].id);
    expect(normalizeEquipment({ name: 'Y' })).toMatchObject({ hands: { main: null, off: null }, ac: 10, acBase: 10 });
    expect(defaultHands({ inventory: [{ id: 'g', name: 'Espadón', type: 'weapon' }], limbs: { rightArm: 'lost' } })).toEqual({ main: null, off: null });
  });

  it('fix hands saved in an impossible state', () => {
    const broken = normalizeEquipment({
      name: 'Z', ac: 12, acBase: 12,
      inventory: [{ id: 'g', name: 'Espadón', type: 'weapon' }, { id: 'd', name: 'Daga', type: 'weapon' }],
      hands: { main: 'g', off: 'd' }, limbs: {}
    });
    expect(broken.hands).toEqual({ main: null, off: 'd' });
  });
});
