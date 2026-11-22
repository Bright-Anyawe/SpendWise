import type { Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { todayInTimeZone } from "../../src/lib/dates";
import { categoryId, createTestDb, type TestDb } from "./helpers/db";

let db: TestDb;
let ama: string;
let kofi: string;

async function addExpense(userId: string, category: string, amount: string, spentOn: string) {
  const cat = await categoryId(db, userId, category);
  await db.pg.query(
    "insert into public.expenses (user_id, category_id, amount, spent_on, spent_time) values ($1, $2, $3, $4, '12:00')",
    [userId, cat, amount, spentOn],
  );
}

const asAma = <T>(fn: (tx: Transaction) => Promise<T>) => db.asUser(ama, fn);

beforeAll(async () => {
  db = await createTestDb();
  ama = await db.createUser({ displayName: "Ama" });
  kofi = await db.createUser({ displayName: "Kofi" });

  // This week (Mon 16 – Thu 19 Nov 2026)
  await addExpense(ama, "Food & Groceries", "98.00", "2026-11-16");
  await addExpense(ama, "Transportation", "6.20", "2026-11-17");
  await addExpense(ama, "Food & Groceries", "74.00", "2026-11-18");
  await addExpense(ama, "Food & Groceries", "35.00", "2026-11-19");
  await addExpense(ama, "Transportation", "8.50", "2026-11-19");
  await addExpense(ama, "Transportation", "23.00", "2026-11-19");
  // Last week (Mon 9 – Thu 12)
  await addExpense(ama, "Food & Groceries", "132.00", "2026-11-09");
  await addExpense(ama, "Transportation", "20.00", "2026-11-12");
  // Savings is money set aside, not spending
  await addExpense(ama, "Savings", "500.00", "2026-11-10");
  // October
  await addExpense(ama, "Food & Groceries", "100.00", "2026-10-05");
  await addExpense(ama, "Food & Groceries", "50.00", "2026-10-25");
  // Someone else's spending must never leak in
  await addExpense(kofi, "Food & Groceries", "9999.00", "2026-11-19");
});

afterAll(async () => {
  await db?.close();
});

describe("totals", () => {
  it("spending_total excludes Savings", async () => {
    const { rows } = await asAma((tx) =>
      tx.query<{ total: string; expense_count: number }>(
        "select total::text, expense_count from public.spending_total('2026-11-01', '2026-11-30')",
      ),
    );
    expect(rows[0]).toEqual({ total: "396.70", expense_count: 8 });
  });

  it("daily_totals fills empty days with 0", async () => {
    const { rows } = await asAma((tx) =>
      tx.query<{ day: Date; total: string; expense_count: number }>(
        "select day, total::text, expense_count from public.daily_totals('2026-11-16', '2026-11-22')",
      ),
    );
    expect(rows.map((r) => r.total)).toEqual(["98.00", "6.20", "74.00", "66.50", "0", "0", "0"]);
    expect(rows.map((r) => r.expense_count)).toEqual([1, 1, 1, 3, 0, 0, 0]);
  });

  it("monthly_totals returns zero-filled months, oldest first", async () => {
    const { rows } = await asAma((tx) =>
      tx.query<{ month_start: Date; total: string }>(
        "select month_start, total::text from public.monthly_totals(3, '2026-11-19')",
      ),
    );
    expect(rows.map((r) => [r.month_start.toISOString().slice(0, 10), r.total])).toEqual([
      ["2026-09-01", "0"],
      ["2026-10-01", "150.00"],
      ["2026-11-01", "396.70"],
    ]);
  });

  it("spending_by_category ranks spending and reports Savings separately", async () => {
    const { rows } = await asAma((tx) =>
      tx.query<{ name: string; total: string; share: string | null; counts_as_spending: boolean }>(
        "select name, total::text, share::text, counts_as_spending from public.spending_by_category('2026-11-01', '2026-11-30')",
      ),
    );
    expect(rows).toEqual([
      { name: "Food & Groceries", total: "339.00", share: "85.5", counts_as_spending: true },
      { name: "Transportation", total: "57.70", share: "14.5", counts_as_spending: true },
      { name: "Savings", total: "500.00", share: null, counts_as_spending: false },
    ]);
  });
});

describe("periods", () => {
  it("week starts on the profile's week start", async () => {
    const monday = await asAma((tx) =>
      tx.query<{ start_date: Date; end_date: Date }>("select * from public.period_bounds('week', '2026-11-19')"),
    );
    expect(monday.rows[0].start_date.toISOString().slice(0, 10)).toBe("2026-11-16");
    expect(monday.rows[0].end_date.toISOString().slice(0, 10)).toBe("2026-11-22");

    const sundayUser = await db.createUser({ weekStartsOn: 0 });
    const sunday = await db.asUser(sundayUser, (tx) =>
      tx.query<{ start_date: Date; end_date: Date }>("select * from public.period_bounds('week', '2026-11-19')"),
    );
    expect(sunday.rows[0].start_date.toISOString().slice(0, 10)).toBe("2026-11-15");
    expect(sunday.rows[0].end_date.toISOString().slice(0, 10)).toBe("2026-11-21");
  });

  it("local_today follows the profile time zone", async () => {
    const user = await db.createUser({ timezone: "Pacific/Auckland" });
    const { rows } = await db.asUser(user, (tx) => tx.query<{ d: Date }>("select public.local_today() as d"));
    expect(rows[0].d.toISOString().slice(0, 10)).toBe(todayInTimeZone("Pacific/Auckland"));
  });
});

type ComparisonRow = {
  kind: string;
  current_start: Date;
  current_end: Date;
  current_total: string;
  current_count: number;
  previous_start: Date;
  previous_end: Date;
  previous_total: string;
};

function day(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function comparisons(ref: string, userId = ama) {
  const { rows } = await db.asUser(userId, (tx) =>
    tx.query<ComparisonRow>(
      "select kind, current_start, current_end, current_total::text, current_count, previous_start, previous_end, previous_total::text from public.spending_comparisons($1)",
      [ref],
    ),
  );
  return Object.fromEntries(rows.map((r) => [r.kind, r]));
}

describe("comparisons", () => {
  it("compares today with yesterday", async () => {
    const { day: d } = await comparisons("2026-11-19");
    expect([d.current_total, d.current_count, d.previous_total]).toEqual(["66.50", 3, "74.00"]);
  });

  it("compares the same days of the previous week", async () => {
    const { week } = await comparisons("2026-11-19");
    expect([day(week.current_start), day(week.current_end), day(week.previous_start), day(week.previous_end)]).toEqual([
      "2026-11-16",
      "2026-11-19",
      "2026-11-09",
      "2026-11-12",
    ]);
    expect([week.current_total, week.previous_total]).toEqual(["244.70", "152.00"]);
  });

  it("compares the same days of the previous month", async () => {
    const { month } = await comparisons("2026-11-19");
    expect([day(month.previous_start), day(month.previous_end)]).toEqual(["2026-10-01", "2026-10-19"]);
    expect([month.current_total, month.previous_total]).toEqual(["396.70", "100.00"]);
  });

  it("caps previous month window at month end", async () => {
    const end = await comparisons("2027-03-31");
    expect([day(end.month.previous_start), day(end.month.previous_end)]).toEqual(["2027-02-01", "2027-02-28"]);
    const mid = await comparisons("2027-03-15");
    expect([day(mid.month.previous_start), day(mid.month.previous_end)]).toEqual(["2027-02-01", "2027-02-15"]);
  });
});

describe("budgets", () => {
  it("budget_status reports ok, warning and over", async () => {
    const food = await categoryId(db, ama, "Food & Groceries");
    const transport = await categoryId(db, ama, "Transportation");
    await db.pg.query(
      `insert into public.budgets (user_id, period, category_id, amount, alert_at_percent) values
         ($1, 'monthly', null, 3000, 80),
         ($1, 'monthly', $2, 50, 80),
         ($1, 'weekly', $3, 250, 80),
         ($1, 'daily', null, 100, 80)`,
      [ama, transport, food],
    );

    const { rows } = await asAma((tx) =>
      tx.query<{ period: string; category_name: string | null; spent: string; remaining: string; used_percent: string; state: string }>(
        "select period, category_name, spent::text, remaining::text, used_percent::text, state from public.budget_status('2026-11-19')",
      ),
    );
    const byKey = Object.fromEntries(rows.map((r) => [`${r.period}:${r.category_name ?? "overall"}`, r]));

    expect(byKey["monthly:overall"]).toMatchObject({ spent: "396.70", remaining: "2603.30", state: "ok" });
    expect(byKey["daily:overall"]).toMatchObject({ spent: "66.50", state: "ok" });
    expect(byKey["monthly:Transportation"]).toMatchObject({ spent: "57.70", remaining: "-7.70", used_percent: "115.4", state: "over" });
    expect(byKey["weekly:Food & Groceries"]).toMatchObject({ spent: "207.00", used_percent: "82.8", state: "warning" });
  });

  it("overall budget ignores Savings", async () => {
    const { rows } = await asAma((tx) =>
      tx.query<{ spent: string }>(
        "select spent::text from public.budget_status('2026-11-19') where period = 'monthly' and category_id is null",
      ),
    );
    expect(rows[0].spent).toBe("396.70");
  });
});

describe("delete_category", () => {
  async function customCategoryWithExpense(userId: string, name: string) {
    const { rows } = await db.pg.query<{ id: string }>(
      "insert into public.categories (user_id, name) values ($1, $2) returning id",
      [userId, name],
    );
    await addExpense(userId, name, "12.00", "2026-11-19");
    return rows[0].id;
  }

  it("delete_category moves expenses", async () => {
    const snacks = await customCategoryWithExpense(ama, "Snacks");
    const other = await categoryId(db, ama, "Other");
    await asAma((tx) => tx.query("select public.delete_category($1, $2)", [snacks, other]));

    const moved = await db.pg.query<{ n: number }>(
      "select count(*)::int as n from public.expenses where category_id = $1 and amount = 12",
      [other],
    );
    expect(moved.rows[0].n).toBe(1);
    const gone = await db.pg.query("select 1 from public.categories where id = $1", [snacks]);
    expect(gone.rows).toHaveLength(0);
  });

  it("refuses to delete fallback", async () => {
    const other = await categoryId(db, ama, "Other");
    const food = await categoryId(db, ama, "Food & Groceries");
    await expect(asAma((tx) => tx.query("select public.delete_category($1, $2)", [other, food]))).rejects.toThrow(/fallback/i);
  });

  it("refuses to move into another user's category", async () => {
    const drinks = await customCategoryWithExpense(ama, "Drinks");
    const kofiFood = await categoryId(db, kofi, "Food & Groceries");
    await expect(asAma((tx) => tx.query("select public.delete_category($1, $2)", [drinks, kofiFood]))).rejects.toThrow(
      /not found/i,
    );
  });

  it("refuses to move a category into itself", async () => {
    const food = await categoryId(db, ama, "Food & Groceries");
    await expect(asAma((tx) => tx.query("select public.delete_category($1, $1)", [food]))).rejects.toThrow(/different/i);
  });
});

describe("function privileges", () => {
  it("other database roles cannot call the analytics functions", async () => {
    await expect(
      db.asOutsider((tx) => tx.query("select * from public.spending_total('2026-11-01', '2026-11-30')")),
    ).rejects.toThrow(/permission denied/i);
  });
});
