import { PAYMENT_METHOD_LABELS } from "@/config/payment-methods";
import type { ExpenseWithCategory } from "@/lib/types/database";

const HEADER = ["Date", "Time", "Amount", "Currency", "Category", "Payment method", "Note"];

/** Text a person typed: neutralise spreadsheet formulas, then quote if needed. */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV for Excel / Google Sheets: UTF-8 with BOM, CRLF line endings, one row per expense. */
export function toCsv(rows: ExpenseWithCategory[], currency: string): string {
  const lines = [HEADER.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.spent_on,
        r.spent_time.slice(0, 5),
        r.amount.toFixed(2),
        currency,
        cell(r.category.name),
        PAYMENT_METHOD_LABELS[r.payment_method],
        cell(r.note ?? ""),
      ].join(","),
    );
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
