import type { Queryable } from "@/lib/db/queryable";
import type { NotificationKind } from "@/lib/types/database";
import { recordPushResults, subscriptionsFor } from "../data/push";
import type { PushPayload, PushResults, PushTarget } from "../push/send";
import type { NotificationCopy } from "./copy";

/** Never more than this many notifications for one person on one local day. */
export const DAILY_CAP = 3;

/** Runs fn in a transaction as the database owner (withOwnerTransaction in the app, PGlite in tests). */
export type OwnerRunner = <T>(fn: (db: Queryable) => Promise<T>) => Promise<T>;
export type Sender = (targets: PushTarget[], payload: PushPayload) => Promise<PushResults>;

export interface NotifyDeps {
  owner: OwnerRunner;
  send: Sender;
}

export interface PlannedNotification {
  kind: NotificationKind;
  dedupeKey: string;
  copy: NotificationCopy;
}

export interface CreatedNotification extends PlannedNotification {
  id: string;
}

/** Owner connection: the spending functions read app.user_id, so point them at this person. */
export async function actAs(db: Queryable, userId: string): Promise<void> {
  await db.query("select set_config('app.user_id', $1, true)", [userId]);
}

/** How many notifications this person already got on their local day containing `now`. */
export async function createdOnLocalDay(db: Queryable, userId: string, timezone: string, now: Date): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from public.notifications
      where user_id = $1 and (created_at at time zone $2)::date = ($3::timestamptz at time zone $2)::date`,
    [userId, timezone, now.toISOString()],
  );
  return Number(rows[0]?.n ?? 0);
}

/**
 * Inserts planned notifications until the day's cap is reached. A dedupe key that already exists
 * inserts nothing, so the same notification is never created (or pushed) twice.
 */
export async function createNotifications(
  db: Queryable,
  userId: string,
  planned: PlannedNotification[],
  alreadyToday: number,
  now: Date,
): Promise<{ created: CreatedNotification[]; capped: number }> {
  const created: CreatedNotification[] = [];
  let capped = 0;
  for (const item of planned) {
    if (alreadyToday + created.length >= DAILY_CAP) {
      capped++;
      continue;
    }
    const { rows } = await db.query<{ id: string }>(
      `insert into public.notifications (user_id, kind, title, body, data, dedupe_key, created_at)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (user_id, dedupe_key) do nothing
       returning id`,
      [
        userId,
        item.kind,
        item.copy.title,
        item.copy.body,
        JSON.stringify({ url: item.copy.url }),
        item.dedupeKey,
        now.toISOString(),
      ],
    );
    if (rows[0]) created.push({ ...item, id: rows[0].id });
  }
  return { created, capped };
}

/** Pushes each new notification to the person's devices and tidies up endpoints that are gone. */
export async function pushNotifications(
  deps: NotifyDeps,
  userId: string,
  created: CreatedNotification[],
): Promise<{ pushed: number; gone: number }> {
  if (created.length === 0) return { pushed: 0, gone: 0 };
  let targets = await deps.owner((db) => subscriptionsFor(db, userId));
  const all: PushResults = { delivered: [], failed: [], gone: [] };
  let pushed = 0;

  for (const n of created) {
    if (targets.length === 0) break;
    const results = await deps.send(targets, {
      title: n.copy.title,
      body: n.copy.body,
      url: n.copy.url,
      tag: n.dedupeKey,
      actions: n.copy.actions,
    });
    if (results.delivered.length) pushed++;
    all.delivered.push(...results.delivered);
    all.failed.push(...results.failed);
    all.gone.push(...results.gone);
    targets = targets.filter((t) => !results.gone.includes(t.endpoint));
  }

  const gone = [...new Set(all.gone)];
  await deps.owner((db) =>
    recordPushResults(db, {
      delivered: [...new Set(all.delivered)].filter((e) => !gone.includes(e)),
      failed: [...new Set(all.failed)].filter((e) => !gone.includes(e)),
      gone,
    }),
  );
  return { pushed, gone: gone.length };
}
