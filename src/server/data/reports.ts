import { addDays } from "@/lib/dates";
import { one, type Queryable } from "@/lib/db/queryable";
import type { BudgetStatus, CategoryTotal, Comparison, DailyTotal } from "@/lib/types/database";
import { budgetStatus } from "./budgets";

export type ReportPeriod = "week" | "month";

export interface ReportData {
  period: ReportPeriod;
  /** Whole period. */
  start: string;
  end: string;
  /** The person's local today. */
  today: string;
  /** Today falls inside the period: numbers are "so far". */
  isCurrent: boolean;
  /** Last day counted: today for the current period, otherwise the period's end. */
  upTo: string;
  /** Spending (Savings excluded) from start to upTo. */
  total: number;
  count: number;
  /** Like-for-like window before (same days of the previous period; the whole previous period for past periods). */
  previous: { start: string; end: string; total: number };
  /** Every day of the period (future days are 0). */
  days: DailyTotal[];
  /** start..upTo, spending categories first, then set-aside (Savings). */
  categories: CategoryTotal[];
  previousCategories: CategoryTotal[];
  /** Budget status, only for the current period. */
  budgets: BudgetStatus[];
  /** Days in the 7 up to upTo with an expense or a "no spending" mark. */
  loggedDays: number;
}

/** Everything the Reports screen, its insights and the PDF need for one week or month. */
export async function reportData(db: Queryable, period: ReportPeriod, ref: string): Promise<ReportData> {
  const today = (await one<{ d: string }>(db, "select public.local_today() as d"))!.d;
  const bounds = (await one<{ start_date: string; end_date: string }>(db, "select * from public.period_bounds($1, $2::date)", [
    period === "week" ? "week" : "month",
    ref,
  ]))!;
  const start = bounds.start_date;
  const end = bounds.end_date;
  const isCurrent = start <= today && today <= end;
  const upTo = isCurrent ? today : end < today ? end : start;

  const { rows: comparisons } = await db.query<Comparison>("select * from public.spending_comparisons($1::date)", [upTo]);
  const comparison = comparisons.find((c) => c.kind === period)!;

  const days = await db.query<DailyTotal>("select * from public.daily_totals($1::date, $2::date)", [start, end]);
  const categories = await db.query<CategoryTotal>("select * from public.spending_by_category($1::date, $2::date)", [start, upTo]);
  const previousCategories = await db.query<CategoryTotal>("select * from public.spending_by_category($1::date, $2::date)", [
    comparison.previous_start,
    comparison.previous_end,
  ]);
  const logged = await one<{ n: number }>(
    db,
    `select count(*)::int as n from (
       select spent_on as d from public.expenses where spent_on between $1::date and $2::date
       union
       select day from public.no_spend_days where day between $1::date and $2::date
     ) logged`,
    [addDays(upTo, -6), upTo],
  );

  return {
    period,
    start,
    end,
    today,
    isCurrent,
    upTo,
    total: comparison.current_total,
    count: comparison.current_count,
    previous: { start: comparison.previous_start, end: comparison.previous_end, total: comparison.previous_total },
    days: days.rows,
    categories: categories.rows,
    previousCategories: previousCategories.rows,
    budgets: isCurrent ? await budgetStatus(db, today) : [],
    loggedDays: logged?.n ?? 0,
  };
}
