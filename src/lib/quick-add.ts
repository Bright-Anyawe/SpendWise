import type { PaymentMethod } from "@/lib/types/database";
import { timeInTimeZone, todayInTimeZone } from "./dates";

export interface QuickAddDefaults {
  spentOn: string;
  spentTime: string;
  paymentMethod: PaymentMethod;
}

/** What a new expense starts with: now, in the person's time zone, paid the way they paid last time. */
export function quickAddDefaults(timezone: string, lastPaymentMethod: PaymentMethod | null, now: Date = new Date()): QuickAddDefaults {
  return {
    spentOn: todayInTimeZone(timezone, now),
    spentTime: timeInTimeZone(timezone, now),
    paymentMethod: lastPaymentMethod ?? "cash",
  };
}
