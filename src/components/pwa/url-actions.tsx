"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useQuickAdd } from "@/components/quick-add/quick-add-provider";
import { markNoSpendToday } from "@/server/actions/no-spend";

/**
 * Handles the buttons on reminder notifications, which open the app at
 * /?add=1 (open quick add) or /?no-spend=1 (mark today as a no-spend day).
 */
export function UrlActions() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { openNew } = useQuickAdd();
  const handled = useRef<string | null>(null);

  const add = params.get("add") === "1";
  const noSpend = params.get("no-spend") === "1";

  useEffect(() => {
    if (!add && !noSpend) return;
    const key = params.toString();
    if (handled.current === key) return;
    handled.current = key;

    const rest = new URLSearchParams(params);
    rest.delete("add");
    rest.delete("no-spend");
    router.replace(rest.size ? `${pathname}?${rest}` : pathname, { scroll: false });

    if (add) openNew();
    if (noSpend) {
      void markNoSpendToday().then(
        (result) => (result.ok ? toast("Marked today as a no-spend day. We won't remind you tonight.") : toast.error(result.error)),
        () => toast.error("We couldn't reach SpendWise. Please try again when you're online."),
      );
    }
  }, [add, noSpend, params, pathname, router, openNew]);

  return null;
}
