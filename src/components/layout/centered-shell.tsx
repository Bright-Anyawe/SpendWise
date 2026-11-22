import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand/brand-mark";

/** Narrow, centred column used by sign-in, sign-up and onboarding screens. */
export function CenteredShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center px-5 py-10 sm:justify-center">
      <div className="flex w-full max-w-[400px] flex-col gap-8">
        <BrandMark />
        {children}
      </div>
    </main>
  );
}
