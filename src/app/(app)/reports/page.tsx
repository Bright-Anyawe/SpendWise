import { ChevronLeft, ChevronRight, Download, FileText, Lightbulb } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChartLegend, SpendBarChart } from "@/components/charts/spend-bar-chart";
import { Comparison } from "@/components/common/comparison";
import { SectionCard } from "@/components/common/section-card";
import { CategoryBars } from "@/components/expenses/category-bars";
import { buildInsights } from "@/lib/insights";
import { dayLabel, isIsoDate, todayInTimeZone } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { comparisonLabel, highestDay, monthName, rangeLabel } from "@/lib/view/dashboard";
import { dayBars, periodNav } from "@/lib/view/reports";
import { requireOnboardedProfile } from "@/server/auth";
import { getReportData } from "@/server/queries";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage({ searchParams }: PageProps<"/reports">) {
  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-4 px-5 py-5 md:px-8 md:py-8">
      <Suspense
        fallback={
          <div aria-hidden="true" className="flex flex-col gap-4">
            <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
            <div className="h-44 animate-pulse rounded-xl bg-muted" />
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
          </div>
        }
      >
        <Reports searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Reports({ searchParams }: { searchParams: PageProps<"/reports">["searchParams"] }) {
  const { profile } = await requireOnboardedProfile();
  const params = await searchParams;
  const today = todayInTimeZone(profile.timezone);
  const period = params.period === "week" ? "week" : "month";
  const requestedRef = typeof params.ref === "string" ? params.ref : "";
  const ref = isIsoDate(requestedRef) && requestedRef <= today ? requestedRef : today;

  const r = await getReportData(period, ref);
  const money = (n: number) => formatMoney(n, profile.currency);
  const nav = periodNav(period, r.start, r.end, today);
  const insights = buildInsights(r, money);
  const spending = r.categories.filter((c) => c.counts_as_spending);
  const saved = r.categories.filter((c) => !c.counts_as_spending).reduce((s, c) => s + c.total, 0);
  const daysElapsed = Math.round((Date.parse(r.upTo) - Date.parse(r.start)) / 86_400_000) + 1;
  const best = highestDay(r.days, r.upTo);
  const bars = dayBars(r.days, r.isCurrent ? today : "9999-12-31", period);
  const dailyBudget = r.budgets.find((b) => b.period === "daily" && b.category_id === null)?.amount ?? null;
  const against = r.isCurrent
    ? `${rangeLabel(r.previous.start, r.previous.end)}`
    : period === "month"
      ? monthName(r.previous.start)
      : "the week before";
  const compare = comparisonLabel(r.total, r.previous.total, against);
  const scope = r.isCurrent ? `Spent so far this ${period}` : period === "month" ? `Spent in ${nav.label}` : `Spent ${nav.label}`;

  const tab = (value: "week" | "month", label: string) => (
    <Link
      href={value === "month" ? "/reports" : "/reports?period=week"}
      aria-current={period === value ? "page" : undefined}
      className={cn(
        "flex h-9 items-center rounded-[9px] px-4 text-sm font-semibold",
        period === value ? "bg-card text-primary shadow-sm" : "text-muted-foreground",
      )}
    >
      {label}
    </Link>
  );
  const navHref = (refDate: string) => `/reports?${new URLSearchParams({ ...(period === "week" ? { period } : {}), ref: refDate })}`;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-[-0.01em]">Reports</h1>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Report period" className="flex rounded-md bg-muted p-[3px]">
          {tab("week", "Week")}
          {tab("month", "Month")}
        </nav>
        <div className="flex items-center">
          <Link href={navHref(nav.prevRef)} aria-label={`Previous ${period}`} className="flex size-11 items-center justify-center rounded-full hover:bg-muted">
            <ChevronLeft aria-hidden="true" className="size-5" />
          </Link>
          <span className="min-w-28 text-center text-sm font-semibold tabular-nums">{nav.label}</span>
          {nav.nextRef ? (
            <Link href={navHref(nav.nextRef)} aria-label={`Next ${period}`} className="flex size-11 items-center justify-center rounded-full hover:bg-muted">
              <ChevronRight aria-hidden="true" className="size-5" />
            </Link>
          ) : (
            <span aria-hidden="true" className="flex size-11 items-center justify-center text-border">
              <ChevronRight className="size-5" />
            </span>
          )}
        </div>
      </div>

      <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5">
        <h2 className="text-[13px] font-medium text-muted-foreground">{scope}</h2>
        <p className="text-[36px] leading-[42px] font-semibold tracking-[-0.02em] tabular-nums">{money(r.total)}</p>
        <Comparison {...compare} />
        <dl className="mt-2 grid grid-cols-3 gap-2 border-t border-muted pt-3.5">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">Expenses</dt>
            <dd className="text-[15px] font-semibold tabular-nums">{r.count}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">Daily average</dt>
            <dd className="text-[15px] font-semibold tabular-nums">{money(daysElapsed > 0 ? r.total / daysElapsed : 0)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">Highest day</dt>
            <dd className="text-[15px] font-semibold tabular-nums">
              {best ? (
                <>
                  {dayLabel(best.day, today)}
                  <span className="block text-xs font-medium text-muted-foreground">{money(best.total)}</span>
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
      </section>

      {r.total === 0 && r.categories.length === 0 ? (
        <p className="rounded-xl border border-dashed border-input bg-card px-5 py-10 text-center text-[15px] text-muted-foreground">
          Nothing logged {r.isCurrent ? `this ${period} yet` : `in ${nav.label}`}. Reports fill in as you add expenses.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Day by day" meta={profile.currency} className="lg:col-span-2">
            <SpendBarChart
              bars={bars.map((b) => ({ ...b, tooltipLabel: dayLabel(b.key, today) }))}
              currency={profile.currency}
              reference={dailyBudget}
              labelKeys={[...(r.isCurrent ? [today] : []), ...(best ? [best.day] : [])]}
              height={180}
              summary={`Spending per day, ${nav.label}. Total ${money(r.total)}.${best ? ` Highest: ${dayLabel(best.day, today)}, ${money(best.total)}.` : ""}`}
            />
            <ChartLegend budgetLabel={dailyBudget ? `Daily budget (${money(dailyBudget)})` : null} />
          </SectionCard>

          <SectionCard title="By category">
            {spending.length > 0 ? (
              <CategoryBars categories={spending} currency={profile.currency} />
            ) : (
              <p className="text-sm text-muted-foreground">No spending in this period.</p>
            )}
            {saved > 0 ? (
              <p className="mt-1 flex justify-between gap-2 border-t border-muted pt-3 text-[13px] text-muted-foreground">
                <span>
                  Set aside to Savings
                  <span className="block text-xs">Not counted as spending</span>
                </span>
                <strong className="font-semibold text-foreground tabular-nums">{money(saved)}</strong>
              </p>
            ) : null}
          </SectionCard>

          <div className="flex flex-col gap-4">
            <SectionCard title="What stands out">
              {insights.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {insights.map((i) => (
                    <li key={i.id} className="flex items-start gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-secondary text-primary">
                        <Lightbulb aria-hidden="true" className="size-[17px]" />
                      </span>
                      <span className="pt-1.5 text-sm leading-5">{i.text}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Not enough to go on yet. Insights appear once there’s a little more data.</p>
              )}
              <p className="text-xs text-muted-foreground">Calculated from your own records.</p>
            </SectionCard>

            <SectionCard title={`Export ${nav.label}`}>
              <div className="grid grid-cols-2 gap-2.5">
                <a
                  href={`/api/export/csv?${new URLSearchParams({ from: r.start, to: r.upTo })}`}
                  className="flex h-12 items-center justify-center gap-2 rounded-md border border-primary text-[15px] font-semibold text-primary"
                >
                  <Download aria-hidden="true" className="size-[18px]" />
                  CSV
                </a>
                <a
                  href={`/api/export/pdf?${new URLSearchParams({ period, ref: r.start })}`}
                  className="flex h-12 items-center justify-center gap-2 rounded-md border border-primary text-[15px] font-semibold text-primary"
                >
                  <FileText aria-hidden="true" className="size-[18px]" />
                  PDF report
                </a>
              </div>
              <p className="text-xs text-muted-foreground">CSV opens in Excel or Google Sheets. The PDF has the summary, categories and every expense.</p>
            </SectionCard>
          </div>
        </div>
      )}
    </>
  );
}
