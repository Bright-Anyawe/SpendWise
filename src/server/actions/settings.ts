"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/neon";
import { withUserTransaction } from "@/lib/db/user-transaction";
import {
  changePasswordSchema,
  deleteAccountSchema,
  notificationPreferencesSchema,
  profileSettingsSchema,
} from "@/schemas/settings";
import { type ActionResult, fail, formDataToObject, fromZodError, ok } from "../action-result";
import { requireUser } from "../auth";
import { updateNotificationPreferences, updateProfileSettings } from "../data/settings";

export async function saveProfileSettings(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = profileSettingsSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    await withUserTransaction(user.id, (db) => updateProfileSettings(db, parsed.data));
  } catch {
    return fail("We couldn't save your settings. Please try again.");
  }
  revalidatePath("/", "layout");
  return ok(undefined);
}

export async function saveNotificationPreferences(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = notificationPreferencesSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    await withUserTransaction(user.id, (db) => updateNotificationPreferences(db, parsed.data));
  } catch {
    return fail("We couldn't save that. Please try again.");
  }
  revalidatePath("/settings");
  return ok(undefined);
}

export async function changePassword(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = changePasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const { error } = await getAuth().changePassword({
    currentPassword: parsed.data.currentPassword,
    newPassword: parsed.data.newPassword,
    revokeOtherSessions: true,
  });
  if (error) {
    if (error.code === "INVALID_PASSWORD") {
      return fail("That current password isn't right.", { currentPassword: ["That current password isn't right."] });
    }
    if (error.code === "PASSWORD_TOO_SHORT" || error.code === "PASSWORD_TOO_LONG") {
      return fail("Use between 8 and 72 characters.", { newPassword: ["Use between 8 and 72 characters."] });
    }
    return fail("We couldn't change your password. Please try again.");
  }
  return ok(undefined, "Password changed. You've been signed out on your other devices.");
}

/** Deletes the Neon Auth account (password required), then everything the app stored for that person. */
export async function deleteAccount(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = deleteAccountSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const { error } = await getAuth().deleteUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "INVALID_PASSWORD") return fail("That password isn't right.", { password: ["That password isn't right."] });
    return fail("We couldn't delete your account right now. Nothing was removed. Please try again later.");
  }

  // The login is gone; now remove the app data. If this fails the data is unreachable and is cleaned up later.
  await withUserTransaction(user.id, (db) => db.query("select app.delete_my_account()")).catch(() => undefined);
  redirect("/auth/sign-in?deleted=1");
}
