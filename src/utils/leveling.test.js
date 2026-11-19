import { describe, it, expect } from 'vitest';
import {
  levelOf, xpOf, canAdvance, nextLevelXp, xpProgress, canLevelUp, addXp, levelUpPlan, emptyLevelUpChoices,
  learnableSpells, hpGain, levelUpIssues, applyLevelUp, describeLevelUp
} from './leveling';
import { emptyDraft, sanitizeDraft, buildCharacter, randomDraft } from './characterBuilder';
import { castSpell, slotTable, slotsLeft, spellRows, longRest, shortRest, hitDiceLeft, slotsForLevel } from './spellcasting';
import { XP_FOR_LEVEL, MAX_LEVEL, SPELL_PROGRESSION } from '../data/progression';
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
  return () => values[i++];
};

const fighter = () => buildCharacter(sanitizeDraft({
  ...emptyDraft(),
  classId: 'fighter', backgroundId: 'soldier', speciesId: 'dwarf',
  baseScores: { fue: 15, des: 14, con: 13, int: 8, sab: 10, car: 12 },
  bonus: { mode: 'twoOne', plus2: 'fue', plus1: 'con' },
  classSkills: ['acrobatics', 'survival'],
  name: 'Durgan', languages: ['Enano', 'Élfico']
}));

const wizard = () => buildCharacter(sanitizeDraft({
  ...emptyDraft(),
  classId: 'wizard', backgroundId: 'criminal', speciesId: 'human', extraFeatId: 'skilled',
  baseScores: { fue: 8, des: 12, con: 13, int: 15, sab: 14, car: 10 },
  bonus: { mode: 'twoOne', plus2: 'int', plus1: 'con' },
  speciesSkills: ['perception'], classSkills: ['arcana', 'history'],
  spells: {
    class: {
      cantrips: ['fireBolt', 'mageHand', 'light'],
      spells: ['magicMissile', 'shield', 'mageArmor', 'sleep', 'burningHands', 'detectMagic'],
      prepared: ['magicMissile', 'shield', 'sleep', 'burningHands']
    }
  },
  name: 'Elowen', languages: ['Enano', 'Dracónico']
}));

/** Choose the first valid options of a plan (what a hurried player would do). */
function quickChoices(character) {
  const plan = levelUpPlan(character);
  const choices = emptyLevelUpChoices(character);
  if (plan.asi) {
    const best = Object.entries(character.stats).filter(([, v]) => v <= 18).sort((a, b) => b[1] - a[1])[0][0];
    choices.asi = { mode: 'two', abilities: [best] };
  }
  if (plan.spells) {
    choices.spells.cantrips = learnableSpells(character, plan, 0).slice(0, plan.spells.cantrips).map(s => s.id);
    const options = [];
    for (let level = plan.spells.maxSpellLevel; level >= 1; level--) options.push(...learnableSpells(character, plan, level));
    choices.spells.spells = options.slice(0, plan.spells.spells).map(s => s.id);
    if (plan.spells.prepared != null) {
      const book = [...choices.spells.spells, ...choices.spells.prepared];
      const extra = character.spellcasting.known.filter(k => k.sourceKey === 'class' && !book.includes(k.id) && SPELLS.find(s => s.id === k.id).level > 0).map(k => k.id);
      choices.spells.prepared = [...book, ...extra].slice(0, plan.spells.prepared);
    }
  }
  return { plan, choices };
}

const withXp = (character, level) => ({ ...character, xp: XP_FOR_LEVEL[level] });

describe('experience', () => {
  it('tracks progress to the next level', () => {
    const hero = fighter();
    expect(hero).toMatchObject({ level: 1, xp: 0, subclass: null });
    expect(nextLevelXp(hero)).toBe(300);
    expect(xpProgress({ ...hero, xp: 150 })).toEqual({ level: 1, xp: 150, next: 300, percent: 50 });
    expect(xpProgress({ ...hero, level: 3, xp: 1800 })).toMatchObject({ next: 2700, percent: 50 });
    expect(xpProgress({ ...hero, level: 5, xp: 9000 })).toEqual({ level: 5, xp: 9000, next: null, percent: 100 });
  });

  it('adds experience safely', () => {
    const hero = fighter();
    expect(addXp(hero, 40).xp).toBe(40);
    expect(addXp(hero, -10)).toBe(hero);
    expect(addXp(hero, 'mucho')).toBe(hero);
    expect(addXp(hero, 999999).xp).toBe(XP_FOR_LEVEL[MAX_LEVEL] * 2);
  });

  it('knows when a hero can level up', () => {
    const hero = fighter();
    expect(canLevelUp(hero)).toBe(false);
    expect(canLevelUp({ ...hero, xp: 299 })).toBe(false);
    expect(canLevelUp({ ...hero, xp: 300 })).toBe(true);
    expect(canLevelUp({ ...hero, level: 5, xp: 99999 })).toBe(false);
    // Heroes from old saves have no rules data
    const old = { name: 'Kaelen', class: 'Pícaro (Nivel 3)', xp: 5000, stats: {} };
    expect(canAdvance(old)).toBe(false);
    expect(canLevelUp(old)).toBe(false);
    expect(levelOf(old)).toBe(1);
    expect(xpOf({})).toBe(0);
  });
});

describe('level-up plan and choices', () => {
  it('a fighter gains hit points, features, a subclass and an ability increase', () => {
    let hero = withXp(fighter(), 2);
    const plan2 = levelUpPlan(hero);
    expect(plan2).toMatchObject({ level: 2, hitDie: 10, hpAverage: 6, conMod: 2, extraHpPerLevel: 1, asi: false, spells: null, subclass: null });
    expect(plan2.features).toEqual(['Oleada de Acción', 'Mente Táctica']);

    const before = hero.maxHp;
    const { character, summary } = applyLevelUp(hero, emptyLevelUpChoices(hero));
    expect(character).toMatchObject({ level: 2, class: 'Guerrero (Nivel 2)', proficiencyBonus: 2 });
    expect(character.maxHp).toBe(before + 9); // 6 average + 2 Con + 1 dwarf
    expect(character.hp).toBe(hero.hp + 9);
    expect(summary.hpGain).toBe(9);
    expect(character.classFeatures).toContain('Mente Táctica');

    hero = withXp(character, 3);
    const plan3 = levelUpPlan(hero);
    expect(plan3.subclass.name).toBe('Campeón');
    hero = applyLevelUp(hero, emptyLevelUpChoices(hero)).character;
    expect(hero.subclass).toBe('Campeón');

    hero = withXp(hero, 4);
    expect(levelUpPlan(hero).asi).toBe(true);
    const choices = emptyLevelUpChoices(hero);
    expect(levelUpIssues(hero, levelUpPlan(hero), choices)).toEqual(['Elige qué característica sube +2.']);
    choices.asi = { mode: 'split', abilities: ['fue', 'con'] };
    const lvl4 = applyLevelUp(hero, choices).character;
    expect(lvl4.stats.fue).toBe(18);
    expect(lvl4.stats.con).toBe(15); // 14 -> 15: modifier unchanged
    expect(lvl4.classFeatures).not.toContain('Mejora de Característica');

    const lvl5 = applyLevelUp(withXp(lvl4, 5), emptyLevelUpChoices(lvl4)).character;
    expect(lvl5).toMatchObject({ level: 5, proficiencyBonus: 3 });
    expect(lvl5.classFeatures).toContain('Ataque Adicional');
    expect(() => applyLevelUp(withXp(lvl5, 5), emptyLevelUpChoices(lvl5))).toThrow();
  });

  it('rolling the hit die uses the roll instead of the average', () => {
    const hero = withXp(fighter(), 2);
    const plan = levelUpPlan(hero);
    expect(hpGain(plan, { hp: { method: 'roll', roll: 10 } })).toBe(13);
    expect(hpGain(plan, { hp: { method: 'roll', roll: 1 } })).toBe(4);
    expect(levelUpIssues(hero, plan, { ...emptyLevelUpChoices(hero), hp: { method: 'roll', roll: null } })).toHaveLength(1);
  });

  it('raising Constitution raises max HP for every level', () => {
    let hero = fighter();
    for (let level = 2; level <= 3; level++) hero = applyLevelUp(withXp(hero, level), emptyLevelUpChoices(hero)).character;
    hero = { ...withXp(hero, 4), stats: { ...hero.stats, con: 15 } };
    const choices = { ...emptyLevelUpChoices(hero), asi: { mode: 'split', abilities: ['con', 'fue'] } };
    const { character, summary } = applyLevelUp(hero, choices);
    expect(character.stats.con).toBe(16);
    // average + old Con mod + dwarf, plus the retroactive +1 for each of the 4 levels (new one included)
    expect(summary.hpGain).toBe(6 + 2 + 1 + 4);
  });

  it('rejects ability increases above 20', () => {
    const hero = { ...withXp(fighter(), 4), level: 3, stats: { ...fighter().stats, fue: 19 } };
    const plan = levelUpPlan(hero);
    expect(levelUpIssues(hero, plan, { ...emptyLevelUpChoices(hero), asi: { mode: 'two', abilities: ['fue'] } })).toHaveLength(1);
    expect(levelUpIssues(hero, plan, { ...emptyLevelUpChoices(hero), asi: { mode: 'split', abilities: ['fue', 'con'] } })).toEqual([]);
    expect(levelUpIssues(hero, plan, { ...emptyLevelUpChoices(hero), asi: { mode: 'split', abilities: ['con', 'con'] } })).toHaveLength(1);
  });
});

describe('spellcasters', () => {
  it('a wizard grows the spellbook, prepares more and unlocks level 2 and 3 spells', () => {
    let hero = wizard();
    expect(slotTable(hero.spellcasting)).toEqual([{ level: 1, max: 2, used: 0, left: 2 }]);

    hero = withXp(hero, 2);
    const plan2 = levelUpPlan(hero);
    expect(plan2.spells).toMatchObject({ cantrips: 0, spells: 2, prepared: 5, maxSpellLevel: 1 });
    expect(learnableSpells(hero, plan2, 2)).toEqual([]);
    const choices = emptyLevelUpChoices(hero);
    expect(choices.spells.prepared).toEqual(['magicMissile', 'shield', 'sleep', 'burningHands']);
    choices.spells.spells = ['featherFall', 'grease'];
    expect(levelUpIssues(hero, plan2, choices)).toEqual(['Prepara 5 conjuros de tu libro.']);
    choices.spells.prepared = [...choices.spells.prepared, 'grease'];
    hero = applyLevelUp(hero, choices).character;
    expect(slotTable(hero.spellcasting).map(r => r.max)).toEqual([3]);
    expect(hero.spellcasting.known.find(k => k.id === 'grease')).toMatchObject({ prepared: true, sourceKey: 'class' });
    expect(hero.spellcasting.known.find(k => k.id === 'featherFall').prepared).toBe(false);

    hero = withXp(hero, 3);
    const plan3 = levelUpPlan(hero);
    expect(plan3.spells.maxSpellLevel).toBe(2);
    expect(learnableSpells(hero, plan3, 2).map(s => s.id)).toContain('mistyStep');
    hero = applyLevelUp(hero, quickChoices(hero).choices).character;
    expect(slotTable(hero.spellcasting).map(r => [r.level, r.max])).toEqual([[1, 4], [2, 2]]);

    hero = applyLevelUp(withXp(hero, 4), quickChoices(withXp(hero, 4)).choices).character;
    const plan5 = levelUpPlan(withXp(hero, 5));
    expect(plan5.spells.maxSpellLevel).toBe(3);
    expect(learnableSpells(hero, plan5, 3).map(s => s.id)).toContain('fireball');
    hero = applyLevelUp(withXp(hero, 5), quickChoices(withXp(hero, 5)).choices).character;
    expect(slotTable(hero.spellcasting).map(r => [r.level, r.max])).toEqual([[1, 4], [2, 3], [3, 2]]);
    const classSpells = hero.spellcasting.known.filter(k => k.sourceKey === 'class');
    expect(classSpells.filter(k => SPELLS.find(s => s.id === k.id).level === 0)).toHaveLength(4);
    expect(classSpells.filter(k => SPELLS.find(s => s.id === k.id).level > 0)).toHaveLength(14);
    expect(classSpells.filter(k => k.prepared && SPELLS.find(s => s.id === k.id).level > 0)).toHaveLength(9);
  });

  it('keeps spent slots when levelling up', () => {
    let hero = wizard();
    hero = castSpell(hero, 'magicMissile', fixedDice([1, 1, 1])).character;
    hero = applyLevelUp(withXp(hero, 2), { ...emptyLevelUpChoices(hero), spells: { cantrips: [], spells: ['grease', 'jump'], prepared: ['magicMissile', 'shield', 'sleep', 'burningHands', 'grease'] } }).character;
    expect(slotTable(hero.spellcasting)).toEqual([{ level: 1, max: 3, used: 1, left: 2 }]);
  });

  it('every caster class can reach level 5 with valid choices', () => {
    const rng = seeded(5);
    const classes = new Set();
    for (let i = 0; i < 120 && classes.size < Object.keys(SPELL_PROGRESSION).length; i++) {
      let hero = buildCharacter(randomDraft(rng));
      if (!SPELL_PROGRESSION[hero.classId]) continue;
      classes.add(hero.classId);
      for (let level = 2; level <= 5; level++) {
        hero = withXp(hero, level);
        const { choices } = quickChoices(hero);
        expect(levelUpIssues(hero, levelUpPlan(hero), choices)).toEqual([]);
        hero = applyLevelUp(hero, choices).character;
      }
      const expected = SPELL_PROGRESSION[hero.classId].slots[5];
      expect(Object.fromEntries(slotTable(hero.spellcasting).map(r => [r.level, r.max]))).toEqual(expected);
      expect(hero.proficiencyBonus).toBe(3);
      const ids = hero.spellcasting.known.map(k => k.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(classes.size).toBe(Object.keys(SPELL_PROGRESSION).length);
  });

  it('describes the level up for the chronicle', () => {
    const hero = withXp(wizard(), 2);
    const { character, summary } = applyLevelUp(hero, { ...emptyLevelUpChoices(hero), spells: { cantrips: [], spells: ['grease', 'jump'], prepared: ['magicMissile', 'shield', 'sleep', 'burningHands', 'grease'] } });
    const line = describeLevelUp(character, summary);
    expect(line).toContain('sube a nivel 2');
    expect(line).toContain('Erudito');
    expect(line).toContain('Aprende: Grasa, Salto.');
  });
});

describe('casting at higher levels', () => {
  const caster = level => {
    let hero = wizard();
    for (let l = 2; l <= level; l++) hero = applyLevelUp(withXp(hero, l), quickChoices(withXp(hero, l)).choices).character;
    return hero;
  };

  it('uses the lowest free slot and upcasts when lower ones are spent', () => {
    let hero = caster(3); // slots: 4 x 1st, 2 x 2nd
    for (let i = 0; i < 4; i++) hero = castSpell(hero, 'magicMissile', fixedDice([1, 1, 1])).character;
    expect(slotsLeft(hero, 1)).toBe(2);
    const upcast = castSpell(hero, 'magicMissile', fixedDice([1, 1, 1, 1]));
    expect(upcast.cast).toMatchObject({ slotLevel: 2, damage: { dice: [1, 1, 1, 1], total: 7 } }); // one extra die
    expect(slotTable(upcast.character.spellcasting).find(r => r.level === 2).used).toBe(1);
  });

  it('level 2 spells need a level 2 slot', () => {
    let hero = caster(3);
    const plan = levelUpPlan(withXp(hero, 4));
    expect(plan.spells.maxSpellLevel).toBe(2);
    hero = { ...hero, spellcasting: { ...hero.spellcasting, known: [...hero.spellcasting.known, { id: 'scorchingRay', source: 'Mago', sourceKey: 'class', ability: 'int', prepared: true, freeCast: false }] } };
    hero = castSpell(hero, 'scorchingRay', fixedDice([15, 1, 1, 1, 1, 1, 1])).character;
    hero = castSpell(hero, 'scorchingRay', fixedDice([15, 1, 1, 1, 1, 1, 1])).character;
    expect(spellRows(hero).find(r => r.id === 'scorchingRay').blocked).toBe('Sin espacios de conjuro');
    expect(spellRows(hero).find(r => r.id === 'magicMissile').blocked).toBeNull(); // still has 1st-level slots
    expect(castSpell(hero, 'scorchingRay', fixedDice([])).ok).toBe(false);
  });

  it('cantrips deal two dice from level 5', () => {
    expect(castSpell(caster(4), 'fireBolt', fixedDice([15, 6])).cast.damage.dice).toHaveLength(1);
    expect(castSpell(caster(5), 'fireBolt', fixedDice([15, 6, 6])).cast.damage.dice).toHaveLength(2);
  });

  it('rests recover every slot level and one hit die per level', () => {
    let hero = caster(3);
    hero = castSpell(hero, 'magicMissile', fixedDice([1, 1, 1])).character;
    hero = longRest({ ...hero, hp: 1, hitDiceUsed: 3 });
    expect(slotTable(hero.spellcasting).every(r => r.used === 0)).toBe(true);
    expect(hitDiceLeft(hero)).toBe(3);
    const rested = shortRest({ ...hero, hp: 1 }, fixedDice([4])).character;
    expect(hitDiceLeft(rested)).toBe(2);
  });

  it('warlock pact slots level up and come back on a short rest', () => {
    expect(slotsForLevel('warlock', 3)).toEqual({ recovery: 'short', levels: { 2: { max: 2, used: 0 } } });
    expect(slotsForLevel('warlock', 5)).toEqual({ recovery: 'short', levels: { 3: { max: 2, used: 0 } } });
    expect(slotsForLevel('fighter', 5)).toBeNull();
  });
});
