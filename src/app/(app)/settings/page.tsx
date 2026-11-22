import type { Metadata } from "next";
import { type ReactNode, Suspense } from "react";
import { AccountSettings, DataSettings } from "@/components/settings/account-settings";
import { CategorySettings } from "@/components/settings/category-settings";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { requireOnboardedProfile } from "@/server/auth";
import { getCategories, getNotificationPreferences } from "@/server/queries";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-5 py-5 md:px-8 md:py-8">
      <h1 className="text-2xl font-semibold tracking-[-0.01em]">Settings</h1>
      <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Settings />
      </Suspense>
    </main>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="px-1 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

async function Settings() {
  const { user, profile } = await requireOnboardedProfile();
  const [categories, prefs] = await Promise.all([getCategories(), getNotificationPreferences()]);

  return (
    <>
      <Section id="s-preferences" title="Preferences">
        <div className="rounded-xl border border-border bg-card p-5">
          <ProfileSettings profile={profile} />
        </div>
      </Section>
      <Section id="s-categories" title="Categories">
        <CategorySettings categories={categories} />
      </Section>
      {prefs ? (
        <Section id="s-notifications" title="Reminders and notifications">
          <NotificationSettings prefs={prefs} />
        </Section>
      ) : null}
      <Section id="s-data" title="Your data">
        <DataSettings />
      </Section>
      <Section id="s-account" title="Account">
        <AccountSettings email={user.email} />
      </Section>
    </>
  );
}
