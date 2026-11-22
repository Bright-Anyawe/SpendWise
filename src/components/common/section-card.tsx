import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** White card with a title row and an optional link (e.g. "See all"). */
export function SectionCard({
  title,
  meta,
  action,
  children,
  className,
}: {
  title: string;
  meta?: ReactNode;
  action?: { href: string; label: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-xl border border-border bg-card p-5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] leading-6 font-semibold">{title}</h2>
        {action ? (
          <Link href={action.href} className="-my-2 py-2 text-sm font-semibold text-primary hover:text-primary-hover">
            {action.label}
          </Link>
        ) : meta ? (
          <span className="text-[13px] text-muted-foreground">{meta}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}
