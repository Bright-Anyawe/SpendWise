import { z } from "zod";
import { currencySchema, timeZoneSchema, weekStartSchema } from "./profile";

export const profileSettingsSchema = z.object({
  displayName: z.string().trim().min(1, { error: "Tell us what to call you" }).max(60, { error: "Use 60 characters or fewer" }),
  currency: currencySchema,
  timezone: timeZoneSchema,
  weekStartsOn: weekStartSchema,
});

export type ProfileSettingsInput = z.infer<typeof profileSettingsSchema>;

export const notificationPreferencesSchema = z.object({
  dailyReminderEnabled: z.boolean(),
  /** Local time, on a 15-minute step ("20:00", "21:45"). */
  reminderTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):(00|15|30|45)$/, { error: "Choose a time on the quarter hour" }),
  eveningReviewEnabled: z.boolean(),
  weeklySummaryEnabled: z.boolean(),
  monthlySummaryEnabled: z.boolean(),
  budgetAlertsEnabled: z.boolean(),
});

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: "Enter your current password" }),
    newPassword: z.string().min(8, { error: "Use at least 8 characters" }).max(72, { error: "Use 72 characters or fewer" }),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], error: "The passwords don't match" });

export const deleteAccountSchema = z.object({
  password: z.string().min(1, { error: "Enter your password to confirm" }),
  confirm: z.literal("DELETE", { error: "Type DELETE to confirm" }),
});
