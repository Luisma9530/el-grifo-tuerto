import React from 'react';

/**
 * Shown while a screen loaded on demand arrives (usually a few milliseconds:
 * it is preloaded). Its text only fades in if the wait is noticeable, so a
 * quick load shows nothing but the tavern's dark background.
 */
export default function LoadingScreen({ text = 'Abriendo la taberna…' }) {
  return (
    <div className="flex-1 min-h-screen flex items-center justify-center bg-[#0b090e]" role="status" aria-live="polite">
      <p className="loading-fade-in font-cinzel text-sm tracking-wide text-amber-200/70">{text}</p>
    </div>
  );
}
