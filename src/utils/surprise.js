// Surprise attacks: who is caught off guard when a fight starts, and the opening
// strike (the attack the player wrote to start it). The rules themselves (the
// initiative with Disadvantage, the strike played before the initiative) live in
// encounter.js; this file decides them from the story:
//
//  - Duncan (the AI) says it in the "combate" field of his reply ("sorpresa",
//    "ataqueDelHeroe", "objetivo"): cleanSurprise / cleanOpeningHint validate it.
//  - The local engine (no AI) uses simple rules: an attack written in a quiet
//    scene (a conversation, nobody with a weapon out) surprises the enemies; an
//    ambush while exploring the wild surprises the party (see localSurprise).
//  - When the attacker sneaks up (Stealth) or strikes in the middle of a
//    conversation with a lie (Deception), or the enemies lie in wait (their
//    Stealth), the game rolls that check against the passive Perception of each
//    creature of the other side: whoever notices it is not surprised.
//  - detectOpeningStrike reads the player's words: the weapon or spell named
//    (or the weapon in hand) and the enemy named. When something is not clear
//    the combat view asks before any die is rolled.
//
// Pure functions.

import { attackOptions } from './combat';
import { spellRows } from './spellcasting';
import { OFFENSIVE_KINDS } from './encounter';

/** "sorpresa.quien" in Duncan's reply -> side of the fight that is surprised (null: nobody). */
export const SURPRISE_REPLY_SIDES = { enemigos: 'enemies', grupo: 'heroes', nadie: null };
/** "sorpresa.tirada": the check the hidden side makes. */
export const SURPRISE_REPLY_CHECKS = { sigilo: 'stealth', engano: 'deception', 'engaño': 'deception' };
const REASON_MAX = 120;
const MAX_WHO = 6;

/** Lowercase, without accents. */
export const fold = text => String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const STOP = new Set(['para', 'como', 'pero', 'sobre', 'entre', 'hacia', 'desde', 'contra', 'mientras', 'cuando', 'donde', 'todo', 'toda', 'todos', 'este', 'esta', 'esos', 'esas', 'aquel', 'tiene', 'gran', 'menor', 'mayor']);
/** The significant words of a name: 4+ letters, no filler. */
const wordsOf = text => fold(text).split(/[^a-zñ]+/).filter(w => w.length >= 4 && !STOP.has(w));
/** A word stem that also matches plurals and gender ("lobo" ~ "lobos", "bandida"). */
const stemOf = word => word.replace(/(es|s)$/, '').replace(/[aeo]$/, '');
const textStems = text => fold(text).split(/[^a-zñ]+/).filter(Boolean);
const mentions = (stems, word) => {
  const s = stemOf(word);
  return s.length >= 3 && stems.some(w => w.startsWith(s));
};
/** How many significant words of `name` the text names. */
const score = (stems, name) => wordsOf(name).filter(w => mentions(stems, w)).length;

// ---------------------------------------------------------------------------
// Duncan's field
// ---------------------------------------------------------------------------

/**
 * Validate "combate.sorpresa" of Duncan's reply.
 * @param {object} raw  { quien: 'enemigos' | 'grupo' | 'nadie', afectados?: string[], motivo?, tirada?: 'sigilo' | 'engano' }
 * @param {{ enemyIds?: string[], partyNames?: string[], heroAttacks?: boolean, actorId?: string }} context
 *   enemyIds: the creatures of the fight (bestiary ids); partyNames: the members;
 *   heroAttacks: the fight starts with the attack of who acts (they can't be ambushed in that same move);
 *   actorId: who acts (for the Stealth or Deception check)
 * @returns {null | { side, who: 'all' | string[], reason, check? }}  the `surprise` option of createEncounter
 */
export function cleanSurprise(raw, { enemyIds = [], partyNames = [], heroAttacks = false, actorId = null } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const key = fold(raw.quien).trim();
  const side = SURPRISE_REPLY_SIDES[key];
  if (!side) return null;
  if (side === 'heroes' && heroAttacks) return null;
  const allowed = (side === 'enemies' ? enemyIds : partyNames).map(fold);
  const given = (Array.isArray(raw.afectados) ? raw.afectados : typeof raw.afectados === 'string' ? [raw.afectados] : [])
    .filter(v => typeof v === 'string')
    .map(v => v.trim())
    .filter(Boolean)
    .slice(0, MAX_WHO * 2);
  // Unknown names are dropped; nobody valid (or "todos") means the whole side
  const named = given.some(v => fold(v) === 'todos') ? [] : [...new Set(given.filter(v => allowed.includes(fold(v))))].slice(0, MAX_WHO);
  const reason = typeof raw.motivo === 'string' ? raw.motivo.trim().replace(/\s+/g, ' ').slice(0, REASON_MAX) : '';
  const skill = SURPRISE_REPLY_CHECKS[fold(raw.tirada).trim()] || null;
  // Deception only makes sense for the hero who strikes mid-conversation; ambushers hide
  const check = skill && (side === 'enemies' ? { skill, ...(actorId ? { heroUid: actorId } : {}) } : { skill: 'stealth' });
  return { side, who: named.length ? named : 'all', reason, ...(check ? { check } : {}) };
}

/**
 * Validate Duncan's hint about the hero's attack: "ataqueDelHeroe" (true / false)
 * and "objetivo" (the bestiary id of the creature attacked).
 * @returns {{ attacks: boolean | null, targetId: string | null }}
 */
export function cleanOpeningHint(combat, enemyIds = []) {
  const attacks = combat?.ataqueDelHeroe === true ? true : combat?.ataqueDelHeroe === false ? false : null;
  const id = typeof combat?.objetivo === 'string' ? combat.objetivo.trim() : '';
  return { attacks, targetId: enemyIds.includes(id) ? id : null };
}

/**
 * The start of a fight Duncan asked for, validated: his "combate" field plus
 * `surprise` (createEncounter's option or null), `heroAttacks` (the fight starts
 * with the attack of who acts: an opening strike) and `targetId` (who they attack).
 * When Duncan doesn't say whether the hero attacks, the player's words decide.
 */
export function readCombatStart(combat, { aggressive = false, partyNames = [], actorId = null } = {}) {
  if (!combat || !Array.isArray(combat.enemigos)) return combat;
  const enemyIds = combat.enemigos.map(e => (typeof e?.id === 'string' ? e.id.trim() : '')).filter(Boolean);
  const hint = cleanOpeningHint(combat, enemyIds);
  const heroAttacks = hint.attacks ?? aggressive;
  const surprise = cleanSurprise(combat.sorpresa, { enemyIds, partyNames, heroAttacks, actorId });
  return { ...combat, surprise, heroAttacks, targetId: hint.targetId };
}

// ---------------------------------------------------------------------------
// The local engine
// ---------------------------------------------------------------------------

const DANGER = /(combate|pelea|luch|atac|amenaz|desenvain|hostil|emboscad|grun|enemig|acech|arma en mano|cuchillo en mano|en guardia|sangr|furios|⚔️)/;
const STEALTH = /(sigil|a escondidas|por la espalda|por detras|sin que (me|nos|lo|la|le)|sin hacer ruido|en silencio|agazap|escondid|oculto|desde las sombras|a hurtadillas)/;
const DECEPTION = /(mientras (le |les )?(habl|charl|sonri|distra|convers|brind|estrech)|finj|engan|disimul|con una sonrisa|le distraigo|aprovech\w* que (no|se) )/;
const EXPLORE = /\b(explor|adentr|camin|viaj|avanz|recorr|atravies|cruz|seguimos|sigo el|me interno|nos internamos|me meto en|batir el|rastre)/;

/**
 * This share of exploring actions in the wild meets an ambush (against the whole
 * party), never two in a row: the campaign remembers whether the last exploration
 * of the local engine ended in one (see `exploration` in generateDMResponse).
 */
export const AMBUSH_CHANCE = 0.08;

/** An exploring action outside a settlement (where the local engine may meet an ambush). */
export const isWildExploration = (actionText, here = null) => !here?.settlement && EXPLORE.test(fold(actionText));

/** The hidden side's check from the player's words (Stealth or Deception), or null. */
export function checkFromAction(actionText) {
  const text = fold(actionText);
  if (STEALTH.test(text)) return 'stealth';
  if (DECEPTION.test(text)) return 'deception';
  return null;
}

/** A quiet scene: the last lines of the chronicle have no fight or threat in them. */
export function isQuietScene(history = []) {
  const recent = (history || []).slice(-3).map(m => fold(m?.text)).join(' ');
  return !DANGER.test(recent);
}

/**
 * Local engine: surprise for a fight it starts.
 * @param {{ actionText, history, aggressive, actorId }} context
 *   aggressive: the action attacks (the fight starts with the hero's attack)
 * @returns {null | { side: 'enemies', who: 'all', reason, check? }}
 *   An attack in a quiet scene surprises every enemy; sneaking up (Stealth) or a
 *   lie (Deception) makes the game roll that check, also in a tense scene.
 */
export function localSurprise({ actionText = '', history = [], aggressive = false, actorId = null } = {}) {
  if (!aggressive) return null;
  const skill = checkFromAction(actionText);
  const quiet = isQuietScene(history);
  if (!skill && !quiet) return null;
  const reason = skill === 'stealth' ? 'se acerca sin ser visto' : skill === 'deception' ? 'en mitad de la conversación' : 'nadie esperaba el ataque';
  return { side: 'enemies', who: 'all', reason, ...(skill ? { check: { skill, ...(actorId ? { heroUid: actorId } : {}) } } : {}) };
}

/**
 * Local engine: an exploring action in the wild may meet an ambush.
 * @param {{ actionText, here, rng }} context  here: the current map place (a settlement is safe)
 * @returns {null | { side: 'heroes', who: 'all', reason, check: { skill: 'stealth' } }}
 */
export function localAmbush({ actionText = '', here = null, rng = Math.random, lastWasAmbush = false } = {}) {
  if (!isWildExploration(actionText, here)) return null;
  // Never two in a row: at least one quiet exploration between two ambushes
  if (lastWasAmbush || rng() >= AMBUSH_CHANCE) return null;
  return { side: 'heroes', who: 'all', reason: 'los esperaban escondidos', check: { skill: 'stealth' } };
}

// ---------------------------------------------------------------------------
// The opening strike: what the player wrote
// ---------------------------------------------------------------------------

const SPELL_WORDS = /\b(conjur|hechiz|magia|magic|lanzo un|invoco|recito)/;
const UNARMED_WORDS = /\b(punetazo|puno|patada|cabezazo|rodillazo|codazo|manos desnudas|sin armas|a golpes)/;

/** The hero's offensive spells (prepared, usable). */
export const offensiveSpells = hero => spellRows(hero).filter(s => !s.blocked && OFFENSIVE_KINDS.includes(s.kind));

/** Copies of the same creature ("Bandido 1", "Bandido 2"...) are the same choice. */
const kindOf = enemy => `${enemy.monsterId}|${String(enemy.name).replace(/ \d+$/, '')}`;

function pickTarget(stems, text, enemies, targetId) {
  const living = enemies.filter(e => e.status === 'active');
  if (!living.length) return { targetUid: null, choices: [] };
  const scored = living.map(e => ({ e, s: score(stems, e.name) * 3 + score(stems, e.baseName) * 3 + score(stems, e.trait || '') }));
  const best = Math.max(...scored.map(x => x.s));
  let pool = best > 0 ? scored.filter(x => x.s === best).map(x => x.e) : [];
  // A number names one copy: "el bandido 2"
  const number = text.match(/\b([1-9])\b/);
  if (pool.length > 1 && number) {
    const exact = pool.filter(e => e.name.endsWith(` ${number[1]}`));
    if (exact.length) pool = exact;
  }
  if (!pool.length && targetId) pool = living.filter(e => e.monsterId === targetId);
  if (!pool.length) pool = living;
  const kinds = new Set(pool.map(kindOf));
  return kinds.size === 1 ? { targetUid: pool[0].uid, choices: [] } : { targetUid: null, choices: pool.map(e => e.uid) };
}

function pickMeans(stems, text, hero) {
  const options = attackOptions(hero);
  const spells = offensiveSpells(hero);
  // A spell named
  const spellScores = spells.map(s => ({ s, n: score(stems, s.name), of: wordsOf(s.name).length }))
    .filter(x => x.n > 0 && x.n >= Math.ceil(x.of / 2));
  if (spellScores.length) {
    const top = Math.max(...spellScores.map(x => x.n));
    const best = spellScores.filter(x => x.n === top);
    return best.length === 1
      ? { action: { type: 'spell', spellId: best[0].s.id } }
      : { choices: { spells: best.map(x => x.s.id), options: [] } };
  }
  // A weapon named (several copies of the same weapon are one choice)
  const weaponScores = options.filter(o => o.weapon).map(o => ({ o, n: Math.max(score(stems, o.name), score(stems, o.itemName)) })).filter(x => x.n > 0);
  if (weaponScores.length) {
    const top = Math.max(...weaponScores.map(x => x.n));
    const best = weaponScores.filter(x => x.n === top);
    const names = new Set(best.map(x => x.o.name));
    return names.size === 1
      ? { action: { type: 'attack', optionId: best[0].o.id } }
      : { choices: { options: best.map(x => x.o.id), spells: [] } };
  }
  const unarmed = options.find(o => o.id === 'unarmed');
  if (UNARMED_WORDS.test(text) && unarmed) return { action: { type: 'attack', optionId: unarmed.id } };
  // "Lanzo un conjuro": the only offensive spell, or a choice among them
  if (SPELL_WORDS.test(text) && spells.length) {
    return spells.length === 1 ? { action: { type: 'spell', spellId: spells[0].id } } : { choices: { spells: spells.map(s => s.id), options: [] } };
  }
  // Nothing named: the weapon in hand (one kind), or a fist; otherwise the player chooses
  const weapons = options.filter(o => o.weapon);
  const kinds = new Set(weapons.map(o => o.name));
  if (kinds.size === 1) return { action: { type: 'attack', optionId: weapons[0].id } };
  if (!weapons.length && !spells.length && unarmed) return { action: { type: 'attack', optionId: unarmed.id } };
  if (!weapons.length && !spells.length) return null;
  return { choices: { options: [...weapons.map(o => o.id), ...(unarmed && !weapons.length ? [unarmed.id] : [])], spells: spells.map(s => s.id) } };
}

/**
 * Read the opening strike from the player's words.
 * @param {string} actionText   what the player wrote ("le clavo la daga al tabernero")
 * @param {object} hero          the attacker's sheet
 * @param {object[]} enemies     the enemies of the new encounter
 * @param {{ targetId?: string }} [hint]  Duncan's "objetivo" (validated)
 * @returns {null | { heroUid, suggest: { type?, optionId?, spellId?, targetUid? }, needs: { means: boolean, target: boolean },
 *                    choices: { options: string[], spells: string[], targets: string[] } }}
 *   null: the hero has nothing to attack with. `needs` empty: the game can play it right away.
 */
export function detectOpeningStrike(actionText, hero, enemies, { targetId = null } = {}) {
  if (!hero) return null;
  const text = fold(actionText);
  const stems = textStems(actionText);
  const means = pickMeans(stems, text, hero);
  if (!means) return null;
  const target = pickTarget(stems, text, enemies, targetId);
  if (!target.targetUid && !target.choices.length) return null;
  const suggest = { ...(means.action || {}), ...(target.targetUid ? { targetUid: target.targetUid } : {}) };
  return {
    heroUid: hero.id || 'player',
    suggest,
    needs: { means: !means.action, target: !target.targetUid },
    choices: { options: means.choices?.options || [], spells: means.choices?.spells || [], targets: target.choices }
  };
}

/** The opening strike is fully known: the game can roll it without asking. */
export const openingReady = opening => Boolean(opening && !opening.needs?.means && !opening.needs?.target && opening.suggest?.type && opening.suggest?.targetUid);
