import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Queryable } from "../../src/lib/db/queryable";
import { addToBudget, budgetStatus, createBudget, setBudgetAmount, updateBudget } from "../../src/server/data/budgets";
import { categoryId, createTestDb, type TestDb } from "./helpers/db";

let db: TestDb;
let ama: string;
let kofi: string;
let food: string;
let monthly: string;

const as = <T,>(userId: string, fn: (q: Queryable) => Promise<T>) => db.asUser(userId, (tx) => fn(tx as unknown as Queryable));
const monthlyOn = async (day: string) => (await as(ama, (q) => budgetStatus(q, day))).find((b) => b.budget_id === monthly)!;

beforeAll(async () => {
  db = await createTestDb({ appParsers: true });
  ama = await db.createUser({ displayName: "Ama" });
  kofi = await db.createUser({ displayName: "Kofi" });
  food = await categoryId(db, ama, "Food & Groceries");
});

afterAll(() => db.close());

beforeEach(async () => {
  await db.pg.exec("delete from public.budget_amounts; delete from public.budgets; delete from public.expenses;");
  monthly = (await as(ama, (q) => createBudget(q, { period: "monthly", categoryId: null, amount: "1200.00", alertAtPercent: 80 }))).id;
});

describe("budgets per month", () => {
  it("uses the usual amount for any month without its own", async () => {
    expect(await monthlyOn("2026-10-15")).toMatchObject({ amount: 1200, default_amount: 1200, period_start: "2026-10-01" });
    expect(await monthlyOn("2026-11-24")).toMatchObject({ amount: 1200, default_amount: 1200, period_start: "2026-11-01" });
  });

  it("sets a forgotten past month without changing other months", async () => {
    const set = await as(ama, (q) => setBudgetAmount(q, monthly, "2026-10-20", "1500.00"));
    expect(set).toEqual({ budget_id: monthly, period_start: "2026-10-01", amount: 1500 });

    await db.pg.query(
      "insert into public.expenses (user_id, category_id, amount, spent_on, spent_time) values ($1, $2, 1350, '2026-10-12', '12:00')",
      [ama, food],
    );
    expect(await monthlyOn("2026-10-31")).toMatchObject({ amount: 1500, default_amount: 1200, spent: 1350, state: "warning" });
    expect(await monthlyOn("2026-11-24")).toMatchObject({ amount: 1200 });
  });

  it("adds money that came in to the month being viewed only", async () => {
    expect(await as(ama, (q) => addToBudget(q, monthly, "500.00", "2026-11-24"))).toMatchObject({ period_start: "2026-11-01", amount: 1700 });
    expect(await as(ama, (q) => addToBudget(q, monthly, "350.50", "2026-11-03"))).toMatchObject({ amount: 2050.5 });

    expect(await monthlyOn("2026-11-24")).toMatchObject({ amount: 2050.5, default_amount: 1200 });
    expect(await monthlyOn("2026-12-01")).toMatchObject({ amount: 1200 });
    expect(await monthlyOn("2026-10-01")).toMatchObject({ amount: 1200 });
  });

  it("changing the usual amount leaves months you set yourself alone", async () => {
    await as(ama, (q) => setBudgetAmount(q, monthly, "2026-10-01", "1500.00"));
    await as(ama, (q) => updateBudget(q, monthly, { amount: "2000.00", alertAtPercent: 80 }));

    expect(await monthlyOn("2026-10-15")).toMatchObject({ amount: 1500, default_amount: 2000 });
    expect(await monthlyOn("2026-12-15")).toMatchObject({ amount: 2000 });
  });

  it("weekly budgets get their own amount per week", async () => {
    const weekly = (await as(ama, (q) => createBudget(q, { period: "weekly", categoryId: null, amount: "300.00", alertAtPercent: 80 }))).id;
    // Weeks start on Monday by default: 18 Nov 2026 is in the week of Mon 16 Nov.
    expect(await as(ama, (q) => setBudgetAmount(q, weekly, "2026-11-18", "450.00"))).toMatchObject({ period_start: "2026-11-16" });
    const week = (await as(ama, (q) => budgetStatus(q, "2026-11-20"))).find((b) => b.budget_id === weekly);
    expect(week).toMatchObject({ amount: 450, default_amount: 300 });
  });

  it("only the owner can set or read a budget's amounts", async () => {
    expect(await as(kofi, (q) => setBudgetAmount(q, monthly, "2026-10-01", "9999.00"))).toBeNull();
    expect(await as(kofi, (q) => addToBudget(q, monthly, "9999.00", "2026-11-01"))).toBeNull();
    await as(ama, (q) => setBudgetAmount(q, monthly, "2026-10-01", "1500.00"));

    const seenByKofi = await as(kofi, (q) => q.query<{ n: number }>("select count(*)::int as n from public.budget_amounts"));
    expect(seenByKofi.rows[0].n).toBe(0);
    expect(await monthlyOn("2026-10-15")).toMatchObject({ amount: 1500 });
  });

  it("deleting a budget removes its monthly amounts", async () => {
    await as(ama, (q) => setBudgetAmount(q, monthly, "2026-10-01", "1500.00"));
    await as(ama, (q) => q.query("delete from public.budgets where id = $1", [monthly]));
    const { rows } = await db.pg.query<{ n: number }>("select count(*)::int as n from public.budget_amounts");
    expect(rows[0].n).toBe(0);
  });
});
