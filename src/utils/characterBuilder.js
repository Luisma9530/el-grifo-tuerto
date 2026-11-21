// Rules for building a level 1 character (D&D 2024 rules / SRD 5.2).
// Pure functions: the creation wizard keeps a "draft" and these functions
// validate it and turn it into the character sheet used by the game.

import {
  ABILITIES, SKILLS, ALL_SKILL_IDS, CLASSES, BACKGROUNDS, SPECIES, FEATS, LANGUAGES, NAME_IDEAS, AVATARS,
  STANDARD_ARRAY, POINT_BUY_BUDGET, POINT_BUY_COST, MAX_ABILITY_SCORE, LEVEL_1_PROFICIENCY_BONUS,
  BASE_LANGUAGE, LANGUAGE_CHOICES
} from '../data/srd';
import { sanitizeSpells, spellIssues, buildSpellcasting, randomSpellChoices } from './spellcasting';
import { normalizeEquipment, isBodyArmor, SHIELD_BONUS } from './equipment';

const ABILITY_IDS = ABILITIES.map(a => a.id);

export const getClass = id => CLASSES.find(c => c.id === id) || null;
export const getBackground = id => BACKGROUNDS.find(b => b.id === id) || null;
export const getSpecies = id => SPECIES.find(s => s.id === id) || null;
export const getFeat = id => FEATS.find(f => f.id === id) || null;
export const getSkill = id => SKILLS.find(s => s.id === id) || null;
export const getAbility = id => ABILITIES.find(a => a.id === id) || null;

export function abilityModifier(score) {
  return Math.floor(((Number(score) || 10) - 10) / 2);
}

export function formatModifier(mod) {
  return mod >= 0 ? `+${mod}` : `−${Math.abs(mod)}`;
}

// ---------------------------------------------------------------------------
// Draft
// ---------------------------------------------------------------------------

/**
 * A blank creation draft.
 * - method: 'standard' | 'pointbuy' | 'roll'
 * - baseScores: scores before background bonuses (null = not assigned yet)
 * - rolledPool: the six values rolled with 4d6 (only for method 'roll')
 * - bonus: background ability increases; mode 'twoOne' (+2 and +1) or 'allOne' (+1 to all three)
 */
export function emptyDraft() {
  return {
    classId: null,
    backgroundId: null,
    speciesId: null,
    speciesOption: null,
    extraFeatId: null,
    method: 'standard',
    baseScores: { fue: null, des: null, con: null, int: null, sab: null, car: null },
    rolledPool: null,
    bonus: { mode: 'twoOne', plus2: null, plus1: null },
    classSkills: [],
    speciesSkills: [],
    spells: {}, // spell choices per source: see spellcasting.js
    name: '',
    avatar: AVATARS[0],
    alignment: '',
    languages: [],
    backstory: ''
  };
}

// ---------------------------------------------------------------------------
// Ability scores
// ---------------------------------------------------------------------------

export function pointBuySpent(scores) {
  return ABILITY_IDS.reduce((sum, id) => sum + (POINT_BUY_COST[scores[id]] ?? 0), 0);
}

/** Roll 4d6 and drop the lowest die. `rollD6` returns 1-6. */
export function rollAbilityScore(rollD6) {
  const dice = [rollD6(), rollD6(), rollD6(), rollD6()];
  const lowest = dice.indexOf(Math.min(...dice));
  const total = dice.reduce((sum, d) => sum + d, 0) - dice[lowest];
  return { dice, dropped: lowest, total };
}

/** The pool of values a draft must distribute (null for point buy). */
export function scorePool(draft) {
  if (draft.method === 'standard') return STANDARD_ARRAY;
  if (draft.method === 'roll') return draft.rolledPool;
  return null;
}

/** Values of the pool not yet assigned to an ability. */
export function unassignedPoolValues(draft) {
  const pool = scorePool(draft);
  if (!pool) return [];
  const remaining = [...pool];
  ABILITY_IDS.forEach(id => {
    const value = draft.baseScores[id];
    const index = remaining.indexOf(value);
    if (value != null && index >= 0) remaining.splice(index, 1);
  });
  return remaining;
}

/** Background increases as { ability: bonus }. */
export function backgroundBonuses(draft) {
  const background = getBackground(draft.backgroundId);
  if (!background) return {};
  if (draft.bonus.mode === 'allOne') {
    return Object.fromEntries(background.abilities.map(id => [id, 1]));
  }
  const bonuses = {};
  if (background.abilities.includes(draft.bonus.plus2)) bonuses[draft.bonus.plus2] = 2;
  if (background.abilities.includes(draft.bonus.plus1) && draft.bonus.plus1 !== draft.bonus.plus2) {
    bonuses[draft.bonus.plus1] = 1;
  }
  return bonuses;
}

/** Final ability scores (base + background increases, capped at 20). Unassigned scores count as 10. */
export function finalScores(draft) {
  const bonuses = backgroundBonuses(draft);
  return Object.fromEntries(ABILITY_IDS.map(id => [
    id,
    Math.min(MAX_ABILITY_SCORE, (draft.baseScores[id] ?? 10) + (bonuses[id] || 0))
  ]));
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

const listOrAll = from => (from === 'any' ? ALL_SKILL_IDS : from);

/** Skills granted by the background (fixed). */
export function backgroundSkills(draft) {
  return getBackground(draft.backgroundId)?.skills || [];
}

/** Skills the species lets you pick from (already-known skills removed). */
export function speciesSkillOptions(draft) {
  const choice = getSpecies(draft.speciesId)?.skillChoice;
  if (!choice) return { count: 0, options: [] };
  const taken = new Set(backgroundSkills(draft));
  return { count: choice.count, options: listOrAll(choice.from).filter(id => !taken.has(id)) };
}

/** Skills the class lets you pick from (already-known skills removed). */
export function classSkillOptions(draft) {
  const choice = getClass(draft.classId)?.skillChoices;
  if (!choice) return { count: 0, options: [] };
  const taken = new Set([...backgroundSkills(draft), ...draft.speciesSkills]);
  return { count: choice.count, options: listOrAll(choice.from).filter(id => !taken.has(id)) };
}

/** Every skill the finished character is proficient in. */
export function allProficientSkills(draft) {
  return [...new Set([...backgroundSkills(draft), ...draft.speciesSkills, ...draft.classSkills])];
}

/**
 * Remove choices that are no longer valid after an earlier choice changed
 * (e.g. a class skill that the new background already grants).
 */
export function sanitizeDraft(draft) {
  const next = { ...draft };
  const species = getSpecies(next.speciesId);
  const background = getBackground(next.backgroundId);

  if (!species?.options?.choices.some(c => c.id === next.speciesOption)) next.speciesOption = null;
  if (!species?.extraFeat) next.extraFeatId = null;

  const bonus = { ...next.bonus };
  if (!background?.abilities.includes(bonus.plus2)) bonus.plus2 = null;
  if (!background?.abilities.includes(bonus.plus1) || bonus.plus1 === bonus.plus2) bonus.plus1 = null;
  next.bonus = bonus;

  const speciesChoice = speciesSkillOptions(next);
  next.speciesSkills = next.speciesSkills.filter(id => speciesChoice.options.includes(id)).slice(0, speciesChoice.count);
  const classChoice = classSkillOptions(next);
  next.classSkills = next.classSkills.filter(id => classChoice.options.includes(id)).slice(0, classChoice.count);

  next.spells = sanitizeSpells(next);

  return next;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function sameMultiset(a, b) {
  if (a.length !== b.length) return false;
  const sorted = list => [...list].sort((x, y) => x - y);
  const [sa, sb] = [sorted(a), sorted(b)];
  return sa.every((value, i) => value === sb[i]);
}

/** A feat can't be taken twice unless it is repeatable. */
export function isExtraFeatAllowed(draft, featId) {
  const backgroundFeat = getBackground(draft.backgroundId)?.feat;
  return featId !== backgroundFeat || featId === 'skilled';
}

export const STEPS = ['class', 'background', 'species', 'abilities', 'skills', 'spells', 'identity'];

/**
 * What is still missing or wrong in each step, as messages for the player.
 * @returns {Record<string, string[]>} empty arrays mean the step is complete
 */
export function stepIssues(draft) {
  const issues = Object.fromEntries(STEPS.map(step => [step, []]));
  const cls = getClass(draft.classId);
  const background = getBackground(draft.backgroundId);
  const species = getSpecies(draft.speciesId);

  if (!cls) issues.class.push('Elige una clase.');
  if (!background) issues.background.push('Elige un trasfondo.');

  if (!species) {
    issues.species.push('Elige una especie.');
  } else {
    if (species.options && !species.options.choices.some(c => c.id === draft.speciesOption)) {
      issues.species.push(`Elige tu ${species.options.label.toLowerCase()}.`);
    }
    if (species.extraFeat) {
      if (!getFeat(draft.extraFeatId)) issues.species.push('Elige tu dote de origen adicional.');
      else if (!isExtraFeatAllowed(draft, draft.extraFeatId)) issues.species.push('Ya tienes esa dote por tu trasfondo: elige otra.');
    }
  }

  // Ability scores
  const values = ABILITY_IDS.map(id => draft.baseScores[id]);
  if (draft.method === 'pointbuy') {
    if (values.some(v => !(v in POINT_BUY_COST))) issues.abilities.push('Cada característica debe estar entre 8 y 15.');
    else if (pointBuySpent(draft.baseScores) > POINT_BUY_BUDGET) issues.abilities.push(`Has gastado más de ${POINT_BUY_BUDGET} puntos.`);
  } else {
    const pool = scorePool(draft);
    if (!pool) issues.abilities.push('Tira los dados para generar tus puntuaciones.');
    else if (values.some(v => v == null)) issues.abilities.push('Asigna una puntuación a cada característica.');
    else if (!sameMultiset(values, pool)) issues.abilities.push('Usa cada puntuación exactamente una vez.');
  }
  if (background && draft.bonus.mode === 'twoOne') {
    const { plus2, plus1 } = draft.bonus;
    const valid = background.abilities.includes(plus2) && background.abilities.includes(plus1) && plus2 !== plus1;
    if (!valid) issues.abilities.push('Reparte los aumentos de tu trasfondo (+2 y +1).');
  }

  // Skills
  if (!cls) issues.skills.push('Elige primero una clase.');
  const speciesChoice = speciesSkillOptions(draft);
  if (draft.speciesSkills.length !== speciesChoice.count || draft.speciesSkills.some(id => !speciesChoice.options.includes(id))) {
    issues.skills.push(`Elige ${speciesChoice.count} habilidad por tu especie.`);
  }
  const classChoice = classSkillOptions(draft);
  const classPicksValid = draft.classSkills.length === classChoice.count
    && new Set(draft.classSkills).size === draft.classSkills.length
    && draft.classSkills.every(id => classChoice.options.includes(id));
  if (cls && !classPicksValid) issues.skills.push(`Elige ${classChoice.count} habilidades de tu clase.`);

  // Spells (nothing to choose for heroes without magic)
  issues.spells.push(...spellIssues(draft));

  // Identity
  const name = draft.name.trim();
  if (name.length < 2) issues.identity.push('Ponle nombre a tu héroe.');
  else if (name.length > 40) issues.identity.push('El nombre es demasiado largo (máximo 40 caracteres).');
  const languagesValid = draft.languages.length === LANGUAGE_CHOICES
    && new Set(draft.languages).size === LANGUAGE_CHOICES
    && draft.languages.every(l => LANGUAGES.includes(l));
  if (!languagesValid) issues.identity.push(`Elige ${LANGUAGE_CHOICES} idiomas además del Común.`);

  return issues;
}

export function isDraftComplete(draft) {
  return Object.values(stepIssues(draft)).every(list => list.length === 0);
}

// ---------------------------------------------------------------------------
// Derived numbers
// ---------------------------------------------------------------------------

/**
 * Armor Class from the class's starting armor, without a shield (see CLASSES[].armor).
 * Used by the creation wizard's preview; in play the AC is computed from the
 * worn armor, the shield in hand and Unarmored Defense (see equipment.js),
 * which gives the same number for the starting equipment.
 */
export function computeBaseArmorClass(cls, scores) {
  const { base, dexCap, unarmored } = cls.armor;
  const dex = abilityModifier(scores.des);
  const dexBonus = dexCap == null ? dex : Math.min(dex, dexCap);
  const extra = unarmored ? abilityModifier(scores[unarmored]) : 0;
  return base + dexBonus + extra;
}

/** Armor Class with the class's starting equipment (its shield in hand, if it has one). */
export function computeArmorClass(cls, scores) {
  return computeBaseArmorClass(cls, scores) + (cls.armor.shield ? SHIELD_BONUS : 0);
}

export function computeMaxHp(cls, species, scores) {
  return Math.max(1, cls.hitDie + abilityModifier(scores.con) + (species?.hpPerLevel || 0));
}

function speciesDisplayName(species, optionId) {
  const option = species.options?.choices.find(c => c.id === optionId);
  if (!option) return species.name;
  // Elf and gnome lineages are names of their own ("Elfo del Bosque", "Drow")
  if (species.id === 'elf' || species.id === 'gnome') return option.name;
  return `${species.name} (${option.name})`;
}

/**
 * Turn a complete draft into the character sheet stored in the campaign.
 * Throws if the draft is not complete.
 */
export function buildCharacter(draft, { id = `hero_${Date.now()}` } = {}) {
  return normalizeEquipment(buildSheet(draft, id));
}

function buildSheet(draft, id) {
  if (!isDraftComplete(draft)) throw new Error('El personaje está incompleto.');

  const cls = getClass(draft.classId);
  const background = getBackground(draft.backgroundId);
  const species = getSpecies(draft.speciesId);
  const option = species.options?.choices.find(c => c.id === draft.speciesOption) || null;
  const stats = finalScores(draft);
  const maxHp = computeMaxHp(cls, species, stats);
  const feats = [background.feat, draft.extraFeatId].filter(Boolean).map(featId => getFeat(featId).name);

  const inventory = [...cls.equipment, ...background.equipment].map((item, index) => ({
    ...item,
    id: `item_${index}`
  }));

  const backstory = draft.backstory.trim()
    || `${background.desc} Ahora, como ${cls.name.toLowerCase()}, buscas fortuna lejos de casa.`;

  return {
    id,
    rulesVersion: 'srd-5.2',
    name: draft.name.trim(),
    avatar: draft.avatar,
    level: 1,
    xp: 0,
    subclass: null,
    // Display strings used across the app (kept for compatibility with older saves)
    race: speciesDisplayName(species, draft.speciesOption),
    class: `${cls.name} (Nivel 1)`,
    classId: cls.id,
    className: cls.name,
    speciesId: species.id,
    speciesOption: option?.id || null,
    backgroundId: background.id,
    background: background.name,
    alignment: draft.alignment || null,

    stats,
    hp: maxHp,
    maxHp,
    hitDie: cls.hitDie,
    // Final AC (worn armor, shield in hand, Unarmored Defense) is set by normalizeEquipment
    acBase: computeBaseArmorClass(cls, stats),
    ac: computeArmorClass(cls, stats),
    // The class's starting armor is worn
    wornArmor: inventory.find(isBodyArmor)?.id ?? null,
    speed: option?.speed ?? species.speed,
    size: species.size,
    darkvision: option?.darkvision ?? species.darkvision,
    proficiencyBonus: LEVEL_1_PROFICIENCY_BONUS,
    savingThrows: [...cls.savingThrows],
    skills: allProficientSkills(draft),
    tools: [background.tool],
    languages: [BASE_LANGUAGE, ...draft.languages],
    feats,
    classFeatures: [...cls.features],
    traits: [
      ...species.traits.map(t => t.name),
      ...(option ? [`${species.options.label}: ${option.name}`] : [])
    ],

    // null for heroes without magic
    spellcasting: buildSpellcasting(draft, stats),
    hitDiceUsed: 0,

    gold: cls.gold + background.gold,
    inventory,
    backstory
  };
}

// ---------------------------------------------------------------------------
// Using the sheet in play
// ---------------------------------------------------------------------------

/** Proficiency bonus of a character (older saves have none: +2). */
export function proficiencyBonus(character) {
  return Number(character?.proficiencyBonus) || LEVEL_1_PROFICIENCY_BONUS;
}

/** Modifier for a skill check: ability modifier + proficiency bonus if proficient. */
export function skillModifier(character, skillId) {
  const skill = getSkill(skillId);
  if (!skill) return 0;
  const proficient = Array.isArray(character?.skills) && character.skills.includes(skillId);
  return abilityModifier(character?.stats?.[skill.ability]) + (proficient ? proficiencyBonus(character) : 0);
}

/** Rows for the skills list of the sheet. */
export function skillRows(character) {
  return SKILLS.map(skill => ({
    ...skill,
    abilityShort: getAbility(skill.ability).short,
    proficient: Array.isArray(character?.skills) && character.skills.includes(skill.id),
    modifier: skillModifier(character, skill.id)
  }));
}

// ---------------------------------------------------------------------------
// Random hero
// ---------------------------------------------------------------------------

const pick = (list, rng) => list[Math.floor(rng() * list.length)];

function pickSeveral(list, count, rng) {
  const pool = [...list];
  const picked = [];
  while (picked.length < count && pool.length > 0) {
    picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return picked;
}

export function randomName(speciesId, rng = Math.random) {
  return pick(NAME_IDEAS[speciesId] || NAME_IDEAS.human, rng);
}

/** A complete, valid draft chosen at random (the class's suggested ability scores are used). */
export function randomDraft(rng = Math.random) {
  const cls = pick(CLASSES, rng);
  const background = pick(BACKGROUNDS, rng);
  const species = pick(SPECIES, rng);

  let draft = {
    ...emptyDraft(),
    classId: cls.id,
    backgroundId: background.id,
    speciesId: species.id,
    speciesOption: species.options ? pick(species.options.choices, rng).id : null,
    method: 'standard',
    baseScores: { ...cls.suggestedArray },
    name: randomName(species.id, rng),
    avatar: pick(AVATARS, rng),
    languages: pickSeveral(LANGUAGES, LANGUAGE_CHOICES, rng)
  };

  if (species.extraFeat) {
    draft.extraFeatId = pick(FEATS.filter(f => isExtraFeatAllowed(draft, f.id)), rng).id;
  }

  // Put the background's +2 where it helps the class most
  const byScore = [...background.abilities].sort((a, b) => draft.baseScores[b] - draft.baseScores[a]);
  draft.bonus = { mode: 'twoOne', plus2: byScore[0], plus1: byScore[1] };

  const speciesChoice = speciesSkillOptions(draft);
  draft.speciesSkills = pickSeveral(speciesChoice.options, speciesChoice.count, rng);
  const classChoice = classSkillOptions(draft);
  draft.classSkills = pickSeveral(classChoice.options, classChoice.count, rng);
  draft.spells = randomSpellChoices(draft, rng);

  return draft;
}
