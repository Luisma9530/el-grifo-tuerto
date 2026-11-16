// Magic rules: choosing spells during character creation, and casting / resting in play.
// Pure functions (dice come from a `rollDie(sides)` callback).

import { CLASSES, FEATS, BACKGROUNDS, SPECIES, ABILITIES, LEVEL_1_PROFICIENCY_BONUS } from '../data/srd';
import { SPELLS, CLASS_SPELLCASTING, MAGIC_INITIATE, SPECIES_CANTRIPS } from '../data/spells';

const mod = score => Math.floor(((Number(score) || 10) - 10) / 2);
const abilityName = id => ABILITIES.find(a => a.id === id)?.name || id;

export const getSpell = id => SPELLS.find(s => s.id === id) || null;

const KIND_LABELS = { attack: 'Ataque', save: 'Salvación', auto: 'Impacto seguro', heal: 'Curación', utility: 'Utilidad' };

/** Short mechanical summary of a spell: "Ataque · 1d10 fuego", "Salvación DES · 3d6 fuego"... */
export function spellSummary(spell) {
  const parts = [KIND_LABELS[spell.kind]];
  if (spell.kind === 'save') parts[0] += ` ${ABILITIES.find(a => a.id === spell.save)?.short}`;
  if (spell.damage) parts.push(`${spell.damage} ${spell.type}`);
  if (spell.heal) parts.push(`${spell.heal}${spell.addMod ? ' + mod.' : ''}`);
  if (spell.ritual) parts.push('ritual');
  if (spell.concentration) parts.push('concentración');
  return parts.join(' · ');
}

/** Spells of a class list at a level (0 = cantrips), in alphabetical order. */
export function spellsFor(classId, level) {
  return SPELLS
    .filter(s => s.level === level && s.classes.includes(classId))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

// ---------------------------------------------------------------------------
// Character creation
// ---------------------------------------------------------------------------

export function emptySpellChoices() {
  return {};
}

/** Feats of the draft that grant spells (background feat and the human's extra feat). */
function magicFeats(draft) {
  const backgroundFeat = BACKGROUNDS.find(b => b.id === draft.backgroundId)?.feat;
  return [...new Set([backgroundFeat, draft.extraFeatId])].filter(id => MAGIC_INITIATE[id]);
}

/**
 * The spell choices a draft has to make, one group per source:
 * the class (if it casts spells at level 1) and each Magic Initiate feat.
 * `spells` is how many level 1 spells to choose; for a wizard that is the
 * spellbook, of which `prepared` are readied.
 */
export function spellSources(draft) {
  const sources = [];
  const cls = CLASSES.find(c => c.id === draft.classId);
  const casting = cls && CLASS_SPELLCASTING[cls.id];
  if (casting) {
    sources.push({
      key: 'class',
      title: cls.name,
      list: cls.id,
      ability: casting.ability,
      cantrips: casting.cantrips,
      spells: casting.spellbook || casting.prepared,
      prepared: casting.spellbook ? casting.prepared : null
    });
  }
  magicFeats(draft).forEach(featId => {
    const feat = MAGIC_INITIATE[featId];
    sources.push({
      key: featId,
      title: FEATS.find(f => f.id === featId).name,
      list: feat.list,
      ability: feat.ability,
      cantrips: feat.cantrips,
      spells: feat.spells,
      prepared: null
    });
  });
  return sources;
}

export const needsSpellChoices = draft => spellSources(draft).length > 0;

/** Cantrips the species knows innately. */
export function speciesCantrips(draft) {
  const entry = SPECIES_CANTRIPS[draft.speciesId];
  if (!entry) return [];
  return [...(entry.always || []), ...(entry.byOption?.[draft.speciesOption] || [])];
}

const emptyPick = () => ({ cantrips: [], spells: [], prepared: [] });
export const picksFor = (draft, key) => ({ ...emptyPick(), ...(draft.spells?.[key] || {}) });

/** Every spell id already chosen or known, optionally ignoring one source. */
function takenSpells(draft, exceptKey = null) {
  const taken = new Set(speciesCantrips(draft));
  spellSources(draft).forEach(source => {
    if (source.key === exceptKey) return;
    const picks = picksFor(draft, source.key);
    [...picks.cantrips, ...picks.spells].forEach(id => taken.add(id));
  });
  return taken;
}

/** Spells a source can still choose from (no spell is learned twice). */
export function spellOptions(draft, source, level) {
  const taken = takenSpells(draft, source.key);
  return spellsFor(source.list, level).filter(s => !taken.has(s.id));
}

/** Drop spell choices that stopped being valid (class, feat or species changed). */
export function sanitizeSpells(draft) {
  const spells = {};
  // Earlier sources keep their picks; later ones lose duplicates
  let partial = { ...draft, spells };
  spellSources(draft).forEach(source => {
    const picks = picksFor(draft, source.key);
    const valid = level => new Set(spellOptions(partial, source, level).map(s => s.id));
    const cantrips = [...new Set(picks.cantrips)].filter(id => valid(0).has(id)).slice(0, source.cantrips);
    const chosen = [...new Set(picks.spells)].filter(id => valid(1).has(id)).slice(0, source.spells);
    const prepared = source.prepared
      ? [...new Set(picks.prepared)].filter(id => chosen.includes(id)).slice(0, source.prepared)
      : [];
    spells[source.key] = { cantrips, spells: chosen, prepared };
    partial = { ...draft, spells: { ...spells } };
  });
  return spells;
}

/** What is missing in the spells step. */
export function spellIssues(draft) {
  const issues = [];
  spellSources(draft).forEach(source => {
    const picks = picksFor(draft, source.key);
    if (picks.cantrips.length !== source.cantrips) {
      issues.push(`Elige ${source.cantrips} trucos de ${source.title}.`);
    }
    if (picks.spells.length !== source.spells) {
      issues.push(source.prepared
        ? `Elige ${source.spells} conjuros para tu libro de conjuros.`
        : `Elige ${source.spells} ${source.spells === 1 ? 'conjuro' : 'conjuros'} de nivel 1 de ${source.title}.`);
    } else if (source.prepared && picks.prepared.length !== source.prepared) {
      issues.push(`Marca ${source.prepared} conjuros de tu libro como preparados.`);
    }
  });
  return issues;
}

/**
 * The `spellcasting` block of a finished character, or null if it knows no magic.
 * known[]: { id, source, ability, prepared, freeCast } — `prepared: false` only for
 * wizard spellbook spells that are not readied; `freeCast` spells can be cast once
 * per long rest without a slot (Magic Initiate).
 */
export function buildSpellcasting(draft, stats) {
  const known = [];
  let slots = null;

  spellSources(draft).forEach(source => {
    const picks = picksFor(draft, source.key);
    const isClass = source.key === 'class';
    picks.cantrips.forEach(id => known.push({ id, source: source.title, ability: source.ability, prepared: true, freeCast: false }));
    picks.spells.forEach(id => known.push({
      id,
      source: source.title,
      ability: source.ability,
      prepared: source.prepared ? picks.prepared.includes(id) : true,
      freeCast: !isClass
    }));
    if (isClass) {
      const casting = CLASS_SPELLCASTING[source.list];
      slots = { max: casting.slots, used: 0, recovery: casting.recovery };
    }
  });

  const innate = speciesCantrips(draft);
  if (innate.length > 0) {
    // Species magic uses the best of Intelligence, Wisdom or Charisma
    const ability = ['int', 'sab', 'car'].reduce((best, id) => (stats[id] > stats[best] ? id : best), 'int');
    const speciesName = SPECIES.find(s => s.id === draft.speciesId).name;
    innate.forEach(id => known.push({ id, source: speciesName, ability, prepared: true, freeCast: false }));
  }

  if (known.length === 0) return null;
  return { slots, known, freeCastsUsed: [] };
}

/** Random valid spell choices for a draft (used by the "random hero" button). */
export function randomSpellChoices(draft, rng = Math.random) {
  const shuffle = list => {
    const pool = [...list];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
  };
  const spells = {};
  let partial = { ...draft, spells };
  spellSources(draft).forEach(source => {
    const cantrips = shuffle(spellOptions(partial, source, 0)).slice(0, source.cantrips).map(s => s.id);
    const chosen = shuffle(spellOptions(partial, source, 1)).slice(0, source.spells).map(s => s.id);
    spells[source.key] = { cantrips, spells: chosen, prepared: source.prepared ? chosen.slice(0, source.prepared) : [] };
    partial = { ...draft, spells: { ...spells } };
  });
  return spells;
}

// ---------------------------------------------------------------------------
// In play
// ---------------------------------------------------------------------------

/** "3d4+3" -> { count: 3, sides: 4, bonus: 3 } */
export function parseDice(notation) {
  const match = /^(\d+)d(\d+)(?:\+(\d+))?$/.exec(notation || '');
  if (!match) return null;
  return { count: Number(match[1]), sides: Number(match[2]), bonus: Number(match[3] || 0) };
}

function rollNotation(notation, rollDie, multiplier = 1) {
  const parsed = parseDice(notation);
  if (!parsed) return null;
  const dice = Array.from({ length: parsed.count * multiplier }, () => rollDie(parsed.sides));
  return { dice, sides: parsed.sides, bonus: parsed.bonus, total: dice.reduce((sum, d) => sum + d, 0) + parsed.bonus };
}

/** Modifier, save DC and attack bonus of a known spell. */
export function spellNumbers(character, entry) {
  const pb = Number(character.proficiencyBonus) || LEVEL_1_PROFICIENCY_BONUS;
  const modifier = mod(character.stats?.[entry.ability]);
  return { modifier, saveDC: 8 + pb + modifier, attackBonus: pb + modifier };
}

export function slotsLeft(character) {
  const slots = character.spellcasting?.slots;
  return slots ? Math.max(0, slots.max - slots.used) : 0;
}

/** Rows for the spells tab of the sheet, cantrips first. */
export function spellRows(character) {
  const casting = character.spellcasting;
  if (!casting) return [];
  return casting.known
    .map(entry => {
      const spell = getSpell(entry.id);
      if (!spell) return null;
      const freeAvailable = entry.freeCast && !casting.freeCastsUsed.includes(entry.id);
      let blocked = null;
      if (!entry.prepared) blocked = 'En tu libro, sin preparar';
      else if (spell.level > 0 && !freeAvailable && slotsLeft(character) === 0) blocked = 'Sin espacios de conjuro';
      return { ...spell, entry, ...spellNumbers(character, entry), freeAvailable, blocked, abilityName: abilityName(entry.ability) };
    })
    .filter(Boolean)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'es'));
}

/**
 * Cast a spell the character knows.
 * @param {(sides: number) => number} rollDie
 * @returns {{ok: false, error: string} | {ok: true, character: object, cast: object}}
 *   cast: { spell, modifier, saveDC, attackBonus, usedSlot, usedFreeCast,
 *           attack: {raw, total, isNat20, isNat1} | null,
 *           damage: {dice, sides, bonus, total, type} | null,
 *           heal: {dice, sides, bonus, total, applied} | null }
 *   Healing spells heal the caster. A natural 20 on a spell attack doubles the damage dice.
 */
export function castSpell(character, spellId, rollDie) {
  const casting = character.spellcasting;
  const entry = casting?.known.find(k => k.id === spellId);
  const spell = getSpell(spellId);
  if (!entry || !spell) return { ok: false, error: 'No conoces ese conjuro.' };
  if (!entry.prepared) return { ok: false, error: 'Ese conjuro está en tu libro, pero no lo tienes preparado.' };

  let usedSlot = false;
  let usedFreeCast = false;
  let nextCasting = casting;
  if (spell.level > 0) {
    if (entry.freeCast && !casting.freeCastsUsed.includes(spellId)) {
      usedFreeCast = true;
      nextCasting = { ...casting, freeCastsUsed: [...casting.freeCastsUsed, spellId] };
    } else if (slotsLeft(character) > 0) {
      usedSlot = true;
      nextCasting = { ...casting, slots: { ...casting.slots, used: casting.slots.used + 1 } };
    } else {
      return { ok: false, error: 'No te quedan espacios de conjuro. Descansa para recuperarlos.' };
    }
  }

  const numbers = spellNumbers(character, entry);
  let attack = null;
  if (spell.kind === 'attack') {
    const raw = rollDie(20);
    attack = { raw, total: raw + numbers.attackBonus, isNat20: raw === 20, isNat1: raw === 1 };
  }

  const rolledDamage = spell.damage ? rollNotation(spell.damage, rollDie, attack?.isNat20 ? 2 : 1) : null;
  const damage = rolledDamage ? { ...rolledDamage, type: spell.type } : null;

  let heal = null;
  let hp = character.hp;
  if (spell.kind === 'heal') {
    const rolled = rollNotation(spell.heal, rollDie);
    const total = Math.max(1, rolled.total + (spell.addMod ? numbers.modifier : 0));
    hp = Math.min(character.maxHp, character.hp + total);
    heal = { ...rolled, bonus: rolled.bonus + (spell.addMod ? numbers.modifier : 0), total, applied: hp - character.hp };
  }

  return {
    ok: true,
    character: { ...character, hp, spellcasting: nextCasting },
    cast: { spell, ...numbers, usedSlot, usedFreeCast, attack, damage, heal }
  };
}

/**
 * The line written in the chronicle (and sent to the Dungeon Master) for a cast.
 * `dc` is the difficulty a spell attack was compared against.
 */
export function describeCast(cast, { target = '', dc = 12 } = {}) {
  const { spell } = cast;
  const on = target.trim() ? ` sobre ${target.trim()}` : '';
  const what = spell.level === 0 ? 'el truco' : 'el conjuro';
  const parts = [`Lanzo ${what} **${spell.name}**${on}.`];
  const dmg = cast.damage ? `${cast.damage.total} de daño ${cast.damage.type}` : null;

  if (cast.attack) {
    const { raw, total, isNat20, isNat1 } = cast.attack;
    const hit = isNat20 || (!isNat1 && total >= dc);
    parts.push(`[🎲 Ataque de conjuro D20: ${raw} (+${cast.attackBonus}) = ${total} vs CD ${dc}]`);
    parts.push(isNat20 ? `¡Crítico! Impacta y hace ${dmg}.` : hit ? `Impacta y hace ${dmg}.` : 'Falla.');
  } else if (spell.kind === 'save') {
    const save = abilityName(spell.save);
    parts.push(dmg
      ? `El objetivo debe superar una salvación de ${save} CD ${cast.saveDC} o sufrir ${dmg}${spell.half ? ' (la mitad si la supera)' : ''}.`
      : `El objetivo debe superar una salvación de ${save} CD ${cast.saveDC} o sufrir su efecto: ${spell.desc}`);
  } else if (spell.kind === 'auto') {
    parts.push(`Acierta automáticamente y hace ${dmg}.`);
  } else if (cast.heal) {
    parts.push(`Recupero ${cast.heal.applied} puntos de golpe (curación de ${cast.heal.total}).`);
  } else {
    parts.push(`Efecto: ${spell.desc}`);
  }
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Rests
// ---------------------------------------------------------------------------

/** Gold a room at the inn costs: the price of a long rest. */
export const LONG_REST_COST = 5;

/** Long rest: full hit points, all spell slots, free casts and the hit die back. */
export function longRest(character) {
  const casting = character.spellcasting;
  return {
    ...character,
    hp: character.maxHp,
    hitDiceUsed: 0,
    spellcasting: casting
      ? { ...casting, freeCastsUsed: [], slots: casting.slots ? { ...casting.slots, used: 0 } : null }
      : casting
  };
}

export const hasHitDie = character => Boolean(character.hitDie) && (character.hitDiceUsed || 0) < (character.level || 1);

/**
 * Short rest: spend the hit die (if any is left and the hero is hurt) to heal
 * hitDie + Constitution, and recover slots that return on a short rest (warlock).
 * @returns {{ character: object, healed: number, die: number | null, slotsRecovered: boolean }}
 */
export function shortRest(character, rollDie) {
  let next = { ...character };
  let healed = 0;
  let die = null;

  if (hasHitDie(character) && character.hp < character.maxHp) {
    die = rollDie(character.hitDie);
    const amount = Math.max(1, die + mod(character.stats?.con));
    const hp = Math.min(character.maxHp, character.hp + amount);
    healed = hp - character.hp;
    next = { ...next, hp, hitDiceUsed: (character.hitDiceUsed || 0) + 1 };
  }

  const slots = character.spellcasting?.slots;
  const slotsRecovered = Boolean(slots && slots.recovery === 'short' && slots.used > 0);
  if (slotsRecovered) {
    next = { ...next, spellcasting: { ...character.spellcasting, slots: { ...slots, used: 0 } } };
  }

  return { character: next, healed, die, slotsRecovered };
}
