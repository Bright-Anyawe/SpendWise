"use client";

import { Plus } from "lucide-react";
import { type ReactNode, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { BudgetBar, BudgetStatusPill } from "@/components/common/budget-progress";
import { ResponsiveSheet } from "@/components/common/responsive-sheet";
import { CategoryTile } from "@/components/icons/category-icon";
import { formatMoney, parseAmount } from "@/lib/money";
import type { BudgetPeriod, BudgetStatus, Category } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { deleteBudget, saveBudget } from "@/server/actions/budgets";

const PERIOD_LABEL: Record<BudgetPeriod, string> = { monthly: "Monthly", weekly: "Weekly", daily: "Daily" };

type Editing = { mode: "new"; period: BudgetPeriod; categoryId: string | null } | { mode: "edit"; budget: BudgetStatus };

export function BudgetManager({
  title,
  intro,
  overall,
  categories,
  allCategories,
  currency,
}: {
  /** Page heading block, shown left of the Add button. */
  title: ReactNode;
  /** Shown under the heading (e.g. the pace note). */
  intro?: ReactNode;
  overall: BudgetStatus[];
  categories: BudgetStatus[];
  allCategories: Category[];
  currency: string;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const icons = new Map(allCategories.map((c) => [c.id, c.icon]));
  const hasMonthly = overall.some((b) => b.period === "monthly");

  return (
    <>
      <header className="flex items-center justify-between gap-3">
        {title}
        <button
          type="button"
          onClick={() => setEditing({ mode: "new", period: "monthly", categoryId: hasMonthly ? (allCategories[0]?.id ?? null) : null })}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md border border-primary bg-card px-4 text-sm font-semibold text-primary"
        >
          <Plus aria-hidden="true" className="size-[18px]" />
          Add budget
        </button>
      </header>
      {intro}

      {overall.length === 0 && categories.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-primary/40 bg-secondary p-5">
          <h2 className="text-[17px] font-semibold text-secondary-foreground">Start with a monthly budget</h2>
          <p className="text-sm text-muted-foreground">
            Pick an amount for the month. You’ll see what’s left, a daily allowance, and a heads-up at 80%.
          </p>
          <button
            type="button"
            onClick={() => setEditing({ mode: "new", period: "monthly", categoryId: null })}
            className="h-11 rounded-md bg-primary px-4 text-[15px] font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            Set a monthly budget
          </button>
        </div>
      ) : null}

      {overall.length > 0 ? (
        <BudgetGroup title="Overall" rows={overall} currency={currency} onEdit={(b) => setEditing({ mode: "edit", budget: b })} />
      ) : null}

      {categories.length > 0 ? (
        <BudgetGroup
          title="Categories"
          rows={categories}
          currency={currency}
          icons={icons}
          onEdit={(b) => setEditing({ mode: "edit", budget: b })}
        />
      ) : null}

      {overall.length + categories.length > 0 ? (
        <button
          type="button"
          onClick={() => setEditing({ mode: "new", period: "monthly", categoryId: allCategories[0]?.id ?? null })}
          className="flex h-[52px] items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-[#9ca3af] text-[15px] font-semibold text-primary"
        >
          <Plus aria-hidden="true" className="size-[18px]" />
          Add a category budget
        </button>
      ) : null}

      <ResponsiveSheet
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing?.mode === "edit" ? "Edit budget" : "New budget"}
      >
        {editing ? (
          <BudgetForm editing={editing} categories={allCategories} currency={currency} onDone={() => setEditing(null)} />
        ) : null}
      </ResponsiveSheet>
    </>
  );
}

function BudgetGroup({
  title,
  rows,
  currency,
  icons,
  onEdit,
}: {
  title: string;
  rows: BudgetStatus[];
  currency: string;
  icons?: Map<string, string>;
  onEdit: (b: BudgetStatus) => void;
}) {
  const money = (n: number) => formatMoney(n, currency);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-[17px] font-semibold">{title}</h2>
      <ul className="rounded-xl border border-border bg-card px-4">
        {rows.map((b, i) => {
          const name = b.category_name ?? PERIOD_LABEL[b.period];
          const periodNote = b.category_id ? ` · ${PERIOD_LABEL[b.period].toLowerCase()}` : "";
          return (
            <li key={b.budget_id} className={cn(i > 0 && "border-t border-muted")}>
              <button
                type="button"
                onClick={() => onEdit(b)}
                aria-label={`Edit ${name} budget`}
                className="flex w-full flex-col gap-2.5 py-3.5 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2.5 text-[15px] font-semibold">
                    {b.category_id && icons ? <CategoryTile icon={icons.get(b.category_id) ?? "circle"} size="sm" /> : null}
                    <span className="truncate">
                      {name}
                      <span className="font-normal text-muted-foreground">{periodNote}</span>
                    </span>
                  </span>
                  <BudgetStatusPill state={b.state} />
                </span>
                <BudgetBar
                  state={b.state}
                  percent={b.used_percent}
                  alertAt={b.alert_at_percent}
                  label={`${name}: ${Math.round(b.used_percent)}% used`}
                />
                <span className="flex w-full justify-between gap-2 text-[13px] text-muted-foreground tabular-nums">
                  <span>
                    {money(b.spent)} of {money(b.amount)}
                  </span>
                  <strong className={cn("font-semibold", b.state === "over" ? "text-destructive" : b.state === "warning" ? "text-warning" : "text-foreground")}>
                    {b.remaining >= 0 ? `${money(b.remaining)} left` : `${money(-b.remaining)} over`}
                  </strong>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function BudgetForm({
  editing,
  categories,
  currency,
  onDone,
}: {
  editing: Editing;
  categories: Category[];
  currency: string;
  onDone: () => void;
}) {
  const ids = useId();
  const existing = editing.mode === "edit" ? editing.budget : null;
  const [period, setPeriod] = useState<BudgetPeriod>(existing?.period ?? (editing.mode === "new" ? editing.period : "monthly"));
  const [categoryId, setCategoryId] = useState<string>(existing?.category_id ?? (editing.mode === "new" ? (editing.categoryId ?? "") : ""));
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [alertAt, setAlertAt] = useState(existing?.alert_at_percent ?? 80);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selectClass = "h-12 rounded-md border border-input bg-card px-3 text-base disabled:bg-muted disabled:text-muted-foreground";

  function submit() {
    if (!parseAmount(amount)) {
      setError("Enter an amount above 0, like 3,000.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await saveBudget({ period, categoryId: categoryId || null, amount, alertAtPercent: alertAt }, existing?.budget_id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast(existing ? "Budget updated" : "Budget added");
      onDone();
    });
  }

  function remove() {
    if (!existing) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    startTransition(async () => {
      const result = await deleteBudget(existing.budget_id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast("Budget deleted");
      onDone();
    });
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label htmlFor={`${ids}-period`} className="flex flex-col gap-1.5 text-sm font-semibold">
          Period
          <select id={`${ids}-period`} value={period} disabled={Boolean(existing)} onChange={(e) => setPeriod(e.target.value as BudgetPeriod)} className={selectClass}>
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="daily">Daily</option>
          </select>
        </label>
        <label htmlFor={`${ids}-category`} className="flex flex-col gap-1.5 text-sm font-semibold">
          For
          <select id={`${ids}-category`} value={categoryId} disabled={Boolean(existing)} onChange={(e) => setCategoryId(e.target.value)} className={selectClass}>
            <option value="">All spending</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {existing ? <p className="-mt-2 text-xs text-muted-foreground">To change the period or category, delete this budget and add a new one.</p> : null}

      <label htmlFor={`${ids}-amount`} className="flex flex-col gap-1.5 text-sm font-semibold">
        Amount
        <span className="flex h-[52px] overflow-hidden rounded-md border border-input bg-card focus-within:ring-3 focus-within:ring-ring/50">
          <span className="flex items-center border-r border-input bg-muted px-3.5 text-[15px] font-semibold text-muted-foreground">{currency}</span>
          <input
            id={`${ids}-amount`}
            inputMode="decimal"
            value={amount}
            autoFocus={!existing}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 3,000"
            className="min-w-0 flex-1 bg-transparent px-3.5 text-base font-normal tabular-nums outline-none"
          />
        </span>
      </label>

      <label htmlFor={`${ids}-alert`} className="flex flex-col gap-1.5 text-sm font-semibold">
        Warn me at
        <select id={`${ids}-alert`} value={alertAt} onChange={(e) => setAlertAt(Number(e.target.value))} className={selectClass}>
          {[50, 60, 70, 75, 80, 85, 90, 95, 100].map((p) => (
            <option key={p} value={p}>
              {p}% of the budget
            </option>
          ))}
        </select>
        <span className="text-xs font-normal text-muted-foreground">The bar shows a mark here. Alerts by notification arrive in a later update.</span>
      </label>

      {error ? (
        <p role="alert" className="rounded-md bg-danger-bg px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="h-[52px] rounded-[14px] bg-primary text-base font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
        {pending ? "Saving…" : existing ? "Save budget" : "Add budget"}
      </button>
      {existing ? (
        <button type="button" onClick={remove} disabled={pending} className="h-11 rounded-md text-[15px] font-semibold text-destructive hover:bg-danger-bg">
          {confirmDelete ? "Tap again to delete this budget" : "Delete budget"}
        </button>
      ) : null}
    </form>
  );
}
