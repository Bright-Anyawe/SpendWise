"use client";

import { CalendarDays, Check, ChevronDown, Clock, Trash2 } from "lucide-react";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/icons/category-icon";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/config/payment-methods";
import { addDays, dayLabel, formatTime, todayInTimeZone } from "@/lib/dates";
import { applyKey } from "@/lib/keypad";
import { formatMoney, parseAmount } from "@/lib/money";
import { offlineQueue, QUEUE_CHANGED, requestBackgroundSync } from "@/lib/offline/idb-store";
import type { OfflineExpenseInput } from "@/lib/offline/queue";
import { quickAddDefaults } from "@/lib/quick-add";
import type { Expense, PaymentMethod } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { createExpense, deleteExpense, restoreExpense, updateExpense } from "@/server/actions/expenses";
import type { CategoryWithUses } from "@/server/data/expenses";
import { Keypad } from "./keypad";

export interface QuickAddFormProps {
  editing: Expense | null;
  /** Start a new expense on this (past) day, e.g. one the person forgot to log. */
  presetDay?: string | null;
  categories: CategoryWithUses[];
  currency: string;
  timezone: string;
  lastPaymentMethod: PaymentMethod | null;
  /** Phones get the on-screen keypad; larger screens type into a field. */
  useKeypad: boolean;
  onDone: () => void;
}

const VISIBLE_CATEGORIES = 7;

const chipClass =
  "flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-input bg-card px-3 text-[13px] font-medium has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:checked]:font-semibold has-[:checked]:text-primary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50";

function initialAmount(expense: Expense | null): string {
  if (!expense) return "";
  return expense.amount.toFixed(2).replace(/\.00$/, "");
}

export function QuickAddForm({ editing, presetDay, categories, currency, timezone, lastPaymentMethod, useKeypad, onDone }: QuickAddFormProps) {
  const ids = useId();
  const [defaults] = useState(() => quickAddDefaults(timezone, lastPaymentMethod));
  const [amount, setAmount] = useState(initialAmount(editing));
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? categories[0]?.id ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(editing?.payment_method ?? defaults.paymentMethod);
  const [spentOn, setSpentOn] = useState(editing?.spent_on ?? (presetDay && presetDay <= defaults.spentOn ? presetDay : defaults.spentOn));
  const [pickEarlier, setPickEarlier] = useState(false);
  const dateInput = useRef<HTMLInputElement>(null);
  const [spentTime, setSpentTime] = useState((editing?.spent_time ?? defaults.spentTime).slice(0, 5));
  const [note, setNote] = useState(editing?.note ?? "");
  const [showDetails, setShowDetails] = useState(Boolean(editing?.note));
  const editingIndex = editing ? categories.findIndex((c) => c.id === editing.category_id) : -1;
  const [showAllCategories, setShowAllCategories] = useState(editingIndex >= VISIBLE_CATEGORIES);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = parseAmount(amount);
  const category = categories.find((c) => c.id === categoryId);
  const today = todayInTimeZone(timezone);
  const yesterday = addDays(today, -1);
  // "Earlier…" stays selected while picking, even if the chosen date happens to be yesterday.
  const whenChoice = !pickEarlier && spentOn === today ? "today" : !pickEarlier && spentOn === yesterday ? "yesterday" : "earlier";
  const shownCategories = showAllCategories ? categories : categories.slice(0, VISIBLE_CATEGORIES);

  function save() {
    if (!parsed) {
      setError("Enter an amount above 0.");
      return;
    }
    if (!category) {
      setError("Choose a category.");
      return;
    }
    setError(null);
    const input = { amount: parsed, categoryId, paymentMethod, note: note.trim() || undefined, spentOn, spentTime };

    startTransition(async () => {
      if (editing) {
        await saveEdit(editing.id, input, category.name);
        return;
      }
      // The id is made here so a retry, or a later sync of the offline copy, never saves it twice.
      const newExpense: OfflineExpenseInput = { ...input, id: crypto.randomUUID() };
      if (!navigator.onLine) {
        await saveOnDevice(newExpense);
        return;
      }
      let result: Awaited<ReturnType<typeof createExpense>>;
      try {
        result = await createExpense(newExpense);
      } catch {
        // The request never reached the server (the connection dropped): keep it on the device.
        await saveOnDevice(newExpense);
        return;
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const saved = result.data;
      toast(`${formatMoney(saved.amount, currency)} · ${category.name}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            const undone = await deleteExpense(saved.id);
            if (!undone.ok) toast.error(undone.error);
          },
        },
      });
      onDone();
    });
  }

  async function saveEdit(id: string, input: Omit<OfflineExpenseInput, "id">, categoryName: string) {
    let result: Awaited<ReturnType<typeof updateExpense>>;
    try {
      result = await updateExpense(id, input);
    } catch {
      setError("You’re offline. Changes to saved expenses need a connection, so try again when you’re back online.");
      return;
    }
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast(`Saved ${formatMoney(result.data.amount, currency)} · ${categoryName}`);
    onDone();
  }

  /** Keeps a new expense in this device's queue until it can be sent (see SyncStatus). */
  async function saveOnDevice(expense: OfflineExpenseInput) {
    try {
      await offlineQueue.add(expense);
    } catch {
      setError("We couldn’t save that on this device. Check your connection and try again.");
      return;
    }
    window.dispatchEvent(new Event(QUEUE_CHANGED));
    void requestBackgroundSync();
    toast(`${formatMoney(Number(expense.amount), currency)} saved on this device. It’ll sync when you’re back online.`);
    onDone();
  }

  function remove() {
    if (!editing) return;
    startTransition(async () => {
      const result = await deleteExpense(editing.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const deleted = result.data;
      toast(`Expense deleted · ${formatMoney(deleted.amount, currency)}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            const restored = await restoreExpense(deleted);
            if (!restored.ok) toast.error(restored.error);
          },
        },
      });
      onDone();
    });
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      {useKeypad ? (
        <div role="status" aria-live="polite" className="flex items-baseline justify-center gap-2 pt-1">
          <span className="text-[17px] font-semibold text-muted-foreground">{currency}</span>
          <span
            className={cn(
              "text-[44px] leading-[52px] font-semibold tracking-[-0.02em] tabular-nums",
              amount ? "text-foreground" : "text-muted-foreground/60",
            )}
          >
            {amount || "0"}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${ids}-amount`} className="text-sm font-semibold">
            Amount
          </label>
          <div className="flex h-14 items-center overflow-hidden rounded-md border border-input bg-card focus-within:ring-3 focus-within:ring-ring/50">
            <span className="flex h-full items-center border-r border-input bg-muted px-4 text-[15px] font-semibold text-muted-foreground">
              {currency}
            </span>
            <input
              id={`${ids}-amount`}
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="min-w-0 flex-1 bg-transparent px-4 text-2xl font-semibold tabular-nums outline-none placeholder:text-muted-foreground/60"
            />
          </div>
        </div>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[13px] font-medium text-muted-foreground">Category</legend>
        <div className="grid grid-cols-4 gap-x-1.5 gap-y-2">
          {shownCategories.map((c) => {
            const selected = c.id === categoryId;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setCategoryId(c.id)}
                className="flex flex-col items-center gap-1 rounded-md py-1 text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span
                  className={cn(
                    "flex size-11 items-center justify-center rounded-[14px] transition-colors",
                    selected ? "bg-primary text-primary-foreground ring-3 ring-chart-3" : "bg-muted text-primary",
                  )}
                >
                  <CategoryIcon icon={c.icon} />
                </span>
                <span className={cn("line-clamp-2 min-h-7 text-center text-[11px] leading-[14px]", selected ? "font-bold" : "font-medium")}>
                  {c.name}
                </span>
              </button>
            );
          })}
          {categories.length > VISIBLE_CATEGORIES ? (
            <button
              type="button"
              onClick={() => setShowAllCategories((v) => !v)}
              aria-expanded={showAllCategories}
              className="flex flex-col items-center gap-1 rounded-md py-1 text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="flex size-11 items-center justify-center rounded-[14px] border border-dashed border-input text-muted-foreground">
                <ChevronDown aria-hidden="true" className={cn("size-5 transition-transform", showAllCategories && "rotate-180")} />
              </span>
              <span className="min-h-7 text-center text-[11px] leading-[14px] font-medium">{showAllCategories ? "Fewer" : "More"}</span>
            </button>
          ) : null}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-muted-foreground">Paid with</legend>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {PAYMENT_METHODS.map((m) => (
            <label
              key={m}
              className="flex h-9 shrink-0 cursor-pointer items-center rounded-full border border-input bg-card px-3 text-[13px] font-medium has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:checked]:font-semibold has-[:checked]:text-primary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
            >
              <input
                type="radio"
                name={`${ids}-payment`}
                value={m}
                checked={paymentMethod === m}
                onChange={() => setPaymentMethod(m)}
                className="sr-only"
              />
              {PAYMENT_METHOD_LABELS[m]}
            </label>
          ))}
        </div>
      </fieldset>

      {/* When: forgotten expenses can go on any earlier day (never a future one). */}
      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-muted-foreground">When</legend>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["today", "Today"],
              ["yesterday", "Yesterday"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className={chipClass}>
              <input
                type="radio"
                name={`${ids}-when`}
                value={value}
                checked={whenChoice === value}
                onChange={() => {
                  setPickEarlier(false);
                  setSpentOn(value === "today" ? today : yesterday);
                }}
                className="sr-only"
              />
              {label}
            </label>
          ))}
          <label className={chipClass}>
            <input
              type="radio"
              name={`${ids}-when`}
              value="earlier"
              checked={whenChoice === "earlier"}
              onChange={() => {
                setPickEarlier(true);
                if (spentOn >= yesterday) setSpentOn(addDays(today, -2));
                // Open the calendar straight away where the browser supports it.
                requestAnimationFrame(() => {
                  try {
                    dateInput.current?.showPicker?.();
                  } catch {
                    dateInput.current?.focus();
                  }
                });
              }}
              className="sr-only"
            />
            <CalendarDays aria-hidden="true" className="size-4" />
            {whenChoice === "earlier" ? dayLabel(spentOn, today) : "Earlier…"}
          </label>
        </div>
        {whenChoice === "earlier" ? (
          <div className="mt-2 flex flex-col gap-1.5">
            <label htmlFor={`${ids}-date`} className="text-[13px] font-medium text-muted-foreground">
              Date
            </label>
            <input
              ref={dateInput}
              id={`${ids}-date`}
              type="date"
              value={spentOn}
              max={today}
              onChange={(e) => e.target.value && e.target.value <= today && setSpentOn(e.target.value)}
              className="h-11 rounded-md border border-input bg-card px-3 text-base"
            />
          </div>
        ) : null}
      </fieldset>

      <button
        type="button"
        onClick={() => setShowDetails((v) => !v)}
        aria-expanded={showDetails}
        className="flex h-11 items-center gap-2 self-start rounded-full border border-input px-3.5 text-[13px] font-medium"
      >
        <Clock aria-hidden="true" className="size-4" />
        {formatTime(spentTime)}
        {note.trim() ? " · note" : " · add note"}
        <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", showDetails && "rotate-180")} />
      </button>

      {showDetails ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${ids}-time`} className="text-[13px] font-medium text-muted-foreground">
              Time
            </label>
            <input
              id={`${ids}-time`}
              type="time"
              value={spentTime}
              onChange={(e) => e.target.value && setSpentTime(e.target.value)}
              className="h-11 rounded-md border border-input bg-card px-3 text-base"
            />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <label htmlFor={`${ids}-note`} className="text-[13px] font-medium text-muted-foreground">
              Note <span className="font-normal">(optional)</span>
            </label>
            <input
              id={`${ids}-note`}
              value={note}
              maxLength={280}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Lunch, waakye"
              className="h-11 rounded-md border border-input bg-card px-3 text-base placeholder:text-muted-foreground/70"
            />
          </div>
        </div>
      ) : null}

      {useKeypad ? <Keypad onKey={(key) => setAmount((a) => applyKey(a, key))} /> : null}

      {error ? (
        <p role="alert" className="rounded-md bg-danger-bg px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={pending || !parsed}
          className="flex h-[52px] items-center justify-center gap-2 rounded-[14px] bg-primary text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:bg-[#e5e7eb] disabled:text-muted-foreground"
        >
          {parsed ? (
            <>
              <Check aria-hidden="true" className="size-5" />
              <span className="tabular-nums">
                {pending ? "Saving…" : `Save ${formatMoney(Number(parsed), currency)}`}
              </span>
            </>
          ) : (
            "Enter an amount"
          )}
        </button>
        {editing ? (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="flex h-11 items-center justify-center gap-2 rounded-md text-[15px] font-semibold text-destructive hover:bg-danger-bg"
          >
            <Trash2 aria-hidden="true" className="size-4" />
            Delete expense
          </button>
        ) : null}
      </div>
    </form>
  );
}
