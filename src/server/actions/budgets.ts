"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { pgErrorCode } from "@/lib/db/queryable";
import { withUserTransaction } from "@/lib/db/user-transaction";
import type { Budget } from "@/lib/types/database";
import { budgetInputSchema } from "@/schemas/budget";
import { amountSchema } from "@/schemas/common";
import { type ActionResult, fail, fromZodError, ok } from "../action-result";
import { requireUser } from "../auth";
import * as data from "../data/budgets";
import { friendlyDbError } from "../db-errors";
import { scheduleBudgetAlerts } from "../notifications/live";

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
    scheduleBudgetAlerts(user.id);
    return ok(saved);
  } catch (error) {
    return fail(friendlyDbError(pgErrorCode(error), "budget"));
  }
}

/** "Money came in": raises a budget by the amount received, e.g. when part of the month's income arrives. */
export async function addToBudget(id: string, amount: unknown): Promise<ActionResult<Budget>> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return fail("That budget was not found.");
  const parsed = amountSchema.safeParse(amount);
  if (!parsed.success) return fail("Enter the amount that came in, above 0.");

  try {
    const saved = await withUserTransaction(user.id, (db) => data.addToBudget(db, id, parsed.data));
    if (!saved) return fail("That budget was not found.");
    revalidatePath("/", "layout");
    // The budget's alerts start over at the new amount; check now in case spending is already near it.
    scheduleBudgetAlerts(user.id);
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
