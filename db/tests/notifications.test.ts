import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Queryable } from "../../src/lib/db/queryable";
import { claimPushSubscription } from "../../src/server/data/push";
import { checkBudgetAlerts } from "../../src/server/notifications/budget-alerts";
import type { NotifyDeps, Sender } from "../../src/server/notifications/deliver";
import type { PushTarget } from "../../src/server/push/send";
import { runDueNotifications } from "../../src/server/notifications/run-due";
import { categoryId, createTestDb, type TestDb } from "./helpers/db";

let db: TestDb;
let owner: Queryable;
let ama: string; // Africa/Accra (UTC+0), week starts Monday
let tama: string; // Pacific/Auckland (UTC+13 in November)
let food: string;
let transport: string;

const endpoint = (who: string) => `https://push.example.test/${who}`;

function deps(send?: Sender): NotifyDeps & { send: ReturnType<typeof vi.fn> } {
  const fn = vi.fn(send ?? (async (targets: PushTarget[]) => ({ delivered: targets.map((t) => t.endpoint), failed: [], gone: [] })));
  return { owner: (run) => db.pg.transaction((tx) => run(tx as unknown as Queryable)), send: fn };
}

async function notifications(userId: string) {
  const { rows } = await db.pg.query<{ kind: string; title: string; body: string; dedupe_key: string }>(
    "select kind, title, body, dedupe_key from public.notifications where user_id = $1 order by created_at, kind",
    [userId],
  );
  return rows;
}

async function spend(userId: string, category: string, amount: string, day: string) {
  await db.pg.query("insert into public.expenses (user_id, category_id, amount, spent_on, spent_time, payment_method) values ($1, $2, $3, $4, '12:00', 'cash')", [
    userId,
    category,
    amount,
    day,
  ]);
}

async function prefs(userId: string, set: string) {
  await db.pg.query(`update public.notification_preferences set ${set} where user_id = $1`, [userId]);
}

beforeAll(async () => {
  db = await createTestDb({ appParsers: true });
  owner = db.pg as unknown as Queryable;
  ama = await db.createUser({ displayName: "Ama", timezone: "Africa/Accra", weekStartsOn: 1 });
  tama = await db.createUser({ displayName: "Tama", timezone: "Pacific/Auckland", weekStartsOn: 1 });
  await db.pg.query("update public.profiles set onboarded_at = now(), currency = 'GHS'");
  food = await categoryId(db, ama, "Food & Groceries");
  transport = await categoryId(db, ama, "Transportation");
});

afterAll(() => db.close());

beforeEach(async () => {
  await db.pg.exec(`
    delete from public.notifications; delete from public.expenses; delete from public.no_spend_days;
    delete from public.budgets; delete from public.push_subscriptions;
    update public.notification_preferences set daily_reminder_enabled = true, reminder_time = '20:00',
      evening_review_enabled = false, weekly_summary_enabled = false, monthly_summary_enabled = false, budget_alerts_enabled = true;
  `);
  await claimPushSubscription(owner, ama, { endpoint: endpoint("ama"), p256dh: "k", auth: "a" });
  await claimPushSubscription(owner, tama, { endpoint: endpoint("tama"), p256dh: "k", auth: "a" });
});

describe("runDueNotifications", () => {
  it("respects the person's time zone", async () => {
    // 07:00 UTC on Sunday 22 Nov is 20:00 in Auckland and 07:00 in Accra.
    const d = deps();
    const counts = await runDueNotifications(new Date("2026-11-22T07:00:00Z"), d);

    expect(counts).toMatchObject({ due: 1, created: 1, pushed: 1 });
    expect(await notifications(tama)).toEqual([
      { kind: "daily_reminder", title: "Nothing logged today", body: "Got a minute? Tap to add today’s spending.", dedupe_key: "evening:2026-11-22" },
    ]);
    expect(await notifications(ama)).toEqual([]);

    // Ama's 20:00 comes 13 hours later.
    await runDueNotifications(new Date("2026-11-22T20:00:00Z"), d);
    expect((await notifications(ama)).map((n) => n.dedupe_key)).toEqual(["evening:2026-11-22"]);
  });

  it("is due from the reminder time until 2 hours after it, across midnight", async () => {
    await prefs(ama, "reminder_time = '23:00'");
    const d = deps();
    expect((await runDueNotifications(new Date("2026-11-22T22:59:00Z"), d)).due).toBe(0);
    expect((await runDueNotifications(new Date("2026-11-23T00:30:00Z"), d)).created).toBe(1);
    expect((await notifications(ama)).map((n) => n.dedupe_key)).toEqual(["evening:2026-11-22"]);
    expect((await runDueNotifications(new Date("2026-11-23T01:00:00Z"), d)).due).toBe(0);
  });

  it("runs twice in the same window → one notification, one push", async () => {
    const d = deps();
    await runDueNotifications(new Date("2026-11-22T20:00:00Z"), d);
    const again = await runDueNotifications(new Date("2026-11-22T20:15:00Z"), d);

    expect(again).toMatchObject({ due: 0, created: 0, pushed: 0 });
    expect(await notifications(ama)).toHaveLength(1);
    expect(d.send.mock.calls.filter(([targets]) => targets[0].endpoint === endpoint("ama"))).toHaveLength(1);
  });

  it("a no-spend day silences the reminder", async () => {
    await db.pg.query("insert into public.no_spend_days (user_id, day) values ($1, '2026-11-22')", [ama]);
    const counts = await runDueNotifications(new Date("2026-11-22T20:05:00Z"), deps());
    expect(counts.due).toBe(0);
    expect(await notifications(ama)).toEqual([]);
  });

  it("sends the evening review instead of the reminder when something was logged", async () => {
    await spend(ama, food, "35.00", "2026-11-21");
    await spend(ama, food, "20.00", "2026-11-22");
    await spend(ama, transport, "8.50", "2026-11-22");

    // Review off (the default): nothing, because there's nothing to remind about.
    expect((await runDueNotifications(new Date("2026-11-22T20:00:00Z"), deps())).due).toBe(0);

    await prefs(ama, "evening_review_enabled = true");
    await runDueNotifications(new Date("2026-11-22T20:00:00Z"), deps());
    expect(await notifications(ama)).toEqual([
      { kind: "evening_review", title: "Today: GHS 28.50", body: "2 expenses, 19% less than yesterday.", dedupe_key: "evening:2026-11-22" },
    ]);
  });

  it("only reminds people who have a device to remind", async () => {
    await db.pg.query("delete from public.push_subscriptions where user_id = $1", [ama]);
    expect((await runDueNotifications(new Date("2026-11-22T20:00:00Z"), deps())).due).toBe(0);
  });

  it("sends the weekly summary on the first day of the week only", async () => {
    await prefs(ama, "weekly_summary_enabled = true, daily_reminder_enabled = false");
    await spend(ama, food, "60.00", "2026-11-16");
    await spend(ama, transport, "30.00", "2026-11-20");
    await spend(ama, food, "100.00", "2026-11-10");

    await runDueNotifications(new Date("2026-11-22T10:00:00Z"), deps()); // Sunday
    await runDueNotifications(new Date("2026-11-23T08:59:00Z"), deps()); // Monday, too early
    expect(await notifications(ama)).toEqual([]);

    await runDueNotifications(new Date("2026-11-23T10:00:00Z"), deps()); // Monday 10:00
    await runDueNotifications(new Date("2026-11-23T11:45:00Z"), deps());
    expect(await notifications(ama)).toEqual([
      {
        kind: "weekly_summary",
        title: "Last week: GHS 90.00",
        body: "10% less than the week before. Food & Groceries was your top category.",
        dedupe_key: "weekly:2026-11-16",
      },
    ]);
  });

  it("sends the monthly summary on the 1st, against the monthly budget", async () => {
    await prefs(ama, "monthly_summary_enabled = true");
    await spend(ama, food, "3310.00", "2026-11-12");
    await db.pg.query("insert into public.budgets (user_id, period, amount) values ($1, 'monthly', 3000)", [ama]);

    await runDueNotifications(new Date("2026-12-01T09:30:00Z"), deps());
    expect(await notifications(ama)).toEqual([
      {
        kind: "monthly_summary",
        title: "November: GHS 3,310.00",
        body: "GHS 310.00 over your monthly budget. Here’s where it went.",
        dedupe_key: "monthly:2026-11",
      },
    ]);
  });

  it("removes expired subscriptions and carries on", async () => {
    const d = deps(async (targets) => ({
      delivered: targets.filter((t) => t.endpoint !== endpoint("ama")).map((t) => t.endpoint),
      failed: [],
      gone: targets.filter((t) => t.endpoint === endpoint("ama")).map((t) => t.endpoint),
    }));
    await claimPushSubscription(owner, ama, { endpoint: endpoint("ama-laptop"), p256dh: "k", auth: "a" });

    const counts = await runDueNotifications(new Date("2026-11-22T20:00:00Z"), d);

    expect(counts).toMatchObject({ created: 1, pushed: 1, gone: 1, errors: 0 });
    const { rows } = await db.pg.query<{ endpoint: string }>("select endpoint from public.push_subscriptions where user_id = $1", [ama]);
    expect(rows.map((r) => r.endpoint)).toEqual([endpoint("ama-laptop")]);
  });

  it("caps pushes at 3 a day", async () => {
    for (const key of ["a", "b", "c"]) {
      await db.pg.query(
        "insert into public.notifications (user_id, kind, title, body, dedupe_key, created_at) values ($1, 'budget_warning', 't', 'b', $2, '2026-11-22T09:00:00Z')",
        [ama, key],
      );
    }
    const d = deps();
    const counts = await runDueNotifications(new Date("2026-11-22T20:00:00Z"), d);

    expect(counts).toMatchObject({ due: 1, created: 0, capped: 1 });
    expect(d.send).not.toHaveBeenCalled();
  });
});

describe("checkBudgetAlerts", () => {
  const now = new Date("2026-11-22T12:00:00Z");

  beforeEach(async () => {
    await db.pg.query("insert into public.budgets (user_id, period, category_id, amount, alert_at_percent) values ($1, 'monthly', $2, 200, 80)", [ama, food]);
  });

  it("warns once at the alert point, then once when over", async () => {
    await spend(ama, food, "150.00", "2026-11-10");
    const d = deps();
    expect(await checkBudgetAlerts(ama, now, d)).toEqual({ created: 0, pushed: 0 });

    await spend(ama, food, "15.00", "2026-11-20"); // 82.5%
    expect(await checkBudgetAlerts(ama, now, d)).toEqual({ created: 1, pushed: 1 });
    expect(await checkBudgetAlerts(ama, now, d)).toEqual({ created: 0, pushed: 0 });

    await spend(ama, food, "53.00", "2026-11-21"); // 218.00
    await checkBudgetAlerts(ama, now, d);
    expect((await notifications(ama)).map((n) => [n.title, n.body])).toEqual([
      ["Food & Groceries is at 82%", "GHS 35.00 left for the rest of November."],
      ["Food & Groceries is over budget", "GHS 18.00 over for November."],
    ]);
    expect(d.send).toHaveBeenCalledTimes(2);
  });

  it("does nothing when budget alerts are off", async () => {
    await prefs(ama, "budget_alerts_enabled = false");
    await spend(ama, food, "250.00", "2026-11-10");
    expect(await checkBudgetAlerts(ama, now, deps())).toEqual({ created: 0, pushed: 0 });
    expect(await notifications(ama)).toEqual([]);
  });
});
