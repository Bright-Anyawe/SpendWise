import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Queryable } from "../../src/lib/db/queryable";
import {
  claimPushSubscription,
  mySubscription,
  recordPushResults,
  removeMySubscription,
  subscriptionsFor,
} from "../../src/server/data/push";
import { listNotifications, markAllNotificationsRead, unreadNotificationCount } from "../../src/server/data/notifications";
import { createTestDb, type TestDb } from "./helpers/db";

let db: TestDb;
let owner: Queryable;
let ama: string;
let kofi: string;

const sub = (endpoint: string, keys = "a") => ({
  endpoint: `https://push.example.test/${endpoint}`,
  p256dh: `p256dh-${keys}`,
  auth: `auth-${keys}`,
  userAgent: "Test browser",
});

beforeAll(async () => {
  db = await createTestDb({ appParsers: true });
  owner = db.pg as unknown as Queryable;
  ama = await db.createUser({ displayName: "Ama" });
  kofi = await db.createUser({ displayName: "Kofi" });
});

afterAll(() => db.close());

beforeEach(async () => {
  await db.pg.query("delete from public.push_subscriptions");
});

describe("notification inbox", () => {
  it("shows people only their own notifications, and marks them read", async () => {
    await db.pg.query(
      `insert into public.notifications (user_id, kind, title, body, data, dedupe_key, created_at) values
        ($1, 'daily_reminder', 'Nothing logged today', 'b', '{"url":"/?add=1"}', 'evening:2026-11-21', '2026-11-21T20:00:00Z'),
        ($1, 'weekly_summary', 'Last week: GHS 90.00', 'b', '{"url":"/reports?period=week"}', 'weekly:2026-11-16', '2026-11-23T09:00:00Z'),
        ($2, 'daily_reminder', 'Kofi''s reminder', 'b', '{}', 'evening:2026-11-21', '2026-11-21T20:00:00Z')`,
      [ama, kofi],
    );
    const asAma = <T,>(fn: (q: Queryable) => Promise<T>) => db.asUser(ama, (tx) => fn(tx as unknown as Queryable));

    expect((await asAma(listNotifications)).map((n) => [n.title, n.url])).toEqual([
      ["Last week: GHS 90.00", "/reports?period=week"],
      ["Nothing logged today", "/?add=1"],
    ]);
    expect(await asAma(unreadNotificationCount)).toBe(2);
    expect(await asAma(markAllNotificationsRead)).toBe(2);
    expect(await asAma(unreadNotificationCount)).toBe(0);
    expect(await db.asUser(kofi, (tx) => unreadNotificationCount(tx as unknown as Queryable))).toBe(1);
  });
});

describe("push subscriptions", () => {
  it("claimPushSubscription moves an endpoint between accounts", async () => {
    await claimPushSubscription(owner, ama, sub("phone"));
    await claimPushSubscription(owner, kofi, sub("phone"));

    expect(await subscriptionsFor(owner, ama)).toEqual([]);
    const kofis = await subscriptionsFor(owner, kofi);
    expect(kofis.map((s) => s.endpoint)).toEqual(["https://push.example.test/phone"]);
    // Ama can no longer see (or remove) it; Kofi can.
    expect(await db.asUser(ama, (tx) => mySubscription(tx as unknown as Queryable, sub("phone").endpoint))).toBeNull();
    expect(await db.asUser(kofi, (tx) => mySubscription(tx as unknown as Queryable, sub("phone").endpoint))).not.toBeNull();
  });

  it("a re-subscribe updates the keys and clears failures", async () => {
    await claimPushSubscription(owner, ama, sub("laptop", "old"));
    await recordPushResults(owner, { delivered: [], failed: [sub("laptop").endpoint], gone: [] });
    const updated = await claimPushSubscription(owner, ama, sub("laptop", "new"));

    expect(updated).toMatchObject({ user_id: ama, p256dh: "p256dh-new", auth: "auth-new", failure_count: 0 });
    expect(await subscriptionsFor(owner, ama)).toHaveLength(1);
  });

  it("records deliveries and removes endpoints the push service says are gone", async () => {
    await claimPushSubscription(owner, ama, sub("ok"));
    await claimPushSubscription(owner, ama, sub("flaky"));
    await claimPushSubscription(owner, ama, sub("gone"));

    await recordPushResults(owner, {
      delivered: [sub("ok").endpoint],
      failed: [sub("flaky").endpoint],
      gone: [sub("gone").endpoint],
    });

    const rows = await subscriptionsFor(owner, ama);
    expect(rows.map((r) => [r.endpoint.split("/").pop(), r.failure_count, r.last_success_at !== null])).toEqual([
      ["ok", 0, true],
      ["flaky", 1, false],
    ]);
  });

  it("people can only turn off their own devices", async () => {
    await claimPushSubscription(owner, ama, sub("phone"));

    expect(await db.asUser(kofi, (tx) => removeMySubscription(tx as unknown as Queryable, sub("phone").endpoint))).toBe(false);
    expect(await subscriptionsFor(owner, ama)).toHaveLength(1);
    expect(await db.asUser(ama, (tx) => removeMySubscription(tx as unknown as Queryable, sub("phone").endpoint))).toBe(true);
    expect(await subscriptionsFor(owner, ama)).toHaveLength(0);
  });
});
