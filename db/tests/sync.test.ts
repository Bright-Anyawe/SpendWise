import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Queryable } from "../../src/lib/db/queryable";
import { categoryId, createTestDb, type TestDb } from "./helpers/db";

// The route as written, with the signed-in person and the database swapped for test ones.
const signedIn = vi.hoisted(() => ({ user: null as { id: string } | null, db: null as unknown }));

vi.mock("@/server/auth", () => ({ getCurrentUser: async () => signedIn.user }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const budgetCheck = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock("@/server/notifications/live", () => ({ scheduleBudgetAlerts: (userId: string) => budgetCheck.calls.push(userId) }));
vi.mock("@/lib/db/user-transaction", () => ({
  withUserTransaction: <T,>(userId: string, fn: (db: Queryable) => Promise<T>) =>
    (signedIn.db as TestDb).asUser(userId, (tx) => fn(tx as unknown as Queryable)),
}));

const { POST } = await import("../../src/app/api/expenses/sync/route");

let db: TestDb;
let ama: string;
let kofi: string;
let food: string;
let kofiFood: string;

const item = (overrides: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  amount: "35.00",
  categoryId: food,
  paymentMethod: "cash",
  spentOn: "2026-11-22",
  spentTime: "12:30",
  ...overrides,
});

function post(body: unknown) {
  return POST(new Request("http://localhost/api/expenses/sync", { method: "POST", body: JSON.stringify(body) }));
}

async function amaExpenseCount() {
  const { rows } = await db.pg.query<{ n: number }>("select count(*)::int as n from public.expenses where user_id = $1", [ama]);
  return rows[0].n;
}

beforeAll(async () => {
  db = await createTestDb({ appParsers: true });
  signedIn.db = db;
  ama = await db.createUser({ displayName: "Ama" });
  kofi = await db.createUser({ displayName: "Kofi" });
  food = await categoryId(db, ama, "Food & Groceries");
  kofiFood = await categoryId(db, kofi, "Food & Groceries");
});

afterAll(() => db.close());

beforeEach(async () => {
  signedIn.user = { id: ama };
  budgetCheck.calls.length = 0;
  await db.pg.query("delete from public.expenses");
});

describe("POST /api/expenses/sync", () => {
  it("needs a signed-in person", async () => {
    signedIn.user = null;
    const response = await post({ items: [item()] });
    expect(response.status).toBe(401);
    expect(await amaExpenseCount()).toBe(0);
  });

  it("saves queued expenses with the ids made on the device", async () => {
    const a = item({ note: "Lunch, waakye" });
    const b = item({ amount: "8.50" });
    const response = await post({ items: [a, b] });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ synced: [a.id, b.id], rejected: [] });
    const { rows } = await db.pg.query<{ id: string; amount: number; note: string | null }>(
      "select id, amount, note from public.expenses where user_id = $1 order by amount",
      [ama],
    );
    expect(rows).toEqual([
      { id: b.id, amount: 8.5, note: null },
      { id: a.id, amount: 35, note: "Lunch, waakye" },
    ]);
    expect(budgetCheck.calls).toEqual([ama]);
  });

  it("is safe to send twice: a repeat is reported as synced, not saved again", async () => {
    const a = item();
    await post({ items: [a] });
    const again = await post({ items: [a] });

    expect(await again.json()).toEqual({ synced: [a.id], rejected: [] });
    expect(await amaExpenseCount()).toBe(1);
  });

  it("rejects bad items one by one and still saves the rest", async () => {
    const good = item();
    const noId = item({ id: undefined });
    const badAmount = item({ amount: "-4" });
    const someoneElsesCategory = item({ categoryId: kofiFood });

    const response = await post({ items: [good, noId, badAmount, someoneElsesCategory] });
    const body = await response.json();

    expect(body.synced).toEqual([good.id]);
    expect(body.rejected).toEqual([
      { id: "unknown", error: "Some details of this expense weren't valid." },
      { id: badAmount.id, error: "Some details of this expense weren't valid." },
      { id: someoneElsesCategory.id, error: "That category no longer exists. Pick another one." },
    ]);
    expect(await amaExpenseCount()).toBe(1);
  });

  it("refuses a malformed or oversized batch", async () => {
    expect((await post({ nope: true })).status).toBe(400);
    expect((await post({ items: Array.from({ length: 201 }, () => item()) })).status).toBe(400);
    expect(await amaExpenseCount()).toBe(0);
  });
});
