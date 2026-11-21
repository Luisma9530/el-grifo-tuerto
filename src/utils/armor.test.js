import { describe, it, expect } from 'vitest';
import {
  normalizeEquipment, armorClass, armorClassBreakdown, setWornArmor, wornArmorItem, wearsUntrainedArmor,
  armorDisadvantage, speedInMetres, equipItem, unequipHand, describeEquipmentForPrompt, isBodyArmor
} from './equipment';
import { buildCharacter, randomDraft, computeArmorClass } from './characterBuilder';
import { resolveAttack, attackOptions } from './combat';
import { castSpell } from './spellcasting';
import { makeItem, addItem } from './items';
import { CLASSES } from '../data/srd';
import { PRESET_CHARACTERS } from '../data/gameData';

/** One valid level 1 hero per class, made with the creation wizard's random hero (seeded). */
const HEROES = (() => {
  let seed = 7;
  const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const found = {};
  for (let i = 0; i < 2000 && Object.keys(found).length < CLASSES.length; i++) {
    const draft = randomDraft(rng);
    if (!found[draft.classId]) found[draft.classId] = buildCharacter(draft, { id: `hero_${draft.classId}` });
  }
  return found;
})();
const tryBuild = classId => HEROES[classId] || null;

/** Hand-made sheet: enough fields for the Armor Class. */
const sheet = (classId, stats, inventory, extra = {}) => normalizeEquipment({
  name: 'Prueba', classId, stats: { fue: 10, des: 10, con: 10, int: 10, sab: 10, car: 10, ...stats },
  hp: 10, maxHp: 10, gold: 0, inventory, hands: { main: null, off: null }, wornArmor: null, ...extra
});
const withItems = (character, ...keys) => normalizeEquipment({ ...character, inventory: keys.reduce((list, key) => addItem(list, makeItem(key)), character.inventory) });
const ok = result => { if (!result.ok) throw new Error(result.error); return result.character; };

describe('Armor Class from the worn armor', () => {
  it('has a hero of every class to test with', () => {
    expect(Object.keys(HEROES).sort()).toEqual(CLASSES.map(c => c.id).sort());
  });

  it('a new hero of every class wears the starting armor and keeps the AC of the creation wizard', () => {
    CLASSES.forEach(cls => {
      const character = tryBuild(cls.id);
      expect(character.ac, cls.id).toBe(computeArmorClass(cls, character.stats));
      const armorItem = character.inventory.find(isBodyArmor);
      expect(wornArmorItem(character)?.id ?? null, cls.id).toBe(armorItem?.id ?? null);
      expect(character.acLegacy, cls.id).toBeUndefined();
    });
  });

  it('light armor adds all the Dexterity, medium up to +2, heavy none', () => {
    const base = sheet('fighter', { des: 18 }, []);
    const wear = key => {
      const c = withItems(base, key);
      return armorClass(ok(setWornArmor(c, c.inventory.at(-1).id)));
    };
    expect(armorClass(base)).toBe(14); // 10 + 4
    expect(wear('armor:studdedLeather')).toBe(16); // 12 + 4
    expect(wear('armor:breastplate')).toBe(16); // 14 + 2
    expect(wear('armor:plate')).toBe(18); // 18
  });

  it('the shield only adds +2 in a hand, and nothing without training', () => {
    let fighter = withItems(sheet('fighter', {}, []), 'armor:chainMail', 'armor:shield');
    fighter = ok(setWornArmor(fighter, fighter.inventory[0].id));
    expect(fighter.ac).toBe(16);
    fighter = ok(equipItem(fighter, fighter.inventory[1].id, 'off'));
    expect(fighter.ac).toBe(18);
    expect(unequipHand(fighter, 'off').ac).toBe(16);

    let wizard = withItems(sheet('wizard', { des: 14 }, []), 'armor:shield');
    wizard = ok(equipItem(wizard, wizard.inventory[0].id, 'off'));
    expect(wizard.ac).toBe(12);
    expect(armorClassBreakdown(wizard).untrainedShield).toBe(true);
  });

  it('Unarmored Defense: barbarian with Constitution (shield allowed), monk with Wisdom (no shield)', () => {
    let barbarian = withItems(sheet('barbarian', { des: 14, con: 16 }, []), 'armor:shield');
    expect(barbarian.ac).toBe(15);
    barbarian = ok(equipItem(barbarian, barbarian.inventory[0].id, 'off'));
    expect(barbarian.ac).toBe(17);
    barbarian = withItems(barbarian, 'armor:hide');
    expect(ok(setWornArmor(barbarian, barbarian.inventory.at(-1).id)).ac).toBe(16); // 12 + 2 + 2 shield

    let monk = withItems(sheet('monk', { des: 16, sab: 14 }, []), 'armor:shield');
    expect(monk.ac).toBe(15);
    monk = ok(equipItem(monk, monk.inventory[0].id, 'off'));
    // A shield cancels Unarmored Defense and monks aren't trained with it
    expect(monk.ac).toBe(13);
  });

  it('armor without training: same AC, Disadvantage on Str/Dex tests and attacks, no spells', () => {
    const wizard = tryBuild('wizard');
    expect(wizard).not.toBeNull();
    let armored = withItems(wizard, 'armor:chainMail');
    armored = ok(setWornArmor(armored, armored.inventory.at(-1).id));
    expect(armored.ac).toBe(16);
    expect(wearsUntrainedArmor(armored)).toBe(true);
    expect(armorDisadvantage(armored, { ability: 'des' })).toMatch(/sin competencia/);
    expect(armorDisadvantage(armored, { ability: 'int' })).toBeNull();
    expect(describeEquipmentForPrompt(armored)).toMatch(/SIN COMPETENCIA.*no puede lanzar conjuros/);

    const option = attackOptions(armored)[0];
    const dice = [15, 3];
    const attack = resolveAttack(armored, option.id, () => dice.shift(), { targetAC: 10 });
    expect(attack.attack.disadvantage).toBeTruthy();
    expect(attack.attack.rolls[0].raw).toBe(3); // the lower of 15 and 3

    const known = armored.spellcasting?.known?.find(k => k.prepared);
    if (known) expect(castSpell(armored, known.id, () => 1).ok).toBe(false);
  });

  it('heavy armor without the Strength it needs costs 3 m of speed; stealth disadvantage shows', () => {
    let weak = withItems(sheet('fighter', { fue: 12 }, [], { speed: 30 }), 'armor:plate');
    weak = ok(setWornArmor(weak, weak.inventory[0].id));
    expect(speedInMetres(weak)).toBe(6);
    expect(armorDisadvantage(weak, { skillId: 'stealth', ability: 'des' })).toMatch(/Sigilo/);
    const strong = { ...weak, stats: { ...weak.stats, fue: 15 } };
    expect(speedInMetres(strong)).toBe(9);
  });

  it('only body armor goes in the armor slot', () => {
    const c = withItems(sheet('fighter', {}, []), 'armor:shield', 'weapon:longsword');
    expect(setWornArmor(c, c.inventory[0].id).ok).toBe(false);
    expect(setWornArmor(c, c.inventory[1].id).ok).toBe(false);
  });
});

describe('migrating older saves', () => {
  /** A save from before the armor slot: same sheet, without wornArmor. */
  const older = character => {
    const { wornArmor: _w, acLegacy: _l, ...rest } = character;
    return rest;
  };

  it('every class keeps exactly its Armor Class and wears its starting armor', () => {
    CLASSES.forEach(cls => {
      const character = tryBuild(cls.id);
      const migrated = normalizeEquipment(older(character));
      expect(migrated.ac, cls.id).toBe(character.ac);
      expect(migrated.acBase, cls.id).toBe(character.acBase);
      expect(wornArmorItem(migrated)?.name ?? null, cls.id).toBe(cls.equipment.find(i => i.type === 'armor' && !/escudo/i.test(i.name))?.name ?? null);
      expect(migrated.acLegacy, cls.id).toBeUndefined();
    });
  });

  it('saves from before the hands (only `ac`) keep it too', () => {
    const character = tryBuild('paladin') || tryBuild('fighter');
    const { hands: _h, acBase: _b, wornArmor: _w, ...veryOld } = character;
    expect(normalizeEquipment(veryOld).ac).toBe(character.ac);
  });

  it('preset heroes keep their AC through an adjustment tied to the armor they had', () => {
    PRESET_CHARACTERS.forEach(preset => {
      const migrated = normalizeEquipment(preset);
      expect(migrated.ac, preset.id).toBe(preset.ac);
      expect(normalizeEquipment(migrated).ac, preset.id).toBe(preset.ac); // idempotent
    });
    // Valeria: AC 18 with her shield, no armor item: +6 kept while she wears nothing
    const valeria = normalizeEquipment(PRESET_CHARACTERS.find(p => p.id === 'valeria'));
    expect(valeria.acLegacy).toEqual({ item: null, bonus: 6 });
    let plated = withItems(valeria, 'armor:plate');
    plated = ok(setWornArmor(plated, plated.inventory.at(-1).id));
    expect(plated.ac).toBe(20); // 18 + shield, the old adjustment no longer applies
    expect(ok(setWornArmor(plated, null)).ac).toBe(18);
  });

  it('the adjustment survives a save and load', () => {
    const valeria = normalizeEquipment(PRESET_CHARACTERS.find(p => p.id === 'valeria'));
    const loaded = normalizeEquipment(JSON.parse(JSON.stringify(valeria)));
    expect(loaded.ac).toBe(18);
  });
});
