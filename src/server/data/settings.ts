import { one, type Queryable } from "@/lib/db/queryable";
import type { NotificationPreferencesInput, ProfileSettingsInput } from "@/schemas/settings";

export interface NotificationPreferences {
  user_id: string;
  daily_reminder_enabled: boolean;
  reminder_time: string;
  evening_review_enabled: boolean;
  weekly_summary_enabled: boolean;
  monthly_summary_enabled: boolean;
  budget_alerts_enabled: boolean;
  updated_at: string;
}

export async function updateProfileSettings(db: Queryable, input: ProfileSettingsInput): Promise<void> {
  await db.query(
    `update public.profiles
        set display_name = $1, currency = $2, timezone = $3, week_starts_on = $4
      where id = (select app.current_user_id())`,
    [input.displayName, input.currency, input.timezone, input.weekStartsOn],
  );
}

export function getNotificationPreferences(db: Queryable): Promise<NotificationPreferences | null> {
  return one<NotificationPreferences>(
    db,
    "select * from public.notification_preferences where user_id = (select app.current_user_id())",
  );
}

export async function updateNotificationPreferences(db: Queryable, input: NotificationPreferencesInput): Promise<void> {
  await db.query(
    `update public.notification_preferences
        set daily_reminder_enabled = $1, reminder_time = $2::time, evening_review_enabled = $3,
            weekly_summary_enabled = $4, monthly_summary_enabled = $5, budget_alerts_enabled = $6
      where user_id = (select app.current_user_id())`,
    [
      input.dailyReminderEnabled,
      input.reminderTime,
      input.eveningReviewEnabled,
      input.weeklySummaryEnabled,
      input.monthlySummaryEnabled,
      input.budgetAlertsEnabled,
    ],
  );
}
