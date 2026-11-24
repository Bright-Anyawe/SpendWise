import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Queryable } from "../../src/lib/db/queryable";
import { addToBudget, budgetStatus, createBudget } from "../../src/server/data/budgets";
import { createTestDb, type TestDb } from "./helpers/db";

let db: TestDb;
let ama: string;
let kofi: string;

const as = <T,>(userId: string, fn: (q: Queryable) => Promise<T>) => db.asUser(userId, (tx) => fn(tx as unknown as Queryable));

beforeAll(async () => {
  db = await createTestDb({ appParsers: true });
  ama = await db.createUser({ displayName: "Ama" });
  kofi = await db.createUser({ displayName: "Kofi" });
});

afterAll(() => db.close());

describe("addToBudget (income that arrives in parts)", () => {
  it("raises the budget by each amount that comes in", async () => {
    const budget = await as(ama, (q) => createBudget(q, { period: "monthly", categoryId: null, amount: "1200.00", alertAtPercent: 80 }));

    expect((await as(ama, (q) => addToBudget(q, budget.id, "500.00")))?.amount).toBe(1700);
    expect((await as(ama, (q) => addToBudget(q, budget.id, "350.50")))?.amount).toBe(2050.5);

    const [status] = await as(ama, (q) => budgetStatus(q, "2026-11-24"));
    expect(status).toMatchObject({ amount: 2050.5, alert_at_percent: 80 });
  });

  it("only changes the person's own budgets", async () => {
    const budget = await as(ama, (q) => createBudget(q, { period: "weekly", categoryId: null, amount: "300.00", alertAtPercent: 80 }));

    expect(await as(kofi, (q) => addToBudget(q, budget.id, "1000.00"))).toBeNull();
    const { rows } = await db.pg.query<{ amount: number }>("select amount from public.budgets where id = $1", [budget.id]);
    expect(rows[0].amount).toBe(300);
  });
});
