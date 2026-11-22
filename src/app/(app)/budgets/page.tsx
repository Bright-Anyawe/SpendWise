import { Lightbulb } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { BudgetManager } from "@/components/budgets/budget-manager";
import { todayInTimeZone } from "@/lib/dates";
import { paceNote, sortBudgets } from "@/lib/view/budgets";
import { budgetLeft, monthName } from "@/lib/view/dashboard";
import { requireOnboardedProfile } from "@/server/auth";
import { getBudgetStatus, getCategories } from "@/server/queries";

export const metadata: Metadata = { title: "Budgets" };

export default function BudgetsPage() {
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
        <Budgets />
      </Suspense>
    </main>
  );
}

async function Budgets() {
  const { profile } = await requireOnboardedProfile();
  const [budgets, categories] = await Promise.all([getBudgetStatus(), getCategories()]);
  const today = todayInTimeZone(profile.timezone);
  const { overall, categories: categoryBudgets } = sortBudgets(budgets);
  const monthly = overall.find((b) => b.period === "monthly");
  const pace = monthly ? paceNote(monthly, today) : null;
  const left = budgetLeft(budgets, today);

  return (
    <BudgetManager
      title={
        <div className="flex flex-col">
          <h1 className="text-2xl font-semibold tracking-[-0.01em]">Budgets</h1>
          <span className="text-[13px] text-muted-foreground">
            {monthName(today)}
            {left ? ` · ${left.daysLeft} ${left.daysLeft === 1 ? "day" : "days"} left` : ""}
          </span>
        </div>
      }
      intro={
        pace ? (
          <p className="flex gap-3 rounded-xl bg-secondary px-4 py-3.5 text-sm leading-5 text-[#14532d]">
            <Lightbulb aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
            {pace}
          </p>
        ) : null
      }
      overall={overall}
      categories={categoryBudgets}
      allCategories={categories}
      currency={profile.currency}
    />
  );
}
