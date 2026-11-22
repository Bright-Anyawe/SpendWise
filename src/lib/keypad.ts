const MAX_WHOLE_DIGITS = 9;
const MAX_DECIMALS = 2;

/**
 * The quick-add keypad: returns the amount string after pressing `key`
 * ("0"–"9", "." or "del"). Invalid presses leave the amount unchanged, so the
 * display can never hold something parseAmount would reject (other than empty or zero).
 */
export function applyKey(amount: string, key: string): string {
  if (key === "del") return amount.slice(0, -1);

  if (key === ".") {
    if (amount.includes(".")) return amount;
    return `${amount || "0"}.`;
  }

  if (!/^\d$/.test(key)) return amount;

  const [whole, decimals] = amount.split(".");
  if (decimals !== undefined) {
    return decimals.length >= MAX_DECIMALS ? amount : amount + key;
  }
  if (whole === "0") return key;
  if (whole.length >= MAX_WHOLE_DIGITS) return amount;
  return amount + key;
}
