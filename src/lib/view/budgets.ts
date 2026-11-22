import type { BudgetStatus } from "@/lib/types/database";
import { monthName } from "./dashboard";

const PERIOD_ORDER = { monthly: 0, weekly: 1, daily: 2 } as const;
const STATE_ORDER = { over: 0, warning: 1, ok: 2 } as const;

/** Overall budgets (monthly → weekly → daily), then category budgets most urgent first. */
export function sortBudgets(rows: BudgetStatus[]): { overall: BudgetStatus[]; categories: BudgetStatus[] } {
  const overall = rows.filter((b) => b.category_id === null).sort((a, b) => PERIOD_ORDER[a.period] - PERIOD_ORDER[b.period]);
  const categories = rows
    .filter((b) => b.category_id !== null)
    .sort(
      (a, b) =>
        STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
        b.used_percent - a.used_percent ||
        (a.category_name ?? "").localeCompare(b.category_name ?? ""),
    );
  return { overall, categories };
}

/** How the monthly budget compares with how much of the month has passed. Null when already over. */
export function paceNote(monthly: BudgetStatus, today: string): string | null {
  if (monthly.state === "over") return null;
  const [y, m, d] = today.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const monthGone = Math.round((d / daysInMonth) * 100);
  const used = Math.round(monthly.used_percent);
  const start = `You’ve used ${used}% of your monthly budget and ${monthGone}% of ${monthName(today)} has gone, so you’re`;
  if (used - monthGone > 5) return `${start} a little ahead of pace.`;
  if (monthGone - used > 5) return `${start} comfortably within budget.`;
  return `${start} right on pace.`;
}
