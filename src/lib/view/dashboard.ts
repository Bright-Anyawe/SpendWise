import { percentChange } from "@/lib/calc";

import type { BudgetStatus, DailyTotal, MonthlyTotal } from "@/lib/types/database";

const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type ComparisonTone = "less" | "more" | "same" | "none";

/** "23% less than yesterday". Spending less is good news; more is said plainly, never as a warning. */
export function comparisonLabel(current: number, previous: number, against: string): { text: string; tone: ComparisonTone } {
  const change = percentChange(current, previous);
  if (change === null) return { text: `Nothing to compare with ${against} yet`, tone: "none" };
  const pct = Math.round(Math.abs(change));
  if (pct === 0) return { text: `About the same as ${against}`, tone: "same" };
  return change < 0 ? { text: `${pct}% less than ${against}`, tone: "less" } : { text: `${pct}% more than ${against}`, tone: "more" };
}

function parts(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return { y, m, d };
}

/** "1–19 October", "9 November", "28 October – 3 November". */
export function rangeLabel(start: string, end: string): string {
  const a = parts(start);
  const b = parts(end);
  const year = (p: { y: number }) => (a.y !== b.y ? ` ${p.y}` : "");
  if (start === end) return `${a.d} ${MONTHS_LONG[a.m - 1]}`;
  if (a.y === b.y && a.m === b.m) return `${a.d}–${b.d} ${MONTHS_LONG[a.m - 1]}`;
  return `${a.d} ${MONTHS_LONG[a.m - 1]}${year(a)} – ${b.d} ${MONTHS_LONG[b.m - 1]}${year(b)}`;
}

function daysBetween(from: string, to: string): number {
  const f = parts(from);
  const t = parts(to);
  return Math.round((Date.UTC(t.y, t.m - 1, t.d) - Date.UTC(f.y, f.m - 1, f.d)) / 86_400_000);
}

export interface BudgetLeft {
  amount: number;
  spent: number;
  left: number;
  percent: number;
  daysLeft: number;
  /** About how much can be spent per day for the rest of the month, or null when nothing is left. */
  perDay: number | null;
  state: BudgetStatus["state"];
}

/** The overall monthly budget, as "money left this month". Null when there isn't one. */
export function budgetLeft(budgets: BudgetStatus[], today: string): BudgetLeft | null {
  const monthly = budgets.find((b) => b.period === "monthly" && b.category_id === null);
  if (!monthly) return null;
  const daysLeft = Math.max(daysBetween(today, monthly.period_end) + 1, 0);
  const left = monthly.remaining;
  return {
    amount: monthly.amount,
    spent: monthly.spent,
    left,
    percent: monthly.used_percent,
    daysLeft,
    perDay: left > 0 && daysLeft > 0 ? left / daysLeft : null,
    state: monthly.state,
  };
}

export interface Bar {
  key: string;
  label: string;
  value: number;
  /** past / today / future for days; past / partial for months. */
  kind: "past" | "today" | "future" | "partial";
}

export function weekBars(days: DailyTotal[], today: string): Bar[] {
  return days.map((d) => {
    const { y, m, d: day } = parts(d.day);
    const kind = d.day < today ? "past" : d.day === today ? "today" : "future";
    return {
      key: d.day,
      label: kind === "today" ? "Today" : WEEKDAYS[new Date(Date.UTC(y, m - 1, day)).getUTCDay()],
      value: d.total,
      kind,
    };
  });
}

export function monthBars(months: MonthlyTotal[], today: string): Bar[] {
  const currentMonth = `${today.slice(0, 7)}-01`;
  return months.map((m) => ({
    key: m.month_start,
    label: MONTHS_SHORT[Number(m.month_start.slice(5, 7)) - 1],
    value: m.total,
    kind: m.month_start === currentMonth ? "partial" : "past",
  }));
}

/** The day with the most spending up to today, or null if nothing was spent. */
export function highestDay(days: DailyTotal[], today: string): { day: string; total: number } | null {
  let best: { day: string; total: number } | null = null;
  for (const d of days) {
    if (d.day > today || d.total <= 0) continue;
    if (!best || d.total > best.total) best = { day: d.day, total: d.total };
  }
  return best;
}

const STATE_ORDER: Record<BudgetStatus["state"], number> = { over: 0, warning: 1, ok: 2 };

/** Up to three budgets that need attention: over first, then the most used. The overall monthly budget has its own card. */
export function budgetsToWatch(budgets: BudgetStatus[], limit = 3): BudgetStatus[] {
  return budgets
    .filter((b) => !(b.period === "monthly" && b.category_id === null))
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || b.used_percent - a.used_percent)
    .slice(0, limit);
}

/** The month name for "Last 6 months" style labels, e.g. "November". */
export function monthName(day: string): string {
  return MONTHS_LONG[Number(day.slice(5, 7)) - 1];
}

