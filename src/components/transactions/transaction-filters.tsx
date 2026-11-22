"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { ResponsiveSheet } from "@/components/common/responsive-sheet";
import { CategoryIcon } from "@/components/icons/category-icon";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/config/payment-methods";
import type { Category, PaymentMethod } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import type { TransactionsPeriod } from "@/lib/view/transactions";
import type { ExpenseFilters } from "@/schemas/expense";

type Changes = Record<string, string | string[] | null>;

const PERIODS: { value: TransactionsPeriod; label: string }[] = [
  { value: "month", label: "This month" },
  { value: "week", label: "This week" },
  { value: "all", label: "All time" },
];

const chip =
  "inline-flex h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-[13px] font-medium transition-colors";

export function TransactionFilters({
  period,
  filters,
  categories,
}: {
  period: TransactionsPeriod;
  filters: ExpenseFilters;
  categories: Category[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const ids = useId();
  const [query, setQuery] = useState(filters.q ?? "");
  const [sheetOpen, setSheetOpen] = useState(false);

  function update(changes: Changes) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      next.delete(key);
      for (const v of value === null ? [] : Array.isArray(value) ? value : [value]) if (v !== "") next.append(key, v);
    }
    next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Search as you type, a moment after typing stops.
  useEffect(() => {
    if ((filters.q ?? "") === query.trim()) return;
    const timer = setTimeout(() => update({ q: query.trim() || null }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const extraCount =
    (filters.categoryIds?.length ? 1 : 0) +
    (filters.paymentMethods?.length ? 1 : 0) +
    (filters.minAmount !== undefined || filters.maxAmount !== undefined ? 1 : 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <label htmlFor={`${ids}-q`} className="sr-only">
          Search transactions
        </label>
        <Search aria-hidden="true" className="pointer-events-none absolute top-3.5 left-3.5 size-5 text-muted-foreground" />
        <input
          id={`${ids}-q`}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes or categories"
          className="h-12 w-full rounded-md border border-input bg-card pr-3.5 pl-11 text-base placeholder:text-muted-foreground/80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        />
      </div>

      <div role="group" aria-label="Filters" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            aria-pressed={period === p.value}
            onClick={() => update({ period: p.value === "month" ? null : p.value, from: null, to: null })}
            className={cn(chip, period === p.value ? "border-primary bg-secondary font-semibold text-primary" : "border-input bg-card")}
          >
            {p.label}
          </button>
        ))}
        {period === "custom" ? (
          <button
            type="button"
            aria-pressed="true"
            onClick={() => setSheetOpen(true)}
            className={cn(chip, "border-primary bg-secondary font-semibold text-primary")}
          >
            {filters.from}
            {filters.to ? ` – ${filters.to}` : " onwards"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={cn(chip, extraCount ? "border-primary bg-secondary font-semibold text-primary" : "border-input bg-card")}
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          Filters{extraCount ? ` (${extraCount})` : ""}
        </button>
        {extraCount || period === "custom" || filters.q ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              router.replace(pathname, { scroll: false });
            }}
            className={cn(chip, "border-transparent text-primary")}
          >
            <X aria-hidden="true" className="size-4" />
            Clear
          </button>
        ) : null}
      </div>

      <ResponsiveSheet open={sheetOpen} onOpenChange={setSheetOpen} title="Filter transactions">
        <FilterForm
          key={String(sheetOpen)}
          period={period}
          filters={filters}
          categories={categories}
          onApply={(changes) => {
            update(changes);
            setSheetOpen(false);
          }}
        />
      </ResponsiveSheet>
    </div>
  );
}

function FilterForm({
  period,
  filters,
  categories,
  onApply,
}: {
  period: TransactionsPeriod;
  filters: ExpenseFilters;
  categories: Category[];
  onApply: (changes: Changes) => void;
}) {
  const ids = useId();
  const [categoryIds, setCategoryIds] = useState<string[]>(filters.categoryIds ?? []);
  const [methods, setMethods] = useState<PaymentMethod[]>(filters.paymentMethods ?? []);
  const [min, setMin] = useState(filters.minAmount?.toString() ?? "");
  const [max, setMax] = useState(filters.maxAmount?.toString() ?? "");
  const [from, setFrom] = useState(period === "custom" ? (filters.from ?? "") : "");
  const [to, setTo] = useState(period === "custom" ? (filters.to ?? "") : "");

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        onApply({
          category: categoryIds,
          method: methods,
          min: min || null,
          max: max || null,
          ...(from ? { period: "custom", from, to: to || null } : {}),
        });
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Dates</legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-11 rounded-md border border-input bg-card px-3 text-base text-foreground" />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
            To
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="h-11 rounded-md border border-input bg-card px-3 text-base text-foreground" />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">Leave empty to keep the period chosen with the chips.</p>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Categories</legend>
        <div className="grid grid-cols-2 gap-2">
          {categories.map((c) => (
            <label
              key={c.id}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:checked]:font-semibold has-[:checked]:text-primary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
            >
              <input type="checkbox" className="sr-only" checked={categoryIds.includes(c.id)} onChange={() => setCategoryIds((l) => toggle(l, c.id))} />
              <CategoryIcon icon={c.icon} className="size-4" />
              <span className="truncate">{c.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Paid with</legend>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((m) => (
            <label
              key={m}
              className="flex h-9 cursor-pointer items-center rounded-full border border-input bg-card px-3 text-[13px] font-medium has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:checked]:font-semibold has-[:checked]:text-primary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
            >
              <input type="checkbox" className="sr-only" checked={methods.includes(m)} onChange={() => setMethods((l) => toggle(l, m))} />
              {PAYMENT_METHOD_LABELS[m]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Amount</legend>
        <div className="grid grid-cols-2 gap-3">
          <label htmlFor={`${ids}-min`} className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
            At least
            <input id={`${ids}-min`} inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} placeholder="0" className="h-11 rounded-md border border-input bg-card px-3 text-base text-foreground" />
          </label>
          <label htmlFor={`${ids}-max`} className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
            At most
            <input id={`${ids}-max`} inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} placeholder="Any" className="h-11 rounded-md border border-input bg-card px-3 text-base text-foreground" />
          </label>
        </div>
      </fieldset>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onApply({ category: null, method: null, min: null, max: null })}
          className="h-12 flex-1 rounded-md border border-input text-[15px] font-semibold"
        >
          Reset
        </button>
        <button type="submit" className="h-12 flex-[2] rounded-md bg-primary text-[15px] font-semibold text-primary-foreground hover:bg-primary-hover">
          Show results
        </button>
      </div>
    </form>
  );
}
