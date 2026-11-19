import { describe, it, expect } from 'vitest';
import {
  levelUpPlan, emptyLevelUpChoices, learnableSpells, levelUpIssues, applyLevelUp, canLevelUp, featureInfo
} from './leveling';
import { buildCharacter, randomDraft } from './characterBuilder';
import { castSpell, slotTable, spellRows, longRest, cantripDiceMultiplier, getSpell } from './spellcasting';
import {
  XP_FOR_LEVEL, MAX_LEVEL, SPELL_PROGRESSION, ASI_LEVELS_BY_CLASS, EPIC_BOONS, SUBCLASSES, CLASS_FEATURES,
  PROFICIENCY_BY_LEVEL
} from '../data/progression';
import { CLASSES } from '../data/srd';
import { SPELLS } from '../data/spells';

function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const fixedDice = values => {
  let i = 0;
  return () => values[i++ % values.length];
};

/** Valid choices for the next level, picked the way a hurried player would. */
function quickChoices(character) {
  const plan = levelUpPlan(character);
  const choices = emptyLevelUpChoices(character);
  const best = cap => Object.entries(character.stats).filter(([, v]) => v + 2 <= cap).sort((a, b) => b[1] - a[1])[0];
  if (plan.asi) {
    const pick = best(20);
    choices.asi = pick
      ? { mode: 'two', abilities: [pick[0]] }
      : { mode: 'split', abilities: Object.entries(character.stats).filter(([, v]) => v < 20).slice(0, 2).map(([id]) => id) };
  }
  if (plan.epicBoon) {
    choices.boon = { id: EPIC_BOONS[0].id, ability: Object.entries(character.stats).sort((a, b) => b[1] - a[1])[0][0] };
  }
  if (plan.spells) {
    choices.spells.cantrips = learnableSpells(character, plan, 0).slice(0, plan.spells.cantrips).map(s => s.id);
    const options = [];
    for (let level = plan.spells.maxSpellLevel; level >= 1; level--) options.push(...learnableSpells(character, plan, level));
    choices.spells.spells = options.slice(0, plan.spells.spells).map(s => s.id);
    if (plan.spells.arcanumLevel) choices.spells.arcanum = learnableSpells(character, plan, plan.spells.arcanumLevel)[0]?.id || null;
    if (plan.spells.prepared != null) {
      const book = [
        ...choices.spells.spells,
        ...character.spellcasting.known.filter(k => k.sourceKey === 'class' && getSpell(k.id)?.level > 0).map(k => k.id)
      ];
      choices.spells.prepared = [...new Set(book)].slice(0, plan.spells.prepared);
    }
  }
  return choices;
}

function levelTo(character, target) {
  let hero = character;
  for (let level = hero.level + 1; level <= target; level++) {
    hero = { ...hero, xp: XP_FOR_LEVEL[level] };
    expect(canLevelUp(hero)).toBe(true);
    const choices = quickChoices(hero);
    expect({ level, issues: levelUpIssues(hero, levelUpPlan(hero), choices) }).toEqual({ level, issues: [] });
    hero = applyLevelUp(hero, choices).character;
  }
  return hero;
}

/** One random hero of each class. */
function oneHeroPerClass() {
  const rng = seeded(2024);
  const heroes = new Map();
  for (let i = 0; i < 500 && heroes.size < CLASSES.length; i++) {
    const hero = buildCharacter(randomDraft(rng));
    if (!heroes.has(hero.classId)) heroes.set(hero.classId, hero);
  }
  return [...heroes.values()];
}

describe('levels 1 to 20', () => {
  it('has the full progression data', () => {
    expect(MAX_LEVEL).toBe(20);
    expect(XP_FOR_LEVEL[20]).toBe(355000);
    expect(PROFICIENCY_BY_LEVEL[20]).toBe(6);
    CLASSES.forEach(cls => {
      expect(SUBCLASSES[cls.id]?.name).toBeTruthy();
      expect(CLASS_FEATURES[cls.id]).toBeTruthy();
      expect(ASI_LEVELS_BY_CLASS[cls.id]).toContain(4);
      expect(ASI_LEVELS_BY_CLASS[cls.id]).not.toContain(19);
    });
    // Every feature has a description
    CLASSES.forEach(cls => {
      Object.values(CLASS_FEATURES[cls.id]).flat().forEach(name => expect({ name, info: Boolean(featureInfo(name)) }).toEqual({ name, info: true }));
    });
  });

  it.each(oneHeroPerClass().map(hero => [hero.classId, hero]))('a %s reaches level 20 by the rules', (classId, start) => {
    const hero = levelTo(start, 20);
    expect(hero).toMatchObject({ level: 20, proficiencyBonus: 6, subclass: SUBCLASSES[classId].name });
    expect(hero.class).toContain('(Nivel 20)');
    expect(hero.maxHp).toBeGreaterThan(start.maxHp + 19); // at least 1 per level
    expect(hero.hp).toBe(hero.maxHp - (start.maxHp - start.hp));
    expect(hero.classFeatures).toContain(EPIC_BOONS[0].name);
    Object.values(CLASS_FEATURES[classId]).flat().forEach(feature => expect(hero.classFeatures).toContain(feature));
    Object.values(SUBCLASSES[classId].features || {}).flat().forEach(feature => expect(hero.classFeatures).toContain(feature));
    // Ability increases: two points each, plus one from the Epic Boon
    const before = Object.values(start.stats).reduce((a, b) => a + b, 0);
    const after = Object.values(hero.stats).reduce((a, b) => a + b, 0);
    expect(after - before).toBe(ASI_LEVELS_BY_CLASS[classId].length * 2 + 1);
    Object.values(hero.stats).forEach(score => expect(score).toBeLessThanOrEqual(30));

    const progression = SPELL_PROGRESSION[classId];
    if (!progression) {
      expect(hero.spellcasting?.slots ?? null).toBeNull();
      return;
    }
    expect(Object.fromEntries(slotTable(hero.spellcasting).map(r => [r.level, r.max]))).toEqual(progression.slots[20]);
    const classSpells = hero.spellcasting.known.filter(k => k.sourceKey === 'class');
    const ids = hero.spellcasting.known.map(k => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(classSpells.filter(k => getSpell(k.id).level === 0)).toHaveLength(progression.cantrips[19]);
    expect(classSpells.filter(k => getSpell(k.id).level > 0)).toHaveLength((progression.spellbook || progression.prepared)[19]);
    if (progression.spellbook) {
      expect(classSpells.filter(k => k.prepared && getSpell(k.id).level > 0)).toHaveLength(progression.prepared[19]);
    }
    if (progression.mysticArcanum) {
      const arcana = hero.spellcasting.known.filter(k => k.sourceKey === 'arcanum');
      expect(arcana.map(k => getSpell(k.id).level).sort()).toEqual(Object.values(progression.mysticArcanum).sort());
      arcana.forEach(k => expect(k.freeCast).toBe(true));
    }
  });
});

describe('high-level play', () => {
  it('cantrips grow with character level', () => {
    expect([1, 4, 5, 10, 11, 16, 17, 20].map(level => cantripDiceMultiplier({ level }))).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('a level 17 wizard can cast 9th-level spells and its cantrips roll four dice', () => {
    const wizard = oneHeroPerClass().find(h => h.classId === 'wizard');
    const hero = levelTo(wizard, 17);
    expect(slotTable(hero.spellcasting).map(r => r.level)).toContain(9);
    const ninth = spellRows(hero).find(r => r.level === 9 && !r.blocked);
    expect(ninth).toBeTruthy();
    const cast = castSpell(hero, ninth.id, fixedDice([10]));
    expect(cast.ok).toBe(true);
    expect(cast.cast.slotLevel).toBe(9);
    const cantrip = spellRows(hero).find(r => r.level === 0 && r.damage);
    if (cantrip) {
      const parsed = /^(\d+)d/.exec(cantrip.damage);
      const res = castSpell(hero, cantrip.id, fixedDice([15, 3]));
      if (!res.cast.attack || !res.cast.attack.isNat20) expect(res.cast.damage.dice).toHaveLength(Number(parsed[1]) * 4);
    }
  });

  it('a warlock casts each Mystic Arcanum once per long rest', () => {
    const warlock = oneHeroPerClass().find(h => h.classId === 'warlock');
    let hero = levelTo(warlock, 11);
    const arcanum = hero.spellcasting.known.find(k => k.sourceKey === 'arcanum');
    expect(getSpell(arcanum.id).level).toBe(6);
    const first = castSpell(hero, arcanum.id, fixedDice([10]));
    expect(first.ok).toBe(true);
    expect(first.cast.usedFreeCast).toBe(true);
    hero = first.character;
    expect(castSpell(hero, arcanum.id, fixedDice([10])).ok).toBe(false); // pact slots are only 5th level
    hero = longRest(hero);
    expect(castSpell(hero, arcanum.id, fixedDice([10])).ok).toBe(true);
  });

  it('every SRD spell level from 1 to 9 has spells for the full casters', () => {
    ['bard', 'cleric', 'druid', 'sorcerer', 'wizard'].forEach(classId => {
      for (let level = 1; level <= 9; level++) {
        expect({ classId, level, count: SPELLS.filter(s => s.level === level && s.classes.includes(classId)).length > 0 })
          .toEqual({ classId, level, count: true });
      }
    });
  });
});
