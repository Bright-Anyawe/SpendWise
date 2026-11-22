import { z } from "zod";
import { PAYMENT_METHODS } from "@/config/payment-methods";
import { addDays, dayLabel, isIsoDate } from "@/lib/dates";
import type { ExpenseWithCategory, PaymentMethod } from "@/lib/types/database";
import type { ExpenseFilters } from "@/schemas/expense";

export type TransactionsPeriod = "month" | "week" | "all" | "custom";
type SearchParams = Record<string, string | string[] | undefined>;

const uuid = z.uuid();

function list(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function nonNegative(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function monthEnd(day: string): string {
  const [y, m] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/**
 * Turns the Transactions page URL (?period=&from=&to=&category=&method=&min=&max=&q=&page=) into
 * filters. Anything that doesn't make sense is dropped rather than causing an error.
 */
export function parseTransactionFilters(
  searchParams: SearchParams,
  today: string,
  weekStartsOn: number,
): { period: TransactionsPeriod; filters: ExpenseFilters } {
  const filters: ExpenseFilters = { page: 0 };
  const requested = first(searchParams.period);
  const from = first(searchParams.from);
  const to = first(searchParams.to);

  let period: TransactionsPeriod = "month";
  if (requested === "week" || requested === "all") period = requested;
  if (requested === "custom" && from && isIsoDate(from) && (!to || (isIsoDate(to) && to >= from))) period = "custom";

  if (period === "month") {
    filters.from = `${today.slice(0, 7)}-01`;
    filters.to = monthEnd(today);
  } else if (period === "week") {
    const [y, m, d] = today.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    filters.from = addDays(today, -((dow - weekStartsOn + 7) % 7));
    filters.to = addDays(filters.from, 6);
  } else if (period === "custom") {
    filters.from = from;
    if (to) filters.to = to;
  }

  const categoryIds = list(searchParams.category).filter((c) => uuid.safeParse(c).success);
  if (categoryIds.length) filters.categoryIds = categoryIds;

  const methods = list(searchParams.method).filter((m): m is PaymentMethod => (PAYMENT_METHODS as readonly string[]).includes(m));
  if (methods.length) filters.paymentMethods = methods;

  const min = nonNegative(first(searchParams.min));
  const max = nonNegative(first(searchParams.max));
  if (min !== undefined) filters.minAmount = min;
  if (max !== undefined) filters.maxAmount = max;

  const q = first(searchParams.q)?.trim();
  if (q) filters.q = q.slice(0, 100);

  const page = Number(first(searchParams.page));
  if (Number.isInteger(page) && page > 0 && page <= 100) filters.page = page;

  return { period, filters };
}

export interface DayGroup {
  day: string;
  label: string;
  total: number;
  rows: ExpenseWithCategory[];
}

/** Groups newest-first expenses by calendar day, with a total per day (summed in cents). */
export function groupByDay(rows: ExpenseWithCategory[], today: string): DayGroup[] {
  const groups: (DayGroup & { cents: number })[] = [];
  for (const row of rows) {
    let group = groups[groups.length - 1];
    if (!group || group.day !== row.spent_on) {
      group = { day: row.spent_on, label: dayLabel(row.spent_on, today), total: 0, cents: 0, rows: [] };
      groups.push(group);
    }
    group.rows.push(row);
    group.cents += Math.round(row.amount * 100);
    group.total = group.cents / 100;
  }
  return groups.map((g) => ({ day: g.day, label: g.label, total: g.total, rows: g.rows }));
}
