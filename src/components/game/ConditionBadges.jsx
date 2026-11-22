import React from 'react';
import { conditionBadges } from '../../utils/conditions';

const TONES = {
  agotamiento: 'border-amber-600/60 bg-amber-950/50 text-amber-200',
  envenenado: 'border-lime-600/60 bg-lime-950/40 text-lime-200',
  asustado: 'border-purple-600/60 bg-purple-950/40 text-purple-200',
  encantado: 'border-pink-600/60 bg-pink-950/40 text-pink-200',
  invisible: 'border-sky-600/60 bg-sky-950/40 text-sky-200'
};
const DEFAULT_TONE = 'border-red-700/60 bg-red-950/40 text-red-200';

/**
 * Condition badges of a creature (hero or enemy), with a tooltip that explains
 * what the condition does and how long it lasts.
 * `focusable`: false inside another button (the enemy cards), where the native
 * title is the tooltip on touch screens.
 * `nameOf(uid)`: names of the creatures of the fight, for durations tied to their turns.
 */
export default function ConditionBadges({ creature, nameOf, focusable = true, size = 'sm', className = '' }) {
  const badges = conditionBadges(creature, nameOf);
  if (!badges.length) return null;
  const text = size === 'xs' ? 'text-[9px] px-1 py-px' : 'text-[10px] px-1.5 py-0.5';
  return (
    <ul className={`flex flex-wrap gap-1 ${className}`} aria-label="Condiciones">
      {badges.map(badge => (
        <li key={badge.key} className="relative group">
          <span
            tabIndex={focusable ? 0 : undefined}
            aria-label={badge.tooltip}
            className={`inline-flex items-center gap-0.5 rounded border font-semibold leading-tight cursor-help outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${text} ${TONES[badge.id] || DEFAULT_TONE}`}
          >
            <span aria-hidden="true">{badge.icon}</span>{badge.label}
          </span>
          <span
            role="tooltip"
            className="pointer-events-none absolute left-0 top-full z-40 mt-1 hidden w-56 rounded-lg border border-stone-700 bg-[#0f0c14] p-2 text-[11px] font-normal leading-snug text-stone-200 shadow-xl group-hover:block group-focus-within:block"
          >
            {badge.tooltip}
          </span>
        </li>
      ))}
    </ul>
  );
}
