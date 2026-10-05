import { prisma } from "@hrms/lib/prisma";
import { requireAuth, apiSuccess } from "@hrms/lib/api-utils";
import { getWorkScheduleForUserOnDate } from "@hrms/lib/work-schedule";
import { autoCloseForgottenCheckouts } from "@hrms/lib/forgotten-checkout";
import {
  getCompanyTimezone,
  isLateForSchedule,
  startOfDayInZone,
} from "@hrms/lib/company-timezone";
import { repairAttendanceDatesOnce } from "@hrms/lib/repair-attendance-dates";

export async function GET() {
  const { error, user } = await requireAuth();
  if (error || !user) return error;

  const now = new Date();
  const timeZone = await getCompanyTimezone();
  await repairAttendanceDatesOnce();
  const today = startOfDayInZone(now, timeZone);
  await autoCloseForgottenCheckouts(user.id, now, timeZone, "saturday-preview");
  const schedule = await getWorkScheduleForUserOnDate(user.id, today);
  const isLateNow = isLateForSchedule(
    now,
    schedule.workStartTime,
    schedule.lateThreshold,
    timeZone
  );

  const existing = await prisma.attendance.findUnique({
    where: {
      userId_date: { userId: user.id, date: today },
    },
    select: { checkIn: true },
  });

  return apiSuccess({
    workStartTime: schedule.workStartTime,
    lateThreshold: schedule.lateThreshold,
    isLateNow,
    alreadyCheckedIn: !!existing?.checkIn,
  });
}
