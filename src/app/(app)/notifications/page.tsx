import { BellRing, CalendarCheck, ChartColumn, MoonStar, TriangleAlert, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MarkNotificationsRead } from "@/components/notifications/mark-read";
import { dayLabel, formatTime, timeInTimeZone, todayInTimeZone } from "@/lib/dates";
import type { NotificationKind } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { requireOnboardedProfile } from "@/server/auth";
import { getNotifications } from "@/server/queries";

export const metadata: Metadata = { title: "Notifications" };

const ICONS: Record<NotificationKind, typeof BellRing> = {
  daily_reminder: BellRing,
  evening_review: MoonStar,
  weekly_summary: CalendarCheck,
  monthly_summary: ChartColumn,
  budget_warning: Wallet,
  budget_exceeded: TriangleAlert,
};

export default function NotificationsPage() {
  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-5 py-5 md:px-8 md:py-8">
      <h1 className="text-2xl font-semibold tracking-[-0.01em]">Notifications</h1>
      <Suspense fallback={<div aria-hidden="true" className="h-72 animate-pulse rounded-xl bg-muted" />}>
        <Inbox />
      </Suspense>
    </main>
  );
}

async function Inbox() {
  const { profile } = await requireOnboardedProfile();
  const items = await getNotifications();
  const today = todayInTimeZone(profile.timezone);
  const unread = items.filter((n) => !n.read_at).length;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-6 py-12 text-center">
        <BellRing aria-hidden="true" className="size-8 text-muted-foreground" />
        <p className="text-[15px] font-semibold">No notifications yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Reminders, summaries and budget alerts you turn on in{" "}
          <Link href="/settings#s-notifications" className="font-semibold text-primary underline-offset-2 hover:underline">
            Settings
          </Link>{" "}
          show up here.
        </p>
      </div>
    );
  }

  return (
    <>
      <MarkNotificationsRead unread={unread} />
      <ul className="overflow-hidden rounded-xl border border-border bg-card">
        {items.map((n, i) => {
          const Icon = ICONS[n.kind];
          const at = new Date(n.created_at);
          const warning = n.kind === "budget_exceeded";
          return (
            <li key={n.id} className={cn(i > 0 && "border-t border-muted")}>
              <Link href={n.url} className={cn("flex gap-3 px-4 py-3.5 hover:bg-muted/60", !n.read_at && "bg-secondary/50")}>
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                    warning ? "bg-danger-bg text-destructive" : "bg-secondary text-primary",
                  )}
                >
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-[15px] font-semibold">
                      {n.title}
                      {!n.read_at ? <span className="sr-only"> (new)</span> : null}
                    </span>
                    <time dateTime={n.created_at} className="shrink-0 text-xs text-muted-foreground">
                      {dayLabel(todayInTimeZone(profile.timezone, at), today)}, {formatTime(timeInTimeZone(profile.timezone, at))}
                    </time>
                  </span>
                  <span className="text-sm leading-5 text-muted-foreground">{n.body}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
