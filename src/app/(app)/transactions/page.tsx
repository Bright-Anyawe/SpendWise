import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ExpenseList } from "@/components/expenses/expense-list";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { todayInTimeZone } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { rangeLabel } from "@/lib/view/dashboard";
import { groupByDay, parseTransactionFilters, type TransactionsPeriod } from "@/lib/view/transactions";
import { EXPENSES_PAGE_SIZE } from "@/server/data/expenses";
import { requireOnboardedProfile } from "@/server/auth";
import { getCategories, listExpenses, summarizeExpenses } from "@/server/queries";

export const metadata: Metadata = { title: "Transactions" };

export default function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-5 py-5 md:px-8 md:py-8">
      <Suspense fallback={<TransactionsSkeleton />}>
        <Transactions searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function TransactionsSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-12 animate-pulse rounded-md bg-muted" />
      <div className="h-80 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

const PERIOD_TEXT: Record<TransactionsPeriod, string> = {
  month: "This month",
  week: "This week",
  all: "All time",
  custom: "Selected dates",
};

async function Transactions({ searchParams }: { searchParams: PageProps<"/transactions">["searchParams"] }) {
  const { profile } = await requireOnboardedProfile();
  const params = await searchParams;
  const today = todayInTimeZone(profile.timezone);
  const { period, filters } = parseTransactionFilters(params, today, profile.week_starts_on);
  const shownPages = filters.page + 1;

  const [{ rows, hasMore }, summary, categories] = await Promise.all([
    listExpenses({ ...filters, page: 0 }, shownPages * EXPENSES_PAGE_SIZE),
    summarizeExpenses(filters),
    getCategories(),
  ]);
  const groups = groupByDay(rows, today);
  const money = (n: number) => formatMoney(n, profile.currency);
  const filtered = Boolean(filters.q || filters.categoryIds || filters.paymentMethods || filters.minAmount !== undefined || filters.maxAmount !== undefined);

  const exportParams = new URLSearchParams();
  if (filters.from) exportParams.set("from", filters.from);
  if (filters.to) exportParams.set("to", filters.to);
  const moreParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const v of Array.isArray(value) ? value : value ? [value] : []) moreParams.append(key, v);
  }
  moreParams.set("page", String(filters.page + 1));

  return (
    <>
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-[-0.01em]">Transactions</h1>
        <a
          href={`/api/export/csv?${exportParams}`}
          aria-label="Export these dates as CSV"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold"
        >
          <Download aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">Export CSV</span>
        </a>
      </header>

      <TransactionFilters period={period} filters={filters} categories={categories} />

      <p className="flex justify-between gap-3 text-[13px] text-muted-foreground">
        <span>{period === "custom" && filters.from ? rangeLabel(filters.from, filters.to ?? today) : PERIOD_TEXT[period]}</span>
        <span className="tabular-nums">
          {summary.count} {summary.count === 1 ? "expense" : "expenses"} ·{" "}
          <strong className="font-semibold text-foreground">{money(summary.total)}</strong>
        </span>
      </p>

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-input bg-card px-5 py-10 text-center text-[15px] text-muted-foreground">
          {filtered || period !== "all"
            ? "No expenses match. Try a different period or clear the filters."
            : "No expenses yet. Tap + to add your first one."}
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.day} aria-labelledby={`day-${g.day}`} className="flex flex-col gap-1.5">
            <h2 id={`day-${g.day}`} className="flex justify-between px-1 pt-1 text-[13px] font-semibold text-muted-foreground">
              <span>{g.label}</span>
              <span className="tabular-nums">{money(g.total)}</span>
            </h2>
            <div className="rounded-xl border border-border bg-card px-4">
              <ExpenseList expenses={g.rows} currency={profile.currency} />
            </div>
          </section>
        ))
      )}

      {hasMore ? (
        <Link
          href={`/transactions?${moreParams}`}
          scroll={false}
          className="flex h-12 items-center justify-center rounded-md border border-input bg-card text-[15px] font-semibold text-primary"
        >
          Load more
        </Link>
      ) : null}
    </>
  );
}
