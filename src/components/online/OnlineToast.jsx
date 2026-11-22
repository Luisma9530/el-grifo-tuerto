import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/** A short notice for this screen only (refused actions, someone left...). It hides by itself. */
export default function OnlineToast({ text, onClose, ms = 6000 }) {
  useEffect(() => {
    if (!text) return undefined;
    const timer = setTimeout(onClose, ms);
    return () => clearTimeout(timer);
  }, [text, onClose, ms]);
  if (!text) return null;
  return (
    <div role="status" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] max-w-md w-[calc(100%-2rem)] px-4 py-2.5 rounded-xl bg-[#1a1523] border border-sky-700/60 shadow-2xl text-xs text-sky-100 flex items-start gap-2">
      <span className="flex-1">{text}</span>
      <button onClick={onClose} aria-label="Cerrar aviso" className="text-stone-400 hover:text-stone-200"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}
