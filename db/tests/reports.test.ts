import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { reportData } from "../../src/server/data/reports";
import { categoryId, createTestDb, type TestDb } from "./helpers/db";

let db: TestDb;
let user: string;

beforeAll(async () => {
  db = await createTestDb({ appParsers: true });
  user = await db.createUser();
  const food = await categoryId(db, user, "Food & Groceries");
  const savings = await categoryId(db, user, "Savings");
  await db.pg.query(
    `insert into public.expenses (user_id, category_id, amount, spent_on, spent_time) values
       ($1, $2, 100, '2025-02-10', '12:00'),
       ($1, $2, 40,  '2025-03-05', '12:00'),
       ($1, $2, 60,  '2025-03-30', '12:00'),
       ($1, $3, 500, '2025-03-15', '12:00')`,
    [user, food, savings],
  );
});

afterAll(async () => {
  await db?.close();
});

describe("reportData", () => {
  it("compares a past month in full with the full previous month", async () => {
    const r = await db.asUser(user, (tx) => reportData(tx, "month", "2025-03-12"));
    expect(r).toMatchObject({ period: "month", start: "2025-03-01", end: "2025-03-31", isCurrent: false, upTo: "2025-03-31" });
    expect(r.total).toBe(100);
    expect(r.count).toBe(2);
    expect(r.previous).toEqual({ start: "2025-02-01", end: "2025-02-28", total: 100 });
    expect(r.days).toHaveLength(31);
    expect(r.categories.map((c) => [c.name, c.total])).toEqual([
      ["Food & Groceries", 100],
      ["Savings", 500],
    ]);
    expect(r.previousCategories.map((c) => [c.name, c.total])).toEqual([["Food & Groceries", 100]]);
    expect(r.budgets).toEqual([]);
  });

  it("covers the current week up to today", async () => {
    const today = (await db.asUser(user, (tx) => tx.query<{ d: string }>("select public.local_today()::text as d"))).rows[0].d;
    const r = await db.asUser(user, (tx) => reportData(tx, "week", today));
    expect(r.isCurrent).toBe(true);
    expect(r.upTo).toBe(today);
    expect(r.days).toHaveLength(7);
    expect(r.today).toBe(today);
  });
});
