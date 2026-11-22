import type { PaymentMethod } from "@/lib/types/database";

export const PAYMENT_METHODS = ["cash", "mobile_money", "card", "bank_transfer", "other"] as const satisfies readonly PaymentMethod[];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  mobile_money: "Mobile Money",
  card: "Card",
  bank_transfer: "Bank transfer",
  other: "Other",
};
