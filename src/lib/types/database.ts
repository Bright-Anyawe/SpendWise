/**
 * Row shapes for the tables and functions in db/migrations, as the app's `pg` pool returns them
 * (see src/lib/db/pool.ts): numeric → number, date → "YYYY-MM-DD", time → "HH:MM:SS",
 * timestamptz → ISO string. Send amounts to the database as decimal strings.
 */

export type PaymentMethod = "cash" | "mobile_money" | "card" | "bank_transfer" | "other";
export type BudgetPeriod = "daily" | "weekly" | "monthly";
export type BudgetState = "ok" | "warning" | "over";
export type NotificationKind =
  | "daily_reminder"
  | "evening_review"
  | "weekly_summary"
  | "monthly_summary"
  | "budget_warning"
  | "budget_exceeded";

export interface Profile {
  id: string;
  display_name: string | null;
  currency: string;
  timezone: string;
  week_starts_on: number;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  counts_as_spending: boolean;
  is_fallback: boolean;
  created_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  amount: number;
  category_id: string;
  payment_method: PaymentMethod;
  note: string | null;
  spent_on: string;
  spent_time: string;
  spent_at: string;
  created_at: string;
  updated_at: string;
}

export type ExpenseWithCategory = Expense & { category: { name: string; icon: string } };

export interface Budget {
  id: string;
  user_id: string;
  period: BudgetPeriod;
  category_id: string | null;
  amount: number;
  alert_at_percent: number;
  created_at: string;
  updated_at: string;
}

/** Values the app writes when creating an expense (spent_at and user_id are set by the database). */
export interface ExpenseInsert {
  id?: string;
  amount: string;
  category_id: string;
  payment_method: PaymentMethod;
  note: string | null;
  spent_on: string;
  spent_time: string;
}

// ─── Function results ───────────────────────────────────────────────────────

export interface Comparison {
  kind: "day" | "week" | "month";
  current_start: string;
  current_end: string;
  current_total: number;
  current_count: number;
  previous_start: string;
  previous_end: string;
  previous_total: number;
}

export interface DailyTotal {
  day: string;
  total: number;
  expense_count: number;
}

export interface CategoryTotal {
  category_id: string;
  name: string;
  icon: string;
  counts_as_spending: boolean;
  total: number;
  expense_count: number;
  share: number | null;
}

export interface MonthlyTotal {
  month_start: string;
  total: number;
}

export interface BudgetStatus {
  budget_id: string;
  period: BudgetPeriod;
  category_id: string | null;
  category_name: string | null;
  amount: number;
  spent: number;
  remaining: number;
  used_percent: number;
  alert_at_percent: number;
  state: BudgetState;
  period_start: string;
  period_end: string;
  /** The budget's usual amount; `amount` is this period's own amount when one was set. */
  default_amount: number;
}
