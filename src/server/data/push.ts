import { one, type Queryable } from "@/lib/db/queryable";

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}

export interface StoredPushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  last_success_at: string | null;
  failure_count: number;
}

/**
 * Owner connection. A push endpoint belongs to one browser, so when someone else signs in on that
 * browser and turns notifications on, it moves to their account (and the old one stops getting pushes).
 * Re-subscribing replaces the keys.
 */
export function claimPushSubscription(
  ownerDb: Queryable,
  userId: string,
  sub: PushSubscriptionInput,
): Promise<StoredPushSubscription | null> {
  return one<StoredPushSubscription>(
    ownerDb,
    `insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
     values ($1, $2, $3, $4, $5)
     on conflict (endpoint) do update
       set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
           user_agent = excluded.user_agent, failure_count = 0
     returning *`,
    [userId, sub.endpoint, sub.p256dh, sub.auth, sub.userAgent ? sub.userAgent.slice(0, 300) : null],
  );
}

/** Owner connection: every device a person turned notifications on for. */
export async function subscriptionsFor(ownerDb: Queryable, userId: string): Promise<StoredPushSubscription[]> {
  const { rows } = await ownerDb.query<StoredPushSubscription>(
    "select * from public.push_subscriptions where user_id = $1 order by created_at",
    [userId],
  );
  return rows;
}

/** Owner connection: notes which pushes were delivered and drops endpoints the push service says are gone. */
export async function recordPushResults(
  ownerDb: Queryable,
  results: { delivered: string[]; failed: string[]; gone: string[] },
): Promise<void> {
  if (results.delivered.length) {
    await ownerDb.query(
      "update public.push_subscriptions set last_success_at = now(), failure_count = 0 where endpoint = any($1::text[])",
      [results.delivered],
    );
  }
  if (results.failed.length) {
    await ownerDb.query(
      "update public.push_subscriptions set failure_count = failure_count + 1 where endpoint = any($1::text[])",
      [results.failed],
    );
  }
  if (results.gone.length) {
    await ownerDb.query("delete from public.push_subscriptions where endpoint = any($1::text[])", [results.gone]);
  }
}

/** Signed-in person (RLS): this device's subscription, if it's theirs. */
export function mySubscription(db: Queryable, endpoint: string): Promise<StoredPushSubscription | null> {
  return one<StoredPushSubscription>(db, "select * from public.push_subscriptions where endpoint = $1", [endpoint]);
}

/** Signed-in person (RLS): turns notifications off for one of their devices. */
export async function removeMySubscription(db: Queryable, endpoint: string): Promise<boolean> {
  const { rows } = await db.query<{ id: string }>("delete from public.push_subscriptions where endpoint = $1 returning id", [endpoint]);
  return rows.length > 0;
}
