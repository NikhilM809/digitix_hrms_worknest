export const DEFAULT_COMPANY_TIMEZONE = "Asia/Kolkata";

export const COMPANY_TIMEZONES = [
  { value: "Asia/Kolkata", label: "India (IST, Asia/Kolkata)" },
  { value: "Asia/Dubai", label: "Dubai (Asia/Dubai)" },
  { value: "Asia/Singapore", label: "Singapore (Asia/Singapore)" },
  { value: "Asia/Tokyo", label: "Tokyo (Asia/Tokyo)" },
  { value: "Europe/London", label: "London (Europe/London)" },
  { value: "Europe/Berlin", label: "Berlin (Europe/Berlin)" },
  { value: "America/New_York", label: "New York (America/New_York)" },
  { value: "America/Chicago", label: "Chicago (America/Chicago)" },
  { value: "America/Los_Angeles", label: "Los Angeles (America/Los_Angeles)" },
  { value: "Australia/Sydney", label: "Sydney (Australia/Sydney)" },
  { value: "UTC", label: "UTC" },
];

/** Minutes since local midnight in the given IANA timezone. */
export function getMinutesSinceMidnightInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function parseScheduleTimeToMinutes(timeStr: string) {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isLateForSchedule(
  now: Date,
  workStartTime: string,
  lateThresholdMinutes: number,
  timeZone: string
) {
  const nowMinutes = getMinutesSinceMidnightInZone(now, timeZone);
  const startMinutes = parseScheduleTimeToMinutes(workStartTime);
  return nowMinutes > startMinutes + lateThresholdMinutes;
}

/** Calendar date string (YYYY-MM-DD) in the company timezone. */
export function getDateStringInZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function startOfDayInZone(date: Date, timeZone: string) {
  const dateStr = getDateStringInZone(date, timeZone);
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** Attendance date key (YYYY-MM-DD) used as the start-of-day database record. */
export function attendanceDateFromString(dateStr: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export function formatDateInZone(
  date: Date | string,
  timeZone: string = DEFAULT_COMPANY_TIMEZONE
) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [year, month, day] = getDateStringInZone(new Date(date), timeZone).split("-");
  return `${day}-${months[Number(month) - 1]}-${year}`;
}

export function formatDateTimeInZone(
  date: Date | string,
  timeZone: string = DEFAULT_COMPANY_TIMEZONE
) {
  return `${formatDateInZone(date, timeZone)}, ${formatTimeInZone(date, timeZone)}`;
}

export function formatTimeInZone(
  date: Date | string,
  timeZone: string = DEFAULT_COMPANY_TIMEZONE
) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}
