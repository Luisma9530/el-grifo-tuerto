// Magic rules: choosing spells during character creation, and casting / resting in play.
// Pure functions (dice come from a `rollDie(sides)` callback).

import { CLASSES, FEATS, BACKGROUNDS, SPECIES, ABILITIES, LEVEL_1_PROFICIENCY_BONUS } from '../data/srd';
import { SPELLS, CLASS_SPELLCASTING, MAGIC_INITIATE, SPECIES_CANTRIPS } from '../data/spells';
import { SPELL_PROGRESSION, CANTRIP_UPGRADE_LEVELS } from '../data/progression';
import { wearsUntrainedArmor } from './equipment';
import { attackModifiers, rollD20, removeConditions, reduceExhaustion, restConditions, conditionName } from './conditions';
import { spellConditions, TOUCH_SPELLS } from '../data/spellConditions';

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
    picks.cantrips.forEach(id => known.push({ id, source: source.title, sourceKey: source.key, ability: source.ability, prepared: true, freeCast: false }));
    picks.spells.forEach(id => known.push({
      id,
      source: source.title,
      sourceKey: source.key,
      ability: source.ability,
      prepared: source.prepared ? picks.prepared.includes(id) : true,
      freeCast: !isClass
    }));
    if (isClass) slots = slotsForLevel(source.list, 1);
  });

  const innate = speciesCantrips(draft);
  if (innate.length > 0) {
    // Species magic uses the best of Intelligence, Wisdom or Charisma
    const ability = ['int', 'sab', 'car'].reduce((best, id) => (stats[id] > stats[best] ? id : best), 'int');
    const speciesName = SPECIES.find(s => s.id === draft.speciesId).name;
    innate.forEach(id => known.push({ id, source: speciesName, sourceKey: 'species', ability, prepared: true, freeCast: false }));
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

function rollNotation(notation, rollDie, multiplier = 1, extraDice = 0) {
  const parsed = parseDice(notation);
  if (!parsed) return null;
  // Fixed amounts ("0d4+70") have no dice to add when upcast
  const count = parsed.count === 0 ? 0 : parsed.count * multiplier + extraDice;
  const dice = Array.from({ length: count }, () => rollDie(parsed.sides));
  return { dice, sides: parsed.sides, bonus: parsed.bonus, total: dice.reduce((sum, d) => sum + d, 0) + parsed.bonus };
}

/** Modifier, save DC and attack bonus of a known spell. */
export function spellNumbers(character, entry) {
  const pb = Number(character.proficiencyBonus) || LEVEL_1_PROFICIENCY_BONUS;
  const modifier = mod(character.stats?.[entry.ability]);
  return { modifier, saveDC: 8 + pb + modifier, attackBonus: pb + modifier };
}

// ---------------------------------------------------------------------------
// Spell slots
//
// Shape: { recovery: 'long' | 'short', levels: { [spellLevel]: { max, used } } }
// Heroes saved before levels existed have { max, used, recovery } (level 1 only):
// every reader goes through slotTable(), which understands both.
// ---------------------------------------------------------------------------

/** Spell slots of a class at a character level, all unused (null for non-casters). */
export function slotsForLevel(classId, level) {
  const progression = SPELL_PROGRESSION[classId];
  if (!progression) return null;
  const table = progression.slots[level] || {};
  return {
    recovery: progression.recovery,
    levels: Object.fromEntries(Object.entries(table).map(([spellLevel, max]) => [spellLevel, { max, used: 0 }]))
  };
}

/** Slot rows [{ level, max, used, left }] sorted by spell level. */
export function slotTable(casting) {
  const slots = casting?.slots;
  if (!slots) return [];
  const levels = slots.levels || { 1: { max: slots.max, used: slots.used } };
  return Object.entries(levels)
    .map(([level, { max, used }]) => ({ level: Number(level), max, used, left: Math.max(0, max - used) }))
    .filter(row => row.max > 0)
    .sort((a, b) => a.level - b.level);
}

export const slotRecovery = casting => casting?.slots?.recovery || null;

/** Slots left of `minLevel` or higher (all of them by default). */
export function slotsLeft(character, minLevel = 1) {
  return slotTable(character.spellcasting)
    .filter(row => row.level >= minLevel)
    .reduce((sum, row) => sum + row.left, 0);
}

/** Highest spell level the hero has slots for (0 if none). */
export function maxSlotLevel(casting) {
  return slotTable(casting).reduce((max, row) => Math.max(max, row.level), 0);
}

/** Rebuild the slots object from rows, in the current shape. */
function withSlots(casting, rows, recovery = slotRecovery(casting)) {
  return {
    ...casting,
    slots: { recovery, levels: Object.fromEntries(rows.map(row => [row.level, { max: row.max, used: row.used }])) }
  };
}

/** All slots back (long rest, or short rest for pact magic). */
function restoreSlots(casting) {
  if (!casting?.slots) return casting;
  return withSlots(casting, slotTable(casting).map(row => ({ ...row, used: 0 })));
}

/** Cantrip damage dice multiply as the hero gains levels (x2 at 5, x3 at 11, x4 at 17). */
export function cantripDiceMultiplier(character) {
  const level = character.level || 1;
  return 1 + CANTRIP_UPGRADE_LEVELS.filter(threshold => level >= threshold).length;
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
      else if (spell.level > 0 && !freeAvailable && slotsLeft(character, spell.level) === 0) blocked = 'Sin espacios de conjuro';
      return { ...spell, entry, ...spellNumbers(character, entry), freeAvailable, blocked, abilityName: abilityName(entry.ability) };
    })
    .filter(Boolean)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'es'));
}

/**
 * Cast a spell the character knows.
 * @param {(sides: number) => number} rollDie
 * @returns {{ok: false, error: string} | {ok: true, character: object, cast: object}}
 *   cast: { spell, modifier, saveDC, attackBonus, usedSlot, slotLevel, usedFreeCast,
 *           attack: {raw, rolls, total, isNat20, isNat1, mode, advantage, disadvantage, autoCrit, penalty} | null,
 *           damage: {dice, sides, bonus, total, type} | null,
 *           heal: {dice, sides, bonus, total, applied} | null,
 *           cured: string[] (condition names removed from the caster) }
 *   Healing spells heal the caster; spells that cure conditions (Lesser Restoration...)
 *   cure the caster too. A natural 20 on a spell attack doubles the damage dice.
 *   `options.target` / `options.targetUid`: the creature attacked, so its conditions
 *   give advantage or disadvantage (the caster's own conditions always count).
 *   A spell uses the lowest free slot of its level or higher; cast with a higher slot,
 *   damage and healing gain one die per level above (a simplification of each spell's
 *   own "at higher levels" rule). Cantrips gain dice with character level.
 */
export function castSpell(character, spellId, rollDie, { target = null, targetUid = null } = {}) {
  const casting = character.spellcasting;
  const entry = casting?.known.find(k => k.id === spellId);
  const spell = getSpell(spellId);
  if (!entry || !spell) return { ok: false, error: 'No conoces ese conjuro.' };
  if (!entry.prepared) return { ok: false, error: 'Ese conjuro está en tu libro, pero no lo tienes preparado.' };
  if (wearsUntrainedArmor(character)) return { ok: false, error: 'No puedes lanzar conjuros con una armadura con la que no tienes competencia: quítatela en el menú Equipo.' };

  let usedSlot = false;
  let slotLevel = null;
  let usedFreeCast = false;
  let nextCasting = casting;
  if (spell.level > 0) {
    const rows = slotTable(casting);
    const slot = rows.find(row => row.level >= spell.level && row.left > 0);
    if (entry.freeCast && !casting.freeCastsUsed.includes(spellId)) {
      usedFreeCast = true;
      nextCasting = { ...casting, freeCastsUsed: [...casting.freeCastsUsed, spellId] };
    } else if (slot) {
      usedSlot = true;
      slotLevel = slot.level;
      nextCasting = withSlots(casting, rows.map(row => (row.level === slot.level ? { ...row, used: row.used + 1 } : row)));
    } else {
      return { ok: false, error: 'No te quedan espacios de conjuro de ese nivel. Descansa para recuperarlos.' };
    }
  }
  // Extra dice: higher slot for leveled spells, character level for cantrips
  const upcast = slotLevel ? slotLevel - spell.level : 0;
  const cantripMultiplier = spell.level === 0 ? cantripDiceMultiplier(character) : 1;

  const numbers = spellNumbers(character, entry);
  let attack = null;
  if (spell.kind === 'attack') {
    const mods = attackModifiers(character, target, { ranged: !TOUCH_SPELLS.includes(spellId), targetUid });
    const d20 = rollD20(rollDie, mods);
    const raw = d20.raw;
    attack = {
      raw, rolls: d20.rolls, total: raw + numbers.attackBonus - mods.penalty, isNat20: raw === 20, isNat1: raw === 1,
      mode: d20.mode, penalty: mods.penalty, autoCrit: mods.autoCrit,
      advantage: d20.mode === 'advantage' ? mods.advantage.join(', ') : null,
      disadvantage: d20.mode === 'disadvantage' ? mods.disadvantage.join(', ') : null
    };
  }

  const rolledDamage = spell.damage
    ? rollNotation(spell.damage, rollDie, (attack?.isNat20 ? 2 : 1) * cantripMultiplier, upcast)
    : null;
  const damage = rolledDamage ? { ...rolledDamage, type: spell.type } : null;

  let heal = null;
  let hp = character.hp;
  if (spell.kind === 'heal') {
    const rolled = rollNotation(spell.heal, rollDie, 1, upcast);
    const total = Math.max(1, rolled.total + (spell.addMod ? numbers.modifier : 0));
    hp = Math.min(character.maxHp, character.hp + total);
    heal = { ...rolled, bonus: rolled.bonus + (spell.addMod ? numbers.modifier : 0), total, applied: hp - character.hp };
  }

  // Spells that end conditions (on the caster: the hero is alone)
  const cures = spellConditions(spellId)?.cures;
  let next = { ...character, hp, spellcasting: nextCasting };
  const cured = [];
  if (cures) {
    let left = cures.count || Infinity;
    const { creature, removed } = removeConditions(next, c => {
      if (left <= 0 || !cures.ids.includes(c.id)) return false;
      left -= 1;
      return true;
    });
    next = creature;
    removed.forEach(c => cured.push(conditionName(c.id)));
    if (cures.exhaustion && left > 0) {
      const tired = reduceExhaustion(next, cures.exhaustion);
      if (tired.before > tired.after) {
        next = tired.creature;
        cured.push(tired.after ? `un nivel de Agotamiento (queda en ${tired.after})` : 'el Agotamiento');
      }
    }
  }

  return {
    ok: true,
    character: next,
    cast: { spell, ...numbers, usedSlot, slotLevel, usedFreeCast, attack, damage, heal, cured }
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
  const upcast = cast.slotLevel && cast.slotLevel > spell.level ? ` con un espacio de nivel ${cast.slotLevel}` : '';
  const parts = [`Lanzo ${what} **${spell.name}**${on}${upcast}.`];
  if (cast.attack?.advantage) parts.push(`Con ventaja (${cast.attack.advantage}).`);
  if (cast.attack?.disadvantage) parts.push(`Con desventaja (${cast.attack.disadvantage}).`);
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
  if (cast.cured?.length) parts.push(`Me libro de: ${cast.cured.join(', ')}.`);
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Rests
// ---------------------------------------------------------------------------

/** Gold a room at the inn costs: the price of a long rest. */
export const LONG_REST_COST = 5;

/**
 * Long rest: full hit points, all spell slots, free casts and the hit die back;
 * conditions that last until a rest end and Exhaustion drops one level.
 */
export function longRest(character) {
  const casting = character.spellcasting;
  return {
    ...restConditions(character, 'long').creature,
    hp: character.maxHp,
    hitDiceUsed: 0,
    spellcasting: casting ? { ...restoreSlots(casting), freeCastsUsed: [] } : casting
  };
}

/** Hit dice left to spend on short rests (one per level, all back on a long rest). */
export const hitDiceLeft = character => (character.hitDie ? Math.max(0, (character.level || 1) - (character.hitDiceUsed || 0)) : 0);
export const hasHitDie = character => hitDiceLeft(character) > 0;

/**
 * Short rest: spend one hit die (if any is left and the hero is hurt) to heal
 * hitDie + Constitution, and recover slots that return on a short rest (warlock).
 * @returns {{ character: object, healed: number, die: number | null, slotsRecovered: boolean }}
 */
export function shortRest(character, rollDie) {
  // Conditions that last "until a short rest" end
  let next = restConditions(character, 'short').creature;
  let healed = 0;
  let die = null;

  if (hasHitDie(character) && character.hp < character.maxHp) {
    die = rollDie(character.hitDie);
    const amount = Math.max(1, die + mod(character.stats?.con));
    const hp = Math.min(character.maxHp, character.hp + amount);
    healed = hp - character.hp;
    next = { ...next, hp, hitDiceUsed: (character.hitDiceUsed || 0) + 1 };
  }

  const casting = character.spellcasting;
  const slotsRecovered = slotRecovery(casting) === 'short' && slotTable(casting).some(row => row.used > 0);
  if (slotsRecovered) {
    next = { ...next, spellcasting: restoreSlots(casting) };
  }

  return { character: next, healed, die, slotsRecovered };
}
