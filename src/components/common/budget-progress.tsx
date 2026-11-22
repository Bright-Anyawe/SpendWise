import { CircleAlert, CircleCheck, Clock } from "lucide-react";
import type { BudgetState } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const STATUS = {
  ok: { label: "On track", icon: CircleCheck, pill: "bg-positive-bg text-positive", fill: "bg-chart-1" },
  warning: { label: "Close to limit", icon: Clock, pill: "bg-warning-bg text-warning", fill: "bg-warning-fill" },
  over: { label: "Over budget", icon: CircleAlert, pill: "bg-danger-bg text-destructive", fill: "bg-danger-fill" },
} as const;

/** Status always comes with an icon and words, never colour alone. */
export function BudgetStatusPill({ state, label }: { state: BudgetState; label?: string }) {
  const s = STATUS[state];
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs leading-4 font-semibold", s.pill)}>
      <Icon aria-hidden="true" className="size-3.5" />
      {label ?? s.label}
    </span>
  );
}

/** Progress bar with a tick at the alert point (e.g. 80%). */
export function BudgetBar({
  state,
  percent,
  alertAt,
  label,
}: {
  state: BudgetState;
  percent: number;
  alertAt: number;
  label: string;
}) {
  const width = Math.max(0, Math.min(percent, 100));
  return (
    <div role="img" aria-label={label} className="relative h-2 w-full">
      <div className="absolute inset-0 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", STATUS[state].fill)} style={{ width: `${width}%` }} />
      </div>
      <div
        aria-hidden="true"
        className="absolute -top-[3px] h-3.5 w-0.5 rounded-[1px] bg-foreground/35"
        style={{ left: `${alertAt}%` }}
      />
    </div>
  );
}
