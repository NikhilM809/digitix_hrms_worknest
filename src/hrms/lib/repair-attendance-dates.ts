import { prisma } from "@hrms/lib/prisma";
import {
  getCompanyTimezone,
  isLateForSchedule,
  startOfDayInZone,
} from "@hrms/lib/company-timezone";
import { getWorkScheduleForUserOnDate } from "@hrms/lib/work-schedule";

/**
 * Early-morning check-ins used to be stored on the UTC calendar day and marked
 * late against UTC shift times. Move those rows onto the company-timezone date
 * and clear a late mark when the shift grace says they were on time.
 */
export async function repairAttendanceDates() {
  const timeZone = await getCompanyTimezone();
  const rows = await prisma.attendance.findMany({
    where: { checkIn: { not: null } },
    select: {
      id: true,
      userId: true,
      date: true,
      checkIn: true,
      status: true,
      isLate: true,
    },
  });

  let moved = 0;
  let clearedLate = 0;

  for (const row of rows) {
    const checkIn = row.checkIn!;
    const correctDate = startOfDayInZone(checkIn, timeZone);
    if (row.date.getTime() === correctDate.getTime()) continue;

    const clash = await prisma.attendance.findUnique({
      where: { userId_date: { userId: row.userId, date: correctDate } },
      select: { id: true },
    });
    if (clash && clash.id !== row.id) continue;

    const schedule = await getWorkScheduleForUserOnDate(row.userId, correctDate);
    const shouldBeLate = isLateForSchedule(
      checkIn,
      schedule.workStartTime,
      schedule.lateThreshold,
      timeZone
    );
    const clearLate =
      !shouldBeLate && (row.status === "LATE" || row.status === "PRESENT");

    await prisma.attendance.update({
      where: { id: row.id },
      data: {
        date: correctDate,
        ...(clearLate ? { status: "PRESENT", isLate: false, lateReason: null } : {}),
      },
    });

    moved += 1;
    if (clearLate && (row.isLate || row.status === "LATE")) clearedLate += 1;
  }

  if (moved > 0) {
    console.log(
      `Repaired attendance dates in ${timeZone}: moved=${moved} clearedLate=${clearedLate}`
    );
  }
}

let repairPromise: Promise<void> | null = null;

export function repairAttendanceDatesOnce() {
  if (!repairPromise) {
    repairPromise = repairAttendanceDates().catch((error) => {
      repairPromise = null;
      console.error("Attendance date repair failed", error);
    });
  }
  return repairPromise;
}
