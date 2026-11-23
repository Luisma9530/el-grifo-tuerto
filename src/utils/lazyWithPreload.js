import { lazy } from 'react';

/**
 * React.lazy with a `preload()` that starts downloading the component before
 * it is shown (when the player is about to open it), so it appears at once.
 * A failed download is forgotten, so the next attempt tries again.
 */
export function lazyWithPreload(load) {
  let promise = null;
  const start = () => {
    if (!promise) {
      promise = load().catch(error => {
        promise = null;
        throw error;
      });
    }
    return promise;
  };
  const Component = lazy(start);
  Component.preload = () => {
    start().catch(() => { /* it will be retried when it is shown */ });
  };
  return Component;
}

/** Run `task` when the browser is idle (soon after, where requestIdleCallback is missing). */
export function whenIdle(task, timeout = 2000) {
  if (typeof window === 'undefined') return () => {};
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(task, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(task, 200);
  return () => window.clearTimeout(id);
}
