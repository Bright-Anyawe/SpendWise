import { CalendarClock, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BudgetManager } from "@/components/budgets/budget-manager";
import { AddOnDayButton } from "@/components/quick-add/add-on-day-button";
import { todayInTimeZone } from "@/lib/dates";
import { budgetMonthView, paceNote, sortBudgets } from "@/lib/view/budgets";
import { budgetLeft } from "@/lib/view/dashboard";
import { requireOnboardedProfile } from "@/server/auth";
import { getBudgetStatus, getCategories } from "@/server/queries";

export const metadata: Metadata = { title: "Budgets" };

export default function BudgetsPage({ searchParams }: PageProps<"/budgets">) {
  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-5 py-5 md:px-8 md:py-8">
      <Suspense
        fallback={
          <div aria-hidden="true" className="flex flex-col gap-4">
            <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
            <div className="h-72 animate-pulse rounded-xl bg-muted" />
          </div>
        }
      >
        <Budgets searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Budgets({ searchParams }: { searchParams: PageProps<"/budgets">["searchParams"] }) {
  const { profile } = await requireOnboardedProfile();
  const params = await searchParams;
  const today = todayInTimeZone(profile.timezone);
  const view = budgetMonthView(typeof params.ref === "string" ? params.ref : undefined, today);
  const [all, categories] = await Promise.all([getBudgetStatus(view.day), getCategories()]);
  // A past month shows its monthly budgets; weekly and daily ones are shown for the current month.
  const budgets = view.isCurrent ? all : all.filter((b) => b.period === "monthly");
  const hiddenShortBudgets = all.length - budgets.length;
  const { overall, categories: categoryBudgets } = sortBudgets(budgets);
  const monthly = overall.find((b) => b.period === "monthly");
  const pace = view.isCurrent && monthly ? paceNote(monthly, today) : null;
  const left = view.isCurrent ? budgetLeft(budgets, today) : null;

  return (
    <BudgetManager
      title={
        <div className="flex flex-col">
          <h1 className="text-2xl font-semibold tracking-[-0.01em]">Budgets</h1>
          <span className="text-[13px] text-muted-foreground">
            {view.isCurrent ? "This month" : "A past month"}
            {left ? ` · ${left.daysLeft} ${left.daysLeft === 1 ? "day" : "days"} left` : ""}
          </span>
        </div>
      }
      intro={
        <>
          <nav aria-label="Month" className="flex items-center justify-between rounded-xl border border-border bg-card px-1">
            <Link href={`/budgets?ref=${view.prevRef}`} aria-label="Previous month" className="flex size-11 items-center justify-center rounded-full hover:bg-muted">
              <ChevronLeft aria-hidden="true" className="size-5" />
            </Link>
            <span className="text-[15px] font-semibold tabular-nums" aria-live="polite">
              {view.label}
            </span>
            {view.nextRef ? (
              <Link
                href={view.nextRef === `${today.slice(0, 7)}-01` ? "/budgets" : `/budgets?ref=${view.nextRef}`}
                aria-label="Next month"
                className="flex size-11 items-center justify-center rounded-full hover:bg-muted"
              >
                <ChevronRight aria-hidden="true" className="size-5" />
              </Link>
            ) : (
              <span aria-hidden="true" className="flex size-11 items-center justify-center text-border">
                <ChevronRight className="size-5" />
              </span>
            )}
          </nav>
          {view.isCurrent ? null : (
            <p className="flex gap-3 rounded-xl bg-secondary px-4 py-3.5 text-sm leading-5 text-[#14532d]">
              <CalendarClock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
              <span>
                Forgot to set {view.label}? Tap a budget to set its amount for that month, or add one. Other months keep their own amounts.
                {hiddenShortBudgets > 0 ? " Weekly and daily budgets show on the current month." : ""}
              </span>
            </p>
          )}
          {view.isCurrent ? null : <AddOnDayButton day={view.day}>Add a forgotten expense in {view.label}</AddOnDayButton>}
          {pace ? (
            <p className="flex gap-3 rounded-xl bg-secondary px-4 py-3.5 text-sm leading-5 text-[#14532d]">
              <Lightbulb aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
              {pace}
            </p>
          ) : null}
        </>
      }
      overall={overall}
      categories={categoryBudgets}
      allCategories={categories}
      currency={profile.currency}
      view={{ day: view.day, isCurrent: view.isCurrent, label: view.label }}
    />
  );
}
