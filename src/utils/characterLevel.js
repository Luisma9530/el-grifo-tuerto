// The level of a hero, also for older saves that have no `level` field.
// Pure functions, no dependencies on other utils (equipment and leveling use them).

import { XP_FOR_LEVEL, MAX_LEVEL } from '../data/progression';

const clampLevel = n => Math.min(MAX_LEVEL, Math.max(1, Math.round(n)));

/**
 * The hero's real level, read from what the sheet has, in this order:
 *  1. the `level` field (heroes made with the creation wizard);
 *  2. the level in the class text of older heroes: "Paladín (Nivel 3)";
 *  3. the experience points (the highest level its XP reaches), when there are any;
 *  4. level 1 as the last resort.
 */
export function characterLevel(character) {
  const field = Number(character?.level);
  if (Number.isFinite(field) && field >= 1) return clampLevel(field);
  const match = String(character?.class || '').match(/\(\s*Nivel\s*(\d+)\s*\)/i);
  if (match) return clampLevel(Number(match[1]));
  const xp = Number(character?.xp);
  if (Number.isFinite(xp) && xp > 0) {
    return Object.entries(XP_FOR_LEVEL).reduce((lvl, [l, need]) => (xp >= need ? Math.max(lvl, Number(l)) : lvl), 1);
  }
  return 1;
}

/** The sheet with a valid `level` field (unchanged when it already has one). */
export function withLevel(character) {
  if (!character || typeof character !== 'object') return character;
  const level = characterLevel(character);
  return character.level === level ? character : { ...character, level };
}
