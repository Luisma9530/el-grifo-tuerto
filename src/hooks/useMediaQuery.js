import { useEffect, useState } from 'react';

const matches = query => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);

/** Whether a CSS media query matches now (and again when it changes). */
export function useMediaQuery(query) {
  const [match, setMatch] = useState(() => matches(query));
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const list = window.matchMedia(query);
    const onChange = event => setMatch(event.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return match;
}

/** The three-column layout of the game (Tailwind's `lg`). */
export const WIDE_LAYOUT = '(min-width: 1024px)';
