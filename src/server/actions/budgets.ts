"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { pgErrorCode } from "@/lib/db/queryable";
import { withUserTransaction } from "@/lib/db/user-transaction";
import type { Budget } from "@/lib/types/database";
import { budgetInputSchema } from "@/schemas/budget";
import { type ActionResult, fail, fromZodError, ok } from "../action-result";
import { requireUser } from "../auth";
import * as data from "../data/budgets";
import { friendlyDbError } from "../db-errors";

const idSchema = z.uuid();

/**
 * Creates a budget, or updates an existing one's amount and alert point when `id` is given.
 * A budget's period and category can't change: delete it and create another.
 */
export async function saveBudget(input: unknown, id?: string): Promise<ActionResult<Budget>> {
  const user = await requireUser();
  const parsed = budgetInputSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  if (id !== undefined && !idSchema.safeParse(id).success) return fail("That budget was not found.");

  try {
    const saved = await withUserTransaction(user.id, (db) =>
      id === undefined ? data.createBudget(db, parsed.data) : data.updateBudget(db, id, parsed.data),
    );
    if (!saved) return fail("That budget was not found.");
    revalidatePath("/", "layout");
    return ok(saved);
  } catch (error) {
    return fail(friendlyDbError(pgErrorCode(error), "budget"));
  }
}

export async function deleteBudget(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return fail("That budget was not found.");

  try {
    const deleted = await withUserTransaction(user.id, (db) => data.deleteBudget(db, id));
    if (!deleted) return fail("That budget was not found.");
  } catch (error) {
    return fail(friendlyDbError(pgErrorCode(error), "budget"));
  }

  revalidatePath("/", "layout");
  return ok(undefined);
}
