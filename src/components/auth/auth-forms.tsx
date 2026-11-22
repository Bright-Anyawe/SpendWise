"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useBrowserValue } from "@/hooks/use-browser-value";
import type { ActionResult } from "@/server/action-result";
import { requestPasswordReset, resetPassword, signIn, signUp } from "@/server/actions/auth";

function fieldErrors(state: ActionResult | null) {
  return state && !state.ok ? state.fieldErrors : undefined;
}

function echoed(state: ActionResult | null, key: string): string | undefined {
  return state && !state.ok ? state.values?.[key] : undefined;
}

/** Reads one query parameter on the client so the form itself can be part of the static page. */
function useQueryParam(name: string): string {
  return useBrowserValue(() => new URLSearchParams(window.location.search).get(name) ?? "", "");
}

export function SignInForm() {
  const [state, action] = useActionState(signIn, null);
  const next = useQueryParam("next");
  const justReset = useQueryParam("reset") === "1";
  const justDeleted = useQueryParam("deleted") === "1";
  const errors = fieldErrors(state);

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="next" value={echoed(state, "next") ?? next} />
      {justReset && !state ? (
        <p role="status" className="rounded-md bg-positive-bg px-4 py-3 text-sm leading-5 text-positive">
          Your password was changed. Sign in with the new one.
        </p>
      ) : null}
      {justDeleted && !state ? (
        <p role="status" className="rounded-md bg-muted px-4 py-3 text-sm leading-5 text-foreground">
          Your account and all your data have been deleted.
        </p>
      ) : null}
      <FormMessage state={state} />
      <FormField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={echoed(state, "email")}
        key={`email-${echoed(state, "email") ?? ""}`}
        error={errors?.email}
      />
      <FormField id="password" label="Password" type="password" autoComplete="current-password" required error={errors?.password} />
      <Link href="/auth/forgot-password" className="-mt-2 self-end py-2 text-sm font-semibold text-primary hover:text-primary-hover">
        Forgot your password?
      </Link>
      <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
    </form>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUp, null);
  const errors = fieldErrors(state);

  if (state?.ok) return <FormMessage state={state} />;

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <FormMessage state={state} />
      <FormField
        id="displayName"
        label="What should we call you?"
        autoComplete="given-name"
        required
        maxLength={60}
        defaultValue={echoed(state, "displayName")}
        key={`name-${echoed(state, "displayName") ?? ""}`}
        error={errors?.displayName}
      />
      <FormField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={echoed(state, "email")}
        key={`email-${echoed(state, "email") ?? ""}`}
        error={errors?.email}
      />
      <FormField
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="At least 8 characters."
        error={errors?.password}
      />
      <SubmitButton pendingText="Creating your account…">Create account</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, null);
  const errors = fieldErrors(state);

  if (state?.ok) return <FormMessage state={state} />;

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <FormMessage state={state} />
      <FormField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={echoed(state, "email")}
        key={`email-${echoed(state, "email") ?? ""}`}
        error={errors?.email}
      />
      <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(resetPassword, null);
  // Neon Auth sends people here as /auth/reset-password?token=… (or ?error=INVALID_TOKEN).
  const token = useQueryParam("token");
  const linkError = useQueryParam("error");
  const isBrowser = useBrowserValue(() => true, false);
  const errors = fieldErrors(state);

  if (isBrowser && (linkError || !token)) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="rounded-md bg-danger-bg px-4 py-3 text-sm leading-5 text-destructive">
          This reset link has expired or was already used. Links work once, for 1 hour.
        </p>
        <Link
          href="/auth/forgot-password"
          className="flex h-[52px] items-center justify-center rounded-[14px] bg-primary text-base font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          Send a new link
        </Link>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <FormField
        id="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="At least 8 characters."
        error={errors?.password}
      />
      <FormField
        id="confirmPassword"
        label="Type it again"
        type="password"
        autoComplete="new-password"
        required
        error={errors?.confirmPassword}
      />
      <SubmitButton pendingText="Saving…">Save new password</SubmitButton>
    </form>
  );
}
