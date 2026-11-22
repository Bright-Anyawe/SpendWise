import { Bell } from "lucide-react";
import Link from "next/link";
import { getUnreadNotificationCount } from "@/server/queries";

/** The bell on Home, with the number of unread notifications. */
export async function NotificationBell() {
  return <BellLink count={await getUnreadNotificationCount()} />;
}

export function BellLink({ count }: { count: number }) {
  const label = count > 0 ? `Notifications, ${count} unread` : "Notifications";
  return (
    <Link
      href="/notifications"
      aria-label={label}
      title={label}
      className="relative flex size-11 items-center justify-center rounded-full border border-border bg-card hover:bg-muted"
    >
      <Bell aria-hidden="true" className="size-5" />
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-white tabular-nums"
        >
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}
