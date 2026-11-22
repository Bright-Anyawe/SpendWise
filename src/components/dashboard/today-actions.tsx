"use client";

import { Check, Plus } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { useQuickAdd } from "@/components/quick-add/quick-add-provider";
import { markNoSpendDay, unmarkNoSpendDay } from "@/server/actions/no-spend";

/** Shown when nothing is logged today: add an expense, or say there was no spending. */
export function TodayEmptyActions({ today, noSpendToday }: { today: string; noSpendToday: boolean }) {
  const { openNew } = useQuickAdd();
  const [pending, startTransition] = useTransition();

  if (noSpendToday) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-positive-bg px-3 py-1 text-[13px] font-semibold text-positive">
          <Check aria-hidden="true" className="size-4" />
          No spending today
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await unmarkNoSpendDay(today);
              if (!result.ok) toast.error(result.error);
            })
          }
          className="h-11 text-sm font-semibold text-primary"
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={openNew}
        className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-[15px] font-semibold text-primary-foreground hover:bg-primary-hover"
      >
        <Plus aria-hidden="true" className="size-5" />
        Add expense
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await markNoSpendDay(today);
            if (!result.ok) toast.error(result.error);
            else toast("Marked today as a no-spend day. We won't remind you tonight.");
          })
        }
        className="inline-flex h-11 items-center rounded-md border border-primary px-4 text-[15px] font-semibold text-primary"
      >
        No spending today
      </button>
    </div>
  );
}
