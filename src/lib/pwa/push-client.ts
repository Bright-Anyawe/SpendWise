/** Turns the VAPID public key (base64url) into the bytes PushManager.subscribe expects. */
export function vapidKeyToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export type PushSupport = "supported" | "ios-needs-install" | "unsupported";

export interface BrowserTraits {
  userAgent: string;
  maxTouchPoints: number;
  /** Opened from the Home Screen / as an installed app. */
  standalone: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
}

/** iPadOS reports itself as a Mac, so a "Mac" with a touch screen is an iPad. */
export function isAppleMobile(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/**
 * Whether this browser can get SpendWise notifications. On iPhone and iPad, web push only works
 * once the app has been added to the Home Screen and opened from there.
 */
export function pushSupport(t: BrowserTraits): PushSupport {
  const capable = t.hasServiceWorker && t.hasPushManager && t.hasNotification;
  if (isAppleMobile(t.userAgent, t.maxTouchPoints) && !t.standalone) return "ios-needs-install";
  return capable ? "supported" : "unsupported";
}

export function readBrowserTraits(): BrowserTraits {
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone:
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    hasServiceWorker: "serviceWorker" in navigator,
    hasPushManager: "PushManager" in window,
    hasNotification: "Notification" in window,
  };
}
