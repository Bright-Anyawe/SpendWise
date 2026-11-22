/* SpendWise Auto service worker.
 * - Caches static assets (cache-first) and pages you've visited (network-first), with an offline page.
 * - Shows push notifications and opens the right screen when one is tapped.
 * - Background Sync: sends expenses saved while offline (IndexedDB queue shared with the app).
 * Bump VERSION when this file's caching changes.
 */
const VERSION = "v1";
const STATIC_CACHE = `spendwise-static-${VERSION}`;
const PAGES_CACHE = `spendwise-pages-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192", "/icons/badge-96"];

const DB_NAME = "spendwise-offline";
const STORE = "expenses";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [STATIC_CACHE, PAGES_CACHE];
      for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  // Sent on sign-out so pages with someone's data don't stay on the device.
  if (event.data && event.data.type === "clear-caches") event.waitUntil(caches.delete(PAGES_CACHE));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // auth, exports and sync always go to the network

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.mode === "navigate") event.respondWith(networkFirstPage(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic" && !response.redirected) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

// ─── Push notifications ───────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "SpendWise Auto", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "SpendWise Auto", {
      body: data.body || "",
      icon: "/icons/icon-192",
      badge: "/icons/badge-96",
      tag: data.tag,
      data: { url: data.url || "/" },
      actions: Array.isArray(data.actions) ? data.actions : [],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const base = (event.notification.data && event.notification.data.url) || "/";
  const url = event.action === "add" ? "/?add=1" : event.action === "no-spend" ? "/?no-spend=1" : base;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client) {
          await client.navigate(url).catch(() => undefined);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});

// ─── Background Sync: expenses saved while offline ────────────────────────

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-expenses") event.waitUntil(syncQueuedExpenses());
});

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function storeRequest(db, mode, run) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = run(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request ? request.result : undefined);
    tx.onerror = () => reject(tx.error);
  });
}

async function syncQueuedExpenses() {
  const db = await openDb();
  const items = await storeRequest(db, "readonly", (store) => store.getAll());
  if (!items || items.length === 0) return;

  const response = await fetch("/api/expenses/sync", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: items.map((item) => item.input) }),
  });
  // Not signed in or the server is unhappy: keep everything for the next try.
  if (!response.ok) throw new Error(`sync failed: ${response.status}`);

  const result = await response.json();
  const done = [...result.synced, ...result.rejected.map((r) => r.id)];
  for (const id of done) await storeRequest(db, "readwrite", (store) => store.delete(id));

  const windows = await self.clients.matchAll({ type: "window" });
  for (const client of windows) client.postMessage({ type: "expenses-synced", synced: result.synced, rejected: result.rejected });
}
