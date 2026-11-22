"use client";

import { useSyncExternalStore } from "react";

/** True while the media query matches. Server render and first client render use `false`. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Tablet and desktop layout (sidebar, dialogs, keyboard entry). */
export const useIsDesktop = () => useMediaQuery("(min-width: 768px)");
