export type BudgetState = "ok" | "warning" | "over";

/** Percentage change from previous to current, or null when previous is 0 (nothing to compare). */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** How much can be spent per day for the rest of the period, or null when nothing is left. */
export function dailyAllowance(remaining: number, daysLeftIncludingToday: number): number | null {
  if (remaining <= 0 || daysLeftIncludingToday <= 0) return null;
  return remaining / daysLeftIncludingToday;
}

/** Mirrors the database's budget_status(): over > amount, warning from the alert point. Compared in cents. */
export function budgetState(spent: number, amount: number, alertAtPercent: number): BudgetState {
  const spentCents = Math.round(spent * 100);
  if (spentCents > Math.round(amount * 100)) return "over";
  if (spentCents >= Math.round(amount * alertAtPercent)) return "warning";
  return "ok";
}
