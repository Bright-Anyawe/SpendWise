"use client";

import { ChevronRight, Download, KeyRound, LogOut, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { ResponsiveSheet } from "@/components/common/responsive-sheet";
import { forgetThisDevice } from "@/components/pwa/register-sw";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import type { ActionResult } from "@/server/action-result";
import { signOut } from "@/server/actions/auth";
import { changePassword, deleteAccount } from "@/server/actions/settings";

const rowClass = "flex min-h-14 w-full items-center gap-3 py-2 text-left text-[15px] font-medium";

function errorsOf(state: ActionResult | null) {
  return state && !state.ok ? state.fieldErrors : undefined;
}

export function DataSettings() {
  return (
    <div className="rounded-xl border border-border bg-card px-4">
      <a href="/api/export/csv" className={rowClass}>
        <Download aria-hidden="true" className="size-5 text-primary" />
        <span className="flex-1">Export all expenses (CSV)</span>
        <ChevronRight aria-hidden="true" className="size-[18px] text-muted-foreground" />
      </a>
    </div>
  );
}

export function AccountSettings({ email }: { email: string }) {
  const [sheet, setSheet] = useState<"password" | "delete" | null>(null);

  return (
    <>
      <div className="rounded-xl border border-border bg-card px-4">
        <p className="border-b border-muted py-3 text-[13px] text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{email}</span>
        </p>
        <button type="button" onClick={() => setSheet("password")} className={rowClass}>
          <KeyRound aria-hidden="true" className="size-5 text-primary" />
          <span className="flex-1">Change password</span>
          <ChevronRight aria-hidden="true" className="size-[18px] text-muted-foreground" />
        </button>
        <form action={signOut} onSubmit={forgetThisDevice} className="border-t border-muted">
          <button type="submit" className={rowClass}>
            <LogOut aria-hidden="true" className="size-5 text-primary" />
            <span className="flex-1">Sign out</span>
          </button>
        </form>
        <button type="button" onClick={() => setSheet("delete")} className={`${rowClass} border-t border-muted text-destructive`}>
          <Trash2 aria-hidden="true" className="size-5" />
          <span className="flex flex-1 flex-col">
            <span className="font-semibold">Delete account</span>
            <span className="text-[13px] font-normal text-muted-foreground">Permanently removes your account and all your data</span>
          </span>
        </button>
      </div>

      <ResponsiveSheet open={sheet === "password"} onOpenChange={(open) => !open && setSheet(null)} title="Change password">
        {sheet === "password" ? <ChangePasswordForm /> : null}
      </ResponsiveSheet>
      <ResponsiveSheet
        open={sheet === "delete"}
        onOpenChange={(open) => !open && setSheet(null)}
        title="Delete your account?"
        description="This permanently deletes your account, every expense, budget and category. It can’t be undone. Export your data first if you want a copy."
      >
        {sheet === "delete" ? <DeleteAccountForm /> : null}
      </ResponsiveSheet>
    </>
  );
}

function ChangePasswordForm() {
  const [state, action] = useActionState(changePassword, null);
  const errors = errorsOf(state);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <FormMessage state={state} />
      <FormField id="currentPassword" label="Current password" type="password" autoComplete="current-password" required error={errors?.currentPassword} />
      <FormField id="newPassword" label="New password" type="password" autoComplete="new-password" hint="At least 8 characters." required error={errors?.newPassword} />
      <FormField id="confirmPassword" label="Type it again" type="password" autoComplete="new-password" required error={errors?.confirmPassword} />
      <SubmitButton pendingText="Saving…">Change password</SubmitButton>
    </form>
  );
}

function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccount, null);
  const errors = errorsOf(state);
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <FormMessage state={state} />
      <FormField id="password" label="Your password" type="password" autoComplete="current-password" required error={errors?.password} />
      <FormField id="confirm" label="Type DELETE to confirm" autoComplete="off" autoCapitalize="characters" required error={errors?.confirm} />
      <button type="submit" className="h-[52px] rounded-[14px] bg-destructive text-base font-semibold text-white hover:opacity-90">
        Delete my account
      </button>
    </form>
  );
}
