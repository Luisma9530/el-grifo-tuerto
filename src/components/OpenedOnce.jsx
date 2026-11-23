import React, { Suspense, useState } from 'react';

/**
 * Mounts its (lazily loaded) children the first time `when` is true and keeps
 * them mounted afterwards, so a window loaded on demand keeps what was typed
 * in it after closing, exactly as when it was part of the initial bundle.
 */
export default function OpenedOnce({ when, children }) {
  const [opened, setOpened] = useState(Boolean(when));
  if (when && !opened) setOpened(true);
  return opened ? <Suspense fallback={null}>{children}</Suspense> : null;
}
