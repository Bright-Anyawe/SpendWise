import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { categoryId, createTestDb, type TestDb } from "./helpers/db";

let db: TestDb;
let alice: string;
let bob: string;
let aliceFood: string;
let bobFood: string;
let aliceExpense: string;

const OWNED_TABLES = [
  "categories",
  "expenses",
  "budgets",
  "budget_amounts",
  "no_spend_days",
  "notification_preferences",
  "push_subscriptions",
  "notifications",
] as const;

beforeAll(async () => {
  db = await createTestDb();
  alice = await db.createUser({ displayName: "Alice" });
  bob = await db.createUser({ displayName: "Bob" });
  aliceFood = await categoryId(db, alice, "Food & Groceries");
  bobFood = await categoryId(db, bob, "Food & Groceries");

  const { rows } = await db.pg.query<{ id: string }>(
    "insert into public.expenses (user_id, category_id, amount, spent_on, spent_time) values ($1, $2, 35, '2026-11-19', '12:30') returning id",
    [alice, aliceFood],
  );
  aliceExpense = rows[0].id;
  const budget = await db.pg.query<{ id: string }>(
    "insert into public.budgets (user_id, period, amount) values ($1, 'monthly', 3000) returning id",
    [alice],
  );
  await db.pg.query(
    "insert into public.budget_amounts (budget_id, user_id, period_start, amount) values ($1, $2, '2026-10-01', 2500)",
    [budget.rows[0].id, alice],
  );
  await db.pg.query("insert into public.no_spend_days (user_id, day) values ($1, '2026-11-18')", [alice]);
  await db.pg.query(
    "insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push.example.com/a', 'k', 'a')",
    [alice],
  );
  await db.pg.query(
    "insert into public.notifications (user_id, kind, title, body, dedupe_key) values ($1, 'daily_reminder', 'Nothing logged today', 'Got a minute?', 'daily_reminder:2026-11-19')",
    [alice],
  );
});

afterAll(async () => {
  await db?.close();
});

describe("isolation between users", () => {
  it("user cannot read another user's rows", async () => {
    await db.asUser(bob, async (tx) => {
      for (const table of OWNED_TABLES) {
        const { rows } = await tx.query<{ n: number }>(`select count(*)::int as n from public.${table} where user_id = $1`, [alice]);
        expect(rows[0].n, table).toBe(0);
      }
      const profiles = await tx.query<{ n: number }>("select count(*)::int as n from public.profiles where id = $1", [alice]);
      expect(profiles.rows[0].n).toBe(0);
    });
  });

  it("user sees their own rows", async () => {
    await db.asUser(alice, async (tx) => {
      for (const table of OWNED_TABLES) {
        const { rows } = await tx.query<{ n: number }>(`select count(*)::int as n from public.${table}`);
        expect(rows[0].n, table).toBeGreaterThan(0);
      }
    });
  });

  it("user cannot update or delete another user's expense", async () => {
    await db.asUser(bob, async (tx) => {
      const updated = await tx.query("update public.expenses set amount = 1 where id = $1 returning id", [aliceExpense]);
      expect(updated.rows).toHaveLength(0);
      const deleted = await tx.query("delete from public.expenses where id = $1 returning id", [aliceExpense]);
      expect(deleted.rows).toHaveLength(0);
    });
    const { rows } = await db.pg.query<{ amount: string }>("select amount::text from public.expenses where id = $1", [aliceExpense]);
    expect(rows[0].amount).toBe("35.00");
  });

  it("cannot attach an expense to another user's category", async () => {
    await expect(
      db.asUser(alice, (tx) =>
        tx.query("insert into public.expenses (amount, category_id, spent_on, spent_time) values (10, $1, '2026-11-19', '09:00')", [bobFood]),
      ),
    ).rejects.toThrow(/foreign key/i);
  });

  it("cannot insert with someone else's user_id", async () => {
    await expect(
      db.asUser(alice, (tx) =>
        tx.query(
          "insert into public.expenses (user_id, amount, category_id, spent_on, spent_time) values ($1, 10, $2, '2026-11-19', '09:00')",
          [bob, bobFood],
        ),
      ),
    ).rejects.toThrow(/permission denied|row-level security/i);
  });

  it("cannot move an expense to another user's category", async () => {
    await expect(
      db.asUser(alice, (tx) => tx.query("update public.expenses set category_id = $1 where id = $2", [bobFood, aliceExpense])),
    ).rejects.toThrow(/foreign key/i);
  });
});

describe("column privileges", () => {
  it("cannot set is_fallback or spent_at directly", async () => {
    await expect(
      db.asUser(alice, (tx) => tx.query("update public.categories set is_fallback = false where user_id = $1", [alice])),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      db.asUser(alice, (tx) => tx.query("update public.expenses set spent_at = now() where id = $1", [aliceExpense])),
    ).rejects.toThrow(/permission denied/i);
  });

  it("cannot delete the fallback category directly", async () => {
    await expect(
      db.asUser(alice, (tx) => tx.query("delete from public.categories where is_fallback")),
    ).rejects.toThrow(/fallback/i);
    const { rows } = await db.pg.query<{ n: number }>(
      "select count(*)::int as n from public.categories where user_id = $1 and is_fallback",
      [alice],
    );
    expect(rows[0].n).toBe(1);
  });

  it("can update their own profile settings", async () => {
    await db.asUser(alice, async (tx) => {
      const { rows } = await tx.query<{ currency: string }>(
        "update public.profiles set currency = 'USD', week_starts_on = 0 where id = $1 returning currency",
        [alice],
      );
      expect(rows[0].currency).toBe("USD");
    });
    await db.pg.query("update public.profiles set currency = 'GHS', week_starts_on = 1 where id = $1", [alice]);
  });

  it("notifications are read-only except read_at", async () => {
    await db.asUser(alice, async (tx) => {
      const { rows } = await tx.query("update public.notifications set read_at = now() returning id");
      expect(rows).toHaveLength(1);
    });
    await expect(db.asUser(alice, (tx) => tx.query("update public.notifications set title = 'x'"))).rejects.toThrow(
      /permission denied/i,
    );
    await expect(
      db.asUser(alice, (tx) =>
        tx.query("insert into public.notifications (user_id, kind, title, body, dedupe_key) values ($1, 'daily_reminder', 't', 'b', 'k')", [alice]),
      ),
    ).rejects.toThrow(/permission denied/i);
  });
});

describe("without a signed-in person", () => {
  it("the app role sees nothing when no person is set", async () => {
    await db.asSignedOut(async (tx) => {
      for (const table of ["expenses", "categories", "budgets", "profiles"]) {
        const { rows } = await tx.query<{ n: number }>(`select count(*)::int as n from public.${table}`);
        expect(rows[0].n, table).toBe(0);
      }
    });
  });

  it("other database roles get permission denied", async () => {
    await expect(db.asOutsider((tx) => tx.query("select * from public.expenses"))).rejects.toThrow(/permission denied/i);
    await expect(db.asOutsider((tx) => tx.query("select * from public.profiles"))).rejects.toThrow(/permission denied/i);
  });
});

describe("owner connection", () => {
  it("bypasses RLS for the server's own jobs", async () => {
    const { rows } = await db.pg.query<{ n: number }>("select count(distinct user_id)::int as n from public.categories");
    expect(rows[0].n).toBeGreaterThanOrEqual(2);
  });
});

describe("offline sync", () => {
  it("same id inserted twice keeps one row", async () => {
    const id = randomUUID();
    const insert = (amount: string) =>
      db.asUser(alice, (tx) =>
        tx.query(
          "insert into public.expenses (id, amount, category_id, spent_on, spent_time) values ($1, $2, $3, '2026-11-19', '18:20') on conflict (id) do nothing",
          [id, amount, aliceFood],
        ),
      );
    await insert("23.00");
    await insert("99.00");
    const { rows } = await db.pg.query<{ amount: string }>("select amount::text from public.expenses where id = $1", [id]);
    expect(rows).toEqual([{ amount: "23.00" }]);
  });

  it("marking the same no-spend day twice keeps one row", async () => {
    const mark = () =>
      db.asUser(bob, (tx) => tx.query("insert into public.no_spend_days (day) values ('2026-11-17') on conflict (user_id, day) do nothing"));
    await mark();
    await mark();
    const { rows } = await db.pg.query<{ n: number }>(
      "select count(*)::int as n from public.no_spend_days where user_id = $1 and day = '2026-11-17'",
      [bob],
    );
    expect(rows[0].n).toBe(1);
  });
});
