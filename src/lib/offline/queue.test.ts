import { describe, expect, it, vi } from "vitest";
import { createQueue, drainQueue, type QueuedExpense, type QueueStore } from "./queue";

function memoryStore(): QueueStore {
  const items = new Map<string, QueuedExpense>();
  return {
    getAll: async () => [...items.values()],
    put: async (item) => void items.set(item.id, item),
    delete: async (id) => void items.delete(id),
  };
}

const input = (id: string) => ({ id, amount: "35.00", categoryId: "c", paymentMethod: "cash" as const, spentOn: "2026-11-22", spentTime: "12:30" });

describe("offline queue", () => {
  it("drains the queue and keeps failures", async () => {
    const queue = createQueue(memoryStore());
    await queue.add(input("a"));
    await queue.add(input("b"));
    await queue.add(input("c"));

    const send = vi.fn(async () => ({ synced: ["a"], rejected: [{ id: "b", error: "That category no longer exists." }] }));
    const result = await drainQueue(queue, send);

    expect(send).toHaveBeenCalledWith([input("a"), input("b"), input("c")]);
    expect(result).toEqual({ synced: 1, rejected: [{ id: "b", error: "That category no longer exists." }], remaining: 1, offline: false });
    expect((await queue.all()).map((i) => i.id)).toEqual(["c"]);
  });

  it("keeps everything when the network fails", async () => {
    const queue = createQueue(memoryStore());
    await queue.add(input("a"));
    const result = await drainQueue(queue, async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(result).toEqual({ synced: 0, rejected: [], remaining: 1, offline: true });
    expect(await queue.count()).toBe(1);
  });

  it("does nothing when the queue is empty", async () => {
    const send = vi.fn();
    expect(await drainQueue(createQueue(memoryStore()), send)).toEqual({ synced: 0, rejected: [], remaining: 0, offline: false });
    expect(send).not.toHaveBeenCalled();
  });
});
