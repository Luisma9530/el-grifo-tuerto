// Dice and ability modifiers: small and free of the game engine, so the landing
// page (the tavern demo) can roll without loading Duncan's whole engine.
import { tavernAudio } from './audio';

// Helper to calculate D&D stat modifier from score (e.g. 16 -> +3, 10 -> 0, 8 -> -1)
export function getModifier(score) {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function getModifierNumber(score) {
  return Math.floor((score - 10) / 2);
}

// Roll any polyhedral die (d4, d6, d8, d10, d12, d20, d100)
// Pass { silent: true } when the roll will be shown with animateRoll(), which
// plays its own sounds in sync with the 3D dice.
export function rollDie(sides = 20, { silent = false } = {}) {
  const val = Math.floor(Math.random() * sides) + 1;
  if (!silent) tavernAudio.playDiceRoll();
  return val;
}

// Roll a d20 check with any modifier (ability, or skill with proficiency) against a DC
// `disadvantage`: roll two d20 and keep the lower one (e.g. armor without training, poisoned)
// `advantage`: keep the higher one (both at once cancel out)
export function rollCheck({ modifier = 0, statName = 'Tirada', dc = 12, silent = false, disadvantage = false, advantage = false } = {}) {
  const first = rollDie(20, { silent });
  const twoDice = Boolean(disadvantage) !== Boolean(advantage);
  const second = twoDice ? rollDie(20, { silent: true }) : first;
  const rawRoll = !twoDice ? first : disadvantage ? Math.min(first, second) : Math.max(first, second);
  const total = rawRoll + modifier;

  const isNat20 = rawRoll === 20;
  const isNat1 = rawRoll === 1;
  const success = isNat20 ? true : isNat1 ? false : total >= dc;

  if (!silent) {
    if (isNat20) {
      tavernAudio.playCritSuccess();
    } else if (isNat1) {
      tavernAudio.playCritFail();
    }
  }

  return {
    rawRoll,
    modifier,
    total,
    dc,
    statName,
    success,
    isNat20,
    isNat1
  };
}

// Roll a check with a character's ability score
export function rollCheckWithStat(statValue, statName = 'Tirada', dc = 12, { silent = false } = {}) {
  return rollCheck({ modifier: getModifierNumber(statValue), statName, dc, silent });
}
