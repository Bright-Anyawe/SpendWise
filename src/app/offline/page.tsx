import type { Metadata } from "next";
import { CenteredShell } from "@/components/layout/centered-shell";

export const metadata: Metadata = { title: "You're offline" };

// Cached by the service worker and shown when a page can't load without a connection.
export default function OfflinePage() {
  return (
    <CenteredShell>
      <div className="flex flex-col gap-3">
        <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.01em]">You’re offline</h1>
        <p className="text-[15px] leading-[22px] text-muted-foreground">
          This page needs a connection. You can still add expenses from any screen you’ve opened before. They’re kept on
          this device and sync when you’re back online.
        </p>
      </div>
      {/* A full page load on purpose: client-side navigation would just fail again while offline. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/"
        className="flex h-[52px] items-center justify-center rounded-[14px] bg-primary text-base font-semibold text-primary-foreground hover:bg-primary-hover"
      >
        Try again
      </a>
    </CenteredShell>
  );
}
