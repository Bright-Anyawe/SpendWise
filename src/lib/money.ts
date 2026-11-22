import { getCurrency } from "@/config/currencies";

/** Largest amount a single expense or budget may hold (fits numeric(14,2) with headroom). */
export const MAX_AMOUNT = 999_999_999.99;

const AMOUNT_PATTERN = /^(?:(\d+)(?:\.(\d{0,2}))?|\.(\d{1,2}))$/;

/**
 * Turns what a person typed into a normalised decimal string ("1234.50"),
 * or null when it isn't a valid positive amount. Thousands commas are allowed.
 * Never goes through floating point for the digits themselves.
 */
export function parseAmount(input: string): string | null {
  const s = input.trim().replace(/,/g, "");
  const m = AMOUNT_PATTERN.exec(s);
  if (!m) return null;

  const whole = (m[1] ?? "0").replace(/^0+(?=\d)/, "");
  const fraction = (m[2] ?? m[3] ?? "").padEnd(2, "0");
  const normalised = `${whole}.${fraction}`;

  const value = Number(normalised);
  if (!(value > 0) || value > MAX_AMOUNT) return null;
  return normalised;
}

/** Formats an amount for display: "GHS 1,234.50" for code currencies, "$1,234.50" for symbol ones. */
export function formatMoney(amount: number | string, currency: string, locale = "en-GH"): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  const display = getCurrency(currency)?.display ?? "code";

  if (display === "symbol") {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).format(value);
  }

  const digits =
    new Intl.NumberFormat(locale, { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
  return `${currency} ${number}`;
}

/** "NGN 1,234.50": always the ISO code, for places whose fonts may lack the currency symbol (PDF). */
export function formatMoneyCode(amount: number | string, currency: string, locale = "en-GH"): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  const digits =
    new Intl.NumberFormat(locale, { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  const number = new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  return `${currency} ${number}`;
}
