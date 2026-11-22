import { describe, expect, it } from "vitest";
import { notificationPreferencesSchema, profileSettingsSchema } from "./settings";

describe("profileSettingsSchema", () => {
  it("accepts a name, currency, time zone and week start", () => {
    expect(profileSettingsSchema.parse({ displayName: " Ama ", currency: "GHS", timezone: "Africa/Accra", weekStartsOn: 1 })).toEqual({
      displayName: "Ama",
      currency: "GHS",
      timezone: "Africa/Accra",
      weekStartsOn: 1,
    });
  });

  it("rejects an empty name and unknown values", () => {
    expect(profileSettingsSchema.safeParse({ displayName: " ", currency: "GHS", timezone: "Africa/Accra", weekStartsOn: 1 }).success).toBe(false);
    expect(profileSettingsSchema.safeParse({ displayName: "Ama", currency: "XYZ", timezone: "Africa/Accra", weekStartsOn: 1 }).success).toBe(false);
  });
});

describe("notificationPreferencesSchema", () => {
  const valid = {
    dailyReminderEnabled: true,
    reminderTime: "20:00",
    eveningReviewEnabled: false,
    weeklySummaryEnabled: true,
    monthlySummaryEnabled: true,
    budgetAlertsEnabled: true,
  };

  it("accepts reminder times on a 15-minute step", () => {
    expect(notificationPreferencesSchema.parse({ ...valid, reminderTime: "21:45" }).reminderTime).toBe("21:45");
  });

  it("rejects times off the 15-minute steps and bad formats", () => {
    expect(notificationPreferencesSchema.safeParse({ ...valid, reminderTime: "20:10" }).success).toBe(false);
    expect(notificationPreferencesSchema.safeParse({ ...valid, reminderTime: "8pm" }).success).toBe(false);
  });
});
