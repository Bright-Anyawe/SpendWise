"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuickAdd } from "@/components/quick-add/quick-add-provider";
import { cn } from "@/lib/utils";
import { isActive, NAV_ITEMS } from "./nav-items";

const [home, transactions, budgets, reports] = NAV_ITEMS;

function NavLink({ item, pathname }: { item: (typeof NAV_ITEMS)[number]; pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-1 py-1.5 text-[11px] leading-[14px]",
        active ? "font-semibold text-primary" : "font-medium text-muted-foreground",
      )}
    >
      <Icon aria-hidden="true" className="size-6" strokeWidth={active ? 2.25 : 2} />
      {item.label}
    </Link>
  );
}

/** Phone navigation: four destinations and the add button in the middle. Settings is on Home. */
export function BottomNav() {
  const pathname = usePathname();
  const { openNew } = useQuickAdd();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-start border-t border-border bg-card px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),12px)] md:hidden"
    >
      <NavLink item={home} pathname={pathname} />
      <NavLink item={transactions} pathname={pathname} />
      <button
        type="button"
        onClick={openNew}
        aria-label="Add expense"
        className="-mt-7 flex size-[60px] items-center justify-center justify-self-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-[0_8px_20px_rgba(6,95,70,0.3)] transition-transform active:scale-95"
      >
        <Plus aria-hidden="true" className="size-[26px]" />
      </button>
      <NavLink item={budgets} pathname={pathname} />
      <NavLink item={reports} pathname={pathname} />
    </nav>
  );
}
