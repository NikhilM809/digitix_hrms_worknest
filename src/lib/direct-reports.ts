import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { prisma as hrmsPrisma } from "@hrms/lib/prisma";

export async function listDirectReportUsers(worknestUserId: string) {
  const manager = await prisma.user.findUnique({
    where: { id: worknestUserId },
    select: { email: true },
  });
  if (!manager?.email) return [];

  try {
    const hrmsManager = await hrmsPrisma.user.findFirst({
      where: { email: { equals: manager.email, mode: "insensitive" } },
      select: { id: true },
    });
    if (!hrmsManager) return [];
    const reports = await hrmsPrisma.user.findMany({
      where: { managerId: hrmsManager.id, status: "ACTIVE" },
      select: { email: true },
    });
    const emails = new Set(reports.map((person) => person.email.trim().toLowerCase()));
    if (emails.size === 0) return [];
    const users = await prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
    return users.filter((person) => emails.has(person.email.toLowerCase()));
  } catch (error) {
    console.error("Direct reports lookup failed", error);
    return [];
  }
}

/** Projects this manager owns, plus projects owned by or assigned to their direct reports. */
export async function managerProjectWhere(worknestUserId: string): Promise<Prisma.ProjectWhereInput> {
  const reports = await listDirectReportUsers(worknestUserId);
  const reportIds = reports.map((person) => person.id);
  return {
    OR: [
      { managerId: worknestUserId },
      ...(reportIds.length
        ? [
            { managerId: { in: reportIds } },
            { assignments: { some: { employeeId: { in: reportIds } } } },
          ]
        : []),
    ],
  };
}

export async function managerCanAccessProject(worknestUserId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...(await managerProjectWhere(worknestUserId)) },
    select: { id: true },
  });
  return Boolean(project);
}
