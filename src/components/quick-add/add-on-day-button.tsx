"use client";

import { CalendarPlus } from "lucide-react";
import { useQuickAdd } from "./quick-add-provider";

/** Opens quick add on a past day, for an expense the person forgot to log. They can still change the date. */
export function AddOnDayButton({ day, children }: { day: string; children: React.ReactNode }) {
  const { openNewOn } = useQuickAdd();
  return (
    <button
      type="button"
      onClick={() => openNewOn(day)}
      className="inline-flex h-11 items-center gap-2 self-start rounded-md border border-primary bg-card px-4 text-sm font-semibold text-primary hover:bg-secondary"
    >
      <CalendarPlus aria-hidden="true" className="size-[18px]" />
      {children}
    </button>
  );
}
