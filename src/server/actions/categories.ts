"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { pgErrorCode } from "@/lib/db/queryable";
import { withUserTransaction } from "@/lib/db/user-transaction";
import type { Category } from "@/lib/types/database";
import { categoryInputSchema } from "@/schemas/category";
import { type ActionResult, fail, fromZodError, ok } from "../action-result";
import { requireUser } from "../auth";
import * as data from "../data/categories";
import { friendlyDbError } from "../db-errors";

const idSchema = z.uuid();

function saveError(error: unknown): ActionResult<never> {
  const code = pgErrorCode(error);
  const fieldErrors = code === "23505" ? { name: ["You already have a category with that name."] } : undefined;
  return fail(friendlyDbError(code, "category"), fieldErrors);
}

export async function createCategory(input: unknown): Promise<ActionResult<Category>> {
  const user = await requireUser();
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const saved = await withUserTransaction(user.id, (db) => data.createCategory(db, parsed.data));
    revalidatePath("/", "layout");
    return ok(saved);
  } catch (error) {
    return saveError(error);
  }
}

export async function updateCategory(id: string, input: unknown): Promise<ActionResult<Category>> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return fail("That category was not found.");
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const saved = await withUserTransaction(user.id, (db) => data.updateCategory(db, id, parsed.data));
    if (!saved) return fail("That category was not found.");
    revalidatePath("/", "layout");
    return ok(saved);
  } catch (error) {
    return saveError(error);
  }
}

/** Deletes a category after moving its expenses to `moveToId`. Its budgets are removed with it. */
export async function deleteCategory(id: string, moveToId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success || !idSchema.safeParse(moveToId).success) {
    return fail("Choose a category to move these expenses to.");
  }

  try {
    await withUserTransaction(user.id, (db) => data.deleteCategory(db, id, moveToId));
  } catch (error) {
    // public.delete_category raises plain-words messages for the cases a person can hit.
    const message = error instanceof Error && pgErrorCode(error) ? error.message : "";
    return fail(message || "We couldn't delete that category. Please try again.");
  }

  revalidatePath("/", "layout");
  return ok(undefined);
}
