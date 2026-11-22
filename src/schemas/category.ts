import { z } from "zod";

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, { error: "Give the category a name" }).max(40, { error: "Use 40 characters or fewer" }),
  /** A Lucide icon name, e.g. "utensils". */
  icon: z.string().regex(/^[a-z0-9-]{1,40}$/, { error: "Choose an icon" }).default("circle"),
  countsAsSpending: z.boolean().default(true),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;
