"use client";

import { CategoryTile } from "@/components/icons/category-icon";
import { useQuickAdd } from "@/components/quick-add/quick-add-provider";
import { PAYMENT_METHOD_LABELS } from "@/config/payment-methods";
import { formatTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { ExpenseWithCategory } from "@/lib/types/database";
import { cn } from "@/lib/utils";

/** Expense rows; tapping one opens it for editing (with Delete). */
export function ExpenseList({ expenses, currency }: { expenses: ExpenseWithCategory[]; currency: string }) {
  const { openEdit } = useQuickAdd();
  return (
    <ul className="flex flex-col">
      {expenses.map((e, i) => {
        const title = e.note || e.category.name;
        return (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => openEdit(e)}
              aria-label={`Edit ${title}, ${formatMoney(e.amount, currency)}`}
              className={cn(
                "flex w-full items-center gap-3 py-2.5 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                i > 0 && "border-t border-muted",
              )}
            >
              <CategoryTile icon={e.category.icon} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] leading-5 font-medium">{title}</span>
                <span className="truncate text-[13px] leading-[18px] text-muted-foreground">
                  {e.note ? `${e.category.name} · ` : ""}
                  {PAYMENT_METHOD_LABELS[e.payment_method]} · {formatTime(e.spent_time)}
                </span>
              </span>
              <span className="text-[15px] leading-5 font-semibold tabular-nums">{formatMoney(e.amount, currency)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
