// Lightweight entry point for 3D dice rolls (no three.js here: the heavy engine
// is loaded lazily by <DiceOverlay />, which registers itself as the "stage").

import { tavernAudio } from '../utils/audio';

const SETTING_KEY = 'tavern_dice_3d';
const ANIMATED_SIDES = [4, 6, 8, 10, 12, 20, 100];
const FALLBACK_DELAY_MS = 450;

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

/**
 * Show a dice roll whose result is already decided.
 * Resolves when the result is visible to the player, with true if the 3D
 * animation ran or false if the plain fallback (sound + short pause) was used.
 *
 * @param {object} roll
 * @param {number} roll.sides      4, 6, 8, 10, 12, 20 or 100
 * @param {number} roll.value      the number rolled (1..sides)
 * @param {number} [roll.modifier] added to the value in the result banner
 * @param {string} [roll.label]    e.g. "Tirada de Fuerza"
 * @param {number} [roll.dc]       difficulty class, to show success / failure
 * @param {boolean} [roll.success] overrides the success computed from dc
 */
export async function animateRoll(roll) {
  const canAnimate = stage && is3DDiceEnabled() && !prefersReducedMotion() && ANIMATED_SIDES.includes(roll.sides);

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
  playOutcomeSound(getRollOutcome(roll.sides, roll.value));
  return false;
}
