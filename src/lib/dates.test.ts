import { describe, expect, it } from "vitest";
import { isValidTimeZone, timeInTimeZone, todayInTimeZone } from "./dates";

const NOON_UTC = new Date("2026-11-19T12:00:00Z");

describe("todayInTimeZone", () => {
  it("returns the calendar date in the given zone", () => {
    expect(todayInTimeZone("Africa/Accra", NOON_UTC)).toBe("2026-11-19");
    expect(todayInTimeZone("Pacific/Auckland", NOON_UTC)).toBe("2026-11-20");
    expect(todayInTimeZone("America/Los_Angeles", new Date("2026-11-19T05:00:00Z"))).toBe("2026-11-18");
  });
});

describe("timeInTimeZone", () => {
  it("returns 24-hour HH:mm in the zone", () => {
    expect(timeInTimeZone("Africa/Accra", NOON_UTC)).toBe("12:00");
    expect(timeInTimeZone("Europe/London", new Date("2026-07-01T11:30:00Z"))).toBe("12:30");
    expect(timeInTimeZone("Africa/Accra", new Date("2026-11-19T00:05:00Z"))).toBe("00:05");
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA zones and rejects junk", () => {
    expect(isValidTimeZone("Africa/Accra")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("addDays", () => {
  it("adds calendar days across month and year ends", async () => {
    const { addDays } = await import("./dates");
    expect(addDays("2026-11-16", 6)).toBe("2026-11-22");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
  });
});

describe("dayLabel", () => {
  it("names today and yesterday, otherwise weekday day month", async () => {
    const { dayLabel } = await import("./dates");
    expect(dayLabel("2026-11-19", "2026-11-19")).toBe("Today");
    expect(dayLabel("2026-11-18", "2026-11-19")).toBe("Yesterday");
    expect(dayLabel("2026-11-17", "2026-11-19")).toBe("Tue 17 Nov");
    expect(dayLabel("2025-12-31", "2026-11-19")).toBe("Wed 31 Dec 2025");
  });
});

describe("formatTime", () => {
  it("writes 24-hour database times as 12-hour clock times", async () => {
    const { formatTime } = await import("./dates");
    expect(formatTime("18:20:00")).toBe("6:20 pm");
    expect(formatTime("00:05")).toBe("12:05 am");
    expect(formatTime("12:30")).toBe("12:30 pm");
  });
});

describe("longDate and greeting", () => {
  it("writes the full weekday and month", async () => {
    const { longDate } = await import("./dates");
    expect(longDate("2026-11-19")).toBe("Thursday, 19 November");
  });

  it("greets by the time of day", async () => {
    const { greeting } = await import("./dates");
    expect(greeting("07:45")).toBe("Good morning");
    expect(greeting("12:00")).toBe("Good afternoon");
    expect(greeting("18:20")).toBe("Good evening");
    expect(greeting("02:00")).toBe("Good evening");
  });
});
