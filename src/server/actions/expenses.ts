"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { pgErrorCode } from "@/lib/db/queryable";
import { withUserTransaction } from "@/lib/db/user-transaction";
import type { Expense } from "@/lib/types/database";
import { expenseInputSchema, toExpenseRow } from "@/schemas/expense";
import { type ActionResult, fail, fromZodError, ok } from "../action-result";
import { requireUser } from "../auth";
import * as data from "../data/expenses";
import { friendlyDbError } from "../db-errors";
import { scheduleBudgetAlerts } from "../notifications/live";

const idSchema = z.uuid();

function saveError(error: unknown): ActionResult<never> {
  const code = pgErrorCode(error);
  const fieldErrors = code === "23503" ? { categoryId: ["That category no longer exists. Pick another one."] } : undefined;
  return fail(friendlyDbError(code, "expense"), fieldErrors);
}

export async function createExpense(input: unknown): Promise<ActionResult<Expense>> {
  const user = await requireUser();
  const parsed = expenseInputSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const saved = await withUserTransaction(user.id, (db) => data.insertExpense(db, toExpenseRow(parsed.data)));
    if (!saved) return fail("We couldn't save that expense. Please try again.");
    revalidatePath("/", "layout");
    scheduleBudgetAlerts(user.id);
    return ok(saved);
  } catch (error) {
    return saveError(error);
  }
}

export async function updateExpense(id: string, input: unknown): Promise<ActionResult<Expense>> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return fail("That expense was not found.");
  const parsed = expenseInputSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const saved = await withUserTransaction(user.id, (db) => data.updateExpense(db, id, toExpenseRow(parsed.data)));
    if (!saved) return fail("That expense was not found. It may have been deleted.");
    revalidatePath("/", "layout");
    scheduleBudgetAlerts(user.id);
    return ok(saved);
  } catch (error) {
    return saveError(error);
  }
}

/** Deletes an expense and returns it, so the UI can offer Undo (see restoreExpense). */
export async function deleteExpense(id: string): Promise<ActionResult<Expense>> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return fail("That expense was not found.");

  try {
    const deleted = await withUserTransaction(user.id, (db) => data.deleteExpense(db, id));
    if (!deleted) return fail("That expense was not found. It may have been deleted already.");
    revalidatePath("/", "layout");
    return ok(deleted);
  } catch (error) {
    return saveError(error);
  }
}

/** Undo for deleteExpense: puts the same expense (same id) back. */
export async function restoreExpense(deleted: Expense): Promise<ActionResult<Expense>> {
  return createExpense({
    id: deleted.id,
    amount: String(deleted.amount),
    categoryId: deleted.category_id,
    paymentMethod: deleted.payment_method,
    note: deleted.note ?? undefined,
    spentOn: deleted.spent_on,
    spentTime: deleted.spent_time,
  });
}
