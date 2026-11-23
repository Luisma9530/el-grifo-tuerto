import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Tabs of the game screen on a phone, in a bar at the bottom (within reach of the thumb).
 * `tabs`: { id, label, icon, badge? }[] (`badge`: a number, or true for a dot).
 */
export function MobileTabBar({ tabs, active, onChange }) {
  return (
    <nav className="lg:hidden shrink-0 flex border-t border-amber-950/60 bg-[#14101c] text-[11px] font-semibold pb-[env(safe-area-inset-bottom)]" aria-label="Secciones de la partida">
      {tabs.map(({ id, label, icon, badge }) => {
        const Icon = icon;
        const on = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={on ? 'page' : undefined}
            className={`relative flex-1 py-2 flex flex-col items-center gap-0.5 border-t-2 transition-colors ${
              on ? 'border-amber-500 text-amber-300 bg-amber-500/10' : 'border-transparent text-stone-400'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="truncate max-w-full px-1">{label}</span>
            {badge ? (
              <span
                className={`absolute top-1 left-1/2 ml-2.5 rounded-full bg-amber-500 text-stone-950 text-[9px] font-bold flex items-center justify-center ${badge === true ? 'w-2 h-2' : 'min-w-4 h-4 px-1'}`}
                aria-label="Novedades"
              >
                {badge === true ? '' : badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

/**
 * The right-hand column. During a fight (`collapsed`) it folds into a thin rail on a
 * computer, so the fight gets the room; the rail opens it over the screen. On a phone
 * it is a full-width tab (`mobileVisible`). `badge`: news on the rail (a number shows as a count).
 * `open` / `onOpenChange`: to control the rail from outside (the parent folds it again after a fight).
 */
export function SideColumn({ collapsed = false, mobileVisible = false, label = 'Mapa y diarios', railIcons = [], badge = 0, widthClass = 'lg:w-72 xl:w-80 2xl:w-88', open, onOpenChange, children }) {
  const [innerPeek, setInnerPeek] = useState(false);
  const controlled = open !== undefined;
  const peek = controlled ? open : innerPeek;
  const setPeek = update => {
    const next = typeof update === 'function' ? update(peek) : update;
    if (controlled) onOpenChange?.(next);
    else setInnerPeek(next);
  };
  // A new fight starts folded again
  if (!controlled && !collapsed && innerPeek) setInnerPeek(false);
  const folded = collapsed && !peek;

  return (
    <div className={`${mobileVisible ? 'flex' : 'hidden lg:flex'} w-full shrink-0 h-full relative ${collapsed ? 'lg:w-11' : widthClass}`}>
      {collapsed && (
        <button
          type="button"
          onClick={() => setPeek(p => !p)}
          aria-expanded={peek}
          title={peek ? `Ocultar ${label.toLowerCase()}` : `Ver ${label.toLowerCase()}`}
          className="hidden lg:flex w-11 h-full shrink-0 flex-col items-center gap-4 pt-4 border-l border-amber-950/60 bg-[#120f18] text-stone-400 hover:text-amber-300 hover:bg-[#17131f] transition-colors"
        >
          {peek ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {railIcons.map((icon, index) => {
            const Icon = icon;
            return <Icon key={index} className="w-4 h-4" aria-hidden="true" />;
          })}
          {badge > 0 && (
            <span className="min-w-4 h-4 px-1 rounded-full bg-amber-500 text-stone-950 text-[9px] font-bold flex items-center justify-center" aria-label={`${badge} novedades`}>
              {badge}
            </span>
          )}
          <span className="sr-only">{label}</span>
        </button>
      )}
      <div
        className={`w-full h-full min-w-0 ${
          collapsed ? (folded ? 'lg:hidden' : 'lg:absolute lg:top-0 lg:bottom-0 lg:right-11 lg:w-80 lg:z-30 lg:shadow-2xl lg:shadow-black/70') : ''
        }`}
      >
        {children}
      </div>
    </div>
  );
}
