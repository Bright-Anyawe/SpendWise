import { formatMoney } from "@/lib/money";
import type { PushPayload } from "../push/send";

// Notification wording (Phase 2 §7). Every number comes from the database at send time.

export type NotificationCopy = Required<Pick<PushPayload, "title" | "body" | "url">> & Pick<PushPayload, "actions">;

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "23% less than yesterday" / "the same as yesterday"; null when there's nothing to compare with. */
export function changePhrase(current: number, previous: number, than: string): string | null {
  if (previous <= 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return `the same as ${than}`;
  return `${Math.abs(pct)}% ${pct < 0 ? "less" : "more"} than ${than}`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function monthName(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
}

export function dailyReminderCopy(): NotificationCopy {
  return {
    title: "Nothing logged today",
    body: "Got a minute? Tap to add today’s spending.",
    url: "/?add=1",
    actions: [
      { action: "add", title: "Add expense" },
      { action: "no-spend", title: "No spending today" },
    ],
  };
}

export function eveningReviewCopy(r: { total: number; count: number; yesterday: number; currency: string }): NotificationCopy {
  const change = changePhrase(r.total, r.yesterday, "yesterday");
  return {
    title: `Today: ${formatMoney(r.total, r.currency)}`,
    body: `${plural(r.count, "expense", "expenses")}${change ? `, ${change}` : " logged"}.`,
    url: "/",
  };
}

export function weeklySummaryCopy(r: {
  weekStart: string;
  total: number;
  previous: number;
  topCategory: string | null;
  currency: string;
}): NotificationCopy {
  const parts: string[] = [];
  const change = changePhrase(r.total, r.previous, "the week before");
  if (r.total === 0) parts.push("No spending logged last week.");
  else if (change) parts.push(`${capitalise(change)}.`);
  if (r.total > 0 && r.topCategory) parts.push(`${r.topCategory} was your top category.`);
  return {
    title: `Last week: ${formatMoney(r.total, r.currency)}`,
    body: parts.join(" ") || "Here’s where it went.",
    url: `/reports?period=week&ref=${r.weekStart}`,
  };
}

export function monthlySummaryCopy(r: { monthStart: string; total: number; budget: number | null; currency: string }): NotificationCopy {
  let body = "Here’s where it went.";
  if (r.total === 0) body = "No spending logged last month.";
  else if (r.budget !== null && r.total > r.budget) {
    body = `${formatMoney(r.total - r.budget, r.currency)} over your monthly budget. Here’s where it went.`;
  } else if (r.budget !== null) {
    body = `${formatMoney(r.budget - r.total, r.currency)} under your monthly budget. Here’s where it went.`;
  }
  return {
    title: `${monthName(r.monthStart)}: ${formatMoney(r.total, r.currency)}`,
    body,
    url: `/reports?ref=${r.monthStart}`,
  };
}

export interface BudgetAlertFacts {
  period: "daily" | "weekly" | "monthly";
  categoryName: string | null;
  usedPercent: number;
  remaining: number;
  periodStart: string;
  currency: string;
}

function budgetName(b: BudgetAlertFacts): string {
  return b.categoryName ?? `Your ${b.period} budget`;
}

function periodPhrase(b: BudgetAlertFacts, rest: boolean): string {
  if (b.period === "daily") return "today";
  if (b.period === "weekly") return rest ? "the rest of the week" : "this week";
  return rest ? `the rest of ${monthName(b.periodStart)}` : monthName(b.periodStart);
}

export function budgetWarningCopy(b: BudgetAlertFacts): NotificationCopy {
  return {
    title: `${budgetName(b)} is at ${Math.floor(b.usedPercent)}%`,
    body: `${formatMoney(b.remaining, b.currency)} left for ${periodPhrase(b, true)}.`,
    url: "/budgets",
  };
}

export function budgetExceededCopy(b: BudgetAlertFacts): NotificationCopy {
  return {
    title: `${budgetName(b)} is over budget`,
    body: `${formatMoney(-b.remaining, b.currency)} over for ${periodPhrase(b, false)}.`,
    url: "/budgets",
  };
}
