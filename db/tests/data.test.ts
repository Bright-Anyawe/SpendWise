import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBudget, budgetStatus } from "../../src/server/data/budgets";
import { dashboardData } from "../../src/server/data/dashboard";
import { insertExpense, listExpenses, quickAddOptions, summarizeExpenses } from "../../src/server/data/expenses";
import { getMyProfile, saveOnboarding } from "../../src/server/data/profile";
import { categoryId, createTestDb, type TestDb } from "./helpers/db";

let db: TestDb;
let ama: string;
let kofi: string;
let food: string;
let transport: string;
let bills: string;

async function seed(userId: string, category: string, amount: string, spentOn: string, note: string | null, time = "12:00", method = "cash") {
  await db.pg.query(
    "insert into public.expenses (user_id, category_id, amount, spent_on, spent_time, note, payment_method) values ($1, $2, $3, $4, $5, $6, $7)",
    [userId, category, amount, spentOn, time, note, method],
  );
}

beforeAll(async () => {
  db = await createTestDb({ appParsers: true });
  ama = await db.createUser({ displayName: "Ama" });
  kofi = await db.createUser({ displayName: "Kofi" });
  food = await categoryId(db, ama, "Food & Groceries");
  transport = await categoryId(db, ama, "Transportation");
  bills = await categoryId(db, ama, "Utilities & Bills");

  await seed(ama, food, "98.00", "2026-11-16", "Weekly groceries", "18:30", "mobile_money");
  await seed(ama, transport, "6.20", "2026-11-17", "Bus to Madina", "08:10");
  await seed(ama, food, "74.00", "2026-11-18", "Groceries", "17:40", "mobile_money");
  await seed(ama, transport, "8.50", "2026-11-19", "Trotro to work", "07:45");
  await seed(ama, food, "35.00", "2026-11-19", "Lunch, waakye", "12:30");
  await seed(ama, bills, "20.00", "2026-11-19", "Data bundle", "15:10", "mobile_money");
  await seed(ama, transport, "23.00", "2026-11-19", null, "18:20", "mobile_money");
  await seed(kofi, await categoryId(db, kofi, "Food & Groceries"), "9999.00", "2026-11-19", "Kofi's lunch");
});

afterAll(async () => {
  await db?.close();
});

describe("listExpenses", () => {
  it("returns newest first with the category name and app value shapes", async () => {
    const { rows } = await db.asUser(ama, (tx) => listExpenses(tx, { page: 0 }));
    expect(rows.map((r) => r.note)).toEqual([
      null,
      "Data bundle",
      "Lunch, waakye",
      "Trotro to work",
      "Groceries",
      "Bus to Madina",
      "Weekly groceries",
    ]);
    expect(rows[0]).toMatchObject({ amount: 23, spent_on: "2026-11-19", spent_time: "18:20:00", category: { name: "Transportation", icon: "bus" } });
    expect(rows[0].spent_at).toBe("2026-11-19T18:20:00.000Z");
  });

  it("search matches the note or the category name", async () => {
    const byNote = await db.asUser(ama, (tx) => listExpenses(tx, { page: 0, q: "trotro" }));
    expect(byNote.rows.map((r) => r.note)).toEqual(["Trotro to work"]);
    const byCategory = await db.asUser(ama, (tx) => listExpenses(tx, { page: 0, q: "utilities" }));
    expect(byCategory.rows.map((r) => r.note)).toEqual(["Data bundle"]);
    const wildcard = await db.asUser(ama, (tx) => listExpenses(tx, { page: 0, q: "%" }));
    expect(wildcard.rows).toEqual([]);
  });

  it("filters by date range, category, payment method and amount", async () => {
    const { rows } = await db.asUser(ama, (tx) =>
      listExpenses(tx, {
        page: 0,
        from: "2026-11-17",
        to: "2026-11-19",
        categoryIds: [food, transport],
        paymentMethods: ["mobile_money"],
        minAmount: 20,
        maxAmount: 80,
      }),
    );
    expect(rows.map((r) => [r.spent_on, r.amount])).toEqual([
      ["2026-11-19", 23],
      ["2026-11-18", 74],
    ]);
  });

  it("pages 50 at a time and says whether there is more", async () => {
    const user = await db.createUser();
    const cat = await categoryId(db, user, "Other");
    await db.pg.query(
      "insert into public.expenses (user_id, category_id, amount, spent_on, spent_time) select $1, $2, 1, date '2026-01-01' + g, '12:00' from generate_series(0, 50) g",
      [user, cat],
    );
    const first = await db.asUser(user, (tx) => listExpenses(tx, { page: 0 }));
    expect([first.rows.length, first.hasMore]).toEqual([50, true]);
    const second = await db.asUser(user, (tx) => listExpenses(tx, { page: 1 }));
    expect([second.rows.length, second.hasMore]).toEqual([1, false]);
  });

  it("never returns someone else's expenses", async () => {
    const { rows } = await db.asUser(ama, (tx) => listExpenses(tx, { page: 0, q: "Kofi" }));
    expect(rows).toEqual([]);
  });
});

describe("summarizeExpenses", () => {
  it("counts and totals what the same filters list", async () => {
    const all = await db.asUser(ama, (tx) => summarizeExpenses(tx, { page: 0, from: "2026-11-16", to: "2026-11-19" }));
    expect(all).toEqual({ count: 7, total: 264.7 });
    const momo = await db.asUser(ama, (tx) => summarizeExpenses(tx, { page: 0, paymentMethods: ["mobile_money"] }));
    expect(momo).toEqual({ count: 4, total: 215 });
  });

  it("is zero when nothing matches", async () => {
    const none = await db.asUser(ama, (tx) => summarizeExpenses(tx, { page: 0, q: "nothing like this" }));
    expect(none).toEqual({ count: 0, total: 0 });
  });
});

describe("insertExpense", () => {
  it("saves the expense for the signed-in person and returns it", async () => {
    const saved = await db.asUser(ama, (tx) =>
      insertExpense(tx, { amount: "12.50", category_id: food, payment_method: "card", note: "Snack", spent_on: "2026-11-20", spent_time: "10:00" }),
    );
    expect(saved).toMatchObject({ user_id: ama, amount: 12.5, spent_on: "2026-11-20", payment_method: "card", note: "Snack" });
  });

  it("a retry with the same id returns the original unchanged", async () => {
    const id = randomUUID();
    const row = { id, amount: "23.00", category_id: transport, payment_method: "mobile_money" as const, note: "Ride", spent_on: "2026-11-20", spent_time: "18:20" };
    await db.asUser(ama, (tx) => insertExpense(tx, row));
    const retry = await db.asUser(ama, (tx) => insertExpense(tx, { ...row, amount: "99.00" }));
    expect(retry).toMatchObject({ id, amount: 23 });
  });
});

describe("quickAddOptions", () => {
  it("orders categories by recent use and remembers the last payment method", async () => {
    const user = await db.createUser();
    const fun = await categoryId(db, user, "Entertainment");
    const travel = await categoryId(db, user, "Transportation");
    await db.pg.query(
      `insert into public.expenses (user_id, category_id, amount, spent_on, spent_time, payment_method) values
         ($1, $2, 5, current_date, '08:00', 'cash'), ($1, $2, 5, current_date, '09:00', 'cash'),
         ($1, $3, 9, current_date, '10:00', 'card')`,
      [user, fun, travel],
    );
    const options = await db.asUser(user, (tx) => quickAddOptions(tx));
    expect(options.categories.slice(0, 3).map((c) => c.name)).toEqual(["Entertainment", "Transportation", "Food & Groceries"]);
    expect(options.categories).toHaveLength(12);
    expect(options.lastPaymentMethod).toBe("card");
  });

  it("has no last payment method before the first expense", async () => {
    const user = await db.createUser();
    const options = await db.asUser(user, (tx) => quickAddOptions(tx));
    expect(options.lastPaymentMethod).toBeNull();
    expect(options.categories[0].name).toBe("Food & Groceries");
  });
});

describe("saveOnboarding", () => {
  it("saves settings, marks onboarding done and creates the monthly budget", async () => {
    const user = await db.createUser();
    await db.asUser(user, (tx) =>
      saveOnboarding(tx, { currency: "USD", timezone: "Europe/London", weekStartsOn: 0, monthlyBudget: "3000.00" }),
    );
    const profile = await db.asUser(user, (tx) => getMyProfile(tx));
    expect(profile).toMatchObject({ currency: "USD", timezone: "Europe/London", week_starts_on: 0 });
    expect(profile?.onboarded_at).toEqual(expect.any(String));
    const budgets = await db.asUser(user, (tx) => budgetStatus(tx));
    expect(budgets.map((b) => [b.period, b.category_id, b.amount])).toEqual([["monthly", null, 3000]]);
  });

  it("running it again updates the budget instead of adding another", async () => {
    const user = await db.createUser();
    const input = { currency: "GHS", timezone: "Africa/Accra", weekStartsOn: 1, monthlyBudget: "3000.00" };
    await db.asUser(user, (tx) => saveOnboarding(tx, input));
    await db.asUser(user, (tx) => saveOnboarding(tx, { ...input, monthlyBudget: "2500.00" }));
    const budgets = await db.asUser(user, (tx) => budgetStatus(tx));
    expect(budgets.map((b) => b.amount)).toEqual([2500]);
  });
});

describe("dashboardData", () => {
  it("collects today, the week, the month, budgets and today's expenses", async () => {
    await db.asUser(ama, (tx) => createBudget(tx, { period: "monthly", categoryId: null, amount: "3000.00", alertAtPercent: 80 }));
    const data = await db.asUser(ama, (tx) => dashboardData(tx, "2026-11-19"));

    expect(data.today).toBe("2026-11-19");
    expect([data.comparisons.day.current_total, data.comparisons.day.previous_total]).toEqual([86.5, 74]);
    // Mon–Thu up to the reference date; the 35.50 added for Friday by the insert tests isn't counted yet…
    expect(data.comparisons.week.current_total).toBe(264.7);
    expect(data.week).toMatchObject({ start: "2026-11-16", end: "2026-11-22" });
    // …but the week chart shows every day of the week.
    expect(data.week.days.map((d) => d.total)).toEqual([98, 6.2, 74, 86.5, 35.5, 0, 0]);
    expect(data.month).toMatchObject({ start: "2026-11-01", end: "2026-11-30" });
    expect(data.month.categories[0]).toMatchObject({ name: "Food & Groceries", total: 219.5 });
    expect(data.lastSixMonths.map((m) => m.month_start)).toEqual([
      "2026-06-01",
      "2026-07-01",
      "2026-08-01",
      "2026-09-01",
      "2026-10-01",
      "2026-11-01",
    ]);
    expect(data.budgets[0]).toMatchObject({ period: "monthly", amount: 3000 });
    expect(data.todaysExpenses.map((e) => e.amount)).toEqual([23, 20, 35, 8.5]);
    expect(data.noSpendToday).toBe(false);
  });

  it("knows when today was marked as a no-spend day", async () => {
    const user = await db.createUser();
    await db.pg.query("insert into public.no_spend_days (user_id, day) values ($1, '2026-11-19')", [user]);
    const data = await db.asUser(user, (tx) => dashboardData(tx, "2026-11-19"));
    expect(data.noSpendToday).toBe(true);
    expect(data.comparisons.day.current_total).toBe(0);
  });
});
