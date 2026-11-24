"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { pgErrorCode } from "@/lib/db/queryable";
import { withUserTransaction } from "@/lib/db/user-transaction";
import { budgetInputSchema } from "@/schemas/budget";
import { amountSchema, isoDateSchema } from "@/schemas/common";
import { type ActionResult, fail, fromZodError, ok } from "../action-result";
import { requireUser } from "../auth";
import * as data from "../data/budgets";
import type { BudgetAmount } from "../data/budgets";
import { friendlyDbError } from "../db-errors";
import { scheduleBudgetAlerts } from "../notifications/live";

const idSchema = z.uuid();
/** A date in the period being viewed on the Budgets page (any day of that month); omitted = today. */
const daySchema = isoDateSchema.optional();

export interface SaveBudgetOptions {
  /** Any date in the period being viewed; that period gets the amount. Omitted = today's period. */
  day?: string;
  /** Also make it the usual amount, used by every period that hasn't got its own. */
  makeUsual?: boolean;
}

/**
 * Creates a budget, or changes one (`id`). Amounts are per period, so a forgotten past month can be set
 * without touching other months:
 * - New budget: the amount becomes its usual amount and is kept for the viewed period.
 * - Edit: sets the viewed period's amount; with `makeUsual`, the usual amount too. The alert point
 *   applies to every period. A budget's period and category can't change: delete it and add another.
 */
export async function saveBudget(input: unknown, id?: string, options: SaveBudgetOptions = {}): Promise<ActionResult<BudgetAmount>> {
  const user = await requireUser();
  const parsed = budgetInputSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  if (id !== undefined && !idSchema.safeParse(id).success) return fail("That budget was not found.");
  const day = daySchema.safeParse(options.day);
  if (!day.success) return fail("Choose a valid month.");
  const { amount, alertAtPercent } = parsed.data;

  try {
    const saved = await withUserTransaction(user.id, async (db) => {
      const budgetId = id ?? (await data.createBudget(db, parsed.data)).id;
      const period = await data.setBudgetAmount(db, budgetId, day.data ?? null, amount);
      if (!period) return null;
      if (id !== undefined) {
        await (options.makeUsual ? data.updateBudget(db, id, { amount, alertAtPercent }) : data.setBudgetAlert(db, id, alertAtPercent));
      }
      return period;
    });
    if (!saved) return fail("That budget was not found.");
    revalidatePath("/", "layout");
    scheduleBudgetAlerts(user.id);
    return ok(saved);
  } catch (error) {
    return fail(friendlyDbError(pgErrorCode(error), "budget"));
  }
}

/**
 * "Money came in": raises the budget for the viewed period (`day`, default today) by the amount
 * received, e.g. when part of the month's income arrives. Other months are unchanged.
 */
export async function addToBudget(id: string, amount: unknown, day?: string): Promise<ActionResult<BudgetAmount>> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return fail("That budget was not found.");
  const parsed = amountSchema.safeParse(amount);
  if (!parsed.success) return fail("Enter the amount that came in, above 0.");
  const when = daySchema.safeParse(day);
  if (!when.success) return fail("Choose a valid month.");

  try {
    const saved = await withUserTransaction(user.id, (db) => data.addToBudget(db, id, parsed.data, when.data ?? null));
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
