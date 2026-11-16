import { describe, it, expect } from 'vitest';
import {
  emptyDraft, sanitizeDraft, stepIssues, isDraftComplete, buildCharacter, randomDraft,
  finalScores, backgroundBonuses, pointBuySpent, rollAbilityScore, unassignedPoolValues,
  classSkillOptions, speciesSkillOptions, computeArmorClass, getClass, abilityModifier,
  skillModifier, skillRows, isExtraFeatAllowed, formatModifier
} from './characterBuilder';
import {
  ABILITIES, SKILLS, CLASSES, BACKGROUNDS, SPECIES, FEATS, STANDARD_ARRAY, POINT_BUY_BUDGET, NAME_IDEAS
} from '../data/srd';

function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const abilityIds = ABILITIES.map(a => a.id);
const skillIds = SKILLS.map(s => s.id);

/** A complete human fighter soldier, by hand. */
function fighterDraft() {
  return {
    ...emptyDraft(),
    classId: 'fighter',
    backgroundId: 'soldier',
    speciesId: 'human',
    extraFeatId: 'alert',
    method: 'standard',
    baseScores: { fue: 15, des: 14, con: 13, int: 8, sab: 10, car: 12 },
    bonus: { mode: 'twoOne', plus2: 'fue', plus1: 'con' },
    speciesSkills: ['perception'],
    classSkills: ['acrobatics', 'survival'],
    name: 'Alaric',
    languages: ['Enano', 'Élfico']
  };
}

describe('rules data', () => {
  it('has the 12 classes with consistent data', () => {
    expect(CLASSES).toHaveLength(12);
    CLASSES.forEach(cls => {
      expect([6, 8, 10, 12]).toContain(cls.hitDie);
      expect(cls.savingThrows).toHaveLength(2);
      cls.savingThrows.forEach(id => expect(abilityIds).toContain(id));
      if (cls.skillChoices.from !== 'any') {
        cls.skillChoices.from.forEach(id => expect(skillIds).toContain(id));
        expect(cls.skillChoices.from.length).toBeGreaterThanOrEqual(cls.skillChoices.count);
      }
      // The suggested scores are a permutation of the standard array
      expect(Object.values(cls.suggestedArray).sort((a, b) => a - b)).toEqual([...STANDARD_ARRAY].sort((a, b) => a - b));
      expect(Math.max(...cls.primary.map(id => cls.suggestedArray[id]))).toBe(15);
      expect(cls.equipment.length).toBeGreaterThan(0);
      expect(cls.gold).toBeGreaterThan(0);
    });
  });

  it('has backgrounds with three abilities, a feat, two skills and a tool', () => {
    expect(BACKGROUNDS.filter(b => b.source === 'srd').map(b => b.id)).toEqual(['acolyte', 'criminal', 'sage', 'soldier']);
    BACKGROUNDS.forEach(bg => {
      expect(new Set(bg.abilities).size).toBe(3);
      bg.abilities.forEach(id => expect(abilityIds).toContain(id));
      expect(FEATS.some(f => f.id === bg.feat)).toBe(true);
      expect(new Set(bg.skills).size).toBe(2);
      bg.skills.forEach(id => expect(skillIds).toContain(id));
      expect(bg.tool).toBeTruthy();
      expect(['srd', 'original']).toContain(bg.source);
    });
  });

  it('has the 9 species, with names to suggest', () => {
    expect(SPECIES).toHaveLength(9);
    SPECIES.forEach(sp => {
      expect([30, 35]).toContain(sp.speed);
      expect(sp.traits.length).toBeGreaterThan(0);
      expect(NAME_IDEAS[sp.id].length).toBeGreaterThan(2);
      if (sp.options) expect(sp.options.choices.length).toBeGreaterThan(1);
    });
  });
});

describe('ability scores', () => {
  it('computes modifiers', () => {
    expect([1, 8, 9, 10, 11, 15, 17, 20].map(abilityModifier)).toEqual([-5, -1, -1, 0, 0, 2, 3, 5]);
    expect(formatModifier(2)).toBe('+2');
    expect(formatModifier(-1)).toBe('−1');
  });

  it('prices point buy like the rules', () => {
    expect(pointBuySpent({ fue: 15, des: 15, con: 15, int: 8, sab: 8, car: 8 })).toBe(POINT_BUY_BUDGET);
    expect(pointBuySpent({ fue: 8, des: 8, con: 8, int: 8, sab: 8, car: 8 })).toBe(0);
    expect(pointBuySpent({ fue: 13, des: 13, con: 13, int: 12, sab: 12, car: 12 })).toBe(27);
  });

  it('rolls 4d6 dropping the lowest die', () => {
    const dice = [3, 6, 1, 5];
    let i = 0;
    expect(rollAbilityScore(() => dice[i++])).toEqual({ dice: [3, 6, 1, 5], dropped: 2, total: 14 });
  });

  it('applies background increases as +2/+1 or +1/+1/+1', () => {
    const draft = fighterDraft();
    expect(backgroundBonuses(draft)).toEqual({ fue: 2, con: 1 });
    expect(finalScores(draft)).toEqual({ fue: 17, des: 14, con: 14, int: 8, sab: 10, car: 12 });
    draft.bonus = { mode: 'allOne', plus2: null, plus1: null };
    expect(finalScores(draft)).toEqual({ fue: 16, des: 15, con: 14, int: 8, sab: 10, car: 12 });
  });

  it('tracks which pool values are still free, including duplicates', () => {
    const draft = { ...emptyDraft(), method: 'roll', rolledPool: [14, 14, 12, 10, 9, 7] };
    draft.baseScores = { ...draft.baseScores, fue: 14, des: 9 };
    expect(unassignedPoolValues(draft)).toEqual([14, 12, 10, 7]);
  });
});

describe('skills', () => {
  it('never offers a skill the character already has', () => {
    const draft = { ...emptyDraft(), classId: 'fighter', backgroundId: 'soldier', speciesId: 'human' };
    // Soldier grants Athletics and Intimidation, both on the fighter list
    expect(classSkillOptions(draft).options).not.toContain('athletics');
    expect(classSkillOptions(draft).options).not.toContain('intimidation');
    expect(speciesSkillOptions(draft).options).not.toContain('athletics');
    draft.speciesSkills = ['perception'];
    expect(classSkillOptions(draft).options).not.toContain('perception');
    expect(classSkillOptions(draft).count).toBe(2);
  });

  it('lets a bard choose any three skills and an elf one of three', () => {
    const bard = { ...emptyDraft(), classId: 'bard', backgroundId: 'sage', speciesId: 'elf' };
    expect(classSkillOptions(bard)).toMatchObject({ count: 3 });
    expect(classSkillOptions(bard).options).toHaveLength(SKILLS.length - 2);
    expect(speciesSkillOptions(bard)).toEqual({ count: 1, options: ['insight', 'perception', 'survival'] });
  });

  it('drops choices that became invalid after changing an earlier step', () => {
    const draft = fighterDraft();
    const changed = sanitizeDraft({ ...draft, backgroundId: 'poacher', speciesId: 'dwarf' });
    expect(changed.classSkills).toEqual(['acrobatics']); // survival now comes from the background
    expect(changed.speciesSkills).toEqual([]); // dwarves pick no skill
    expect(changed.extraFeatId).toBeNull(); // only humans get an extra feat
    expect(changed.bonus).toEqual({ mode: 'twoOne', plus2: null, plus1: 'con' }); // poacher has no Strength
  });
});

describe('validation', () => {
  it('reports what is missing step by step', () => {
    const issues = stepIssues(emptyDraft());
    expect(issues.class).toHaveLength(1);
    expect(issues.background).toHaveLength(1);
    expect(issues.species).toHaveLength(1);
    expect(issues.abilities.length).toBeGreaterThan(0);
    expect(issues.identity).toHaveLength(2);
    expect(isDraftComplete(emptyDraft())).toBe(false);
  });

  it('accepts a complete draft', () => {
    expect(stepIssues(fighterDraft())).toEqual({ class: [], background: [], species: [], abilities: [], skills: [], spells: [], identity: [] });
  });

  it('rejects ability scores that break the chosen method', () => {
    const draft = fighterDraft();
    expect(stepIssues({ ...draft, baseScores: { ...draft.baseScores, int: 15 } }).abilities).toHaveLength(1);
    const overspent = { ...draft, method: 'pointbuy', baseScores: { fue: 15, des: 15, con: 15, int: 15, sab: 8, car: 8 } };
    expect(stepIssues(overspent).abilities[0]).toContain('27');
    expect(stepIssues({ ...draft, method: 'pointbuy', baseScores: { ...draft.baseScores, fue: 16 } }).abilities).toHaveLength(1);
    expect(stepIssues({ ...draft, method: 'roll', rolledPool: null }).abilities).toHaveLength(1);
    expect(stepIssues({ ...draft, method: 'roll', rolledPool: [15, 14, 13, 12, 10, 8] }).abilities).toEqual([]);
    expect(stepIssues({ ...draft, bonus: { mode: 'twoOne', plus2: 'fue', plus1: 'fue' } }).abilities).toHaveLength(1);
    expect(stepIssues({ ...draft, bonus: { mode: 'twoOne', plus2: 'car', plus1: 'fue' } }).abilities).toHaveLength(1);
  });

  it('requires species sub-choices, valid skills, a name and two languages', () => {
    const draft = fighterDraft();
    expect(stepIssues({ ...draft, speciesId: 'elf', extraFeatId: null, speciesSkills: ['perception'] }).species).toHaveLength(1);
    expect(stepIssues({ ...draft, extraFeatId: null }).species).toHaveLength(1);
    expect(stepIssues({ ...draft, extraFeatId: 'savageAttacker' }).species[0]).toContain('trasfondo');
    expect(stepIssues({ ...draft, classSkills: ['athletics', 'survival'] }).skills).toHaveLength(1); // duplicate of background
    expect(stepIssues({ ...draft, classSkills: ['survival'] }).skills).toHaveLength(1);
    expect(stepIssues({ ...draft, name: ' ' }).identity).toHaveLength(1);
    expect(stepIssues({ ...draft, languages: ['Enano'] }).identity).toHaveLength(1);
    expect(stepIssues({ ...draft, languages: ['Enano', 'Klingon'] }).identity).toHaveLength(1);
  });

  it('only allows repeating a repeatable feat', () => {
    expect(isExtraFeatAllowed({ ...emptyDraft(), backgroundId: 'soldier' }, 'savageAttacker')).toBe(false);
    expect(isExtraFeatAllowed({ ...emptyDraft(), backgroundId: 'innkeeper' }, 'skilled')).toBe(true);
  });
});

describe('buildCharacter', () => {
  it('builds a level 1 human fighter by the rules', () => {
    const hero = buildCharacter(fighterDraft(), { id: 'h1' });
    expect(hero).toMatchObject({
      id: 'h1', name: 'Alaric', level: 1, race: 'Humano', class: 'Guerrero (Nivel 1)', background: 'Soldado',
      stats: { fue: 17, des: 14, con: 14, int: 8, sab: 10, car: 12 },
      maxHp: 12, hp: 12, // d10 + 2 (Constitution 14)
      ac: 16, // chain mail ignores Dexterity
      speed: 30, proficiencyBonus: 2, gold: 18, // 4 (fighter) + 14 (soldier)
      savingThrows: ['fue', 'con'],
      languages: ['Común', 'Enano', 'Élfico'],
      feats: ['Atacante Salvaje', 'Alerta']
    });
    expect([...hero.skills].sort()).toEqual(['acrobatics', 'athletics', 'intimidation', 'perception', 'survival'].sort());
    expect(hero.inventory.map(i => i.name)).toContain('Cota de mallas');
    expect(new Set(hero.inventory.map(i => i.id)).size).toBe(hero.inventory.length);
    expect(hero.backstory.length).toBeGreaterThan(10);
  });

  it('computes Armor Class from each kind of starting armor', () => {
    const scores = { fue: 10, des: 16, con: 14, int: 10, sab: 14, car: 10 };
    const ac = id => computeArmorClass(getClass(id), scores);
    expect(ac('barbarian')).toBe(15); // 10 + Dex 3 + Con 2
    expect(ac('monk')).toBe(15); // 10 + Dex 3 + Wis 2
    expect(ac('cleric')).toBe(17); // 13 + Dex (max 2) + shield
    expect(ac('druid')).toBe(16); // 11 + Dex 3 + shield
    expect(ac('paladin')).toBe(18); // 16 + shield
    expect(ac('ranger')).toBe(15);
    expect(ac('rogue')).toBe(14);
    expect(ac('wizard')).toBe(13);
  });

  it('applies species traits that change numbers', () => {
    const base = fighterDraft();
    const dwarf = buildCharacter(sanitizeDraft({ ...base, speciesId: 'dwarf', classSkills: ['acrobatics', 'survival'] }));
    expect(dwarf.maxHp).toBe(13); // Dwarven Toughness
    expect(dwarf.darkvision).toBe(120);

    const woodElf = buildCharacter({ ...base, speciesId: 'elf', speciesOption: 'wood', extraFeatId: null, speciesSkills: ['perception'] });
    expect(woodElf).toMatchObject({ race: 'Elfo del Bosque', speed: 35, darkvision: 60 });
    const drow = buildCharacter({ ...base, speciesId: 'elf', speciesOption: 'drow', extraFeatId: null, speciesSkills: ['perception'] });
    expect(drow).toMatchObject({ race: 'Drow', darkvision: 120 });

    const goliath = buildCharacter(sanitizeDraft({ ...base, speciesId: 'goliath', speciesOption: 'stone', classSkills: ['acrobatics', 'survival'] }));
    expect(goliath).toMatchObject({ race: 'Goliat (Piedra)', speed: 35 });
    expect(goliath.traits).toContain('Ascendencia gigante: Piedra');
  });

  it('refuses an incomplete draft', () => {
    expect(() => buildCharacter(emptyDraft())).toThrow();
  });
});

describe('skill checks on the sheet', () => {
  const hero = buildCharacter(fighterDraft());

  it('adds the proficiency bonus only to proficient skills', () => {
    expect(skillModifier(hero, 'athletics')).toBe(5); // Str +3, proficient +2
    expect(skillModifier(hero, 'stealth')).toBe(2); // Dex +2, not proficient
    expect(skillModifier(hero, 'arcana')).toBe(-1);
    const rows = skillRows(hero);
    expect(rows).toHaveLength(18);
    expect(rows.find(r => r.id === 'athletics')).toMatchObject({ proficient: true, modifier: 5, abilityShort: 'FUE' });
  });

  it('works with characters from older saves (no skills listed)', () => {
    const old = { stats: { fue: 10, des: 17, con: 12, int: 13, sab: 14, car: 15 } };
    expect(skillModifier(old, 'stealth')).toBe(3);
    expect(skillRows(old).every(r => !r.proficient)).toBe(true);
  });
});

describe('randomDraft', () => {
  it('always produces a complete, valid hero', () => {
    const rng = seeded(2024);
    const seen = new Set();
    for (let i = 0; i < 400; i++) {
      const draft = randomDraft(rng);
      expect(stepIssues(draft)).toEqual({ class: [], background: [], species: [], abilities: [], skills: [], spells: [], identity: [] });
      const hero = buildCharacter(draft);
      expect(hero.maxHp).toBeGreaterThan(0);
      expect(hero.ac).toBeGreaterThanOrEqual(9);
      Object.values(hero.stats).forEach(score => expect(score).toBeLessThanOrEqual(20));
      seen.add(`${hero.classId}/${hero.speciesId}/${hero.backgroundId}`);
    }
    expect(seen.size).toBeGreaterThan(150);
  });
});
