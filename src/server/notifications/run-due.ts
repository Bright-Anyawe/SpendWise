import type { Queryable } from "@/lib/db/queryable";
import type { NotificationKind } from "@/lib/types/database";
import { dailyReminderCopy, eveningReviewCopy, monthlySummaryCopy, type NotificationCopy, weeklySummaryCopy } from "./copy";
import { actAs, createNotifications, type NotifyDeps, pushNotifications } from "./deliver";

interface DueRow {
  user_id: string;
  kind: NotificationKind;
  ref_date: string;
  dedupe_key: string;
  timezone: string;
  currency: string;
  local_date: string;
  sent_today: number;
}

export interface NotifyCounts {
  /** Notifications due at this moment that hadn't been created yet. */
  due: number;
  created: number;
  /** Created notifications that reached at least one device. */
  pushed: number;
  /** Device subscriptions removed because the push service said they're gone. */
  gone: number;
  /** Skipped because the person already had 3 notifications that day. */
  capped: number;
  /** People whose notifications failed (the job carries on with everyone else). */
  errors: number;
}

const num = (v: unknown) => Number(v ?? 0);

/** Fills in a notification's numbers from the database (app.user_id must already point at the person). */
async function copyFor(db: Queryable, row: DueRow): Promise<NotificationCopy> {
  switch (row.kind) {
    case "daily_reminder":
      return dailyReminderCopy();
    case "evening_review": {
      const { rows } = await db.query<{ current_total: number; current_count: number; previous_total: number }>(
        "select current_total, current_count, previous_total from public.spending_comparisons($1::date) where kind = 'day'",
        [row.ref_date],
      );
      const r = rows[0];
      return eveningReviewCopy({ total: num(r?.current_total), count: num(r?.current_count), yesterday: num(r?.previous_total), currency: row.currency });
    }
    case "weekly_summary": {
      const { rows } = await db.query<{ total: number; previous: number; top: string | null }>(
        `select
           (select t.total from public.spending_total($1::date, $1::date + 6) t) as total,
           (select t.total from public.spending_total($1::date - 7, $1::date - 1) t) as previous,
           (select c.name from public.spending_by_category($1::date, $1::date + 6) c where c.counts_as_spending limit 1) as top`,
        [row.ref_date],
      );
      const r = rows[0];
      return weeklySummaryCopy({ weekStart: row.ref_date, total: num(r?.total), previous: num(r?.previous), topCategory: r?.top ?? null, currency: row.currency });
    }
    case "monthly_summary": {
      const { rows } = await db.query<{ total: number; budget: number | null }>(
        `select
           (select t.total from public.spending_total($1::date, ($1::date + interval '1 month - 1 day')::date) t) as total,
           (select b.amount from public.budgets b where b.user_id = $2 and b.period = 'monthly' and b.category_id is null) as budget`,
        [row.ref_date, row.user_id],
      );
      const r = rows[0];
      return monthlySummaryCopy({
        monthStart: row.ref_date,
        total: num(r?.total),
        budget: r?.budget === null || r?.budget === undefined ? null : Number(r.budget),
        currency: row.currency,
      });
    }
    default:
      throw new Error(`Not a scheduled notification: ${row.kind}`);
  }
}

/**
 * The reminder job: creates whatever is due at `now` (in each person's own time zone) and pushes it.
 * Safe to run late, often or twice: dedupe keys mean each notification is created and pushed once.
 */
export async function runDueNotifications(now: Date, deps: NotifyDeps): Promise<NotifyCounts> {
  const due = await deps.owner(async (db) => {
    const { rows } = await db.query<DueRow>("select * from app.due_notifications($1::timestamptz)", [now.toISOString()]);
    return rows;
  });

  const counts: NotifyCounts = { due: due.length, created: 0, pushed: 0, gone: 0, capped: 0, errors: 0 };
  const byPerson = new Map<string, DueRow[]>();
  for (const row of due) byPerson.set(row.user_id, [...(byPerson.get(row.user_id) ?? []), row]);

  for (const [userId, rows] of byPerson) {
    try {
      const { created, capped } = await deps.owner(async (db) => {
        await actAs(db, userId);
        const planned = [];
        for (const row of rows) planned.push({ kind: row.kind, dedupeKey: row.dedupe_key, copy: await copyFor(db, row) });
        return createNotifications(db, userId, planned, num(rows[0].sent_today), now);
      });
      counts.created += created.length;
      counts.capped += capped;
      const pushed = await pushNotifications(deps, userId, created);
      counts.pushed += pushed.pushed;
      counts.gone += pushed.gone;
    } catch (error) {
      counts.errors++;
      console.error(`Notifications failed for one person: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return counts;
}
