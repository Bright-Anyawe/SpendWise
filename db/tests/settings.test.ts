import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getNotificationPreferences, updateNotificationPreferences, updateProfileSettings } from "../../src/server/data/settings";
import { createTestDb, type TestDb } from "./helpers/db";

let db: TestDb;
let ama: string;
let kofi: string;

beforeAll(async () => {
  db = await createTestDb({ appParsers: true });
  ama = await db.createUser({ displayName: "Ama" });
  kofi = await db.createUser({ displayName: "Kofi" });
});

afterAll(async () => {
  await db?.close();
});

describe("settings", () => {
  it("updates only the signed-in person's profile", async () => {
    await db.asUser(ama, (tx) => updateProfileSettings(tx, { displayName: "Ama M.", currency: "USD", timezone: "Europe/London", weekStartsOn: 0 }));
    const { rows } = await db.pg.query<{ id: string; display_name: string; currency: string }>(
      "select id, display_name, currency from public.profiles where id in ($1, $2) order by display_name",
      [ama, kofi],
    );
    expect(rows).toEqual([
      { id: ama, display_name: "Ama M.", currency: "USD" },
      { id: kofi, display_name: "Kofi", currency: "GHS" },
    ]);
  });

  it("reads and saves notification preferences", async () => {
    const before = await db.asUser(ama, (tx) => getNotificationPreferences(tx));
    expect(before).toMatchObject({ daily_reminder_enabled: true, reminder_time: "20:00:00", evening_review_enabled: false });

    await db.asUser(ama, (tx) =>
      updateNotificationPreferences(tx, {
        dailyReminderEnabled: false,
        reminderTime: "21:30",
        eveningReviewEnabled: true,
        weeklySummaryEnabled: false,
        monthlySummaryEnabled: true,
        budgetAlertsEnabled: false,
      }),
    );
    const after = await db.asUser(ama, (tx) => getNotificationPreferences(tx));
    expect(after).toMatchObject({
      daily_reminder_enabled: false,
      reminder_time: "21:30:00",
      evening_review_enabled: true,
      weekly_summary_enabled: false,
      budget_alerts_enabled: false,
    });
    const kofiPrefs = await db.asUser(kofi, (tx) => getNotificationPreferences(tx));
    expect(kofiPrefs?.reminder_time).toBe("20:00:00");
  });
});
