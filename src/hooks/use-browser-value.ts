"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * Reads a value that only exists in the browser (time zone, URL query, …) without a
 * hydration mismatch: the server render and first client render use `serverValue`.
 * `read` must return a stable value (a primitive, or the same object each call).
 */
export function useBrowserValue<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(noopSubscribe, read, () => serverValue);
}
