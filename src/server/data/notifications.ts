import { one, type Queryable } from "@/lib/db/queryable";
import type { NotificationKind } from "@/lib/types/database";

export interface InboxNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  url: string;
  read_at: string | null;
  created_at: string;
}

/** Signed-in person (RLS): their latest notifications, newest first. */
export async function listNotifications(db: Queryable, limit = 50): Promise<InboxNotification[]> {
  const { rows } = await db.query<InboxNotification>(
    `select id, kind, title, body, coalesce(data ->> 'url', '/') as url, read_at, created_at
       from public.notifications
      order by created_at desc
      limit $1`,
    [limit],
  );
  return rows;
}

export async function unreadNotificationCount(db: Queryable): Promise<number> {
  const row = await one<{ n: number }>(db, "select count(*)::int as n from public.notifications where read_at is null");
  return Number(row?.n ?? 0);
}

export async function markAllNotificationsRead(db: Queryable): Promise<number> {
  const { rows } = await db.query<{ id: string }>("update public.notifications set read_at = now() where read_at is null returning id");
  return rows.length;
}
