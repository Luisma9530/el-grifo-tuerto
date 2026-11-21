// How a scene's damage, healing and gold change the character sheet.

/**
 * @param {{hp: number, maxHp: number, gold: number}} character  sheet before the scene
 * @param {{damage?: number, healing?: number, goldChange?: number}} effects
 * @returns {{hp: number, gold: number, knockedOut: boolean, goldLost: number}}
 *   When the hero drops to 0 HP they are knocked out: Duncan patches them up to
 *   half their maximum HP and keeps half of their gold for the trouble
 *   (`goldLost` is that fee).
 */
export function applySceneOutcome(character, { damage = 0, healing = 0, goldChange = 0 } = {}) {
  const maxHp = Math.max(1, Number(character.maxHp) || 1);
  const hpBefore = Math.min(maxHp, Math.max(0, Number(character.hp) || 0));
  let hp = Math.min(maxHp, Math.max(0, hpBefore - damage + healing));
  let gold = Math.max(0, (Number(character.gold) || 0) + goldChange);

  let knockedOut = false;
  let goldLost = 0;
  if (hp === 0 && damage > 0) {
    knockedOut = true;
    hp = Math.max(1, Math.ceil(maxHp / 2));
    goldLost = Math.floor(gold / 2);
    gold -= goldLost;
  }

  return { hp, gold, knockedOut, goldLost };
}

/**
 * A hero who fell (0 HP) is patched up by Duncan: back at half HP, minus half
 * of the gold for the trouble. Same rule as a knock-out during a scene.
 */
export function rescueKnockedOut(character) {
  const maxHp = Math.max(1, Number(character.maxHp) || 1);
  const gold = Math.max(0, Number(character.gold) || 0);
  const goldLost = Math.floor(gold / 2);
  return { hp: Math.max(1, Math.ceil(maxHp / 2)), gold: gold - goldLost, goldLost };
}
