import { describe, it, expect } from 'vitest';
import {
  weaponForItem, attackOptions, damageLabel, resolveAttack, describeAttack, attacksPerAction, sneakAttackDice, rageBonus,
  setEquipped, isProficient, getWeapon, DEFAULT_TARGET_AC
} from './combat';
import { buildCharacter, emptyDraft, sanitizeDraft } from './characterBuilder';
import { WEAPONS } from '../data/weapons';
import { CLASSES, BACKGROUNDS } from '../data/srd';
import { parseDice } from './spellcasting';

const fixedDice = values => {
  let i = 0;
  return () => values[i++ % values.length];
};

const hero = (classId, extra = {}) => buildCharacter(sanitizeDraft({
  ...emptyDraft(),
  classId,
  backgroundId: 'soldier',
  speciesId: 'orc',
  baseScores: { ...CLASSES.find(c => c.id === classId).suggestedArray },
  bonus: { mode: 'twoOne', plus2: 'fue', plus1: 'des' },
  classSkills: [],
  name: 'Prueba',
  languages: ['Enano', 'Élfico'],
  ...extra
}));

/** Build a valid hero (class skills and spells chosen automatically). */
function validHero(classId) {
  const base = sanitizeDraft({
    ...emptyDraft(), classId, backgroundId: 'soldier', speciesId: 'orc',
    baseScores: { ...CLASSES.find(c => c.id === classId).suggestedArray },
    bonus: { mode: 'twoOne', plus2: 'fue', plus1: 'des' }, name: 'Prueba', languages: ['Enano', 'Élfico']
  });
  return base;
}

describe('weapon data', () => {
  it('every weapon has valid damage and properties', () => {
    expect(new Set(WEAPONS.map(w => w.id)).size).toBe(WEAPONS.length);
    WEAPONS.forEach(w => {
      expect(parseDice(w.damage)).not.toBeNull();
      if (w.versatile) expect(parseDice(w.versatile)).not.toBeNull();
      if (w.properties.includes('thrown') || w.kind === 'ranged') expect(w.range).toHaveLength(2);
    });
  });

  it('recognises every weapon of the starting equipment', () => {
    [...CLASSES, ...BACKGROUNDS].forEach(source => {
      source.equipment.filter(item => item.type === 'weapon').forEach(item => {
        expect({ item: item.name, weapon: Boolean(weaponForItem(item)) }).toEqual({ item: item.name, weapon: true });
      });
    });
    expect(weaponForItem({ name: 'Daga de Acero Toledano', type: 'weapon' }).id).toBe('dagger');
    expect(weaponForItem({ name: 'Hachas de mano (4)', type: 'weapon' }).id).toBe('handaxe');
    expect(weaponForItem({ name: 'Arco largo y 20 flechas', type: 'weapon' }).id).toBe('longbow');
    expect(weaponForItem({ name: 'Poción', type: 'consumable' })).toBeNull();
    expect(weaponForItem({ name: 'Cosa', weaponId: 'rapier' }).id).toBe('rapier');
  });
});

describe('attack options', () => {
  it('a fighter attacks with Strength weapons and proficiency', () => {
    const fighter = hero('fighter', { classSkills: ['acrobatics', 'survival'] });
    const options = attackOptions(fighter);
    const greatsword = options.find(o => o.weapon?.id === 'greatsword');
    // Str 17 (+3), proficiency +2
    expect(greatsword).toMatchObject({ ability: 'fue', attackBonus: 5, damage: '2d6', damageBonus: 3, proficient: true });
    expect(options.at(-1)).toMatchObject({ id: 'unarmed', damage: '0d4+1', attackBonus: 5 });
  });

  it('finesse and ranged weapons use Dexterity when it is better', () => {
    const rogue = buildCharacter(sanitizeDraft({
      ...validHero('rogue'), backgroundId: 'criminal',
      bonus: { mode: 'twoOne', plus2: 'des', plus1: 'con' },
      classSkills: ['acrobatics', 'athletics', 'deception', 'insight']
    }));
    const options = attackOptions(rogue);
    expect(options.find(o => o.weapon?.id === 'shortsword')).toMatchObject({ ability: 'des', attackBonus: 5 }); // Dex 17 (+3) + 2
    expect(options.find(o => o.weapon?.id === 'shortbow')).toMatchObject({ ability: 'des' });
  });

  it('versatile weapons use the bigger die without a shield', () => {
    const paladin = hero('paladin', { classSkills: ['insight', 'medicine'], spells: { class: { cantrips: [], spells: ['bless', 'cureWounds'] } } });
    expect(attackOptions(paladin).find(o => o.weapon?.id === 'longsword').damage).toBe('1d8'); // carries a shield
    const noShield = setEquipped(paladin, paladin.inventory.find(i => /Escudo/.test(i.name)).id, false);
    expect(attackOptions(noShield).find(o => o.weapon?.id === 'longsword').damage).toBe('1d10');
  });

  it('only equipped weapons can be used', () => {
    const fighter = hero('fighter', { classSkills: ['acrobatics', 'survival'] });
    const item = fighter.inventory.find(i => weaponForItem(i)?.id === 'greatsword');
    const unequipped = setEquipped(fighter, item.id, false);
    expect(attackOptions(unequipped).some(o => o.weapon?.id === 'greatsword')).toBe(false);
    expect(resolveAttack(unequipped, item.id, fixedDice([15])).ok).toBe(false);
  });

  it('knows weapon proficiencies by class', () => {
    expect(isProficient({ classId: 'wizard' }, getWeapon('longsword'))).toBe(false);
    expect(isProficient({ classId: 'wizard' }, getWeapon('dagger'))).toBe(true);
    expect(isProficient({ classId: 'rogue' }, getWeapon('rapier'))).toBe(true);
    expect(isProficient({ classId: 'rogue' }, getWeapon('longsword'))).toBe(false);
    expect(isProficient({ classId: 'monk' }, getWeapon('shortsword'))).toBe(true);
    expect(isProficient({}, getWeapon('longsword'))).toBe(true); // old saves
  });

  it('monks use Martial Arts', () => {
    const monk = { classId: 'monk', level: 5, proficiencyBonus: 3, stats: { fue: 10, des: 16 }, inventory: [{ id: 'a', name: 'Lanza', type: 'weapon' }] };
    const options = attackOptions(monk);
    expect(options.find(o => o.id === 'unarmed')).toMatchObject({ damage: '1d8', ability: 'des', attackBonus: 6 });
    expect(options.find(o => o.id === 'a')).toMatchObject({ damage: '1d8', ability: 'des' });
  });
});

describe('resolving attacks', () => {
  const fighter = hero('fighter', { classSkills: ['acrobatics', 'survival'] });
  const greatsword = attackOptions(fighter).find(o => o.weapon?.id === 'greatsword');

  it('hits, misses and criticals against the target AC', () => {
    const hit = resolveAttack(fighter, greatsword.id, fixedDice([10, 4, 5])).attack;
    expect(hit.rolls[0]).toMatchObject({ raw: 10, total: 15, hit: true, damage: { dice: [4, 5], total: 12 } });
    expect(hit.targetAC).toBe(DEFAULT_TARGET_AC);
    expect(resolveAttack(fighter, greatsword.id, fixedDice([5]), { targetAC: 16 }).attack.rolls[0].hit).toBe(false);
    const crit = resolveAttack(fighter, greatsword.id, fixedDice([20, 1, 2, 3, 4]), { targetAC: 30 }).attack;
    expect(crit.rolls[0]).toMatchObject({ hit: true, crit: true, damage: { dice: [1, 2, 3, 4], total: 13 } });
    const fumble = resolveAttack(fighter, greatsword.id, fixedDice([1]), { targetAC: 2 }).attack;
    expect(fumble.rolls[0]).toMatchObject({ hit: false, fumble: true });
    expect(describeAttack(hit, 'el bandido')).toContain('Ataco al bandido con mi espadón');
    expect(describeAttack(hit, 'la bruja')).toContain('Ataco a la bruja con mi espadón');
    expect(describeAttack(hit)).toContain('Impacta: 12 de daño cortante');
    expect(describeAttack(fumble)).toContain('¡Pifia!');
  });

  it('Extra Attack rolls several attacks', () => {
    expect([1, 5, 11, 20].map(l => attacksPerAction({ classId: 'fighter', level: l }))).toEqual([1, 2, 3, 4]);
    expect(attacksPerAction({ classId: 'paladin', level: 6 })).toBe(2);
    expect(attacksPerAction({ classId: 'wizard', level: 20 })).toBe(1);
    const lvl5 = { ...fighter, level: 5, proficiencyBonus: 3 };
    const attack = resolveAttack(lvl5, greatsword.id, fixedDice([15, 3, 3, 2, 6, 6])).attack;
    expect(attack.rolls).toHaveLength(2);
    expect(attack.hits).toBe(1);
    expect(attack.totalDamage).toBe(9); // 3 + 3 + Str 3
    expect(describeAttack(attack)).toContain('Ataque 2 D20');
  });

  it('rogues add Sneak Attack once, with finesse or ranged weapons', () => {
    expect([1, 2, 3, 5, 20].map(l => sneakAttackDice({ classId: 'rogue', level: l }))).toEqual([1, 1, 2, 3, 10]);
    const rogue = { classId: 'rogue', level: 3, proficiencyBonus: 2, stats: { fue: 10, des: 16 }, inventory: [{ id: 'r', name: 'Estoque', type: 'weapon' }, { id: 'c', name: 'Garrote', type: 'weapon' }] };
    const sneak = resolveAttack(rogue, 'r', fixedDice([15, 5, 6, 4])).attack;
    expect(sneak.sneak).toMatchObject({ dice: [6, 4], total: 10 });
    expect(sneak.totalDamage).toBe(5 + 3 + 10);
    expect(describeAttack(sneak)).toContain('Ataque Furtivo: +10');
    expect(resolveAttack(rogue, 'c', fixedDice([15, 3])).attack.sneak).toBeNull(); // a club is not finesse
  });

  it('raging barbarians add Rage damage to Strength attacks', () => {
    expect([1, 9, 16].map(l => rageBonus({ classId: 'barbarian', level: l }))).toEqual([2, 3, 4]);
    const barbarian = hero('barbarian', { classSkills: ['animalHandling', 'survival'] });
    const axe = attackOptions(barbarian).find(o => o.weapon?.id === 'greataxe');
    const calm = resolveAttack(barbarian, axe.id, fixedDice([15, 6])).attack;
    const raging = resolveAttack(barbarian, axe.id, fixedDice([15, 6]), { raging: true }).attack;
    expect(raging.totalDamage - calm.totalDamage).toBe(2);
    expect(describeAttack(raging)).toContain('en plena furia');
  });
});

describe('damage labels', () => {
  it('shows dice with the bonus, or the fixed amount', () => {
    expect(damageLabel({ damage: '1d8', damageBonus: 3 })).toBe('1d8 +3');
    expect(damageLabel({ damage: '2d6', damageBonus: -1 })).toBe('2d6 −1');
    expect(damageLabel({ damage: '1d4', damageBonus: 0 })).toBe('1d4');
    expect(damageLabel({ damage: '0d4+1', damageBonus: 3 })).toBe('4');
    expect(damageLabel({ damage: '0d4+1', damageBonus: -1 })).toBe('1');
  });
});
