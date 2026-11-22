"use client";

import { useEffect } from "react";

/**
 * Registers the service worker in production builds. In development it removes any old one,
 * because dev assets change without new names and would be served stale.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      return;
    }
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
  }, []);
  return null;
}

/**
 * Call on sign-out: the service worker forgets cached pages, and this device stops getting the
 * account's notifications (the push service then reports the old endpoint as gone, and the
 * reminder job deletes it).
 */
export function forgetThisDevice() {
  navigator.serviceWorker?.controller?.postMessage({ type: "clear-caches" });
  void navigator.serviceWorker
    ?.getRegistration()
    .then((registration) => registration?.pushManager.getSubscription())
    .then((subscription) => subscription?.unsubscribe())
    .catch(() => undefined);
}
