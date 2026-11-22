"use client";

import { CloudOff, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { offlineQueue, QUEUE_CHANGED } from "@/lib/offline/idb-store";
import { drainQueue, type OfflineExpenseInput, type SyncResponse } from "@/lib/offline/queue";

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

async function sendToServer(items: OfflineExpenseInput[]): Promise<SyncResponse> {
  const response = await fetch("/api/expenses/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!response.ok) throw new Error(`Sync failed (${response.status})`);
  return response.json();
}

/**
 * Slim bar under the page header: "You're offline" or "N expenses waiting to sync".
 * Sends queued expenses when the app opens and whenever the connection comes back.
 */
export function SyncStatus() {
  const router = useRouter();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = useCallback(() => {
    offlineQueue.count().then(setPending, () => setPending(0));
  }, []);

  const inFlight = useRef(false);

  const sync = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const waiting = await offlineQueue.count().catch(() => 0);
    if (waiting === 0) {
      inFlight.current = false;
      setPending(0);
      return;
    }
    setSyncing(true);
    try {
      const result = await drainQueue(offlineQueue, sendToServer);
      if (result.synced > 0) {
        toast(`${result.synced} ${result.synced === 1 ? "expense" : "expenses"} saved while offline ${result.synced === 1 ? "is" : "are"} now synced.`);
        router.refresh();
      }
      for (const r of result.rejected) toast.error(`An expense saved offline couldn’t be added: ${r.error}`);
    } finally {
      inFlight.current = false;
      setSyncing(false);
      refreshCount();
    }
  }, [router, refreshCount]);

  useEffect(() => {
    const onChanged = () => refreshCount();
    const onOnline = () => void sync();
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "expenses-synced") {
        refreshCount();
        router.refresh();
      }
    };
    window.addEventListener(QUEUE_CHANGED, onChanged);
    window.addEventListener("online", onOnline);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    // Send anything left over from last time once the app has opened.
    const initial = window.setTimeout(() => (navigator.onLine ? void sync() : refreshCount()), 0);
    return () => {
      window.clearTimeout(initial);
      window.removeEventListener(QUEUE_CHANGED, onChanged);
      window.removeEventListener("online", onOnline);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [sync, refreshCount, router]);

  if (online && pending === 0) return null;

  return (
    <div role="status" className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-warning-bg px-5 py-2 text-[13px] text-warning md:px-8">
      <CloudOff aria-hidden="true" className="size-4 shrink-0" />
      <span className="flex-1">
        {!online ? "You’re offline. New expenses are saved on this device." : null}
        {!online && pending > 0 ? " " : null}
        {pending > 0 ? `${pending} ${pending === 1 ? "expense" : "expenses"} waiting to sync.` : null}
      </span>
      {online && pending > 0 ? (
        <button
          type="button"
          onClick={() => void sync()}
          disabled={syncing}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 font-semibold text-primary hover:bg-white/60"
        >
          <RefreshCw aria-hidden="true" className={syncing ? "size-3.5 animate-spin" : "size-3.5"} />
          Sync now
        </button>
      ) : null}
    </div>
  );
}
