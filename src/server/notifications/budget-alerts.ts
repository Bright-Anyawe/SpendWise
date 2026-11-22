import { todayInTimeZone } from "@/lib/dates";
import type { BudgetPeriod } from "@/lib/types/database";
import { budgetExceededCopy, budgetWarningCopy } from "./copy";
import { actAs, createdOnLocalDay, createNotifications, type NotifyDeps, type PlannedNotification, pushNotifications } from "./deliver";

interface BudgetRow {
  budget_id: string;
  period: BudgetPeriod;
  category_name: string | null;
  remaining: number;
  used_percent: number;
  state: "ok" | "warning" | "over";
  period_start: string;
}

/**
 * After an expense is saved: a warning when a budget reaches its alert point, and an alert when it
 * goes over — each once per budget per period, and only if budget alerts are on.
 * Going straight past the limit sends only the "over budget" alert.
 */
export async function checkBudgetAlerts(userId: string, now: Date, deps: NotifyDeps): Promise<{ created: number; pushed: number }> {
  const created = await deps.owner(async (db) => {
    const { rows: people } = await db.query<{ timezone: string; currency: string; enabled: boolean }>(
      `select p.timezone, p.currency, np.budget_alerts_enabled as enabled
         from public.profiles p join public.notification_preferences np on np.user_id = p.id
        where p.id = $1`,
      [userId],
    );
    const person = people[0];
    if (!person?.enabled) return [];

    await actAs(db, userId);
    const { rows } = await db.query<BudgetRow>(
      "select budget_id, period, category_name, remaining, used_percent, state, period_start from public.budget_status($1::date)",
      [todayInTimeZone(person.timezone, now)],
    );

    const planned: PlannedNotification[] = [];
    for (const b of rows) {
      if (b.state === "ok") continue;
      const facts = {
        period: b.period,
        categoryName: b.category_name,
        usedPercent: Number(b.used_percent),
        remaining: Number(b.remaining),
        periodStart: b.period_start,
        currency: person.currency,
      };
      planned.push(
        b.state === "over"
          ? { kind: "budget_exceeded", dedupeKey: `budget_exceeded:${b.budget_id}:${b.period_start}`, copy: budgetExceededCopy(facts) }
          : { kind: "budget_warning", dedupeKey: `budget_warning:${b.budget_id}:${b.period_start}`, copy: budgetWarningCopy(facts) },
      );
    }
    if (planned.length === 0) return [];

    const today = await createdOnLocalDay(db, userId, person.timezone, now);
    return (await createNotifications(db, userId, planned, today, now)).created;
  });

  const { pushed } = await pushNotifications(deps, userId, created);
  return { created: created.length, pushed };
}
