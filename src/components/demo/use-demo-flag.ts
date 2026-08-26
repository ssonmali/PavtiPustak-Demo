"use client";

import * as React from "react";

/**
 * A one-way "the visitor has seen this" flag in localStorage.
 *
 * Read through `useSyncExternalStore` rather than an effect, so the value the
 * server renders is explicitly *unknown* rather than a guess that has to be
 * corrected on hydration — which is what would make the banner flash up for
 * someone who dismissed it a week ago.
 */

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** `undefined` on the server, `null` when unset, `"1"` once set. */
export function useDemoFlag(key: string) {
  const value = React.useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        // Storage blocked (private browsing). Treated as never set, so the
        // visitor gets the first-time experience rather than a broken page.
        return null;
      }
    },
    () => undefined,
  );

  const set = React.useCallback(() => {
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // Nothing to do; it simply shows again next time.
    }
    for (const listener of listeners) listener();
  }, [key]);

  return [value, set] as const;
}
