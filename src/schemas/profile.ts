import { z } from "zod";
import { isSupportedCurrency } from "@/config/currencies";
import { isValidTimeZone } from "@/lib/dates";
import { parseAmount } from "@/lib/money";

export const currencySchema = z.string().refine(isSupportedCurrency, { error: "Choose a currency from the list" });

export const timeZoneSchema = z.string().trim().refine(isValidTimeZone, { error: "Choose a valid time zone" });

export const weekStartSchema = z.coerce
  .number()
  .int()
  .min(0, { error: "Choose a day of the week" })
  .max(6, { error: "Choose a day of the week" });

/** Optional amount field: blank → undefined, otherwise a normalised decimal string. */
export const optionalAmountSchema = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (value === undefined || value.trim() === "") return undefined;
    const amount = parseAmount(value);
    if (amount === null) {
      ctx.addIssue({ code: "custom", message: "Enter an amount above 0, like 3,000" });
      return z.NEVER;
    }
    return amount;
  });

export const onboardingSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  currency: currencySchema,
  timezone: timeZoneSchema,
  weekStartsOn: weekStartSchema,
  monthlyBudget: optionalAmountSchema,
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
