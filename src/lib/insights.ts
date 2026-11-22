import { percentChange } from "@/lib/calc";
import { dayLabel } from "@/lib/dates";
import { monthName } from "@/lib/view/dashboard";
import type { ReportData } from "@/server/data/reports";

export interface Insight {
  id: string;
  text: string;
}

/** Thresholds, kept in one place so they're easy to tune. */
export const INSIGHT_RULES = {
  topCategoryMinExpenses: 3,
  categoryChangeMinPercent: 15,
  categoryChangeMinShare: 5,
  streakMinDays: 4,
  maxInsights: 5,
} as const;

/**
 * Plain-language observations computed only from the report's own numbers.
 * An insight appears only when there is enough data behind it.
 */
export function buildInsights(r: ReportData, money: (n: number) => string): Insight[] {
  const out: Insight[] = [];
  const spending = r.categories.filter((c) => c.counts_as_spending && c.total > 0);
  const inPeriod = r.isCurrent ? `this ${r.period}` : r.period === "month" ? `in ${monthName(r.start)}` : "that week";
  const against = r.isCurrent
    ? `in the same days last ${r.period}`
    : r.period === "month"
      ? `in ${monthName(r.previous.start)}`
      : "in the week before";

  // 1. Top category
  const top = spending[0];
  if (top && r.count >= INSIGHT_RULES.topCategoryMinExpenses && top.share !== null) {
    out.push({
      id: "top-category",
      text: `${top.name} is your highest spending category ${inPeriod}: ${money(top.total)}, or ${Math.round(top.share)}% of your spending.`,
    });
  }

  // 2. Overall change
  const change = percentChange(r.total, r.previous.total);
  if (change !== null && r.total > 0) {
    const pct = Math.round(Math.abs(change));
    out.push({
      id: "total-change",
      text: pct === 0 ? `You spent about the same as ${against.replace(/^in /, "")}.` : `You spent ${pct}% ${change < 0 ? "less" : "more"} than ${against}.`,
    });
  }

  // 3. The biggest category change worth mentioning
  const previousByName = new Map(r.previousCategories.map((c) => [c.name, c.total]));
  let biggest: { name: string; change: number } | null = null;
  for (const c of spending) {
    const before = previousByName.get(c.name);
    if (!before || c.share === null || c.share < INSIGHT_RULES.categoryChangeMinShare) continue;
    const delta = percentChange(c.total, before);
    if (delta === null || Math.abs(delta) < INSIGHT_RULES.categoryChangeMinPercent) continue;
    if (!biggest || Math.abs(delta) > Math.abs(biggest.change)) biggest = { name: c.name, change: delta };
  }
  if (biggest) {
    out.push({
      id: "category-change",
      text: `You spent ${Math.round(Math.abs(biggest.change))}% ${biggest.change < 0 ? "less" : "more"} on ${biggest.name} than ${against}.`,
    });
  }

  // 4. Budget for this period, and budgets that are over (current period only)
  if (r.isCurrent) {
    const periodName = r.period === "month" ? "monthly" : "weekly";
    const overall = r.budgets.find((b) => b.category_id === null && b.period === periodName);
    if (overall && overall.state !== "over") {
      const [ty, tm, td] = r.today.split("-").map(Number);
      const [ey, em, ed] = overall.period_end.split("-").map(Number);
      const daysLeft = Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(ty, tm - 1, td)) / 86_400_000) + 1;
      out.push({
        id: "budget-usage",
        text: `You’ve used ${Math.round(overall.used_percent)}% of your ${periodName} budget, with ${daysLeft} ${daysLeft === 1 ? "day" : "days"} left.`,
      });
    }
    for (const b of r.budgets.filter((x) => x.state === "over").slice(0, 2)) {
      const name = b.category_name ?? `Your overall`;
      out.push({ id: `over-${b.budget_id}`, text: `${name} is ${money(-b.remaining)} over its ${b.period} budget.` });
    }
  }

  // 5. Savings
  const saved = r.categories.filter((c) => !c.counts_as_spending).reduce((sum, c) => sum + c.total, 0);
  if (saved > 0) out.push({ id: "savings", text: `You set aside ${money(saved)} to savings.` });

  // 6. Logging habit (current period only)
  if (r.isCurrent && r.loggedDays >= INSIGHT_RULES.streakMinDays) {
    out.push({
      id: "streak",
      text: r.loggedDays >= 7 ? "You’ve logged expenses every day for the last 7 days." : `You logged expenses on ${r.loggedDays} of the last 7 days.`,
    });
  }

  // 7. Highest day of a week
  if (r.period === "week") {
    const spent = r.days.filter((d) => d.total > 0 && d.day <= r.upTo);
    if (spent.length >= 2) {
      const best = spent.reduce((a, b) => (b.total > a.total ? b : a));
      out.push({ id: "highest-day", text: `${dayLabel(best.day, r.today)} was your highest spending day: ${money(best.total)}.` });
    }
  }

  return out.slice(0, INSIGHT_RULES.maxInsights);
}
