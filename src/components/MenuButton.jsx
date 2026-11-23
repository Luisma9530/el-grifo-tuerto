import React, { useEffect, useId, useRef, useState } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';

/**
 * A button that opens a small menu of actions (the «⋯ / Más» menus).
 * `items`: { label, icon?, onClick, hint?, tone?, hidden?, className? }[]; a `'divider'` string draws a line.
 * Closes when an item is chosen, on Escape or when clicking outside.
 */
export default function MenuButton({ label, icon, items, className = '', buttonClassName = '', title, align = 'right', badge = null }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuId = useId();
  useEscapeKey(open, () => setOpen(false));

  useEffect(() => {
    if (!open) return undefined;
    const onDown = event => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const visible = items.filter(item => item && !item.hidden);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title={title}
        className={`relative ${buttonClassName}`}
      >
        {icon}
        {label && <span>{label}</span>}
        {badge}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className={`absolute top-full mt-2 ${align === 'right' ? 'right-0' : 'left-0'} z-50 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-amber-900/50 bg-[#1a1523] p-1.5 shadow-2xl shadow-black/60`}
        >
          {visible.map((item, index) => item === 'divider' ? (
            <div key={`d${index}`} role="separator" className="my-1 border-t border-amber-950/60" />
          ) : (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); item.onClick?.(); }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm transition-colors hover:bg-stone-800/80 ${item.tone || 'text-stone-200'} ${item.className || ''}`}
            >
              {item.icon && <span className="shrink-0 w-4 flex justify-center">{item.icon}</span>}
              <span className="flex-1 min-w-0">
                <span className="block truncate">{item.label}</span>
                {item.hint && <span className="block text-[11px] text-stone-500 truncate">{item.hint}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
