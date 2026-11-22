// A player who joins an online room with no character of their own creates one
// with the same creation wizard. What travels is the wizard's draft (the choices),
// never a finished sheet: the host builds the sheet itself with characterBuilder,
// so ability scores, skills, spells and starting equipment follow the rules.
//
// - Ability scores "standard" and "point buy" are checked by the rules as they are.
//   With "roll" (4d6) the host rolls the six values itself and gives them out in the
//   order the player chose (their highest value goes to their highest ability...),
//   so nobody can send a pool of 18s.
// - The hero joins at the party's level (like the story's companions, see recruit.js)
//   with full hit points and the experience of that level.
// - Gold: like companions, the hero brings no starting gold to the common purse
//   (the purse is shared from the first moment, and joining, leaving and joining
//   again can't be used to fill it).

import { ABILITIES, AVATARS, LANGUAGES } from '../data/srd';
import { XP_FOR_LEVEL } from '../data/progression';
import { sanitizeDraft, stepIssues, buildCharacter, rollAbilityScore, emptyDraft } from '../utils/characterBuilder';
import { levelHeroTo } from '../utils/leveling';
import { newMemberId } from '../utils/party';

export const MAX_BACKSTORY = 1200;
const ABILITY_IDS = ABILITIES.map(a => a.id);
const METHODS = ['standard', 'pointbuy', 'roll'];

const isId = v => typeof v === 'string' && v.length <= 60 && /^[\w:.-]+$/.test(v);
const optId = v => (v == null ? null : isId(v) ? v : undefined);
const ids = (v, max) => (Array.isArray(v) && v.length <= max && v.every(isId) ? [...v] : null);
// eslint-disable-next-line no-control-regex -- control characters are what it removes
const text = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').slice(0, max) : '');

/**
 * A draft from the network with only the wizard's fields and the right types.
 * @returns {object|null} null when something has the wrong shape
 */
export function cleanDraft(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const single = ['classId', 'backgroundId', 'speciesId', 'speciesOption', 'extraFeatId'].map(k => [k, optId(raw[k])]);
  if (single.some(([, v]) => v === undefined)) return null;
  if (!METHODS.includes(raw.method)) return null;
  const scores = raw.baseScores && typeof raw.baseScores === 'object' ? raw.baseScores : null;
  if (!scores) return null;
  const baseScores = {};
  for (const id of ABILITY_IDS) {
    const v = scores[id];
    if (v != null && !(Number.isInteger(v) && v >= 3 && v <= 20)) return null;
    baseScores[id] = v ?? null;
  }
  const bonus = raw.bonus && typeof raw.bonus === 'object' ? raw.bonus : {};
  if (!['twoOne', 'allOne'].includes(bonus.mode)) return null;
  if ((bonus.plus2 != null && !ABILITY_IDS.includes(bonus.plus2)) || (bonus.plus1 != null && !ABILITY_IDS.includes(bonus.plus1))) return null;
  const classSkills = ids(raw.classSkills ?? [], 8);
  const speciesSkills = ids(raw.speciesSkills ?? [], 4);
  if (!classSkills || !speciesSkills) return null;
  const spellsIn = raw.spells && typeof raw.spells === 'object' && !Array.isArray(raw.spells) ? raw.spells : {};
  const keys = Object.keys(spellsIn);
  if (keys.length > 6 || !keys.every(isId)) return null;
  const spells = {};
  for (const key of keys) {
    const s = spellsIn[key] || {};
    const cantrips = ids(s.cantrips ?? [], 10);
    const chosen = ids(s.spells ?? [], 12);
    const prepared = ids(s.prepared ?? [], 12);
    if (!cantrips || !chosen || !prepared) return null;
    spells[key] = { cantrips, spells: chosen, prepared };
  }
  const languages = Array.isArray(raw.languages) && raw.languages.length <= 4 && raw.languages.every(l => LANGUAGES.includes(l)) ? [...raw.languages] : null;
  if (!languages) return null;
  return {
    ...emptyDraft(),
    ...Object.fromEntries(single),
    method: raw.method,
    baseScores,
    rolledPool: null,
    bonus: { mode: bonus.mode, plus2: bonus.plus2 ?? null, plus1: bonus.plus1 ?? null },
    classSkills,
    speciesSkills,
    spells,
    name: text(raw.name, 40),
    avatar: AVATARS.includes(raw.avatar) ? raw.avatar : AVATARS[0],
    alignment: text(raw.alignment, 40),
    languages,
    backstory: text(raw.backstory, MAX_BACKSTORY)
  };
}

/**
 * With rolled scores, the host's own 4d6 for each ability: the values are given
 * out in the order of the player's assignment (ties keep the order of the abilities).
 */
export function rerollScores(draft, rollD6) {
  if (draft.method !== 'roll') return draft;
  const pool = ABILITY_IDS.map(() => rollAbilityScore(rollD6).total).sort((a, b) => b - a);
  const ranked = [...ABILITY_IDS].sort((a, b) => (draft.baseScores[b] ?? 0) - (draft.baseScores[a] ?? 0));
  const baseScores = Object.fromEntries(ranked.map((id, i) => [id, pool[i]]));
  return { ...draft, rolledPool: [...pool], baseScores };
}

/**
 * The sheet of a player's new character, built by the host.
 * @param {{ level: number, rollD6: () => number, id?: string }} options
 * @returns {{ ok: true, character, rolled: number[]|null } | { ok: false, error }}
 */
export function buildPlayerHero(rawDraft, { level = 1, rollD6, id = newMemberId() } = {}) {
  const clean = cleanDraft(rawDraft);
  if (!clean) return { ok: false, error: 'La ficha que llegó no es válida.' };
  const draft = sanitizeDraft(rerollScores(clean, rollD6));
  const issues = Object.values(stepIssues(draft)).flat();
  if (issues.length) return { ok: false, error: `El personaje no cumple las reglas: ${issues[0]}` };
  let sheet;
  try {
    sheet = buildCharacter(draft, { id });
  } catch (err) {
    return { ok: false, error: err?.message || 'No se pudo crear el personaje.' };
  }
  const target = Math.max(1, Math.round(Number(level) || 1));
  const leveled = levelHeroTo(sheet, target);
  return {
    ok: true,
    rolled: draft.method === 'roll' ? draft.rolledPool : null,
    character: {
      ...leveled,
      hp: leveled.maxHp,
      xp: Math.max(Number(leveled.xp) || 0, XP_FOR_LEVEL[leveled.level] || 0),
      gold: 0,
      joinedBy: 'player'
    }
  };
}
