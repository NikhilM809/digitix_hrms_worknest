import { Role } from "@prisma/client";
import type { RoleName, UserStatus } from "@prisma/hrms-client";
import { prisma } from "@/lib/db";
import { prisma as hrmsPrisma } from "@hrms/lib/prisma";

/** Map directory roles to workspace access for projects and hours. */
export function worknestRoleFromHrms(role: RoleName): Role {
  if (role === "ADMIN") return Role.ADMIN;
  if (role === "HR") return Role.SENIOR_MANAGER;
  if (role === "MANAGER") return Role.MANAGER;
  return Role.EMPLOYEE;
}

type HrmsPerson = {
  email: string;
  firstName: string;
  lastName: string;
  role: RoleName;
  status: UserStatus;
  password: string;
};

export async function syncWorknestUserFromHrms(person: HrmsPerson) {
  const email = person.email.trim().toLowerCase();
  const name = `${person.firstName} ${person.lastName}`.trim() || email;
  const active = person.status === "ACTIVE";
  const role = worknestRoleFromHrms(person.role);

  return prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      password: person.password,
      role,
      active,
    },
    update: {
      name,
      password: person.password,
      active,
      role,
    },
  });
}

export async function deactivateWorknestUserByEmail(email: string) {
  const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!existing) return;
  await prisma.user.update({
    where: { id: existing.id },
    data: { active: false },
  });
}

let syncInFlight: Promise<void> | null = null;

export async function syncActiveHrmsPeople() {
  if (syncInFlight) return syncInFlight;
  syncInFlight = syncActiveHrmsPeopleOnce().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

async function syncActiveHrmsPeopleOnce() {
  const people = await hrmsPrisma.user.findMany({
    select: {
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      password: true,
    },
  });
  for (const person of people) {
    await syncWorknestUserFromHrms(person);
  }
}

export async function listAssignablePeople(where?: { role?: Role | { in: Role[] } }) {
  try {
    await syncActiveHrmsPeople();
  } catch (error) {
    console.error("People directory sync failed", error);
  }
  const users = await prisma.user.findMany({
    where: { active: true, ...where },
    orderBy: { name: "asc" },
  });

  try {
    const directory = await hrmsPrisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { email: true },
    });
    if (directory.length === 0) return users;
    const emails = new Set(directory.map((person) => person.email.trim().toLowerCase()));
    return users.filter((user) => emails.has(user.email.toLowerCase()));
  } catch {
    return users;
  }
}

export async function listManagedTeamPeople(managerId: string) {
  const assignments = await prisma.projectAssignment.findMany({
    where: {
      project: { managerId, status: { notIn: ["CLOSE", "CANCEL"] } },
    },
    select: { employeeId: true },
  });
  const ids = new Set([managerId, ...assignments.map((row) => row.employeeId)]);
  const people = await listAssignablePeople();
  return people.filter((person) => ids.has(person.id));
}

export type PeopleOverview = {
  employees: number;
  pendingLeave: number;
  presentToday: number;
  onLeaveToday: number;
  newJoiners: number;
  upcomingEvents: number;
  latestMembers: {
    id: string;
    name: string;
    title: string;
    avatar: string | null;
  }[];
  latestLeave: {
    name: string;
    type: string;
    fromDate: Date;
    reason: string;
  } | null;
};

export async function peopleOverviewStats(options?: {
  hrmsUserId?: string;
  hrmsRole?: RoleName;
}): Promise<PeopleOverview | null> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const in30Days = new Date(start);
  in30Days.setDate(in30Days.getDate() + 30);
  const role = options?.hrmsRole;
  const hrmsUserId = options?.hrmsUserId;

  try {
    const employeeWhere =
      role === "MANAGER" && hrmsUserId
        ? { status: "ACTIVE" as const, OR: [{ managerId: hrmsUserId }, { id: hrmsUserId }] }
        : role === "EMPLOYEE" && hrmsUserId
          ? { id: hrmsUserId }
          : { status: "ACTIVE" as const };

    const scoped = await hrmsPrisma.user.findMany({
      where: employeeWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true,
        dateOfBirth: true,
        joiningDate: true,
        designation: { select: { name: true } },
      },
      orderBy: { joiningDate: "desc" },
    });
    const ids = scoped.map((person) => person.id);
    if (ids.length === 0) {
      return {
        employees: 0,
        pendingLeave: 0,
        presentToday: 0,
        onLeaveToday: 0,
        newJoiners: 0,
        upcomingEvents: 0,
        latestMembers: [],
        latestLeave: null,
      };
    }

    const [pendingLeave, presentToday, onLeaveToday, recentLeave] = await Promise.all([
      hrmsPrisma.leaveRequest.count({
        where: { status: "PENDING", userId: { in: ids } },
      }),
      hrmsPrisma.attendance.count({
        where: {
          date: start,
          userId: { in: ids },
          status: { in: ["PRESENT", "LATE", "WORK_FROM_HOME", "HALF_DAY"] },
        },
      }),
      hrmsPrisma.leaveRequest.count({
        where: {
          userId: { in: ids },
          status: "APPROVED",
          fromDate: { lte: end },
          toDate: { gte: start },
        },
      }),
      hrmsPrisma.leaveRequest.findFirst({
        where: {
          userId: { in: ids },
          status: { in: ["APPROVED", "PENDING"] },
          toDate: { gte: start },
        },
        include: {
          user: { select: { firstName: true, lastName: true } },
          leaveType: { select: { name: true } },
        },
        orderBy: { fromDate: "asc" },
      }),
    ]);

    const upcomingEvents = scoped.filter((person) => {
      if (person.dateOfBirth) {
        const dob = new Date(person.dateOfBirth);
        const birthday = new Date(start.getFullYear(), dob.getMonth(), dob.getDate());
        if (birthday >= start && birthday <= in30Days) return true;
      }
      const joined = new Date(person.joiningDate);
      if (joined.getFullYear() === start.getFullYear()) return false;
      const anniversary = new Date(start.getFullYear(), joined.getMonth(), joined.getDate());
      return anniversary >= start && anniversary <= in30Days;
    }).length;

    return {
      employees: ids.length,
      pendingLeave,
      presentToday,
      onLeaveToday,
      newJoiners: scoped.filter((person) => person.joiningDate >= monthStart).length,
      upcomingEvents,
      latestMembers: scoped.slice(0, 5).map((person) => ({
        id: person.id,
        name: `${person.firstName} ${person.lastName}`.trim(),
        title: person.designation?.name ?? "Team member",
        avatar: person.avatar,
      })),
      latestLeave: recentLeave
        ? {
            name: `${recentLeave.user.firstName} ${recentLeave.user.lastName}`.trim(),
            type: recentLeave.leaveType.name,
            fromDate: recentLeave.fromDate,
            reason: recentLeave.reason,
          }
        : null,
    };
  } catch (error) {
    console.error("People overview failed", error);
    return null;
  }
}
