import { describe, it, expect } from 'vitest';
import {
  spellsFor, spellSources, speciesCantrips, spellOptions, sanitizeSpells, spellIssues, buildSpellcasting,
  randomSpellChoices, parseDice, castSpell, describeCast, spellRows, spellNumbers, slotsLeft,
  longRest, shortRest, hasHitDie, getSpell
} from './spellcasting';
import { emptyDraft, sanitizeDraft, stepIssues, buildCharacter, randomDraft } from './characterBuilder';
import { SPELLS, CLASS_SPELLCASTING, MAGIC_INITIATE, SPECIES_CANTRIPS } from '../data/spells';
import { CLASSES, ABILITIES } from '../data/srd';

function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Dice that always show the given values, in order. */
const fixedDice = values => {
  let i = 0;
  return () => values[i++];
};

/** A complete high elf wizard sage: class spells plus Magic Initiate (Wizard) plus a species cantrip. */
function wizardDraft() {
  return sanitizeDraft({
    ...emptyDraft(),
    classId: 'wizard',
    backgroundId: 'sage',
    speciesId: 'elf',
    speciesOption: 'high',
    baseScores: { fue: 8, des: 12, con: 13, int: 15, sab: 14, car: 10 },
    bonus: { mode: 'twoOne', plus2: 'int', plus1: 'con' },
    speciesSkills: ['perception'],
    classSkills: ['investigation', 'insight'],
    spells: {
      class: {
        cantrips: ['fireBolt', 'mageHand', 'light'],
        spells: ['magicMissile', 'shield', 'mageArmor', 'sleep', 'burningHands', 'detectMagic'],
        prepared: ['magicMissile', 'shield', 'sleep', 'burningHands']
      },
      magicInitiateWizard: { cantrips: ['rayOfFrost', 'minorIllusion'], spells: ['featherFall'] }
    },
    name: 'Elowen',
    languages: ['Enano', 'Dracónico']
  });
}

describe('spell data', () => {
  it('has valid spells with the numbers each kind needs', () => {
    const classIds = CLASSES.map(c => c.id);
    const abilityIds = ABILITIES.map(a => a.id);
    expect(new Set(SPELLS.map(s => s.id)).size).toBe(SPELLS.length);
    SPELLS.forEach(spell => {
      expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).toContain(spell.level);
      spell.classes.forEach(c => expect(classIds).toContain(c));
      if (spell.damage) expect(parseDice(spell.damage)).not.toBeNull();
      if (spell.kind === 'attack' || spell.kind === 'auto') expect(spell.damage).toBeTruthy();
      if (spell.kind === 'save') expect(abilityIds).toContain(spell.save);
      if (spell.kind === 'heal') expect(parseDice(spell.heal)).not.toBeNull();
    });
  });

  it('gives every casting class enough spells to choose from', () => {
    Object.entries(CLASS_SPELLCASTING).forEach(([classId, casting]) => {
      expect(spellsFor(classId, 0).length).toBeGreaterThanOrEqual(casting.cantrips);
      expect(spellsFor(classId, 1).length).toBeGreaterThanOrEqual((casting.spellbook || casting.prepared) + 2);
    });
    Object.values(MAGIC_INITIATE).forEach(feat => {
      // Enough left for a caster of the same class who also takes the feat
      const casting = CLASS_SPELLCASTING[feat.list];
      expect(spellsFor(feat.list, 0).length).toBeGreaterThanOrEqual(casting.cantrips + feat.cantrips);
    });
    Object.values(SPECIES_CANTRIPS).forEach(entry => {
      [...(entry.always || []), ...Object.values(entry.byOption || {}).flat()].forEach(id => expect(getSpell(id)?.level).toBe(0));
    });
  });
});

describe('choosing spells', () => {
  it('knows which sources of magic a hero has', () => {
    expect(spellSources({ ...emptyDraft(), classId: 'fighter', backgroundId: 'soldier' })).toEqual([]);
    expect(spellSources({ ...emptyDraft(), classId: 'fighter', backgroundId: 'acolyte' }).map(s => s.key)).toEqual(['magicInitiateCleric']);
    const wizard = spellSources(wizardDraft());
    expect(wizard.map(s => s.key)).toEqual(['class', 'magicInitiateWizard']);
    expect(wizard[0]).toMatchObject({ cantrips: 3, spells: 6, prepared: 4, ability: 'int' });
    expect(wizard[1]).toMatchObject({ cantrips: 2, spells: 1, prepared: null });
    expect(spellSources({ ...emptyDraft(), classId: 'paladin' })[0]).toMatchObject({ cantrips: 0, spells: 2 });
    expect(spellSources({ ...emptyDraft(), classId: 'fighter', backgroundId: 'soldier', speciesId: 'human', extraFeatId: 'magicInitiateDruid' })
      .map(s => s.key)).toEqual(['magicInitiateDruid']);
  });

  it('gives species their innate cantrips', () => {
    expect(speciesCantrips({ speciesId: 'elf', speciesOption: 'high' })).toEqual(['prestidigitation']);
    expect(speciesCantrips({ speciesId: 'tiefling', speciesOption: 'infernal' })).toEqual(['thaumaturgy', 'fireBolt']);
    expect(speciesCantrips({ speciesId: 'gnome', speciesOption: 'rock' })).toEqual(['mending', 'prestidigitation']);
    expect(speciesCantrips({ speciesId: 'dwarf', speciesOption: null })).toEqual([]);
  });

  it('never offers a spell the hero already knows', () => {
    const draft = wizardDraft();
    const [cls, feat] = spellSources(draft);
    const classCantrips = spellOptions(draft, cls, 0).map(s => s.id);
    expect(classCantrips).toContain('fireBolt'); // its own pick stays selectable
    expect(classCantrips).not.toContain('rayOfFrost'); // taken by the feat
    expect(classCantrips).not.toContain('prestidigitation'); // innate for high elves
    expect(spellOptions(draft, feat, 1).map(s => s.id)).not.toContain('magicMissile');
  });

  it('accepts a complete selection and reports what is missing', () => {
    expect(stepIssues(wizardDraft()).spells).toEqual([]);
    const blank = sanitizeDraft({ ...wizardDraft(), spells: {} });
    expect(spellIssues(blank)).toHaveLength(4); // class cantrips + spellbook, feat cantrips + spell
    const unprepared = wizardDraft();
    unprepared.spells.class.prepared = ['shield'];
    expect(spellIssues(unprepared)).toEqual(['Marca 4 conjuros de tu libro como preparados.']);
  });

  it('drops choices that stop being valid', () => {
    const draft = wizardDraft();
    // Becoming a cleric invalidates the wizard picks but keeps the feat's
    const cleric = sanitizeDraft({ ...draft, classId: 'cleric', classSkills: [] });
    expect(cleric.spells.class).toEqual({ cantrips: ['light'], spells: ['detectMagic'], prepared: [] });
    expect(cleric.spells.magicInitiateWizard.cantrips).toEqual(['rayOfFrost', 'minorIllusion']);
    // Changing background removes the feat's spells altogether
    expect(sanitizeDraft({ ...draft, backgroundId: 'soldier' }).spells.magicInitiateWizard).toBeUndefined();
    // Duplicates and extra picks are trimmed
    const messy = sanitizeSpells({ ...draft, spells: { ...draft.spells, magicInitiateWizard: { cantrips: ['fireBolt', 'rayOfFrost', 'acidSplash', 'message'], spells: ['shield'] } } });
    expect(messy.magicInitiateWizard).toEqual({ cantrips: ['rayOfFrost', 'acidSplash'], spells: [], prepared: [] });
  });

  it('builds the spellcasting block of the sheet', () => {
    const hero = buildCharacter(wizardDraft());
    const { spellcasting } = hero;
    expect(spellcasting.slots).toEqual({ recovery: 'long', levels: { 1: { max: 2, used: 0 } } });
    expect(spellcasting.known).toHaveLength(3 + 6 + 2 + 1 + 1);
    expect(spellcasting.known.find(k => k.id === 'mageArmor')).toMatchObject({ prepared: false, freeCast: false, ability: 'int' });
    expect(spellcasting.known.find(k => k.id === 'featherFall')).toMatchObject({ prepared: true, freeCast: true });
    expect(spellcasting.known.find(k => k.id === 'prestidigitation')).toMatchObject({ source: 'Elfo', ability: 'int' });
    expect(spellNumbers(hero, spellcasting.known[0])).toEqual({ modifier: 3, saveDC: 13, attackBonus: 5 }); // Int 17
  });

  it('leaves heroes without magic with no spellcasting', () => {
    const fighter = { ...emptyDraft(), classId: 'fighter', backgroundId: 'soldier', speciesId: 'orc' };
    expect(buildSpellcasting(fighter, { int: 10, sab: 10, car: 10 })).toBeNull();
    expect(spellRows({ stats: {} })).toEqual([]);
  });

  it('warlocks recover their single slot on a short rest', () => {
    const warlock = { ...emptyDraft(), classId: 'warlock', backgroundId: 'soldier', speciesId: 'orc' };
    const spells = randomSpellChoices(warlock, seeded(1));
    expect(buildSpellcasting({ ...warlock, spells }, { car: 16 }).slots).toEqual({ recovery: 'short', levels: { 1: { max: 1, used: 0 } } });
  });

  it('random heroes always get valid spells', () => {
    const rng = seeded(77);
    let casters = 0;
    for (let i = 0; i < 300; i++) {
      const draft = randomDraft(rng);
      expect(stepIssues(draft).spells).toEqual([]);
      const hero = buildCharacter(draft);
      if (hero.spellcasting) {
        casters++;
        const ids = hero.spellcasting.known.map(k => k.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
    expect(casters).toBeGreaterThan(150);
  });
});

describe('casting', () => {
  const hero = buildCharacter(wizardDraft()); // Int 17: +5 to hit, DC 13

  it('parses dice notation', () => {
    expect(parseDice('3d4+3')).toEqual({ count: 3, sides: 4, bonus: 3 });
    expect(parseDice('1d10')).toEqual({ count: 1, sides: 10, bonus: 0 });
    expect(parseDice('fuego')).toBeNull();
  });

  it('casts cantrips for free, with attack and damage rolls', () => {
    const res = castSpell(hero, 'fireBolt', fixedDice([14, 7]));
    expect(res.ok).toBe(true);
    expect(res.cast).toMatchObject({
      usedSlot: false, attackBonus: 5,
      attack: { raw: 14, total: 19, isNat20: false },
      damage: { dice: [7], total: 7, type: 'fuego' }
    });
    expect(slotsLeft(res.character)).toBe(2);
    expect(describeCast(res.cast, { target: 'el encapuchado' }))
      .toBe('Lanzo el truco **Descarga de Fuego** sobre el encapuchado. [🎲 Ataque de conjuro D20: 14 (+5) = 19 vs CD 12] Impacta y hace 7 de daño fuego.');
  });

  it('doubles damage dice on a natural 20 and misses on a low roll', () => {
    const crit = castSpell(hero, 'fireBolt', fixedDice([20, 4, 9]));
    expect(crit.cast.damage).toMatchObject({ dice: [4, 9], total: 13 });
    expect(describeCast(crit.cast)).toContain('¡Crítico!');
    const miss = castSpell(hero, 'fireBolt', fixedDice([3, 5]));
    expect(describeCast(miss.cast)).toContain('Falla.');
  });

  it('spends a slot for level 1 spells and stops when none are left', () => {
    const first = castSpell(hero, 'magicMissile', fixedDice([1, 2, 3]));
    expect(first.cast).toMatchObject({ usedSlot: true, damage: { total: 9, type: 'fuerza' } }); // 1+2+3+3
    expect(describeCast(first.cast)).toContain('Acierta automáticamente y hace 9 de daño fuerza.');
    const second = castSpell(first.character, 'burningHands', fixedDice([6, 6, 6]));
    expect(slotsLeft(second.character)).toBe(0);
    expect(describeCast(second.cast)).toContain('salvación de Destreza CD 13 o sufrir 18 de daño fuego (la mitad si la supera)');
    const third = castSpell(second.character, 'sleep', fixedDice([]));
    expect(third).toEqual({ ok: false, error: expect.stringContaining('espacios de conjuro') });
    // Cantrips still work
    expect(castSpell(second.character, 'fireBolt', fixedDice([10, 3])).ok).toBe(true);
  });

  it('casts a Magic Initiate spell once for free, then with slots', () => {
    const free = castSpell(hero, 'featherFall', fixedDice([]));
    expect(free.cast).toMatchObject({ usedFreeCast: true, usedSlot: false });
    expect(slotsLeft(free.character)).toBe(2);
    const paid = castSpell(free.character, 'featherFall', fixedDice([]));
    expect(paid.cast).toMatchObject({ usedFreeCast: false, usedSlot: true });
    expect(describeCast(paid.cast)).toContain('Efecto: Hasta cinco criaturas caen despacio');
  });

  it('refuses unknown and unprepared spells', () => {
    expect(castSpell(hero, 'cureWounds', fixedDice([])).ok).toBe(false);
    expect(castSpell(hero, 'mageArmor', fixedDice([])).error).toContain('preparado');
    expect(castSpell({ stats: {} }, 'fireBolt', fixedDice([])).ok).toBe(false);
  });

  it('heals the caster, without going over the maximum', () => {
    const cleric = buildCharacter(randomClericDraft());
    const hurt = { ...cleric, hp: 2 };
    const res = castSpell(hurt, 'cureWounds', fixedDice([3, 4]));
    const expected = 3 + 4 + res.cast.modifier;
    expect(res.cast.heal).toMatchObject({ total: expected, applied: Math.min(expected, cleric.maxHp - 2) });
    expect(res.character.hp).toBe(Math.min(cleric.maxHp, 2 + expected));
    expect(describeCast(res.cast)).toContain('Recupero');
    const full = castSpell(cleric, 'cureWounds', fixedDice([8, 8]));
    expect(full.character.hp).toBe(cleric.maxHp);
    expect(full.cast.heal.applied).toBe(0);
  });

  it('lists spells for the sheet with what blocks them', () => {
    const rows = spellRows(hero);
    expect(rows[0].level).toBe(0);
    expect(rows.find(r => r.id === 'mageArmor').blocked).toBe('En tu libro, sin preparar');
    expect(rows.find(r => r.id === 'fireBolt')).toMatchObject({ blocked: null, attackBonus: 5, saveDC: 13, abilityName: 'Inteligencia' });
    const drained = { ...hero, spellcasting: { ...hero.spellcasting, slots: { recovery: 'long', levels: { 1: { max: 2, used: 2 } } } } };
    const drainedRows = spellRows(drained);
    expect(drainedRows.find(r => r.id === 'sleep').blocked).toBe('Sin espacios de conjuro');
    expect(drainedRows.find(r => r.id === 'featherFall')).toMatchObject({ blocked: null, freeAvailable: true });
    expect(drainedRows.find(r => r.id === 'fireBolt').blocked).toBeNull();
  });
});

function randomClericDraft() {
  return sanitizeDraft({
    ...emptyDraft(),
    classId: 'cleric',
    backgroundId: 'soldier',
    speciesId: 'orc',
    baseScores: { fue: 14, des: 8, con: 13, int: 10, sab: 15, car: 12 },
    bonus: { mode: 'twoOne', plus2: 'fue', plus1: 'con' },
    classSkills: ['medicine', 'religion'],
    spells: { class: { cantrips: ['sacredFlame', 'guidance', 'light'], spells: ['cureWounds', 'guidingBolt', 'bless', 'healingWord'] } },
    name: 'Urzoga',
    languages: ['Orco', 'Enano']
  });
}

describe('rests', () => {
  const hero = buildCharacter(wizardDraft());
  const spent = {
    ...hero,
    hp: 1,
    hitDiceUsed: 1,
    spellcasting: { ...hero.spellcasting, freeCastsUsed: ['featherFall'], slots: { recovery: 'long', levels: { 1: { max: 2, used: 2 } } } }
  };

  it('a long rest restores hit points, slots, free casts and the hit die', () => {
    const rested = longRest(spent);
    expect(rested.hp).toBe(hero.maxHp);
    expect(slotsLeft(rested)).toBe(2);
    expect(rested.spellcasting.freeCastsUsed).toEqual([]);
    expect(hasHitDie(rested)).toBe(true);
    expect(longRest({ hp: 3, maxHp: 10 })).toMatchObject({ hp: 10 }); // heroes without magic
  });

  it('a short rest spends the hit die to heal, once', () => {
    const hurt = { ...hero, hp: 1 };
    const first = shortRest(hurt, fixedDice([4]));
    expect(first).toMatchObject({ die: 4, healed: 6, slotsRecovered: false }); // d6: 4 + Con 2
    expect(first.character.hp).toBe(7);
    const second = shortRest(first.character, fixedDice([6]));
    expect(second).toMatchObject({ die: null, healed: 0 });
    // Not hurt: the die is kept
    expect(shortRest(hero, fixedDice([6])).character.hitDiceUsed).toBe(0);
  });

  it('a short rest gives warlocks their slot back, but not other casters', () => {
    expect(shortRest(spent, fixedDice([3])).slotsRecovered).toBe(false);
    const warlock = {
      ...hero,
      spellcasting: { ...hero.spellcasting, slots: { max: 1, used: 1, recovery: 'short' } } // old save format
    };
    const rested = shortRest(warlock, fixedDice([3]));
    expect(rested.slotsRecovered).toBe(true);
    expect(slotsLeft(rested.character)).toBe(1);
  });
});
