import { z } from "zod";
import { PAYMENT_METHODS } from "@/config/payment-methods";
import type { ExpenseInsert } from "@/lib/types/database";
import { amountSchema, isoDateSchema, timeSchema } from "./common";

export const expenseInputSchema = z.object({
  /** Client-generated for offline entries so retries never create duplicates. */
  id: z.uuid().optional(),
  amount: amountSchema,
  categoryId: z.uuid({ error: "Choose a category" }),
  paymentMethod: z.enum(PAYMENT_METHODS, { error: "Choose how you paid" }),
  note: z.string().trim().max(280, { error: "Keep the note to 280 characters" }).optional(),
  spentOn: isoDateSchema,
  spentTime: timeSchema,
});

export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export function toExpenseRow(input: ExpenseInput): ExpenseInsert {
  return {
    ...(input.id ? { id: input.id } : {}),
    amount: input.amount,
    category_id: input.categoryId,
    payment_method: input.paymentMethod,
    note: input.note ? input.note : null,
    spent_on: input.spentOn,
    spent_time: input.spentTime,
  };
}

const optionalText = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

export const expenseFiltersSchema = z
  .object({
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    categoryIds: z.array(z.uuid()).optional(),
    paymentMethods: z.array(z.enum(PAYMENT_METHODS)).optional(),
    minAmount: z.number().nonnegative().optional(),
    maxAmount: z.number().nonnegative().optional(),
    q: optionalText,
    page: z.number().int().min(0).default(0),
  })
  .refine((f) => !f.from || !f.to || f.from <= f.to, { path: ["to"], error: "The end date is before the start date" })
  .transform((f) => {
    const out: Partial<typeof f> & { page: number } = { page: f.page };
    if (f.from) out.from = f.from;
    if (f.to) out.to = f.to;
    if (f.categoryIds?.length) out.categoryIds = f.categoryIds;
    if (f.paymentMethods?.length) out.paymentMethods = f.paymentMethods;
    if (f.minAmount !== undefined) out.minAmount = f.minAmount;
    if (f.maxAmount !== undefined) out.maxAmount = f.maxAmount;
    if (f.q) out.q = f.q;
    return out;
  });

export type ExpenseFilters = z.infer<typeof expenseFiltersSchema>;
