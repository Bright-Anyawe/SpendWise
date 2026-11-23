"use server";

import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/neon";
import { safeNextPath } from "@/lib/auth/redirect";
import { getSiteUrl } from "@/lib/site-url";
import { forgotPasswordSchema, resetPasswordSchema, signInSchema, signUpSchema } from "@/schemas/auth";
import { type ActionResult, fail, formDataToObject, fromZodError, ok, pick } from "../action-result";
import { unexpectedAuthError } from "../auth-errors";

// Better Auth error codes returned by Neon Auth.
const EMAIL_TAKEN = new Set(["USER_ALREADY_EXISTS", "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"]);
const BAD_PASSWORD = new Set(["PASSWORD_TOO_SHORT", "PASSWORD_TOO_LONG", "INVALID_PASSWORD"]);

export async function signUp(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const raw = formDataToObject(formData);
  const echo = pick(raw, ["displayName", "email"]);
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error, echo);
  const { displayName, email, password } = parsed.data;

  const { data, error } = await getAuth().signUp.email({ email, password, name: displayName });
  if (error) {
    const code = error.code ?? "";
    if (EMAIL_TAKEN.has(code)) {
      const message = "An account with that email already exists. Sign in instead.";
      return fail(message, { email: [message] }, echo);
    }
    if (BAD_PASSWORD.has(code)) {
      const message = error.message || "Choose a password between 8 and 72 characters.";
      return fail(message, { password: [message] }, echo);
    }
    if (code === "INVALID_EMAIL") return fail("Enter a valid email address.", { email: ["Enter a valid email address."] }, echo);
    return fail(unexpectedAuthError("sign-up", error, "We couldn't create your account. Please try again."), undefined, echo);
  }

  // With "Verify email at signup" turned on in Neon Auth there's no session until the email is confirmed.
  if (!data?.token) {
    return ok(undefined, `We've sent a message to ${email}. Verify your email, then sign in.`);
  }
  redirect("/onboarding");
}

export async function signIn(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const raw = formDataToObject(formData);
  const echo = pick(raw, ["email", "next"]);
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error, echo);

  const { error } = await getAuth().signIn.email(parsed.data);
  if (error) {
    if (error.code === "EMAIL_NOT_VERIFIED") {
      return fail("Please verify your email first. Check your inbox for the message we sent.", undefined, echo);
    }
    if (error.code === "INVALID_EMAIL_OR_PASSWORD") {
      return fail("That email and password don't match. Try again or reset your password.", undefined, echo);
    }
    return fail(unexpectedAuthError("sign-in", error, "We couldn't sign you in right now. Please try again."), undefined, echo);
  }

  redirect(safeNextPath(raw.next));
}

export async function signOut(): Promise<void> {
  await getAuth().signOut();
  redirect("/auth/sign-in");
}

export async function requestPasswordReset(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const raw = formDataToObject(formData);
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error, pick(raw, ["email"]));

  const { error } = await getAuth().requestPasswordReset({
    email: parsed.data.email,
    redirectTo: `${getSiteUrl()}/auth/reset-password`,
  });
  // Neon Auth answers the same for unknown emails, so an error here is about the service, not the account.
  if (error) {
    return fail(unexpectedAuthError("password reset", error, "We couldn't send the reset link right now. Please try again."), undefined, pick(raw, ["email"]));
  }

  // Same answer whether or not the account exists, so emails can't be probed.
  return ok(undefined, "If an account uses that email, we've sent a link to reset the password. It works for 1 hour.");
}

export async function resetPassword(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const { error } = await getAuth().resetPassword({ newPassword: parsed.data.password, token: parsed.data.token });
  if (error) {
    if (BAD_PASSWORD.has(error.code ?? "")) {
      const message = error.message || "Choose a password between 8 and 72 characters.";
      return fail(message, { password: [message] });
    }
    if (error.code === "INVALID_ORIGIN") return fail(unexpectedAuthError("password change", error, ""));
    return fail("This reset link has expired or was already used. Request a new one.");
  }

  redirect("/auth/sign-in?reset=1");
}
