"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { formatTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { NotificationPreferencesInput } from "@/schemas/settings";
import { saveNotificationPreferences } from "@/server/actions/settings";
import type { NotificationPreferences } from "@/server/data/settings";
import { PushSettings } from "./push-settings";

const TIMES = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);

export function NotificationSettings({ prefs }: { prefs: NotificationPreferences }) {
  const ids = useId();
  const [value, setValue] = useState<NotificationPreferencesInput>({
    dailyReminderEnabled: prefs.daily_reminder_enabled,
    reminderTime: prefs.reminder_time.slice(0, 5),
    eveningReviewEnabled: prefs.evening_review_enabled,
    weeklySummaryEnabled: prefs.weekly_summary_enabled,
    monthlySummaryEnabled: prefs.monthly_summary_enabled,
    budgetAlertsEnabled: prefs.budget_alerts_enabled,
  });
  const [, startTransition] = useTransition();

  // Saves each change straight away; puts it back if saving fails.
  function change(patch: Partial<NotificationPreferencesInput>) {
    const previous = value;
    const next = { ...value, ...patch };
    setValue(next);
    startTransition(async () => {
      const result = await saveNotificationPreferences(next);
      if (!result.ok) {
        setValue(previous);
        toast.error(result.error);
      }
    });
  }

  const rows: { key: keyof NotificationPreferencesInput; label: string; hint: string }[] = [
    { key: "dailyReminderEnabled", label: "Daily reminder", hint: "Only if you haven’t logged anything that day" },
    { key: "eveningReviewEnabled", label: "Evening review", hint: "Your day’s total at reminder time, when you’ve logged something" },
    { key: "weeklySummaryEnabled", label: "Weekly summary", hint: "At the start of each week, 9:00 am" },
    { key: "monthlySummaryEnabled", label: "Monthly summary", hint: "On the 1st, 9:00 am" },
    { key: "budgetAlertsEnabled", label: "Budget alerts", hint: "At a budget’s warning point, and if you go over" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <PushSettings />
      <ul className="rounded-xl border border-border bg-card px-4">
        {rows.map((row, i) => (
          <li key={row.key} className={cn(i > 0 && "border-t border-muted")}>
            <div className="flex min-h-16 items-center gap-3 py-2.5">
              <label htmlFor={`${ids}-${row.key}`} className="flex flex-1 flex-col">
                <span className="text-[15px] font-medium">{row.label}</span>
                <span className="text-[13px] text-muted-foreground">{row.hint}</span>
              </label>
              <Switch id={`${ids}-${row.key}`} checked={value[row.key] as boolean} onCheckedChange={(checked) => change({ [row.key]: checked })} />
            </div>
            {row.key === "dailyReminderEnabled" && value.dailyReminderEnabled ? (
              <div className="flex items-center justify-between gap-3 border-t border-muted py-2.5 pl-4">
                <label htmlFor={`${ids}-time`} className="flex flex-col">
                  <span className="text-[15px] font-medium">Reminder time</span>
                  <span className="text-[13px] text-muted-foreground">In your time zone</span>
                </label>
                <select
                  id={`${ids}-time`}
                  value={value.reminderTime}
                  onChange={(e) => change({ reminderTime: e.target.value })}
                  className="h-10 rounded-md border border-input bg-card px-3 text-base font-semibold"
                >
                  {TIMES.map((t) => (
                    <option key={t} value={t}>
                      {formatTime(t)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="px-1 text-xs text-muted-foreground">
        We’ll never send more than 3 notifications a day, and never a reminder and a review on the same evening.
      </p>
    </div>
  );
}
