import type { PaymentMethod } from "@/lib/types/database";

/** What quick add sends to createExpense, with the id generated on the device. */
export interface OfflineExpenseInput {
  id: string;
  amount: string;
  categoryId: string;
  paymentMethod: PaymentMethod;
  note?: string;
  spentOn: string;
  spentTime: string;
}

export interface QueuedExpense {
  id: string;
  input: OfflineExpenseInput;
  queuedAt: string;
}

/** Storage behind the queue: IndexedDB in the browser (shared with the service worker), memory in tests. */
export interface QueueStore {
  getAll(): Promise<QueuedExpense[]>;
  put(item: QueuedExpense): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface SyncResponse {
  synced: string[];
  rejected: { id: string; error: string }[];
}

export function createQueue(store: QueueStore) {
  return {
    async add(input: OfflineExpenseInput): Promise<void> {
      await store.put({ id: input.id, input, queuedAt: new Date().toISOString() });
    },
    async all(): Promise<QueuedExpense[]> {
      const items = await store.getAll();
      return items.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
    },
    async remove(ids: string[]): Promise<void> {
      for (const id of ids) await store.delete(id);
    },
    async count(): Promise<number> {
      return (await store.getAll()).length;
    },
  };
}

export type OfflineQueue = ReturnType<typeof createQueue>;

/**
 * Sends everything queued. Synced and rejected (invalid) expenses leave the queue; anything the
 * server didn't mention stays. A network failure keeps the whole queue for the next try.
 */
export async function drainQueue(
  queue: OfflineQueue,
  send: (items: OfflineExpenseInput[]) => Promise<SyncResponse>,
): Promise<{ synced: number; rejected: SyncResponse["rejected"]; remaining: number; offline: boolean }> {
  const items = await queue.all();
  if (items.length === 0) return { synced: 0, rejected: [], remaining: 0, offline: false };

  let response: SyncResponse;
  try {
    response = await send(items.map((i) => i.input));
  } catch {
    return { synced: 0, rejected: [], remaining: items.length, offline: true };
  }

  await queue.remove([...response.synced, ...response.rejected.map((r) => r.id)]);
  return {
    synced: response.synced.length,
    rejected: response.rejected,
    remaining: await queue.count(),
    offline: false,
  };
}
