"use client";

import { useId } from "react";
import { Bar, BarChart, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/money";
import type { Bar as BarDatum } from "@/lib/view/dashboard";

export interface SpendBarChartProps {
  bars: (BarDatum & { tooltipLabel?: string })[];
  currency: string;
  /** Plain-language summary for screen readers (the chart itself is visual). */
  summary: string;
  /** Dashed amber line, e.g. the daily or monthly budget. */
  reference?: number | null;
  /** Keys of bars that get a value label (keep it selective: today and the highest). */
  labelKeys?: string[];
  height?: number;
}

const COLORS = {
  past: "var(--chart-1)",
  today: "var(--chart-2)",
  empty: "#e3e8e5",
};

function shortAmount(value: number): string {
  return value >= 1000 ? value.toLocaleString("en-GH", { maximumFractionDigits: 0 }) : value.toFixed(2);
}

/** One-hue bar chart following the data-viz rules in docs/phase-2-design-system.md §5. */
export function SpendBarChart({ bars, currency, summary, reference, labelKeys = [], height = 160 }: SpendBarChartProps) {
  const patternId = `stripes-${useId().replace(/:/g, "")}`;
  const labelled = new Set(labelKeys);
  const max = Math.max(0, reference ?? 0, ...bars.map((b) => b.value));

  return (
    <div role="img" aria-label={summary} className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bars} margin={{ top: 20, right: 4, bottom: 0, left: 4 }} barCategoryGap="22%">
          <defs>
            <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="3" height="6" fill="var(--chart-1)" />
              <rect x="3" width="3" height="6" fill="var(--chart-3)" />
            </pattern>
          </defs>
          <XAxis
            dataKey="label"
            interval={0}
            tickLine={false}
            axisLine={{ stroke: "#c9d1cc" }}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <YAxis hide domain={[0, max > 0 ? max * 1.12 : 1]} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={({ active, payload }) => {
              const item = payload?.[0]?.payload as (BarDatum & { tooltipLabel?: string }) | undefined;
              if (!active || !item || item.kind === "future") return null;
              return (
                <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-md">
                  <div className="font-medium text-muted-foreground">{item.tooltipLabel ?? item.label}</div>
                  <div className="text-sm font-semibold tabular-nums">{formatMoney(item.value, currency)}</div>
                </div>
              );
            }}
          />
          {reference ? (
            <ReferenceLine y={reference} stroke="var(--budget-line)" strokeDasharray="5 4" strokeWidth={2} />
          ) : null}
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={32} minPointSize={3} isAnimationActive={false}>
            {bars.map((b) => (
              <Cell
                key={b.key}
                fill={
                  b.value <= 0 || b.kind === "future"
                    ? COLORS.empty
                    : b.kind === "today"
                      ? COLORS.today
                      : b.kind === "partial"
                        ? `url(#${patternId})`
                        : COLORS.past
                }
              />
            ))}
            <LabelList
              dataKey="value"
              content={(props) => {
                const { x, y, width, value, index } = props as { x: number; y: number; width: number; value: number; index: number };
                const bar = bars[index];
                if (!bar || !labelled.has(bar.key) || value <= 0) return null;
                return (
                  <text
                    x={x + width / 2}
                    y={y - 6}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={600}
                    fill="var(--primary)"
                    className="tabular-nums"
                  >
                    {shortAmount(value)}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Legend items under a chart: the dashed budget line and/or the "so far" stripes. */
export function ChartLegend({ budgetLabel, partialLabel }: { budgetLabel?: string | null; partialLabel?: string | null }) {
  if (!budgetLabel && !partialLabel) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {budgetLabel ? (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="w-4 border-t-2 border-dashed border-budget-line" />
          {budgetLabel}
        </span>
      ) : null}
      {partialLabel ? (
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-[2px]"
            style={{ background: "repeating-linear-gradient(45deg, var(--chart-1) 0 3px, var(--chart-3) 3px 6px)" }}
          />
          {partialLabel}
        </span>
      ) : null}
    </div>
  );
}
