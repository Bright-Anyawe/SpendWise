function partsInZone(tz: string, now: Date, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, ...options }).formatToParts(now);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** The calendar date ("YYYY-MM-DD") it is right now in the given IANA time zone. */
export function todayInTimeZone(tz: string, now: Date = new Date()): string {
  const p = partsInZone(tz, now, { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${p.year}-${p.month}-${p.day}`;
}

/** The 24-hour wall-clock time ("HH:mm") it is right now in the given IANA time zone. */
export function timeInTimeZone(tz: string, now: Date = new Date()): string {
  const p = partsInZone(tz, now, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${p.hour}:${p.minute}`;
}

export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date written as YYYY-MM-DD (rejects 2026-02-30). */
export function isIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

/** Adds (or subtracts) whole calendar days to a YYYY-MM-DD date. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Today", "Yesterday", "Tue 17 Nov", or "Wed 31 Dec 2025" for another year. */
export function dayLabel(day: string, today: string): string {
  if (day === today) return "Today";
  if (day === addDays(today, -1)) return "Yesterday";
  const [y, m, d] = day.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const base = `${weekday} ${d} ${MONTHS[m - 1]}`;
  return day.slice(0, 4) === today.slice(0, 4) ? base : `${base} ${y}`;
}

/** "18:20:00" → "6:20 pm". */
export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "Thursday, 19 November". */
export function longDate(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${WEEKDAYS_LONG[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${d} ${MONTHS_LONG[m - 1]}`;
}

/** Greeting for a local "HH:mm" time. Late night counts as evening. */
export function greeting(time: string): string {
  const hour = Number(time.slice(0, 2));
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}
