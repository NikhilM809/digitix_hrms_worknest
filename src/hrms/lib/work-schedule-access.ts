import type { RoleName } from "@prisma/hrms-client";
import { prisma } from "@hrms/lib/prisma";
import { canManageWorkSchedules } from "@hrms/lib/permissions";

export async function canManageEmployeeWorkSchedule(
  role: RoleName,
  actorId: string,
  targetUserId: string
) {
  if (canManageWorkSchedules(role)) return true;

  if (role === "MANAGER") {
    const employee = await prisma.user.findFirst({
      where: { id: targetUserId, managerId: actorId, status: "ACTIVE" },
      select: { id: true },
    });
    return !!employee;
  }

  return false;
}
