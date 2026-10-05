import { prisma } from "../src/hrms/lib/prisma";
import { repairAttendanceDates } from "../src/hrms/lib/repair-attendance-dates";

repairAttendanceDates()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
