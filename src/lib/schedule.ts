export type Frequency = "daily" | "weekly" | "monthly";

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function computeNextRun(freq: Frequency, timeOfDay: string, dayOfWeek: number, dayOfMonth: number, from: Date = new Date()): Date {
  const [hh, mm] = (timeOfDay || "08:00").split(":").map((n) => parseInt(n, 10) || 0);
  const d = new Date(from.getTime());
  d.setSeconds(0, 0);
  d.setHours(hh, mm);
  if (freq === "daily") {
    if (d <= from) d.setDate(d.getDate() + 1);
    return d;
  }
  if (freq === "weekly") {
    const diff = (((dayOfWeek - d.getDay()) % 7) + 7) % 7;
    d.setDate(d.getDate() + diff);
    if (d <= from) d.setDate(d.getDate() + 7);
    return d;
  }
  const dom = Math.min(Math.max(1, dayOfMonth || 1), 28);
  d.setDate(dom);
  if (d <= from) {
    d.setMonth(d.getMonth() + 1);
    d.setDate(dom);
  }
  return d;
}

export function describeSchedule(freq: Frequency, timeOfDay: string, dayOfWeek: number, dayOfMonth: number): string {
  if (freq === "daily") return `Every day at ${timeOfDay}`;
  if (freq === "weekly") return `Every ${WEEKDAYS[dayOfWeek] ?? "Monday"} at ${timeOfDay}`;
  return `Monthly on day ${dayOfMonth} at ${timeOfDay}`;
}
