// Companions who join (or leave) the party through the story.
//
// Duncan (the AI, in a validated structured field) or the local engine
// introduces a character who offers to join: { nombre, clase, especie?, motivo }.
// The player accepts or turns them down. When accepted, the game makes the
// full sheet with the rules: a hero of that class (and species, if given)
// built like "Héroe al azar", at the party's level (see partyLevel) with the
// class's starting equipment. They bring no gold: the purse is the party's.
// A member may also leave through the story: { nombre, motivo }.
// Pure functions (the dice come from `rng`).

import { CLASSES, SPECIES } from '../data/srd';
import { buildCharacter, randomDraft } from './characterBuilder';
import { levelHeroTo } from './leveling';
import { XP_FOR_LEVEL } from '../data/progression';
import { MAX_PARTY, members, partyLevel, findMemberByName, newMemberId } from './party';

const NAME_MAX = 40;
const REASON_MAX = 160;

const fold = text => String(text || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const clean = (value, max) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '');

/** Spanish names Duncan may write for a class -> class id ("Clérigo", "clerigo", "cleric"). */
export function classIdFrom(value) {
  const wanted = fold(value);
  if (!wanted) return null;
  const found = CLASSES.find(c => c.id === wanted || fold(c.name) === wanted || fold(c.name).replace(/o$/, 'a') === wanted);
  return found?.id || null;
}

/** Species name -> species id ("Enana", "elfo", "dwarf"); null when unknown. */
export function speciesIdFrom(value) {
  const wanted = fold(value);
  if (!wanted) return null;
  const found = SPECIES.find(s => s.id === wanted || fold(s.name) === wanted || fold(s.name).replace(/o$/, 'a') === wanted);
  return found?.id || null;
}

/** The class names, for the prompt. */
export const RECRUIT_CLASS_NAMES = CLASSES.map(c => c.name);

/**
 * Validate a companion offer from Duncan's reply. Needs a name and a known class;
 * an unknown species is ignored (chosen at random). Null when unusable.
 * @returns {{ name, classId, speciesId, reason } | null}
 */
export function cleanRecruitOffer(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = clean(raw.nombre, NAME_MAX);
  const classId = classIdFrom(raw.clase);
  if (name.length < 2 || !classId) return null;
  return { name, classId, speciesId: speciesIdFrom(raw.especie), reason: clean(raw.motivo, REASON_MAX) };
}

/** Validate a member leaving in Duncan's reply. @returns {{ name, reason } | null} */
export function cleanDeparture(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = clean(raw.nombre, NAME_MAX);
  return name ? { name, reason: clean(raw.motivo, REASON_MAX) } : null;
}

/**
 * Can this offer be made now? Not when the party is full, nor for someone who
 * is already in it.
 */
export function recruitAllowed(party, offer) {
  if (!offer) return false;
  if (members(party).length >= MAX_PARTY) return false;
  return !members(party).some(m => fold(m.name) === fold(offer.name));
}

/**
 * The full sheet of a companion: class (and species) from the offer, the rest
 * chosen like "Héroe al azar", at `level` with the starting equipment and no gold.
 */
export function buildRecruit(offer, { level = 1, rng = Math.random, id = newMemberId() } = {}) {
  let draft = null;
  for (let i = 0; i < 600 && !draft; i++) {
    const candidate = randomDraft(rng);
    if (candidate.classId === offer.classId && (!offer.speciesId || candidate.speciesId === offer.speciesId)) draft = candidate;
  }
  // A species that never came up: any species of that class will do
  for (let i = 0; i < 600 && !draft; i++) {
    const candidate = randomDraft(rng);
    if (candidate.classId === offer.classId) draft = candidate;
  }
  if (!draft) throw new Error('No se pudo crear al compañero.');
  const target = Math.max(1, Math.round(Number(level) || 1));
  const sheet = buildCharacter({ ...draft, name: offer.name }, { id });
  const leveled = levelHeroTo(sheet, target);
  return {
    ...leveled,
    hp: leveled.maxHp,
    xp: Math.max(Number(leveled.xp) || 0, XP_FOR_LEVEL[leveled.level] || 0),
    gold: 0,
    backstory: offer.reason
      ? `${offer.reason} ${sheet.backstory}`.trim()
      : sheet.backstory,
    joinedBy: 'story'
  };
}

/** A pending offer as saved with the campaign (shown in the chronicle until the player answers). */
export function makeRecruitOffer(offer, party, { rng = Math.random, scene = 0 } = {}) {
  if (!recruitAllowed(party, offer)) return null;
  const character = buildRecruit(offer, { level: partyLevel(party), rng });
  return { id: `offer_${character.id}`, scene, reason: offer.reason, character };
}

/** The member a departure refers to, if it can leave (never the last one). */
export function departingMember(party, departure) {
  if (!departure || members(party).length <= 1) return null;
  return findMemberByName(party, departure.name);
}
