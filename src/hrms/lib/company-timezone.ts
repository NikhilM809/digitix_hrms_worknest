import { prisma } from "@hrms/lib/prisma";
import { DEFAULT_COMPANY_TIMEZONE } from "@hrms/lib/timezone-utils";

export { DEFAULT_COMPANY_TIMEZONE } from "@hrms/lib/timezone-utils";
export {
  getMinutesSinceMidnightInZone,
  parseScheduleTimeToMinutes,
  isLateForSchedule,
  getDateStringInZone,
  formatDateInZone,
  startOfDayInZone,
  attendanceDateFromString,
  formatDateTimeInZone,
  formatTimeInZone,
} from "@hrms/lib/timezone-utils";

export async function getCompanyTimezone() {
  try {
    const rows = await prisma.$queryRaw<Array<{ timezone: string }>>`
      SELECT "timezone" FROM "CompanySettings" LIMIT 1
    `;
    const timeZone = rows[0]?.timezone?.trim();
    if (timeZone && isValidTimeZone(timeZone)) return timeZone;
  } catch (error) {
    console.error("Company timezone lookup failed", error);
  }
  return DEFAULT_COMPANY_TIMEZONE;
}

export function isValidTimeZone(timeZone: string) {
  try {
    Intl.DateTimeFormat("en-IN", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}
