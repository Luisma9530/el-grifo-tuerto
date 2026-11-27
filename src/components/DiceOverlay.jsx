import React, { useCallback, useEffect, useRef, useState } from 'react';
import { registerDiceStage, playOutcomeSound } from '../dice3d/controller';
import { tavernAudio } from '../utils/audio';

const HOLD_MS = { normal: 1500, crit: 2300, fumble: 2300 };
const BANNER_SPACE = 175; // px needed above the dice for the result banner

const OUTCOME_STYLES = {
  crit: { number: 'text-emerald-300', glow: '0 0 28px rgba(52, 211, 153, 0.85)', ring: 'border-emerald-400/70' },
  fumble: { number: 'text-red-400', glow: '0 0 28px rgba(239, 68, 68, 0.85)', ring: 'border-red-500/70' },
  normal: { number: 'text-amber-200', glow: '0 0 24px rgba(245, 158, 11, 0.7)', ring: 'border-amber-500/60' }
};

function describeRoll(roll, outcome) {
  const modifier = roll.modifier || 0;
  const total = roll.value + modifier;
  const breakdown = modifier !== 0
    ? `${roll.value} ${modifier > 0 ? '+' : '−'} ${Math.abs(modifier)}`
    : null;

  let verdict = null;
  if (outcome === 'crit') verdict = '¡Crítico!';
  else if (outcome === 'fumble') verdict = '¡Pifia!';
  else if (typeof roll.success === 'boolean') verdict = roll.success ? 'Éxito' : 'Fallo';
  else if (typeof roll.dc === 'number') verdict = total >= roll.dc ? 'Éxito' : 'Fallo';
  return { total, breakdown, verdict };
}

/**
 * Full-screen stage where 3D dice are thrown. Mounted once in <App />; rolls are
 * requested through animateRoll() in dice3d/controller. Click / Esc skips.
 */
export default function DiceOverlay() {
  const canvasRef = useRef(null);
  const enginePromiseRef = useRef(null);
  const activeRef = useRef(null); // { phase, skip, dismiss }
  const tokenRef = useRef(0);
  const [view, setView] = useState({ phase: 'idle' });

  const getEngine = useCallback(() => {
    if (!enginePromiseRef.current) {
      enginePromiseRef.current = import('../dice3d/engine')
        .then(({ createDiceEngine }) => createDiceEngine(canvasRef.current))
        .catch(error => {
          enginePromiseRef.current = null; // allow a retry on the next roll
          throw error;
        });
    }
    return enginePromiseRef.current;
  }, []);

  const runRoll = useCallback(async (roll) => {
    // Browsers pause animation frames in background tabs: nothing to show there
    if (document.hidden) return false;

    const token = ++tokenRef.current;
    activeRef.current?.dismiss();

    const engine = await getEngine();
    if (token !== tokenRef.current) return true; // superseded by a newer roll

    setView({ phase: 'rolling', roll });
    // Wait a frame so the stage is laid out before measuring the canvas
    // (with a timer as backup, in case frames are paused)
    await new Promise(resolve => {
      requestAnimationFrame(resolve);
      setTimeout(resolve, 120);
    });
    if (token !== tokenRef.current) return true;

    engine.resize();
    const playback = engine.roll(roll, { onImpact: strength => tavernAudio.playDiceImpact(strength) });

    // Never leave the game waiting on a stalled animation (e.g. tab sent to the
    // background mid-roll): jump to the result shortly after it should have ended.
    const watchdog = setTimeout(playback.skip, playback.duration * 1000 + 1200);
    playback.done.then(() => clearTimeout(watchdog));

    let holdTimer = null;
    const active = {
      phase: 'rolling',
      skip: playback.skip,
      dismiss: () => {
        if (active.phase === 'gone') return;
        active.phase = 'gone';
        clearTimeout(holdTimer);
        playback.skip();
        engine.stop();
        if (activeRef.current === active) activeRef.current = null;
        setView(current => (current.roll === roll ? { phase: 'idle' } : current));
      }
    };
    activeRef.current = active;

    await playback.done;
    if (active.phase === 'gone') return true;

    active.phase = 'result';
    const { outcome } = roll;
    engine.highlight(outcome);
    playOutcomeSound(outcome);
    setView({ phase: 'result', roll, outcome, anchor: engine.getAnchor() });
    holdTimer = setTimeout(active.dismiss, HOLD_MS[outcome]);
    return true;
  }, [getEngine]);

  useEffect(() => registerDiceStage(runRoll), [runRoll]);

  // Free the WebGL context when the app unmounts
  useEffect(() => () => {
    activeRef.current?.dismiss();
    enginePromiseRef.current?.then(engine => engine.dispose()).catch(() => {});
    enginePromiseRef.current = null;
  }, []);

  const handleInteract = useCallback(() => {
    const active = activeRef.current;
    if (!active) return;
    if (active.phase === 'rolling') active.skip();
    else active.dismiss();
  }, []);

  const isActive = view.phase !== 'idle';

  useEffect(() => {
    if (!isActive) return undefined;
    const onKey = event => {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleInteract();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isActive, handleInteract]);

  const { roll, outcome = 'normal', anchor } = view;
  const result = view.phase === 'result' ? describeRoll(roll, outcome) : null;
  const styles = OUTCOME_STYLES[outcome];

  return (
    <div
      className={`fixed inset-0 z-[70] transition-opacity duration-200 ${
        isActive ? 'opacity-100 cursor-pointer' : 'opacity-0 pointer-events-none'
      }`}
      onClick={handleInteract}
      aria-hidden={!isActive}
    >
      {/* Dim the tavern so the dice stand out */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, rgba(11, 9, 14, 0.45) 0%, rgba(11, 9, 14, 0.82) 100%)' }}
      />

      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {result && (
        <div
          className="absolute pointer-events-none"
          style={
            // Above the dice, or below them when they came to rest near the top edge
            anchor.above >= BANNER_SPACE
              ? { left: `clamp(120px, ${anchor.x}px, calc(100% - 120px))`, top: anchor.above, transform: 'translate(-50%, -100%)' }
              : { left: `clamp(120px, ${anchor.x}px, calc(100% - 120px))`, top: anchor.below, transform: 'translate(-50%, 0)' }
          }
        >
          <div className={`animate-dice-result px-6 py-3 rounded-2xl bg-[#120e18]/90 border-2 ${styles.ring} text-center shadow-2xl shadow-black/70 backdrop-blur-sm`}>
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-mono whitespace-nowrap">
              {roll.label ? `${roll.label} · ${roll.notation}` : roll.notation}
            </div>
            <div
              className={`font-cinzel font-black text-6xl leading-none my-1 ${styles.number}`}
              style={{ textShadow: styles.glow }}
            >
              {result.total}
            </div>
            {result.breakdown && (
              <div className="text-xs font-mono text-stone-300 whitespace-nowrap">{result.breakdown}</div>
            )}
            {result.verdict && (
              <div className={`mt-1 font-cinzel font-bold text-sm uppercase tracking-wider whitespace-nowrap ${styles.number}`}>
                {result.verdict}
                {outcome === 'normal' && !roll.against && typeof roll.dc === 'number' && (
                  <span className="text-stone-400 font-mono normal-case tracking-normal"> · CD {roll.dc}</span>
                )}
              </div>
            )}
            {/* What a check was compared with: «contra Perspicacia del erudito 17» (own line: it can be long) */}
            {roll.against && (
              <div className="mt-0.5 max-w-[15rem] mx-auto text-[11px] font-mono text-stone-400 leading-snug">contra {roll.against}</div>
            )}
          </div>
        </div>
      )}

      {isActive && (
        <div className="absolute bottom-5 inset-x-0 text-center text-[11px] text-stone-400/80 font-mono pointer-events-none">
          {view.phase === 'rolling' ? 'Pulsa para saltar la animación' : 'Pulsa para continuar'}
        </div>
      )}

      {/* Announce the result to screen readers */}
      <div className="sr-only" role="status" aria-live="polite">
        {result && `${roll.label || `Tirada de ${roll.notation}`}: ${result.total}${result.breakdown ? ` (${result.breakdown})` : ''}${result.verdict ? `. ${result.verdict}` : ''}${roll.against ? `, contra ${roll.against}` : ''}`}
      </div>
    </div>
  );
}
