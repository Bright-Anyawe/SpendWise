"use client";

import { RotateCw } from "lucide-react";
import { useEffect } from "react";

/** Shown when a signed-in page can't load (for example, the database couldn't be reached). */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-col items-start gap-4 px-5 py-16">
      <h1 className="text-[22px] leading-7 font-semibold">This page didn’t load</h1>
      <p className="text-[15px] text-muted-foreground">
        Something went wrong getting your numbers. Your expenses are safe. Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={retry}
        className="inline-flex h-12 items-center gap-2 rounded-md bg-primary px-5 text-[15px] font-semibold text-primary-foreground hover:bg-primary-hover"
      >
        <RotateCw aria-hidden="true" className="size-[18px]" />
        Try again
      </button>
    </main>
  );
}
