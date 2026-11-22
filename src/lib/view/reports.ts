import { addDays } from "@/lib/dates";
import type { DailyTotal } from "@/lib/types/database";
import type { ReportPeriod } from "@/server/data/reports";
import { type Bar, monthName, weekBars } from "./dashboard";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortRange(start: string, end: string): string {
  const [, sm, sd] = start.split("-").map(Number);
  const [, em, ed] = end.split("-").map(Number);
  return sm === em ? `${sd}–${ed} ${MONTHS_SHORT[sm - 1]}` : `${sd} ${MONTHS_SHORT[sm - 1]} – ${ed} ${MONTHS_SHORT[em - 1]}`;
}

function shiftMonth(firstOfMonth: string, months: number): string {
  const [y, m] = firstOfMonth.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 10);
}

/** Title for the period and the reference dates for the previous / next one (no next for the future). */
export function periodNav(period: ReportPeriod, start: string, end: string, today: string) {
  if (period === "month") {
    const next = shiftMonth(start, 1);
    return { label: `${monthName(start)} ${start.slice(0, 4)}`, prevRef: shiftMonth(start, -1), nextRef: next <= today ? next : null };
  }
  const next = addDays(start, 7);
  return { label: shortRange(start, end), prevRef: addDays(start, -7), nextRef: next <= today ? next : null };
}

/** Day bars for a week (weekday names) or a month (a few day numbers, plus today). */
export function dayBars(days: DailyTotal[], today: string, period: ReportPeriod): Bar[] {
  if (period === "week") return weekBars(days, today);
  return days.map((d) => {
    const dayNumber = Number(d.day.slice(8, 10));
    const kind = d.day < today ? "past" : d.day === today ? "today" : "future";
    return {
      key: d.day,
      label: [1, 8, 15, 22, 29].includes(dayNumber) || kind === "today" ? String(dayNumber) : "",
      value: d.total,
      kind,
    };
  });
}
