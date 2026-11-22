import { Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChartLegend, SpendBarChart } from "@/components/charts/spend-bar-chart";
import { BudgetBar, BudgetStatusPill } from "@/components/common/budget-progress";
import { Comparison } from "@/components/common/comparison";
import { SectionCard } from "@/components/common/section-card";
import { TodayEmptyActions } from "@/components/dashboard/today-actions";
import { CategoryBars } from "@/components/expenses/category-bars";
import { ExpenseList } from "@/components/expenses/expense-list";
import { BellLink, NotificationBell } from "@/components/notifications/notification-bell";
import { dayLabel, greeting, longDate, timeInTimeZone } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  budgetLeft,
  budgetsToWatch,
  comparisonLabel,
  highestDay,
  monthBars,
  monthName,
  rangeLabel,
  weekBars,
} from "@/lib/view/dashboard";
import { requireOnboardedProfile } from "@/server/auth";
import { getDashboardData } from "@/server/queries";

export const metadata: Metadata = { title: "Home" };

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-5 py-5 md:px-8 md:py-8">
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </main>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="h-14 w-60 animate-pulse rounded-md bg-muted" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="col-span-2 h-36 animate-pulse rounded-xl bg-muted lg:col-span-1" />
        <div className="col-span-2 h-36 animate-pulse rounded-xl bg-muted lg:col-span-1" />
        <div className="h-28 animate-pulse rounded-xl bg-muted lg:h-36" />
        <div className="h-28 animate-pulse rounded-xl bg-muted lg:h-36" />
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

async function Dashboard() {
  const { profile } = await requireOnboardedProfile();
  const data = await getDashboardData();
  const money = (n: number) => formatMoney(n, profile.currency);
  const { day, week, month } = data.comparisons;
  const today = data.today;

  const left = budgetLeft(data.budgets, today);
  const dailyBudget = data.budgets.find((b) => b.period === "daily" && b.category_id === null)?.amount ?? null;
  const monthlyBudget = left?.amount ?? null;
  const bars = weekBars(data.week.days, today);
  const best = highestDay(data.week.days, today);
  const months = monthBars(data.lastSixMonths, today);
  const spending = data.month.categories.filter((c) => c.counts_as_spending);
  const watch = budgetsToWatch(data.budgets);
  const weekTotal = data.week.days.reduce((sum, d) => sum + d.total, 0);
  const monthsTotal = data.lastSixMonths.reduce((sum, m) => sum + m.total, 0);

  const dayCompare = comparisonLabel(day.current_total, day.previous_total, "yesterday");
  const weekCompare = comparisonLabel(week.current_total, week.previous_total, "the same days last week");
  const monthCompare = comparisonLabel(month.current_total, month.previous_total, rangeLabel(month.previous_start, month.previous_end));

  return (
    <>
      <header className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[13px] font-medium text-muted-foreground">{longDate(today)}</span>
          <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.01em] md:text-[28px] md:leading-9">
            {greeting(timeInTimeZone(profile.timezone))}
            {profile.display_name ? `, ${profile.display_name}` : ""}
          </h1>
        </div>
        <div className="flex gap-2">
          <Suspense fallback={<BellLink count={0} />}>
            <NotificationBell />
          </Suspense>
          <Link
            href="/settings"
            aria-label="Settings"
            className="flex size-11 items-center justify-center rounded-full border border-border bg-card md:hidden"
          >
            <Settings aria-hidden="true" className="size-5" />
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <section className="col-span-2 flex flex-col gap-2 rounded-xl border border-border bg-card p-5 lg:col-span-1">
          <h2 className="text-[13px] font-medium text-muted-foreground">Spent today</h2>
          <p className="text-[40px] leading-[44px] font-semibold tracking-[-0.02em] tabular-nums lg:text-[32px] lg:leading-10">
            {money(day.current_total)}
          </p>
          {day.current_count > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-muted-foreground">
                {day.current_count} {day.current_count === 1 ? "expense" : "expenses"}
              </span>
              <Comparison {...dayCompare} pill />
            </div>
          ) : (
            <>
              <p className="text-[13px] text-muted-foreground">
                {data.noSpendToday ? "A no-spend day. Nice." : "Nothing logged yet today."}
              </p>
              <TodayEmptyActions today={today} noSpendToday={data.noSpendToday} />
            </>
          )}
        </section>

        {left ? (
          <section className="col-span-2 flex flex-col gap-3 rounded-xl bg-primary p-5 text-primary-foreground lg:order-last lg:col-span-1">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-[13px] font-medium text-mint">{left.left >= 0 ? "Left this month" : "Over this month"}</h2>
              <span className="text-[13px] text-mint">
                {left.daysLeft} {left.daysLeft === 1 ? "day" : "days"} to go
              </span>
            </div>
            <p className="text-[32px] leading-[38px] font-semibold tracking-[-0.02em] tabular-nums lg:text-[28px]">
              {money(Math.abs(left.left))}
            </p>
            <div
              role="img"
              aria-label={`${Math.round(left.percent)}% of the monthly budget used`}
              className="h-2 overflow-hidden rounded-full bg-white/20"
            >
              <div className="h-full rounded-full bg-mint-400" style={{ width: `${Math.min(left.percent, 100)}%` }} />
            </div>
            <div className="flex justify-between gap-2 text-[13px] text-mint tabular-nums">
              <span>
                {money(left.spent)} spent ({Math.round(left.percent)}%)
              </span>
              <span>of {money(left.amount)}</span>
            </div>
            <p className="border-t border-white/20 pt-3 text-sm leading-5">
              {left.perDay !== null ? (
                <>
                  You can spend about <strong className="tabular-nums">{money(Math.floor(left.perDay))} a day</strong> for the
                  rest of {monthName(today)}.
                </>
              ) : (
                <>You’ve used this month’s budget. You can raise it on the Budgets page.</>
              )}
            </p>
          </section>
        ) : (
          <section className="col-span-2 flex flex-col justify-between gap-3 rounded-xl border border-dashed border-primary/40 bg-secondary p-5 lg:order-last lg:col-span-1">
            <div>
              <h2 className="text-[15px] font-semibold text-secondary-foreground">Set a monthly budget</h2>
              <p className="mt-1 text-sm text-muted-foreground">See how much is left and what you can spend each day.</p>
            </div>
            <Link
              href="/budgets"
              className="inline-flex h-11 w-fit items-center rounded-md bg-primary px-4 text-[15px] font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              Set a budget
            </Link>
          </section>
        )}

        <PeriodTile title="This week" total={money(week.current_total)} compare={weekCompare} />
        <PeriodTile title="This month" total={money(month.current_total)} compare={monthCompare} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {data.todaysExpenses.length > 0 ? (
          <SectionCard title="Today" action={{ href: "/transactions", label: "See all" }} className="gap-1 lg:order-4 lg:col-span-2">
            <ExpenseList expenses={data.todaysExpenses.slice(0, 5)} currency={profile.currency} />
          </SectionCard>
        ) : null}

        <SectionCard title="This week" meta={rangeLabel(data.week.start, data.week.end)} className="lg:order-1">
          {weekTotal > 0 ? (
            <>
              <SpendBarChart
                bars={bars.map((b) => ({ ...b, tooltipLabel: dayLabel(b.key, today) }))}
                currency={profile.currency}
                reference={dailyBudget}
                labelKeys={[today, ...(best ? [best.day] : [])]}
                summary={`Daily spending this week. ${bars
                  .filter((b) => b.kind !== "future")
                  .map((b) => `${dayLabel(b.key, today)}: ${money(b.value)}`)
                  .join(". ")}.${dailyBudget ? ` Daily budget ${money(dailyBudget)}.` : ""}`}
              />
              <ChartLegend budgetLabel={dailyBudget ? `Daily budget (${money(dailyBudget)})` : null} />
              {best ? (
                <p className="text-[13px] text-muted-foreground">
                  Highest so far:{" "}
                  <strong className="font-semibold text-foreground tabular-nums">
                    {dayLabel(best.day, today)}, {money(best.total)}
                  </strong>
                </p>
              ) : null}
            </>
          ) : (
            <EmptyNote>Your week will show here after your first expense.</EmptyNote>
          )}
        </SectionCard>

        <SectionCard
          title="Where it went"
          action={spending.length > 5 ? { href: "/reports", label: `All ${spending.length}` } : undefined}
          meta={monthName(today)}
          className="lg:order-2"
        >
          {spending.length > 0 ? (
            <CategoryBars categories={spending.slice(0, 5)} currency={profile.currency} />
          ) : (
            <EmptyNote>Nothing spent in {monthName(today)} yet.</EmptyNote>
          )}
        </SectionCard>

        {watch.length > 0 ? (
          <SectionCard title="Budgets to watch" action={{ href: "/budgets", label: "Manage" }} className="gap-4 lg:order-3">
            <ul className="flex flex-col gap-4">
              {watch.map((b) => (
                <li key={b.budget_id} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[15px] font-medium">
                      {b.category_name ?? (b.period === "weekly" ? "Weekly budget" : "Daily budget")}
                    </span>
                    <BudgetStatusPill state={b.state} label={b.state === "over" ? `Over by ${money(-b.remaining)}` : undefined} />
                  </div>
                  <BudgetBar
                    state={b.state}
                    percent={b.used_percent}
                    alertAt={b.alert_at_percent}
                    label={`${Math.round(b.used_percent)}% used`}
                  />
                  <span className="text-[13px] text-muted-foreground tabular-nums">
                    {money(b.spent)} of {money(b.amount)} ({Math.round(b.used_percent)}%)
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>
        ) : null}

        <SectionCard title="Last 6 months" meta={profile.currency} className={cn("lg:order-5", watch.length === 0 && "lg:order-3")}>
          {monthsTotal > 0 ? (
            <>
              <SpendBarChart
                bars={months}
                currency={profile.currency}
                reference={monthlyBudget}
                labelKeys={months.slice(-1).map((m) => m.key)}
                summary={`Monthly spending: ${months.map((m) => `${m.label} ${money(m.value)}`).join(", ")}.`}
              />
              <ChartLegend
                budgetLabel={monthlyBudget ? `Monthly budget (${money(monthlyBudget)})` : null}
                partialLabel={`${monthName(today)} so far`}
              />
            </>
          ) : (
            <EmptyNote>Your monthly trend builds up as you log expenses.</EmptyNote>
          )}
        </SectionCard>
      </div>
    </>
  );
}

function PeriodTile({ title, total, compare }: { title: string; total: string; compare: ReturnType<typeof comparisonLabel> }) {
  return (
    <section className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4 lg:p-5">
      <h2 className="text-[13px] font-medium text-muted-foreground">{title}</h2>
      <p className="text-[22px] leading-7 font-semibold tracking-[-0.01em] tabular-nums lg:text-[28px] lg:leading-9">{total}</p>
      <span className="text-xs">
        <Comparison {...compare} />
      </span>
    </section>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md bg-muted px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
