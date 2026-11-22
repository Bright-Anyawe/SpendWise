import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { categoryId, createTestDb, type TestDb } from "./helpers/db";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db?.close();
});

async function insertExpense(userId: string, values: Partial<Record<string, unknown>> = {}) {
  const cat = await categoryId(db, userId, "Food & Groceries");
  const row = { amount: "35.00", spent_on: "2026-11-19", spent_time: "12:30", note: null, ...values };
  const { rows } = await db.pg.query<{ id: string; spent_at: Date }>(
    `insert into public.expenses (user_id, category_id, amount, spent_on, spent_time, note)
     values ($1, $2, $3, $4, $5, $6) returning id, spent_at`,
    [userId, cat, row.amount, row.spent_on, row.spent_time, row.note],
  );
  return rows[0];
}

describe("first sign-in", () => {
  it("ensure_profile is idempotent", async () => {
    const id = await db.createUser({ displayName: "Esi" });
    await db.asUser(id, (tx) => tx.query("select app.ensure_profile('Someone else')"));
    const { rows } = await db.pg.query<{ n: number; name: string }>(
      "select (select count(*)::int from public.categories where user_id = $1) as n, (select display_name from public.profiles where id = $1) as name",
      [id],
    );
    expect(rows[0]).toEqual({ n: 12, name: "Esi" });
  });

  it("ensure_profile refuses when no person is signed in", async () => {
    await expect(db.asSignedOut((tx) => tx.query("select app.ensure_profile('x')"))).rejects.toThrow(/signed in/i);
  });

  it("seeds profile, preferences and 12 categories on first sign-in", async () => {
    const id = await db.createUser({ displayName: "Ama" });

    const profile = await db.pg.query<{ display_name: string; currency: string; timezone: string; week_starts_on: number }>(
      "select display_name, currency, timezone, week_starts_on from public.profiles where id = $1",
      [id],
    );
    expect(profile.rows[0]).toEqual({ display_name: "Ama", currency: "GHS", timezone: "Africa/Accra", week_starts_on: 1 });

    const prefs = await db.pg.query<{ reminder_time: string; daily_reminder_enabled: boolean }>(
      "select reminder_time, daily_reminder_enabled from public.notification_preferences where user_id = $1",
      [id],
    );
    expect(prefs.rows[0]).toEqual({ reminder_time: "20:00:00", daily_reminder_enabled: true });

    const cats = await db.pg.query<{ name: string }>(
      "select name from public.categories where user_id = $1 order by sort_order",
      [id],
    );
    expect(cats.rows.map((r) => r.name)).toEqual([
      "Food & Groceries",
      "Transportation",
      "Rent & Housing",
      "Utilities & Bills",
      "Shopping",
      "Healthcare",
      "Education",
      "Entertainment",
      "Family & Gifts",
      "Business",
      "Savings",
      "Other",
    ]);
  });

  it("Savings does not count as spending and Other is the fallback", async () => {
    const id = await db.createUser();
    const { rows } = await db.pg.query<{ name: string; counts_as_spending: boolean; is_fallback: boolean }>(
      "select name, counts_as_spending, is_fallback from public.categories where user_id = $1 and (not counts_as_spending or is_fallback) order by name",
      [id],
    );
    expect(rows).toEqual([
      { name: "Other", counts_as_spending: true, is_fallback: true },
      { name: "Savings", counts_as_spending: false, is_fallback: false },
    ]);
  });
});

describe("expenses", () => {
  it("derives spent_at in the profile time zone (London summer)", async () => {
    const id = await db.createUser({ timezone: "Europe/London" });
    const row = await insertExpense(id, { spent_on: "2026-07-01", spent_time: "12:30" });
    expect(row.spent_at.toISOString()).toBe("2026-07-01T11:30:00.000Z");
  });

  it("derives spent_at in Accra with no offset", async () => {
    const id = await db.createUser();
    const row = await insertExpense(id, { spent_on: "2026-11-19", spent_time: "23:45" });
    expect(row.spent_at.toISOString()).toBe("2026-11-19T23:45:00.000Z");
  });

  it("recomputes spent_at when the time changes", async () => {
    const id = await db.createUser();
    const row = await insertExpense(id);
    const { rows } = await db.pg.query<{ spent_at: Date }>(
      "update public.expenses set spent_time = '07:45' where id = $1 returning spent_at",
      [row.id],
    );
    expect(rows[0].spent_at.toISOString()).toBe("2026-11-19T07:45:00.000Z");
  });

  it("rejects amount <= 0 and notes over 280 chars", async () => {
    const id = await db.createUser();
    await expect(insertExpense(id, { amount: "0" })).rejects.toThrow(/check/i);
    await expect(insertExpense(id, { amount: "-5" })).rejects.toThrow(/check/i);
    await expect(insertExpense(id, { note: "x".repeat(281) })).rejects.toThrow(/check/i);
    await expect(insertExpense(id, { note: "x".repeat(280) })).resolves.toBeTruthy();
  });
});

describe("profiles", () => {
  it("rejects invalid time zone", async () => {
    const id = await db.createUser();
    await expect(
      db.pg.query("update public.profiles set timezone = 'Mars/Olympus' where id = $1", [id]),
    ).rejects.toThrow(/check/i);
  });

  it("rejects a currency that is not a 3-letter code", async () => {
    const id = await db.createUser();
    await expect(db.pg.query("update public.profiles set currency = 'ghs' where id = $1", [id])).rejects.toThrow(/check/i);
  });
});

describe("account deletion", () => {
  it("delete_my_account removes all their rows", async () => {
    const id = await db.createUser();
    await insertExpense(id);
    const cat = await categoryId(db, id, "Food & Groceries");
    await db.pg.query(
      "insert into public.budgets (user_id, period, category_id, amount) values ($1, 'monthly', null, 3000), ($1, 'monthly', $2, 800)",
      [id, cat],
    );
    await db.pg.query("insert into public.no_spend_days (user_id, day) values ($1, '2026-11-18')", [id]);

    const other = await db.createUser();
    await db.asUser(id, (tx) => tx.query("select app.delete_my_account()"));
    const kept = await db.pg.query<{ n: number }>("select count(*)::int as n from public.categories where user_id = $1", [other]);
    expect(kept.rows[0].n, "someone else's data is untouched").toBe(12);

    for (const table of ["profiles", "notification_preferences"]) {
      const { rows } = await db.pg.query<{ n: number }>(`select count(*)::int as n from public.${table} where ${table === "profiles" ? "id" : "user_id"} = $1`, [id]);
      expect(rows[0].n, table).toBe(0);
    }
    for (const table of ["categories", "expenses", "budgets", "no_spend_days", "push_subscriptions", "notifications"]) {
      const { rows } = await db.pg.query<{ n: number }>(`select count(*)::int as n from public.${table} where user_id = $1`, [id]);
      expect(rows[0].n, table).toBe(0);
    }
  });
});
