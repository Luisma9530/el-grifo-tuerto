import { useEffect, useRef } from 'react';

/** Calls onEscape when the Escape key is pressed while `active` is true (e.g. an open modal). */
export function useEscapeKey(active, onEscape) {
  const handlerRef = useRef(onEscape);

  useEffect(() => {
    handlerRef.current = onEscape;
  });

  useEffect(() => {
    if (!active) return undefined;
    const onKeyDown = event => {
      if (event.key === 'Escape') handlerRef.current?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active]);
}
