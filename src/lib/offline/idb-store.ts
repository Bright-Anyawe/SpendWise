import { createQueue, type QueuedExpense, type QueueStore } from "./queue";

// Must match public/sw.js, which drains the same store during Background Sync.
const DB_NAME = "spendwise-offline";
const STORE = "expenses";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = action(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(request ? request.result : undefined);
        };
        tx.onerror = () => reject(tx.error);
      }),
  );
}

const idbStore: QueueStore = {
  getAll: async () => (await run<QueuedExpense[]>("readonly", (s) => s.getAll())) ?? [],
  put: async (item) => void (await run("readwrite", (s) => s.put(item))),
  delete: async (id) => void (await run("readwrite", (s) => s.delete(id))),
};

/** The device's queue of expenses saved while offline. Browser only. */
export const offlineQueue = createQueue(idbStore);

/** Fired on window whenever the queue changes, so the status bar can update. */
export const QUEUE_CHANGED = "spendwise:queue-changed";

/** Asks the service worker to send the queue when the connection is back (Chrome/Edge/Android). */
export async function requestBackgroundSync(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker?.ready;
    const sync = (registration as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } })?.sync;
    await sync?.register("sync-expenses");
  } catch {
    // Not supported: the app syncs itself when it comes back online or is opened.
  }
}
