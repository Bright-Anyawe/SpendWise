import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { CenteredShell } from "@/components/layout/centered-shell";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { getProfile, requireUser } from "@/server/auth";

export const metadata: Metadata = { title: "Set up your money" };

export default function OnboardingPage() {
  return (
    <CenteredShell>
      <AuthHeading title="Set up your money">You can change any of this later in Settings.</AuthHeading>
      <Suspense fallback={<div className="h-[560px] animate-pulse rounded-lg bg-muted" aria-hidden="true" />}>
        <OnboardingLoader />
      </Suspense>
    </CenteredShell>
  );
}

async function OnboardingLoader() {
  await requireUser();
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.onboarded_at) redirect("/");
  return (
    <OnboardingForm
      defaults={{ currency: profile.currency, timezone: profile.timezone, weekStartsOn: profile.week_starts_on }}
    />
  );
}
