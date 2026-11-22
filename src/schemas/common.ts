import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { parseAmount } from "@/lib/money";

export const isoDateSchema = z
  .string()
  .refine(isIsoDate, { error: "Choose a valid date" })
  .refine((v) => v >= "2000-01-01" && v <= "2100-12-31", { error: "Choose a date between 2000 and 2100" });

export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, { error: "Choose a valid time" });

/** Required amount typed by a person → normalised decimal string ("1234.50"). */
export const amountSchema = z.string().transform((value, ctx) => {
  const amount = parseAmount(value);
  if (amount === null) {
    ctx.addIssue({ code: "custom", message: "Enter an amount above 0" });
    return z.NEVER;
  }
  return amount;
});
