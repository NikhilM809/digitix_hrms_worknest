import { DEFAULT_COMPANY_TIMEZONE } from "@hrms/lib/timezone-utils";

export { DEFAULT_COMPANY_TIMEZONE } from "@hrms/lib/timezone-utils";
export {
  getMinutesSinceMidnightInZone,
  parseScheduleTimeToMinutes,
  isLateForSchedule,
  getDateStringInZone,
  startOfDayInZone,
  attendanceDateFromString,
  formatDateTimeInZone,
  formatTimeInZone,
} from "@hrms/lib/timezone-utils";

export async function getCompanyTimezone() {
  return DEFAULT_COMPANY_TIMEZONE;
}
