"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand/brand-mark";
import { useQuickAdd } from "@/components/quick-add/quick-add-provider";
import { cn } from "@/lib/utils";
import { isActive, NAV_ITEMS } from "./nav-items";

/** Tablet and desktop navigation. */
export function Sidebar() {
  const pathname = usePathname();
  const { openNew } = useQuickAdd();

  return (
    <aside className="sticky top-0 hidden h-dvh w-[72px] shrink-0 flex-col gap-6 border-r border-border bg-card px-3 py-6 md:flex lg:w-60 lg:px-4">
      <div className="hidden px-2 lg:block">
        <BrandMark />
      </div>
      <button
        type="button"
        onClick={openNew}
        className="flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-3 text-[15px] font-semibold text-primary-foreground hover:bg-primary-hover"
      >
        <Plus aria-hidden="true" className="size-5" />
        <span className="sr-only lg:not-sr-only">Add expense</span>
        <kbd className="ml-auto hidden rounded bg-white/15 px-1.5 text-xs font-medium lg:inline">N</kbd>
      </button>
      <nav aria-label="Main" className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={item.label}
              className={cn(
                "flex h-11 items-center justify-center gap-3 rounded-[10px] px-3 text-[15px] lg:justify-start",
                active ? "bg-secondary font-semibold text-primary" : "font-medium text-[#374151] hover:bg-muted",
              )}
            >
              <Icon aria-hidden="true" className="size-5 shrink-0" />
              <span className="sr-only lg:not-sr-only">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
