// Experience and level advancement (levels 1 to 5, D&D 2024 rules / SRD 5.2).
// Pure functions: the level-up dialog builds a `choices` object and these
// functions validate it and apply it to the character sheet.

import {
  MAX_LEVEL, XP_FOR_LEVEL, PROFICIENCY_BY_LEVEL, ASI_LEVELS, SUBCLASS_LEVEL, SUBCLASSES, CLASS_FEATURES,
  SPELL_PROGRESSION
} from '../data/progression';
import { ABILITIES, MAX_ABILITY_SCORE } from '../data/srd';
import { getClass, getSpecies, abilityModifier, computeArmorClass } from './characterBuilder';
import { spellsFor, slotsForLevel, slotTable, maxSlotLevel, getSpell } from './spellcasting';

const ABILITY_IDS = ABILITIES.map(a => a.id);

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

export const levelOf = character => Math.min(MAX_LEVEL, Math.max(1, Number(character?.level) || 1));
export const xpOf = character => Math.max(0, Number(character?.xp) || 0);

/** Only heroes made with the creation wizard have the data needed to level up. */
export const canAdvance = character => Boolean(character?.rulesVersion && getClass(character.classId));

/** XP needed for the next level (null at the maximum level). */
export function nextLevelXp(character) {
  const level = levelOf(character);
  return level >= MAX_LEVEL ? null : XP_FOR_LEVEL[level + 1];
}

/** Progress towards the next level, for the sheet's XP bar. */
export function xpProgress(character) {
  const level = levelOf(character);
  const xp = xpOf(character);
  const next = nextLevelXp(character);
  if (next == null) return { level, xp, next: null, percent: 100 };
  const start = XP_FOR_LEVEL[level];
  return { level, xp, next, percent: Math.max(0, Math.min(100, Math.round(((xp - start) / (next - start)) * 100))) };
}

/** The hero has enough experience to go up one level. */
export function canLevelUp(character) {
  const next = nextLevelXp(character);
  return canAdvance(character) && next != null && xpOf(character) >= next;
}

/** Add experience (never negative, capped so nobody skips past the last level). */
export function addXp(character, amount) {
  const gain = Math.max(0, Math.round(Number(amount) || 0));
  if (gain === 0) return character;
  return { ...character, xp: Math.min(XP_FOR_LEVEL[MAX_LEVEL] * 2, xpOf(character) + gain) };
}

// ---------------------------------------------------------------------------
// Level-up plan
// ---------------------------------------------------------------------------

/** Spells learned through the class (not feats or species). Older saves have no sourceKey. */
const classEntries = character => (character.spellcasting?.known || [])
  .filter(k => (k.sourceKey ? k.sourceKey === 'class' : k.source === getClass(character.classId)?.name));

/**
 * Everything that changes when the hero reaches the next level, and the choices
 * the player has to make.
 * spells: null for classes without magic; otherwise how many cantrips and
 * spells to learn (spells up to `maxSpellLevel`) and, for wizards, how many to prepare.
 */
export function levelUpPlan(character) {
  const cls = getClass(character.classId);
  const species = getSpecies(character.speciesId);
  const level = levelOf(character) + 1;
  const conMod = abilityModifier(character.stats?.con);
  const extraHpPerLevel = species?.hpPerLevel || 0;

  let spells = null;
  const progression = SPELL_PROGRESSION[cls.id];
  if (progression) {
    const known = classEntries(character);
    const knownCantrips = known.filter(k => getSpell(k.id)?.level === 0).length;
    const knownSpells = known.filter(k => getSpell(k.id)?.level > 0);
    const isWizard = Boolean(progression.spellbook);
    const targetSpells = isWizard ? progression.spellbook[level - 1] : progression.prepared[level - 1];
    const slots = slotsForLevel(cls.id, level);
    spells = {
      list: cls.id,
      ability: known[0]?.ability || null,
      cantrips: Math.max(0, progression.cantrips[level - 1] - knownCantrips),
      spells: Math.max(0, targetSpells - knownSpells.length),
      prepared: isWizard ? progression.prepared[level - 1] : null,
      maxSpellLevel: maxSlotLevel({ slots }),
      slotsBefore: slotTable(character.spellcasting),
      slotsAfter: slotTable({ slots })
    };
  }

  const subclass = level === SUBCLASS_LEVEL ? SUBCLASSES[cls.id] : null;

  return {
    level,
    className: cls.name,
    hitDie: cls.hitDie,
    hpAverage: cls.hitDie / 2 + 1,
    conMod,
    extraHpPerLevel,
    proficiencyBefore: PROFICIENCY_BY_LEVEL[level - 1],
    proficiencyAfter: PROFICIENCY_BY_LEVEL[level],
    features: [
      ...(subclass ? [subclass.name] : []),
      ...(CLASS_FEATURES[cls.id]?.[level] || []),
      ...(ASI_LEVELS.includes(level) ? ['Mejora de Característica'] : [])
    ],
    subclass,
    asi: ASI_LEVELS.includes(level),
    spells
  };
}

// ---------------------------------------------------------------------------
// Choices
// ---------------------------------------------------------------------------

/**
 * choices:
 * - hp: { method: 'average' | 'roll', roll: number | null }
 * - asi: { mode: 'two' (+2 to one) | 'split' (+1 to two), abilities: [id] or [id, id] }
 * - spells: { cantrips: [id], spells: [id], prepared: [id] } — prepared lists every
 *   spellbook spell a wizard wants ready (old and new)
 */
export function emptyLevelUpChoices(character) {
  const prepared = (character.spellcasting?.known || []).filter(k => k.prepared && getSpell(k.id)?.level > 0 && !k.freeCast).map(k => k.id);
  return {
    hp: { method: 'average', roll: null },
    asi: { mode: 'two', abilities: [] },
    spells: { cantrips: [], spells: [], prepared }
  };
}

/** Spells the hero can learn at the new level, by spell level (known ones excluded). */
export function learnableSpells(character, plan, level) {
  if (!plan.spells || level > plan.spells.maxSpellLevel) return [];
  const known = new Set((character.spellcasting?.known || []).map(k => k.id));
  return spellsFor(plan.spells.list, level).filter(s => !known.has(s.id));
}

/** Hit points gained this level. */
export function hpGain(plan, choices) {
  const base = choices.hp.method === 'roll' && choices.hp.roll ? choices.hp.roll : plan.hpAverage;
  return Math.max(1, base + plan.conMod + plan.extraHpPerLevel);
}

/** Ability increases as { ability: bonus }. */
export function asiBonuses(choices) {
  const { mode, abilities } = choices.asi;
  if (mode === 'two' && abilities[0]) return { [abilities[0]]: 2 };
  if (mode === 'split') return Object.fromEntries(abilities.filter(Boolean).map(id => [id, 1]));
  return {};
}

/** What is still missing, as messages for the player. */
export function levelUpIssues(character, plan, choices) {
  const issues = [];
  if (choices.hp.method === 'roll' && !choices.hp.roll) issues.push('Tira tu dado de golpe o elige la media.');

  if (plan.asi) {
    const { mode, abilities } = choices.asi;
    const valid = mode === 'two'
      ? abilities.length === 1 && character.stats[abilities[0]] + 2 <= MAX_ABILITY_SCORE
      : abilities.length === 2 && abilities[0] !== abilities[1]
        && abilities.every(id => character.stats[id] + 1 <= MAX_ABILITY_SCORE);
    if (!valid) issues.push(mode === 'two' ? 'Elige qué característica sube +2.' : 'Elige dos características distintas para subir +1.');
  }

  if (plan.spells) {
    const { cantrips, spells, prepared } = choices.spells;
    const cantripOptions = new Set(learnableSpells(character, plan, 0).map(s => s.id));
    const spellOptions = new Set(
      Array.from({ length: plan.spells.maxSpellLevel }, (_, i) => learnableSpells(character, plan, i + 1)).flat().map(s => s.id)
    );
    if (cantrips.length !== plan.spells.cantrips || cantrips.some(id => !cantripOptions.has(id))) {
      issues.push(`Elige ${plan.spells.cantrips} ${plan.spells.cantrips === 1 ? 'truco nuevo' : 'trucos nuevos'}.`);
    }
    if (spells.length !== plan.spells.spells || spells.some(id => !spellOptions.has(id))) {
      issues.push(`Elige ${plan.spells.spells} ${plan.spells.spells === 1 ? 'conjuro nuevo' : 'conjuros nuevos'}.`);
    }
    if (plan.spells.prepared != null) {
      const book = new Set([...classEntries(character).filter(k => getSpell(k.id)?.level > 0).map(k => k.id), ...spells]);
      if (prepared.length !== plan.spells.prepared || new Set(prepared).size !== prepared.length || prepared.some(id => !book.has(id))) {
        issues.push(`Prepara ${plan.spells.prepared} conjuros de tu libro.`);
      }
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

/**
 * The character sheet after going up one level.
 * Throws if the choices are not complete.
 * @returns {{ character: object, summary: { level, hpGain, features, learned: string[], asi } }}
 */
export function applyLevelUp(character, choices) {
  if (!canLevelUp(character)) throw new Error('Aún no puedes subir de nivel.');
  const plan = levelUpPlan(character);
  const issues = levelUpIssues(character, plan, choices);
  if (issues.length > 0) throw new Error(issues[0]);

  const cls = getClass(character.classId);
  const { level } = plan;

  // Ability Score Improvement (raising Constitution also raises max HP retroactively)
  const bonuses = plan.asi ? asiBonuses(choices) : {};
  const stats = Object.fromEntries(ABILITY_IDS.map(id => [id, Math.min(MAX_ABILITY_SCORE, character.stats[id] + (bonuses[id] || 0))]));
  const conGain = abilityModifier(stats.con) - abilityModifier(character.stats.con);
  const gained = hpGain(plan, choices) + conGain * level;

  // Spells
  let spellcasting = character.spellcasting;
  const learned = [];
  if (plan.spells && spellcasting) {
    const classKnown = classEntries(character);
    const ability = plan.spells.ability || classKnown[0]?.ability;
    const isWizard = plan.spells.prepared != null;
    const additions = [...choices.spells.cantrips, ...choices.spells.spells].map(id => ({
      id, source: cls.name, sourceKey: 'class', ability, prepared: true, freeCast: false
    }));
    let known = [...spellcasting.known, ...additions];
    if (isWizard) {
      const prepared = new Set(choices.spells.prepared);
      known = known.map(k => (k.source === cls.name && getSpell(k.id)?.level > 0 && !k.freeCast ? { ...k, prepared: prepared.has(k.id) } : k));
    }
    // New slot table; keep slots already spent at each level
    const used = Object.fromEntries(slotTable(spellcasting).map(row => [row.level, row.used]));
    const fresh = slotsForLevel(cls.id, level);
    const levels = Object.fromEntries(Object.entries(fresh.levels).map(([lvl, row]) => [lvl, { max: row.max, used: Math.min(row.max, used[lvl] || 0) }]));
    spellcasting = { ...spellcasting, known, slots: { recovery: fresh.recovery, levels } };
    learned.push(...additions.map(a => getSpell(a.id).name));
  }

  const next = {
    ...character,
    level,
    class: `${cls.name} (Nivel ${level})`,
    stats,
    maxHp: character.maxHp + gained,
    hp: character.hp + gained,
    proficiencyBonus: plan.proficiencyAfter,
    ac: computeArmorClass(cls, stats),
    subclass: plan.subclass ? plan.subclass.name : character.subclass || null,
    classFeatures: [...(character.classFeatures || []), ...plan.features.filter(f => f !== 'Mejora de Característica')],
    spellcasting
  };

  return {
    character: next,
    summary: { level, hpGain: gained, features: plan.features, learned, asi: bonuses }
  };
}

/** One line for the chronicle. */
export function describeLevelUp(character, summary) {
  const asi = Object.entries(summary.asi)
    .map(([id, bonus]) => `${ABILITIES.find(a => a.id === id).name} +${bonus}`);
  const parts = [
    `🎉 **${character.name} sube a nivel ${summary.level}.**`,
    `Puntos de golpe máximos +${summary.hpGain}.`,
    summary.features.length ? `Nuevos rasgos: ${summary.features.join(', ')}.` : '',
    asi.length ? `Mejora: ${asi.join(', ')}.` : '',
    summary.learned.length ? `Aprende: ${summary.learned.join(', ')}.` : ''
  ];
  return parts.filter(Boolean).join(' ');
}
