"use client";

import { useEffect } from "react";
import { markNotificationsRead } from "@/server/actions/notifications";

/** Marks the inbox as read once it has been shown. */
export function MarkNotificationsRead({ unread }: { unread: number }) {
  useEffect(() => {
    if (unread > 0) void markNotificationsRead().catch(() => undefined);
  }, [unread]);
  return null;
}
