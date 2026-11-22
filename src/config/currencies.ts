export type CurrencyDisplay = "code" | "symbol";

export interface Currency {
  code: string;
  name: string;
  /** How amounts are written: "GHS 1,234.50" (code) or "$1,234.50" (symbol). */
  display: CurrencyDisplay;
}

export const CURRENCIES: readonly Currency[] = [
  { code: "GHS", name: "Ghanaian cedi", display: "code" },
  { code: "USD", name: "US dollar", display: "symbol" },
  { code: "GBP", name: "British pound", display: "symbol" },
  { code: "EUR", name: "Euro", display: "symbol" },
  { code: "NGN", name: "Nigerian naira", display: "symbol" },
  { code: "KES", name: "Kenyan shilling", display: "code" },
  { code: "ZAR", name: "South African rand", display: "symbol" },
  { code: "XOF", name: "West African CFA franc", display: "code" },
  { code: "CAD", name: "Canadian dollar", display: "symbol" },
  { code: "AUD", name: "Australian dollar", display: "symbol" },
  { code: "INR", name: "Indian rupee", display: "symbol" },
  { code: "JPY", name: "Japanese yen", display: "symbol" },
] as const;

export const DEFAULT_CURRENCY = "GHS";

const CODES = new Set(CURRENCIES.map((c) => c.code));

export function isSupportedCurrency(code: string): boolean {
  return CODES.has(code);
}

export function getCurrency(code: string): Currency | undefined {
  return CURRENCIES.find((c) => c.code === code);
}
