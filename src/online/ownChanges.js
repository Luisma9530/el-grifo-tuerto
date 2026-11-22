// Changes a player makes to their own character outside combat (equipment, level
// up), played by the host with the same rules as offline: equipment.js decides
// what can be held or worn, leveling.js whether the level-up choices are legal.
// The host rolls the hit die itself when the player chose to roll.

import { setHands, setWornArmor } from '../utils/equipment';
import { canLevelUp, levelUpPlan, applyLevelUp } from '../utils/leveling';

/**
 * @param sheet the member's sheet (with the purse as `gold`, see party.js memberSheet)
 * @param direct { kind: 'equip', hands, armorId } | { kind: 'levelUp', choices }
 * @param rollDie (sides) => number
 * @returns {{ ok: true, character, summary?, changed? } | { ok: false, error }}
 */
export function applyOwnChange(sheet, direct, rollDie) {
  if (!sheet) return { ok: false, error: 'Ese personaje no está en el grupo.' };
  if (direct.kind === 'equip') {
    const held = setHands(sheet, direct.hands);
    if (!held.ok) return held;
    const worn = setWornArmor(held.character, direct.armorId);
    if (!worn.ok) return worn;
    const changed = held.changed || (sheet.wornArmor || null) !== (worn.character.wornArmor || null);
    return { ok: true, character: worn.character, changed };
  }
  if (direct.kind === 'levelUp') {
    if (!canLevelUp(sheet)) return { ok: false, error: `${sheet.name} aún no tiene experiencia para subir de nivel.` };
    const plan = levelUpPlan(sheet);
    const choices = direct.choices.hp.method === 'roll'
      ? { ...direct.choices, hp: { method: 'roll', roll: rollDie(plan.hitDie) } }
      : direct.choices;
    try {
      const { character, summary } = applyLevelUp(sheet, choices);
      return { ok: true, character, summary, roll: choices.hp.roll };
    } catch (err) {
      return { ok: false, error: err?.message || 'Esa subida de nivel no es válida.' };
    }
  }
  return { ok: false, error: 'Mensaje no válido.' };
}
