// Ability checks outside combat: how hard they are (Difficulty Class, DC) and who
// is on the other side. Pure functions: no network, no storage, no React.
//
// · The 2024 rules give the DC by how hard the task is (DC_SCALE): 5 very easy,
//   10 easy, 15 medium, 20 hard, 25 very hard, 30 nearly impossible.
// · Duncan (Gemini) sets the DC for each situation in his reply ("prueba", see
//   cleanCheckRequest); the game rolls the d20 and compares (resolveCheck).
// · When someone resists (lying to a guard, sneaking past a sentry, grappling a
//   thug), the check is opposed: the creature of the bestiary with its own sheet,
//   or a simple NPC profile (NPC_PROFILES: child, guard, scholar, noble...).
// · Without the AI, the local engine picks the DC from a table of actions
//   (LOCAL_DC_TABLE) and the words of the action and the scene (CONTEXT_MODIFIERS).

import { SKILLS, ABILITIES } from '../data/srd';
import { skillModifier, abilityModifier } from './characterBuilder';
import { checkModifiers } from './conditions';

// ---------------------------------------------------------------------------
// The scale
// ---------------------------------------------------------------------------

/** Typical DCs of the 2024 rules. */
export const DC_SCALE = [
  { dc: 5, name: 'muy fácil' },
  { dc: 10, name: 'fácil' },
  { dc: 15, name: 'media' },
  { dc: 20, name: 'difícil' },
  { dc: 25, name: 'muy difícil' },
  { dc: 30, name: 'casi imposible' }
];
export const DC_MIN = 5;
export const DC_MAX = 30;
/** When nobody knows how hard it is: a medium task. */
export const DEFAULT_DC = 15;

/** A DC within 5-30 (rounded), or null when the value is not a number. */
export function clampDC(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return null;
  return Math.min(DC_MAX, Math.max(DC_MIN, n));
}

/** The name of the band a DC falls in: 14 -> 'media' (the nearest typical DC). */
export function dcBand(dc) {
  const n = Number(dc);
  let best = DC_SCALE[0];
  DC_SCALE.forEach(step => { if (Math.abs(step.dc - n) < Math.abs(best.dc - n) || (Math.abs(step.dc - n) === Math.abs(best.dc - n) && step.dc > best.dc)) best = step; });
  return best.name;
}

// ---------------------------------------------------------------------------
// Skills and abilities by name
// ---------------------------------------------------------------------------

const fold = text => String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Every name Duncan may give a check: the 18 skills and the 6 abilities, in Spanish. */
export const CHECK_NAMES = [...SKILLS.map(s => s.name), ...ABILITIES.map(a => a.name)];

/**
 * A skill or ability from its Spanish name or id ("Engaño", "engano", "deception",
 * "Fuerza", "fue"). Returns { skillId, ability, label } or null.
 */
export function findCheck(name) {
  const key = fold(name);
  if (!key) return null;
  const skill = SKILLS.find(s => fold(s.name) === key || fold(s.id) === key);
  if (skill) return { skillId: skill.id, ability: skill.ability, label: skill.name };
  const ability = ABILITIES.find(a => fold(a.name) === key || a.id === key || fold(a.short) === key);
  if (ability) return { skillId: null, ability: ability.id, label: ability.name };
  return null;
}

const skillName = id => SKILLS.find(s => s.id === id)?.name || id;
const skillAbility = id => SKILLS.find(s => s.id === id)?.ability || null;

// ---------------------------------------------------------------------------
// Who is on the other side
// ---------------------------------------------------------------------------

/**
 * Opposed checks: the skill of whoever acts -> what the other side rolls (the best
 * of the list), and whether it is a passive score (10 + bonus, no roll).
 *  · Deceiving, persuading or intimidating someone: their Insight (Perspicacia).
 *  · Hiding or picking a pocket: their passive Perception (they are not searching).
 *  · Grappling, shoving or slipping free: their Athletics or Acrobatics.
 *  · Seeing through a lie: their Deception; spotting someone hidden: their Stealth.
 */
export const OPPOSED_SKILLS = {
  deception: { skills: ['insight'] },
  persuasion: { skills: ['insight'] },
  intimidation: { skills: ['insight'] },
  performance: { skills: ['insight'] },
  stealth: { skills: ['perception'], passive: true },
  sleightOfHand: { skills: ['perception'], passive: true },
  athletics: { skills: ['athletics', 'acrobatics'] },
  acrobatics: { skills: ['athletics', 'acrobatics'] },
  insight: { skills: ['deception'] },
  perception: { skills: ['stealth'] }
};

/**
 * Simple NPC profiles Duncan (or the local engine) can name for an opposed check.
 * Ability scores in the usual 3-18 range; `skills` are the bonuses that differ from
 * the plain ability modifier (proficiency of the trade). Based on the SRD stat blocks
 * where one exists (Plebeyo, Guardia, Bandido, Noble, Sacerdote, Espía, Veterano).
 *
 * | perfil    | Perspicacia | Percepción (pasiva) | Atletismo | CA |
 * |-----------|-------------|---------------------|-----------|----|
 * | niño      | −1          | +1 (11)             | −2        | 10 |
 * | borracho  | −2          | −2 (8)              | +0        | 10 |
 * | plebeyo   | +0          | +0 (10)             | +0        | 10 |
 * | anciano   | +4          | +0 (10)             | −1        | 10 |
 * | guardia   | +0          | +2 (12)             | +3        | 16 |
 * | soldado   | +2          | +2 (12)             | +5        | 17 |
 * | bandido   | +0          | +0 (10)             | +2        | 12 |
 * | mercader  | +4          | +1 (11)             | +0        | 10 |
 * | erudito   | +5          | +2 (12)             | −1        | 10 |
 * | noble     | +4          | +2 (12)             | +0        | 15 |
 * | sacerdote | +5          | +3 (13)             | +0        | 13 |
 * | espía     | +4          | +6 (16)             | +0        | 12 |
 */
export const NPC_PROFILES = {
  nino: {
    label: 'niño', of: 'del niño', ac: 10,
    stats: { fue: 6, des: 12, con: 10, int: 8, sab: 8, car: 10 },
    skills: { perception: 1 },
    words: ['nino', 'nina', 'ninos', 'ninas', 'crio', 'cria', 'chiquillo', 'chiquilla', 'chaval', 'chavala', 'mocoso', 'mocosa', 'muchacho', 'muchacha', 'zagal']
  },
  borracho: {
    label: 'borracho', of: 'del borracho', ac: 10,
    stats: { fue: 10, des: 8, con: 12, int: 8, sab: 6, car: 10 },
    skills: {},
    words: ['borracho', 'borracha', 'borrachos', 'ebrio', 'ebria', 'beodo']
  },
  plebeyo: {
    label: 'plebeyo', of: 'del plebeyo', ac: 10,
    stats: { fue: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 },
    skills: {},
    words: ['plebeyo', 'plebeya', 'campesino', 'campesina', 'aldeano', 'aldeana', 'aldeanos', 'granjero', 'granjera', 'pescador', 'pescadora', 'posadero', 'posadera', 'parroquiano', 'parroquiana', 'mozo', 'moza', 'criado', 'criada', 'pastor', 'pastora', 'lenador']
  },
  anciano: {
    label: 'anciano', of: 'del anciano', ac: 10,
    stats: { fue: 8, des: 8, con: 9, int: 12, sab: 14, car: 11 },
    skills: { insight: 4 },
    words: ['anciano', 'anciana', 'ancianos', 'abuelo', 'abuela']
  },
  guardia: {
    label: 'guardia', of: 'del guardia', ac: 16,
    stats: { fue: 13, des: 12, con: 12, int: 10, sab: 11, car: 10 },
    skills: { perception: 2, athletics: 3 },
    words: ['guardia', 'guardias', 'centinela', 'centinelas', 'vigilante', 'vigilantes', 'guarda', 'carcelero', 'carcelera', 'portero', 'portera', 'alguacil']
  },
  soldado: {
    label: 'soldado', of: 'del soldado', ac: 17,
    stats: { fue: 16, des: 13, con: 14, int: 10, sab: 11, car: 10 },
    skills: { perception: 2, athletics: 5, insight: 2 },
    words: ['soldado', 'soldados', 'veterano', 'veterana', 'sargento', 'capitan', 'capitana', 'oficial', 'caballero', 'mercenario', 'mercenaria']
  },
  bandido: {
    label: 'bandido', of: 'del bandido', ac: 12,
    stats: { fue: 15, des: 12, con: 12, int: 10, sab: 10, car: 11 },
    skills: { athletics: 2, intimidation: 2 },
    words: ['bandido', 'bandida', 'bandidos', 'maton', 'matona', 'matones', 'rufian', 'forajido', 'forajida', 'salteador', 'ladron', 'ladrona', 'pirata', 'contrabandista', 'matasietes']
  },
  mercader: {
    label: 'mercader', of: 'del mercader', ac: 10,
    stats: { fue: 10, des: 10, con: 10, int: 12, sab: 12, car: 14 },
    skills: { insight: 4, persuasion: 4, deception: 4 },
    words: ['mercader', 'mercaderes', 'comerciante', 'tendero', 'tendera', 'vendedor', 'vendedora', 'buhonero', 'buhonera', 'prestamista', 'usurero', 'tratante']
  },
  erudito: {
    label: 'erudito', of: 'del erudito', ac: 10,
    stats: { fue: 8, des: 10, con: 10, int: 16, sab: 14, car: 10 },
    skills: { insight: 5, perception: 2, investigation: 5, history: 5, arcana: 5 },
    words: ['erudito', 'erudita', 'sabio', 'sabia', 'bibliotecario', 'bibliotecaria', 'archivero', 'archivera', 'profesor', 'profesora', 'maestro', 'maestra', 'estudioso', 'estudiosa', 'escriba', 'alquimista', 'astrologo', 'astrologa', 'mago', 'maga']
  },
  noble: {
    label: 'noble', of: 'del noble', ac: 15,
    stats: { fue: 11, des: 12, con: 11, int: 12, sab: 14, car: 16 },
    skills: { insight: 4, perception: 2, deception: 5, persuasion: 5 },
    words: ['noble', 'nobles', 'aristocrata', 'conde', 'condesa', 'baron', 'baronesa', 'duque', 'duquesa', 'marques', 'marquesa', 'lord', 'lady', 'dama', 'principe', 'princesa', 'rey', 'reina', 'consejero', 'consejera', 'magistrado', 'magistrada', 'alcalde', 'alcaldesa']
  },
  sacerdote: {
    label: 'sacerdote', of: 'del sacerdote', ac: 13,
    stats: { fue: 10, des: 10, con: 12, int: 13, sab: 16, car: 13 },
    skills: { insight: 5, medicine: 7, religion: 5, persuasion: 5 },
    words: ['sacerdote', 'sacerdotisa', 'clerigo', 'cleriga', 'monje', 'monja', 'acolito', 'acolita', 'parroco', 'fraile', 'abad', 'abadesa', 'druida']
  },
  espia: {
    label: 'espía', of: 'del espía', ac: 12,
    stats: { fue: 10, des: 15, con: 10, int: 12, sab: 14, car: 16 },
    skills: { insight: 4, perception: 6, deception: 5, investigation: 5, sleightOfHand: 5, stealth: 6 },
    words: ['espia', 'espias', 'informante', 'agente', 'chivato', 'chivata', 'asesino', 'asesina']
  }
};
export const NPC_PROFILE_IDS = Object.keys(NPC_PROFILES);

/** A profile id from what Duncan wrote: "erudito", "Niño", "espía" -> 'erudito', 'nino', 'espia'. */
export function findProfile(name) {
  const key = fold(name);
  if (!key) return null;
  if (NPC_PROFILES[key]) return key;
  return NPC_PROFILE_IDS.find(id => fold(NPC_PROFILES[id].label) === key || NPC_PROFILES[id].words.includes(key)) || null;
}

const wordsOf = text => fold(text).split(/[^a-z0-9ñ]+/).filter(Boolean);

/**
 * The first NPC profile a text mentions ("engaño al erudito de la biblioteca"):
 * { profile, index } or null.
 */
export function detectProfile(text) {
  const words = wordsOf(text);
  for (let i = 0; i < words.length; i++) {
    const id = NPC_PROFILE_IDS.find(p => NPC_PROFILES[p].words.includes(words[i]));
    if (id) return id;
  }
  return null;
}

/**
 * Skill bonuses of the SRD creatures that have them (the stat blocks of this game
 * keep only what combat needs). Any other skill: the plain ability modifier.
 */
export const CREATURE_SKILLS = {
  guard: { perception: 2 },
  scout: { nature: 4, perception: 5, stealth: 6, survival: 5 },
  spy: { deception: 5, insight: 4, investigation: 5, perception: 6, sleightOfHand: 5, stealth: 6 },
  cultist: { deception: 2, religion: 2 },
  priestAcolyte: { medicine: 4, religion: 2 },
  wolf: { perception: 5, stealth: 4 },
  direWolf: { perception: 5, stealth: 4 },
  worg: { perception: 4 },
  goblinMinion: { stealth: 6 },
  goblinWarrior: { stealth: 6 },
  goblinBoss: { stealth: 6 },
  bugbearWarrior: { stealth: 6, survival: 2 },
  giantSpider: { perception: 4, stealth: 7 },
  giantWolfSpider: { perception: 3, stealth: 7 },
  blackBear: { perception: 5 },
  brownBear: { perception: 5 },
  shadow: { stealth: 6 },
  imp: { deception: 4, insight: 3, stealth: 5 },
  harpy: { performance: 3 },
  warriorInfantry: { perception: 2 },
  koboldWarrior: { perception: 2 }
};

/**
 * Who resists a check, as the game uses it:
 * { kind: 'profile' | 'creature', id, name, of, stats, skills, saves, ac }.
 * `name` (optional): what Duncan calls them ("Albus", "el capitán Vargas").
 */
export function profileOpponent(id, name = '') {
  const p = NPC_PROFILES[id];
  if (!p) return null;
  const own = cleanName(name);
  return { kind: 'profile', id, name: own || p.label, of: own ? `de ${own}` : p.of, stats: p.stats, skills: p.skills, saves: {}, ac: p.ac };
}

export function creatureOpponent(monster, name = '') {
  if (!monster) return null;
  const own = cleanName(name) || monster.name;
  return {
    kind: 'creature', id: monster.id, name: own, of: `de ${cleanName(name) || monster.name.toLowerCase()}`,
    stats: monster.stats || {}, skills: CREATURE_SKILLS[monster.id] || monster.skills || {}, saves: monster.saves || {}, ac: monster.ac
  };
}

const cleanName = name => (typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').slice(0, 40) : '');

/** An opponent's bonus for a skill: its own bonus, or the plain ability modifier. */
export function opponentSkillBonus(opponent, skillId) {
  const own = opponent?.skills?.[skillId];
  if (Number.isFinite(own)) return own;
  return abilityModifier(opponent?.stats?.[skillAbility(skillId)] ?? 10);
}

/** An opponent's saving throw bonus: its own, or the plain ability modifier. */
export function opponentSaveBonus(opponent, ability) {
  const own = opponent?.saves?.[ability];
  if (Number.isFinite(own)) return own;
  return abilityModifier(opponent?.stats?.[ability] ?? 10);
}

/** Passive score (10 + bonus): passive Perception is 10 + Wisdom when nothing else is known. */
export const passiveScore = (opponent, skillId) => 10 + opponentSkillBonus(opponent, skillId);

/**
 * Who an attack or a spell points at, from the player's words ("el guardia",
 * "el lobo de la colina"): an NPC profile first, then a creature of the bestiary
 * by its Spanish name. Null when nothing is recognised.
 */
export function opponentFromText(text, monsters = []) {
  const profile = detectProfile(text);
  if (profile) return profileOpponent(profile);
  const words = wordsOf(text);
  const monster = (monsters || []).find(m => {
    const name = wordsOf(m.name);
    return name.length && name.every(w => words.includes(w) || words.includes(`${w}s`) || words.includes(`${w}es`));
  });
  return monster ? creatureOpponent(monster) : null;
}

/**
 * The opponent of a check Duncan describes: { criatura, perfil, nombre }.
 * `getMonster(id)` looks the creature up in the bestiary (when loaded).
 */
export function resolveOpponent(ref, { getMonster = null } = {}) {
  if (!ref) return null;
  const monster = ref.creature && getMonster ? getMonster(ref.creature) : null;
  if (monster) return creatureOpponent(monster, ref.name);
  const profile = ref.profile || detectProfile(ref.name);
  if (profile) return profileOpponent(profile, ref.profile ? ref.name : '');
  return null;
}

// ---------------------------------------------------------------------------
// Duncan's "prueba"
// ---------------------------------------------------------------------------

/**
 * Validate the check Duncan asks for in his reply:
 * { habilidad, cd, contra: { perfil, criatura, nombre, habilidad }, exito, fallo }.
 * The skill (or ability) must be one of CHECK_NAMES; the DC is clamped to 5-30
 * (15 when missing); `contra` is kept only if it names a profile, a creature id
 * or a name. The two outcomes (exito / fallo) are returned raw: dmPrompt cleans
 * their numbers. Null when the reply has no usable check.
 * @returns {{ skillId, ability, label, dc, against: { profile, creature, name, skillId } | null, success, failure } | null}
 */
export function cleanCheckRequest(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const check = findCheck(raw.habilidad) || findCheck(raw.caracteristica);
  if (!check) return null;
  const dc = clampDC(raw.cd) ?? DEFAULT_DC;
  const contra = raw.contra && typeof raw.contra === 'object' ? raw.contra : null;
  let against = null;
  if (contra) {
    const profile = findProfile(contra.perfil);
    const creature = typeof contra.criatura === 'string' && /^[a-zA-Z][a-zA-Z0-9]{1,40}$/.test(contra.criatura.trim()) ? contra.criatura.trim() : null;
    const name = cleanName(contra.nombre);
    const opposedSkill = findCheck(contra.habilidad)?.skillId || null;
    if (profile || creature || name) against = { profile, creature, name, skillId: opposedSkill };
  }
  const branch = value => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
  return { ...check, dc, against, success: branch(raw.exito), failure: branch(raw.fallo) };
}

// ---------------------------------------------------------------------------
// Rolling
// ---------------------------------------------------------------------------

const sign = n => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

/** Ability check bonus of a hero: skill (with proficiency) or plain ability. */
export function heroCheckBonus(character, { skillId = null, ability = null } = {}) {
  if (skillId) return skillModifier(character, skillId);
  return abilityModifier(character?.stats?.[ability] ?? 10);
}

/**
 * Roll a check of a hero and compare it: against a DC, or against an opponent
 * (opposed roll, or their passive score for Stealth and Sleight of Hand).
 * Conditions and armor give Advantage / Disadvantage as in the rest of the game
 * (checkModifiers). A natural 20 always succeeds and a natural 1 always fails, as
 * every other check of the game. In an opposed roll a tie keeps things as they
 * are: whoever acts fails.
 * @param {object} p
 * @param {object} p.character
 * @param {string} [p.skillId] / [p.ability]
 * @param {number} [p.dc]          DC when nobody resists (default 15)
 * @param {object} [p.opponent]    see profileOpponent / creatureOpponent
 * @param {string} [p.opposedSkill] what the opponent rolls (default OPPOSED_SKILLS)
 * @param {function} p.rollDie     sides -> number
 * @returns {object} { skillId, ability, label, rawRoll, rolls, modifier, total, dc, dcName,
 *                     versus, success, isNat20, isNat1, advantage, disadvantage, text, tag }
 */
export function resolveCheck({ character, skillId = null, ability = null, label = '', dc = DEFAULT_DC, opponent = null, opposedSkill = null, rollDie }) {
  const abilityId = ability || skillAbility(skillId) || 'sab';
  const name = label || (skillId ? skillName(skillId) : ABILITIES.find(a => a.id === abilityId)?.name || 'Prueba');
  const mods = checkModifiers(character || {}, { ability: abilityId, skillId });
  const both = mods.advantage.length > 0 && mods.disadvantage.length > 0;
  const advantage = both ? [] : mods.advantage;
  const disadvantage = both ? [] : mods.disadvantage;
  const first = rollDie(20);
  const twoDice = advantage.length > 0 || disadvantage.length > 0;
  const second = twoDice ? rollDie(20) : null;
  const rawRoll = !twoDice ? first : disadvantage.length ? Math.min(first, second) : Math.max(first, second);
  const modifier = heroCheckBonus(character, { skillId, ability: abilityId }) - (mods.penalty || 0);
  const total = rawRoll + modifier;
  const isNat20 = rawRoll === 20;
  const isNat1 = rawRoll === 1;

  // Who resists, and with what
  const rule = OPPOSED_SKILLS[skillId];
  const vsSkill = opponent && (opposedSkill || (rule ? bestSkill(opponent, rule.skills) : null));
  let versus = null;
  let target = clampDC(dc) ?? DEFAULT_DC;
  if (opponent && vsSkill) {
    const bonus = opponentSkillBonus(opponent, vsSkill);
    const passive = !opposedSkill && Boolean(rule?.passive);
    const raw = passive ? null : rollDie(20);
    const vsTotal = passive ? 10 + bonus : raw + bonus;
    versus = { name: opponent.name, of: opponent.of, kind: opponent.kind, id: opponent.id, skillId: vsSkill, label: skillName(vsSkill), bonus, raw, total: vsTotal, passive };
    // Beating them means going over their total (a tie keeps things as they are)
    target = vsTotal + 1;
  }
  const success = isNat20 ? true : isNat1 ? false : total >= target;
  const mode = disadvantage.length ? ` con desventaja (${disadvantage.join(', ')})` : advantage.length ? ` con ventaja (${advantage.join(', ')})` : '';
  const against = versus
    ? `${versus.label}${versus.passive ? ' pasiva' : ''} ${versus.of} ${versus.total}`
    : `CD ${target} (${dcBand(target)})`;
  const text = `${name} ${total} contra ${against}`;
  const tag = `[🎲 ${name}${mode} D20: **${rawRoll}** ${sign(modifier)} = ${total} contra ${against}${versus && !versus.passive ? ` (D20: ${versus.raw} ${sign(versus.bonus)})` : ''}]`;
  return {
    skillId, ability: abilityId, label: name, rawRoll, rolls: twoDice ? [first, second] : [first], modifier, total,
    dc: versus ? null : target, dcName: versus ? null : dcBand(target), versus, against,
    success, isNat20, isNat1, advantage, disadvantage, text, tag
  };
}

function bestSkill(opponent, skills) {
  return skills.reduce((best, id) => (opponentSkillBonus(opponent, id) > opponentSkillBonus(opponent, best) ? id : best), skills[0]);
}

export const UNKNOWN_SAVE_BONUS = 1;

/**
 * A creature's saving throw against a hero's spell (outside combat): 8 +
 * proficiency + spellcasting ability is the caster's DC (cast.saveDC); the target
 * rolls with its own bonus when it is known (bestiary or NPC profile), +1 otherwise.
 * @returns {{ raw, bonus, total, dc, success, name, of, known, text }}
 */
export function rollTargetSave({ opponent = null, ability, dc, rollDie }) {
  const raw = rollDie(20);
  const known = Boolean(opponent);
  const bonus = known ? opponentSaveBonus(opponent, ability) : UNKNOWN_SAVE_BONUS;
  const total = raw + bonus;
  const success = raw !== 1 && (raw === 20 || total >= dc);
  const of = known ? opponent.of : 'del objetivo';
  return { raw, bonus, total, dc, success, name: known ? opponent.name : '', of, known, text: `salvación ${of}: ${raw} ${sign(bonus)} = ${total} vs CD ${dc}${known ? '' : ' (sin datos del objetivo: +1)'}` };
}

/** Armor Class a spell attack is compared against outside combat (12 when unknown). */
export const UNKNOWN_TARGET_AC = 12;
export const targetAC = opponent => (Number.isFinite(opponent?.ac) ? opponent.ac : UNKNOWN_TARGET_AC);

// ---------------------------------------------------------------------------
// The local engine (no AI): DC by kind of action and context
// ---------------------------------------------------------------------------

/**
 * Base DC by kind of action. `words`: stems looked for in the action (without
 * accents). The first row that matches wins, so the more specific ones go first.
 * Documented in the pull request; it does not try to cover every situation.
 */
export const LOCAL_DC_TABLE = [
  { id: 'lock', label: 'forzar una cerradura', ability: 'des', checkLabel: 'Destreza (ganzúas)', dc: 15, words: ['cerradura', 'ganzua', 'candado', 'forzar el cofre', 'abrir el cofre'] },
  { id: 'pickpocket', label: 'robar sin que se note', skillId: 'sleightOfHand', dc: 15, words: ['robar', 'bolsillo', 'birlar', 'hurtar', 'mangar', 'escamotear'] },
  { id: 'hide', label: 'esconderse o moverse sin ser visto', skillId: 'stealth', dc: 15, words: ['esconder', 'escondo', 'ocultar', 'oculto', 'sigilo', 'escabull', 'colarme', 'colar', 'sin ser vist', 'a hurtadillas', 'sombras', 'agazap'] },
  { id: 'climb', label: 'trepar', skillId: 'athletics', dc: 15, words: ['trepar', 'trepo', 'escalar', 'escalo', 'encaram'] },
  { id: 'swim', label: 'nadar', skillId: 'athletics', dc: 15, words: ['nadar', 'nado', 'bucear', 'buceo', 'cruzar el rio a nado'] },
  { id: 'jump', label: 'saltar', skillId: 'athletics', dc: 10, words: ['saltar', 'salto', 'brincar'] },
  { id: 'force', label: 'forzar o romper por la fuerza', skillId: 'athletics', dc: 15, words: ['derribar la puerta', 'romper', 'forzar', 'empujar', 'levantar', 'arrancar', 'doblar'] },
  { id: 'grapple', label: 'agarrar o derribar a alguien', skillId: 'athletics', dc: 15, opposed: true, words: ['agarrar', 'agarro', 'placar', 'placo', 'inmovilizar', 'sujetar', 'tumbar'] },
  { id: 'balance', label: 'mantener el equilibrio', skillId: 'acrobatics', dc: 10, words: ['equilibrio', 'cornisa', 'haciendo equilibrios', 'cuerda floja', 'voltereta', 'rodar'] },
  { id: 'deceive', label: 'engañar', skillId: 'deception', dc: 15, opposed: true, words: ['engan', 'mentir', 'miento', 'mentira', 'farol', 'disfraz', 'hacerme pasar', 'embauc', 'timar'] },
  { id: 'intimidate', label: 'intimidar', skillId: 'intimidation', dc: 15, opposed: true, words: ['intimid', 'amenaz', 'asustar'] },
  { id: 'persuade', label: 'convencer', skillId: 'persuasion', dc: 15, opposed: true, words: ['convenc', 'persuad', 'negociar', 'regatear', 'pedir un favor', 'suplicar', 'razonar con'] },
  { id: 'perform', label: 'actuar ante un público', skillId: 'performance', dc: 10, words: ['cantar', 'canto', 'tocar el laud', 'tocar una cancion', 'bailar', 'actuar', 'recitar'] },
  { id: 'readPerson', label: 'calar a alguien', skillId: 'insight', dc: 15, opposed: true, words: ['si miente', 'calar', 'intuir', 'sus intenciones', 'leer su rostro'] },
  { id: 'track', label: 'rastrear u orientarse', skillId: 'survival', dc: 15, words: ['rastrear', 'rastro', 'huellas', 'orientar', 'seguir el rastro'] },
  { id: 'heal', label: 'atender a un herido', skillId: 'medicine', dc: 10, words: ['vendar', 'estabilizar', 'primeros auxilios', 'diagnosticar', 'atender al herido'] },
  { id: 'animal', label: 'tratar con un animal', skillId: 'animalHandling', dc: 10, words: ['calmar al', 'domar', 'montar a caballo', 'tranquilizar al caballo', 'amansar'] },
  { id: 'arcana', label: 'saber de magia', skillId: 'arcana', dc: 15, words: ['runas', 'arcano', 'descifrar', 'que magia', 'identificar el hechizo', 'pergamino'] },
  { id: 'religion', label: 'saber de dioses y ritos', skillId: 'religion', dc: 15, words: ['ritual', 'reliquia', 'simbolo sagrado', 'que dios', 'sobre el dios', 'sobre la diosa'] },
  { id: 'nature', label: 'saber de la naturaleza', skillId: 'nature', dc: 15, words: ['identificar la planta', 'identificar la hierba', 'identificar la seta', 'que planta', 'que hierba', 'que seta', 'que animal', 'que veneno'] },
  { id: 'history', label: 'recordar historia y leyendas', skillId: 'history', dc: 15, words: ['recordar', 'recuerdo', 'leyenda', 'historia de', 'que se sabe de', 'blason'] },
  { id: 'search', label: 'buscar o investigar', skillId: 'investigation', dc: 15, words: ['registrar', 'registro', 'buscar pistas', 'investigar', 'investigo', 'examinar', 'examino', 'trampa', 'mecanismo'] },
  { id: 'notice', label: 'percibir algo', skillId: 'perception', dc: 15, words: ['escuchar', 'escucho', 'vigilar', 'otear', 'aguzar', 'observar', 'observo', 'otear el horizonte', 'buscar a alguien'] }
];

/**
 * Context that makes a task easier or harder: words of the action or the scene.
 * `kinds`: the rows of LOCAL_DC_TABLE it affects ('*' = all); `delta` in DC.
 */
export const CONTEXT_MODIFIERS = [
  { words: ['noche', 'oscuridad', 'a oscuras', 'penumbra', 'sombras'], kinds: ['hide', 'pickpocket'], delta: -5, reason: 'a oscuras es más fácil no ser visto' },
  { words: ['noche', 'oscuridad', 'a oscuras', 'niebla', 'bruma'], kinds: ['notice', 'track', 'search'], delta: 5, reason: 'con poca luz cuesta ver' },
  { words: ['tormenta', 'lluvia', 'aguacero', 'ventisca', 'temporal'], kinds: ['climb', 'swim', 'balance', 'jump', 'track', 'notice'], delta: 5, reason: 'el mal tiempo lo complica' },
  { words: ['tormenta', 'lluvia', 'aguacero', 'ruido', 'multitud', 'gentio', 'mercado', 'fiesta'], kinds: ['hide', 'pickpocket'], delta: -5, reason: 'el ruido o la gente tapan los movimientos' },
  { words: ['corriente', 'rapidos', 'remolino', 'mar embravecido'], kinds: ['swim'], delta: 5, reason: 'el agua tira con fuerza' },
  { words: ['cuerda', 'escalera', 'enredadera', 'arbol'], kinds: ['climb'], delta: -5, reason: 'hay buenos asideros' },
  { words: ['liso', 'lisa', 'resbaladiz', 'hielo', 'helad', 'mojad', 'acantilado'], kinds: ['climb', 'balance'], delta: 5, reason: 'la superficie no da agarre' },
  { words: ['de calidad', 'buena cerradura', 'enana', 'enano', 'reforzad', 'maestr', 'complicad', 'cerradura magica'], kinds: ['lock', 'force'], delta: 5, reason: 'es una obra de calidad' },
  { words: ['oxidad', 'vieja', 'viejo', 'simple', 'tosca', 'tosco', 'destartalad', 'carcomid', 'podrid'], kinds: ['lock', 'force'], delta: -5, reason: 'está viejo o es tosco' },
  { words: ['hostil', 'enfadad', 'furios', 'desconfiad', 'receloso', 'recelosa'], kinds: ['persuade', 'deceive', 'perform'], delta: 5, reason: 'no está de buen humor' },
  { words: ['amigo', 'amiga', 'agradecid', 'nos debe', 'me debe', 'aliado'], kinds: ['persuade', 'deceive'], delta: -5, reason: 'le cae bien de antemano' },
  { words: ['soborno', 'sobornar', 'le pago', 'le ofrezco', 'monedas de oro'], kinds: ['persuade'], delta: -5, reason: 'el dinero ayuda a convencer' },
  { words: ['borracho', 'ebrio', 'distraid', 'dormid'], kinds: ['hide', 'pickpocket', 'deceive'], delta: -5, reason: 'el otro está distraído' },
  { words: ['huellas frescas', 'barro', 'nieve', 'sangre'], kinds: ['track'], delta: -5, reason: 'el rastro es claro' },
  { words: ['antiguo', 'antigua', 'olvidad', 'perdid', 'prohibid', 'secreto'], kinds: ['history', 'arcana', 'religion', 'nature'], delta: 5, reason: 'es un saber raro u olvidado' },
  { words: ['famos', 'conocid', 'popular', 'comun'], kinds: ['history', 'arcana', 'religion', 'nature'], delta: -5, reason: 'es algo bien conocido' }
];

const contains = (text, word) => {
  const w = fold(word);
  // Whole words for short words, any part for stems ("intimid" -> "intimidar")
  return w.includes(' ') || w.length > 5 ? text.includes(w) : new RegExp(`(^|[^a-z0-9ñ])${w}`).test(text);
};

/** The row of LOCAL_DC_TABLE an action matches (or the first one using that skill). */
export function localCheckKind(actionText, { skillId = null, ability = null } = {}) {
  const text = fold(actionText);
  const byWords = LOCAL_DC_TABLE.find(row => (!skillId && !ability || row.skillId === skillId || (!row.skillId && row.ability === ability)) && row.words.some(w => contains(text, w)));
  if (byWords) return byWords;
  if (skillId || ability) return LOCAL_DC_TABLE.find(row => (skillId ? row.skillId === skillId : !row.skillId && row.ability === ability)) || null;
  return null;
}

/**
 * The check the local engine makes for an action (or for the check the player asked
 * for from the sheet, `intent` { skillId, ability }): its kind, skill, DC and why.
 * `sceneText`: the place, the weather or the last lines of the chronicle, read only
 * for the context (never for who is there).
 * Returns null when the action needs no check.
 * @returns {{ kind, label, skillId, ability, checkLabel, dc, base, reasons: string[], opponent }}
 */
export function planLocalCheck(actionText, { sceneText = '', intent = null, contextText = '' } = {}) {
  const ask = intent && (intent.skillId || intent.ability) ? intent : null;
  // From the sheet the action says only "a Stealth check": what they try is in the chronicle
  const text = ask ? `${actionText} ${contextText}` : actionText;
  const row = localCheckKind(text, ask || {});
  if (!row && !ask) return null;
  const skillId = ask ? ask.skillId || null : row.skillId || null;
  const ability = ask ? ask.ability || skillAbility(ask.skillId) : row.ability || skillAbility(row.skillId);
  const base = row ? row.dc : DEFAULT_DC;
  const reasons = [];
  let dc = base;
  const all = fold(`${text} ${sceneText}`);
  if (row) {
    CONTEXT_MODIFIERS.forEach(mod => {
      if (!(mod.kinds === '*' || mod.kinds.includes(row.id))) return;
      if (mod.words.some(w => contains(all, w))) {
        dc += mod.delta;
        reasons.push(`${mod.delta > 0 ? '+' : '−'}${Math.abs(mod.delta)}: ${mod.reason}`);
      }
    });
  }
  // Someone on the other side (named in the action, not in the scene)
  const profile = detectProfile(text);
  const opposable = row
    ? Boolean(row.opposed) || ['hide', 'pickpocket'].includes(row.id)
    : ['deception', 'persuasion', 'intimidation', 'stealth', 'sleightOfHand', 'insight'].includes(skillId);
  const opponent = profile && opposable && OPPOSED_SKILLS[skillId] ? profileOpponent(profile) : null;
  return {
    kind: row?.id || 'generic', label: row?.label || 'una prueba', skillId, ability,
    checkLabel: ask ? ask.label || '' : row?.checkLabel || '', dc: clampDC(dc), base, reasons, opponent
  };
}
