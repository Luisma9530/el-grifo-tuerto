// Weapon attacks resolved by the game (no AI needed): attack rolls, damage,
// critical hits, Extra Attack, Sneak Attack, Rage and the monk's Martial Arts.

import {
  WEAPONS, WEAPON_PROFICIENCY, EXTRA_ATTACK, MARTIAL_ARTS_DIE, RAGE_DAMAGE, WEAPON_NAME_HINTS, PROPERTY_NAMES
} from '../data/weapons';
import { parseDice } from './spellcasting';

const mod = score => Math.floor(((Number(score) || 10) - 10) / 2);
const byLevel = (table, level) => Object.entries(table)
  .filter(([threshold]) => level >= Number(threshold))
  .reduce((value, [, v]) => v, null);

export const DEFAULT_TARGET_AC = 12;
export const getWeapon = id => WEAPONS.find(w => w.id === id) || null;

/** The weapon an inventory item is (null for non-weapons). */
export function weaponForItem(item) {
  if (!item) return null;
  if (item.weaponId) return getWeapon(item.weaponId);
  if (item.type && item.type !== 'weapon') return null;
  const name = String(item.name || '').toLowerCase();
  const hint = WEAPON_NAME_HINTS.find(([words]) => name.includes(words));
  return hint ? getWeapon(hint[1]) : null;
}

/** Weapons are ready to use unless the player unequipped them. */
export const isEquipped = item => item.equipped !== false;

/** Mark an inventory item as equipped or not. */
export function setEquipped(character, itemId, equipped) {
  return {
    ...character,
    inventory: (character.inventory || []).map(item => (item.id === itemId ? { ...item, equipped } : item))
  };
}

const level = character => Number(character.level) || 1;
const hasShield = character => (character.inventory || []).some(item => /escudo/i.test(item.name || '') && isEquipped(item));

export function isProficient(character, weapon) {
  if (weapon.category === 'simple') return true;
  const martial = WEAPON_PROFICIENCY[character.classId]?.martial;
  if (martial === true) return true;
  if (Array.isArray(martial)) return weapon.properties.some(p => martial.includes(p));
  // Heroes from older saves have no classId: treat them as proficient
  return !character.classId;
}

export const attacksPerAction = character => byLevel(EXTRA_ATTACK[character.classId] || {}, level(character)) || 1;
export const sneakAttackDice = character => (character.classId === 'rogue' ? Math.ceil(level(character) / 2) : 0);
export const rageBonus = character => (character.classId === 'barbarian' ? byLevel(RAGE_DAMAGE, level(character)) : 0);
const martialArtsDie = character => (character.classId === 'monk' ? byLevel(MARTIAL_ARTS_DIE, level(character)) : null);

/** Monks use Dexterity and their Martial Arts die with simple melee and light martial melee weapons. */
const isMonkWeapon = weapon => weapon.kind === 'melee'
  && (weapon.category === 'simple' || weapon.properties.includes('light'));

/**
 * Everything the hero can attack with: equipped weapons plus an unarmed strike.
 * Each option: { id, itemId, name, weapon, ability, attackBonus, damage, damageBonus, type, proficient, notes }
 */
export function attackOptions(character) {
  const str = mod(character.stats?.fue);
  const dex = mod(character.stats?.des);
  const pb = Number(character.proficiencyBonus) || 2;
  const maDie = martialArtsDie(character);
  const twoHands = !hasShield(character);
  const options = [];

  (character.inventory || []).forEach(item => {
    const weapon = weaponForItem(item);
    if (!weapon || !isEquipped(item)) return;
    const monk = maDie && isMonkWeapon(weapon);
    const finesse = weapon.properties.includes('finesse') || monk;
    const ability = weapon.kind === 'ranged' && !weapon.properties.includes('thrown')
      ? 'des'
      : finesse && dex > str ? 'des' : 'fue';
    const abilityMod = ability === 'des' ? dex : str;
    const proficient = isProficient(character, weapon);
    let damage = weapon.versatile && twoHands ? weapon.versatile : weapon.damage;
    if (monk) {
      const current = parseDice(damage);
      if (current && current.count === 1 && current.sides < maDie) damage = `1d${maDie}`;
    }
    const notes = [
      ...weapon.properties.map(p => PROPERTY_NAMES[p]),
      weapon.versatile && twoHands ? 'a dos manos' : null,
      weapon.range ? `alcance ${weapon.range[0]}/${weapon.range[1]} m` : null,
      proficient ? null : 'sin competencia'
    ].filter(Boolean);
    options.push({
      id: item.id,
      itemId: item.id,
      name: weapon.name,
      itemName: item.name,
      weapon,
      ability,
      attackBonus: abilityMod + (proficient ? pb : 0),
      damage,
      damageBonus: abilityMod,
      type: weapon.type,
      proficient,
      notes: [...new Set(notes)]
    });
  });

  // Unarmed strike: always available (monks use their Martial Arts die and Dexterity)
  const unarmedAbility = maDie && dex > str ? 'des' : 'fue';
  const unarmedMod = unarmedAbility === 'des' ? dex : str;
  options.push({
    id: 'unarmed',
    itemId: null,
    name: 'Golpe sin armas',
    itemName: 'Golpe sin armas',
    weapon: null,
    ability: unarmedAbility,
    attackBonus: unarmedMod + pb,
    damage: maDie ? `1d${maDie}` : '0d4+1',
    damageBonus: unarmedMod,
    type: 'contundente',
    proficient: true,
    notes: maDie ? ['artes marciales'] : []
  });

  return options;
}

/** "1d8 +3", or the fixed amount for weapons without dice ("2" for an unarmed strike). */
export function damageLabel(option) {
  const parsed = parseDice(option.damage);
  if (!parsed) return option.damage;
  if (parsed.count === 0) return String(Math.max(1, parsed.bonus + option.damageBonus));
  const bonus = parsed.bonus + option.damageBonus;
  return `${parsed.count}d${parsed.sides}${bonus ? ` ${bonus > 0 ? '+' : '−'}${Math.abs(bonus)}` : ''}`;
}

function rollDice(notation, rollDie, multiplier = 1) {
  const parsed = parseDice(notation);
  const dice = Array.from({ length: parsed.count * multiplier }, () => rollDie(parsed.sides));
  return { dice, sides: parsed.sides, fixed: parsed.bonus };
}

/**
 * Resolve an Attack action with one of the hero's attack options.
 * @param {(sides: number) => number} rollDie
 * @param {{ targetAC?: number, raging?: boolean }} [options]
 * @returns {{ ok: false, error: string } | { ok: true, attack: object }}
 *   attack: { option, targetAC, rolls: [{ raw, total, hit, crit, fumble, damage: { dice, sides, bonus, total } | null }],
 *             sneak: { dice, sides, total } | null, rage: number, totalDamage, hits }
 *   Natural 20: hit, damage dice doubled. Natural 1: miss. Sneak Attack is added
 *   once, to the first hit with a finesse or ranged weapon.
 */
export function resolveAttack(character, optionId, rollDie, { targetAC = DEFAULT_TARGET_AC, raging = false } = {}) {
  const option = attackOptions(character).find(o => o.id === optionId);
  if (!option) return { ok: false, error: 'No tienes ese arma equipada.' };

  const ac = Number(targetAC) > 0 ? Math.round(Number(targetAC)) : DEFAULT_TARGET_AC;
  const rage = raging && option.ability === 'fue' && option.weapon?.kind !== 'ranged' ? rageBonus(character) : 0;
  const count = attacksPerAction(character);
  const sneakDice = sneakAttackDice(character);
  const sneakEligible = sneakDice > 0 && option.weapon
    && (option.weapon.properties.includes('finesse') || option.weapon.kind === 'ranged');

  let sneak = null;
  const rolls = Array.from({ length: count }, () => {
    const raw = rollDie(20);
    const total = raw + option.attackBonus;
    const crit = raw === 20;
    const fumble = raw === 1;
    const hit = crit || (!fumble && total >= ac);
    let damage = null;
    if (hit) {
      const rolled = rollDice(option.damage, rollDie, crit ? 2 : 1);
      const bonus = rolled.fixed + option.damageBonus + rage;
      damage = { dice: rolled.dice, sides: rolled.sides, bonus, total: Math.max(1, rolled.dice.reduce((a, b) => a + b, 0) + bonus) };
      if (sneakEligible && !sneak) {
        const extra = rollDice(`${sneakDice}d6`, rollDie, crit ? 2 : 1);
        sneak = { dice: extra.dice, sides: 6, total: extra.dice.reduce((a, b) => a + b, 0) };
      }
    }
    return { raw, total, hit, crit, fumble, damage };
  });

  const hits = rolls.filter(r => r.hit).length;
  const totalDamage = rolls.reduce((sum, r) => sum + (r.damage?.total || 0), 0) + (sneak?.total || 0);
  return { ok: true, attack: { option, targetAC: ac, rolls, sneak, rage, totalDamage, hits } };
}

/** The line written in the chronicle (and sent to the Dungeon Master). */
export function describeAttack(attack, target = '') {
  const { option } = attack;
  // Spanish contraction: "a el encapuchado" -> "al encapuchado"
  const who = target.trim().replace(/^el\s+/i, 'l ');
  const on = who ? (who.startsWith('l ') ? ` a${who}` : ` a ${who}`) : '';
  const head = `Ataco${on} con ${option.weapon ? `mi ${option.name.toLowerCase()}` : 'un golpe sin armas'}${attack.rage ? ' en plena furia' : ''}.`;
  const parts = attack.rolls.map((r, i) => {
    const label = attack.rolls.length > 1 ? `Ataque ${i + 1}` : 'Ataque';
    const roll = `[🎲 ${label} D20: ${r.raw} (${r.total - r.raw >= 0 ? '+' : ''}${r.total - r.raw}) = ${r.total} vs CA ${attack.targetAC}]`;
    if (r.crit) return `${roll} ¡Crítico! ${r.damage.total} de daño ${option.type}.`;
    if (r.hit) return `${roll} Impacta: ${r.damage.total} de daño ${option.type}.`;
    return `${roll} ${r.fumble ? '¡Pifia!' : 'Falla.'}`;
  });
  const sneak = attack.sneak ? ` Ataque Furtivo: +${attack.sneak.total} de daño.` : '';
  const total = attack.hits > 0 ? ` Daño total: ${attack.totalDamage}.` : '';
  return `${head} ${parts.join(' ')}${sneak}${total}`;
}
