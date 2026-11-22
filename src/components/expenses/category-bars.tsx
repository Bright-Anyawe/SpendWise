import { CategoryTile } from "@/components/icons/category-icon";
import { formatMoney } from "@/lib/money";
import type { CategoryTotal } from "@/lib/types/database";

/** Ranked horizontal bars: names and values identify each category, not colour. */
export function CategoryBars({ categories, currency }: { categories: CategoryTotal[]; currency: string }) {
  const max = Math.max(...categories.map((c) => c.total), 0);
  return (
    <ul className="flex flex-col gap-3.5">
      {categories.map((c) => (
        <li key={c.category_id} className="flex items-center gap-3">
          <CategoryTile icon={c.icon} size="sm" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex justify-between gap-2 text-sm leading-5">
              <span className="truncate font-medium">{c.name}</span>
              <span className="font-semibold tabular-nums">{formatMoney(c.total, currency)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-chart-1" style={{ width: `${max > 0 ? (c.total / max) * 100 : 0}%` }} />
              </div>
              <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
                {c.share === null ? "" : `${Math.round(c.share)}%`}
              </span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
