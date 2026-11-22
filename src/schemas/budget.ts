import { z } from "zod";
import { amountSchema } from "./common";

export const budgetInputSchema = z.object({
  period: z.enum(["daily", "weekly", "monthly"], { error: "Choose daily, weekly or monthly" }),
  /** null = an overall budget for the period. */
  categoryId: z.uuid().nullable().default(null),
  amount: amountSchema,
  alertAtPercent: z.number().int().min(1, { error: "Use 1–100%" }).max(100, { error: "Use 1–100%" }).default(80),
});

export type BudgetInput = z.infer<typeof budgetInputSchema>;
