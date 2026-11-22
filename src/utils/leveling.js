// Experience and level advancement (levels 1 to 20, D&D 2024 rules / SRD 5.2).
// Pure functions: the level-up dialog builds a `choices` object and these
// functions validate it and apply it to the character sheet.

import {
  MAX_LEVEL, XP_FOR_LEVEL, PROFICIENCY_BY_LEVEL, ASI_LEVELS_BY_CLASS, SUBCLASS_LEVEL, SUBCLASSES, CLASS_FEATURES,
  SPELL_PROGRESSION, EPIC_BOON_LEVEL, EPIC_BOONS, FEATURE_INFO
} from '../data/progression';
import { ABILITIES, MAX_ABILITY_SCORE } from '../data/srd';

/** An Epic Boon can push one ability score up to 30. */
export const EPIC_MAX_ABILITY_SCORE = 30;

/** Short description of a class or subclass feature (empty if unknown). */
export const featureInfo = name => FEATURE_INFO?.[name] || '';
import { getClass, getSpecies, abilityModifier } from './characterBuilder';
import { normalizeEquipment } from './equipment';
import { characterLevel } from './characterLevel';
import { spellsFor, slotsForLevel, slotTable, maxSlotLevel, getSpell } from './spellcasting';

const ABILITY_IDS = ABILITIES.map(a => a.id);

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

export const levelOf = character => characterLevel(character);
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
    // Warlocks: one Mystic Arcanum spell (6th-9th level) at levels 11, 13, 15 and 17
    const arcanumLevel = progression.mysticArcanum?.[level] || null;
    spells = {
      list: cls.id,
      ability: known[0]?.ability || null,
      cantrips: Math.max(0, progression.cantrips[level - 1] - knownCantrips),
      spells: Math.max(0, targetSpells - knownSpells.length),
      prepared: isWizard ? progression.prepared[level - 1] : null,
      maxSpellLevel: maxSlotLevel({ slots }),
      arcanumLevel,
      slotsBefore: slotTable(character.spellcasting),
      slotsAfter: slotTable({ slots })
    };
  }

  const subclassData = SUBCLASSES[cls.id];
  const subclass = level === SUBCLASS_LEVEL ? subclassData : null;
  // Features of the subclass the hero already has (or gets now)
  const subclassFeatures = level >= SUBCLASS_LEVEL ? subclassData?.features?.[level] || [] : [];
  const asi = (ASI_LEVELS_BY_CLASS[cls.id] || []).includes(level);
  const epicBoon = level === EPIC_BOON_LEVEL;

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
      ...subclassFeatures,
      ...(CLASS_FEATURES[cls.id]?.[level] || []),
      ...(asi ? ['Mejora de Característica'] : []),
      ...(epicBoon ? ['Don Épico'] : [])
    ],
    subclass,
    asi,
    epicBoon,
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
 * - spells: { cantrips: [id], spells: [id], prepared: [id], arcanum: id | null } — prepared
 *   lists every spellbook spell a wizard wants ready (old and new); arcanum is the
 *   warlock's Mystic Arcanum spell
 * - boon: { id, ability } — Epic Boon at level 19 (+1 to an ability, up to 30)
 */
export function emptyLevelUpChoices(character) {
  const prepared = (character.spellcasting?.known || []).filter(k => k.prepared && getSpell(k.id)?.level > 0 && !k.freeCast).map(k => k.id);
  return {
    hp: { method: 'average', roll: null },
    asi: { mode: 'two', abilities: [] },
    spells: { cantrips: [], spells: [], prepared, arcanum: null },
    boon: { id: null, ability: null }
  };
}

/** Spells the hero can learn at the new level, by spell level (known ones excluded). */
export function learnableSpells(character, plan, level) {
  if (!plan.spells) return [];
  const isArcanum = level === plan.spells.arcanumLevel;
  if (level > plan.spells.maxSpellLevel && !isArcanum) return [];
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

  if (plan.epicBoon) {
    const { id, ability } = choices.boon || {};
    if (!EPIC_BOONS.some(b => b.id === id)) issues.push('Elige tu Don Épico.');
    else if (!ability || character.stats[ability] + 1 > EPIC_MAX_ABILITY_SCORE) issues.push('Elige qué característica mejora tu Don Épico.');
  }

  if (plan.spells?.arcanumLevel) {
    const options = new Set(learnableSpells(character, plan, plan.spells.arcanumLevel).map(s => s.id));
    if (!options.has(choices.spells.arcanum)) issues.push(`Elige tu Arcano Místico de nivel ${plan.spells.arcanumLevel}.`);
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
  const bonuses = plan.asi ? { ...asiBonuses(choices) } : {};
  const boon = plan.epicBoon ? EPIC_BOONS.find(b => b.id === choices.boon.id) : null;
  const caps = Object.fromEntries(ABILITY_IDS.map(id => [id, MAX_ABILITY_SCORE]));
  if (boon) {
    bonuses[choices.boon.ability] = (bonuses[choices.boon.ability] || 0) + 1;
    caps[choices.boon.ability] = EPIC_MAX_ABILITY_SCORE;
  }
  const stats = Object.fromEntries(ABILITY_IDS.map(id => [
    id,
    Math.min(Math.max(caps[id], character.stats[id]), character.stats[id] + (bonuses[id] || 0))
  ]));
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
    if (choices.spells.arcanum) {
      additions.push({
        id: choices.spells.arcanum, source: 'Arcano Místico', sourceKey: 'arcanum', ability, prepared: true, freeCast: true
      });
    }
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
    // Armor Class (armor, Dexterity, Unarmored Defense, shield) is recomputed by normalizeEquipment
    subclass: plan.subclass ? plan.subclass.name : character.subclass || null,
    classFeatures: [
      ...(character.classFeatures || []),
      ...plan.features.filter(f => f !== 'Mejora de Característica' && f !== 'Don Épico' && f !== plan.subclass?.name),
      ...(boon ? [boon.name] : [])
    ],
    spellcasting
  };

  return {
    character: normalizeEquipment(next),
    summary: { level, hpGain: gained, features: plan.features.filter(f => f !== 'Don Épico').concat(boon ? [boon.name] : []), learned, asi: bonuses }
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

// ---------------------------------------------------------------------------
// Quick level ups (combat simulator, companions who join the party)
// ---------------------------------------------------------------------------

/** Valid choices for the next level, picked the way a hurried player would. */
export function quickLevelUpChoices(character) {
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
        ...(character.spellcasting?.known || []).filter(k => k.sourceKey === 'class' && getSpell(k.id)?.level > 0).map(k => k.id)
      ];
      choices.spells.prepared = [...new Set(book)].slice(0, plan.spells.prepared);
    }
  }
  return choices;
}

/**
 * The hero raised to `target` level with quick choices (only heroes made with
 * the creation wizard can level up; a lower target leaves the hero as is).
 * HP stay as full as they were.
 */
export function levelHeroTo(character, target) {
  const goal = Math.min(MAX_LEVEL, Math.max(1, Math.round(Number(target) || 1)));
  if (!canAdvance(character)) return character;
  let hero = character;
  const wasFull = hero.hp >= hero.maxHp;
  while ((hero.level || 1) < goal) {
    const next = (hero.level || 1) + 1;
    hero = { ...hero, xp: Math.max(Number(hero.xp) || 0, XP_FOR_LEVEL[next]) };
    const choices = quickLevelUpChoices(hero);
    if (levelUpIssues(hero, levelUpPlan(hero), choices).length) break;
    hero = applyLevelUp(hero, choices).character;
  }
  return wasFull ? { ...hero, hp: hero.maxHp } : hero;
}

