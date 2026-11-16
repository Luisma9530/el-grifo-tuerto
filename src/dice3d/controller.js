// Lightweight entry point for 3D dice rolls (no three.js here: the heavy engine
// is loaded lazily by <DiceOverlay />, which registers itself as the "stage").

import { tavernAudio } from '../utils/audio';

const SETTING_KEY = 'tavern_dice_3d';
const ANIMATED_SIDES = [4, 6, 8, 10, 12, 20, 100];
const FALLBACK_DELAY_MS = 450;
const MAX_PHYSICAL_DICE = 5; // more than this gets crowded: resolved instantly instead

let stage = null;

/** Player preference (Settings): 3D dice are on unless explicitly turned off. */
export function is3DDiceEnabled() {
  try {
    return localStorage.getItem(SETTING_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function set3DDiceEnabled(enabled) {
  try {
    if (enabled) localStorage.removeItem(SETTING_KEY);
    else localStorage.setItem(SETTING_KEY, 'off');
  } catch {
    // ignore: the preference just won't persist
  }
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Called by <DiceOverlay /> on mount. `run(roll)` must resolve to true once the
 * dice have settled, or false if the animation could not run.
 * Returns an unregister function.
 */
export function registerDiceStage(run) {
  stage = run;
  return () => {
    if (stage === run) stage = null;
  };
}

/** 'crit' (natural 20), 'fumble' (natural 1) or 'normal'. Only a d20 can crit. */
export function getRollOutcome(sides, value) {
  if (sides === 20 && value === 20) return 'crit';
  if (sides === 20 && value === 1) return 'fumble';
  return 'normal';
}

export function playOutcomeSound(outcome) {
  if (outcome === 'crit') tavernAudio.playCritSuccess();
  else if (outcome === 'fumble') tavernAudio.playCritFail();
}

/** "d20", "3d6" or "2d8 + 1d4" for a set of dice. */
export function diceNotation(dice) {
  const counts = new Map();
  dice.forEach(die => counts.set(die.sides, (counts.get(die.sides) || 0) + 1));
  return [...counts.entries()]
    .map(([sides, count]) => (count === 1 && counts.size === 1 ? `d${sides}` : `${count}d${sides}`))
    .join(' + ');
}

/**
 * Accepts { sides, value } for one die or { dice: [{ sides, value }] } for several,
 * and returns the roll with `dice`, the summed `value`, its `notation` and `outcome`.
 */
export function normalizeRoll(roll) {
  const dice = Array.isArray(roll.dice) && roll.dice.length > 0
    ? roll.dice
    : [{ sides: roll.sides, value: roll.value }];
  return {
    ...roll,
    dice,
    value: dice.reduce((sum, die) => sum + die.value, 0),
    notation: diceNotation(dice),
    outcome: dice.length === 1 ? getRollOutcome(dice[0].sides, dice[0].value) : 'normal'
  };
}

/**
 * Show a dice roll whose result is already decided.
 * Resolves when the result is visible to the player, with true if the 3D
 * animation ran or false if the plain fallback (sound + short pause) was used.
 *
 * @param {object} roll
 * @param {number} [roll.sides]    4, 6, 8, 10, 12, 20 or 100 (single die)
 * @param {number} [roll.value]    the number rolled (1..sides)
 * @param {{sides: number, value: number}[]} [roll.dice]  several dice instead (e.g. 3d6 of damage)
 * @param {number} [roll.modifier] added to the value in the result banner
 * @param {string} [roll.label]    e.g. "Tirada de Fuerza"
 * @param {number} [roll.dc]       difficulty class, to show success / failure
 * @param {boolean} [roll.success] overrides the success computed from dc
 */
export async function animateRoll(input) {
  const roll = normalizeRoll(input);
  const physicalDice = roll.dice.reduce((count, die) => count + (die.sides === 100 ? 2 : 1), 0);
  const canAnimate = stage && is3DDiceEnabled() && !prefersReducedMotion()
    && roll.dice.every(die => ANIMATED_SIDES.includes(die.sides))
    && physicalDice <= MAX_PHYSICAL_DICE;

  if (canAnimate) {
    try {
      if (await stage(roll)) return true;
    } catch (error) {
      console.error('No se pudo animar la tirada en 3D:', error);
    }
  }

  // Fallback: classic dice sound and a short pause before revealing the result
  tavernAudio.playDiceRoll();
  await new Promise(resolve => setTimeout(resolve, FALLBACK_DELAY_MS));
  playOutcomeSound(roll.outcome);
  return false;
}
