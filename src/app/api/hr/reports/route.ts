import { NextRequest } from "next/server";
import { prisma } from "@hrms/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@hrms/lib/api-utils";
import {
  accumulateUserPeriodHours,
  expandToMonthBounds,
  expandToWeekBounds,
  monthKeyInZone,
  resolveWorkingHours,
  weekKeyInZone,
} from "@hrms/lib/attendance-hours";
import { formatDateInZone, formatTimeInZone, getCompanyTimezone } from "@hrms/lib/company-timezone";

async function getManagerUserFilter(userId: string) {
  const team = await prisma.user.findMany({
    where: { managerId: userId },
    select: { id: true },
  });
  return { in: [userId, ...team.map((t) => t.id)] };
}

function paddedDateRange(from: string, to: string) {
  const start = new Date(from);
  start.setUTCDate(start.getUTCDate() - 31);
  const end = new Date(to);
  end.setUTCDate(end.getUTCDate() + 31);
  end.setUTCHours(23, 59, 59, 999);
  return { gte: start, lte: end };
}

export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth(["ADMIN", "MANAGER"]);
    if (error) return error;

    const { searchParams } = req.nextUrl;
    const type = searchParams.get("type") ?? "attendance";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const employeeId = searchParams.get("employeeId");
    const lateOnly = searchParams.get("late") === "true";

    const dateFilter =
      from && to
        ? {
            gte: new Date(from),
            lte: new Date(to),
          }
        : undefined;

    const managerUserFilter =
      user!.role === "MANAGER" ? await getManagerUserFilter(user!.id) : undefined;

    if (employeeId && managerUserFilter && !managerUserFilter.in.includes(employeeId)) {
      return apiSuccess([]);
    }

    const userIdFilter = employeeId
      ? employeeId
      : managerUserFilter
        ? managerUserFilter
        : undefined;

    switch (type) {
      case "attendance": {
        const timeZone = await getCompanyTimezone();
        const records = await prisma.attendance.findMany({
          where: {
            ...(from && to ? { date: paddedDateRange(from, to) } : {}),
            ...(userIdFilter ? { userId: userIdFilter } : {}),
            ...(lateOnly ? { isLate: true } : {}),
          },
          include: {
            user: {
              select: {
                employeeId: true,
                firstName: true,
                lastName: true,
                department: { select: { name: true } },
              },
            },
          },
          orderBy: { date: "desc" },
        });

        const { weekly, monthly } = accumulateUserPeriodHours(records, timeZone);
        const visible = dateFilter
          ? records.filter((r) => r.date >= dateFilter.gte && r.date <= dateFilter.lte)
          : records;
        const rows = visible.slice(0, 500);

        return apiSuccess(
          rows.map((r) => ({
            date: formatDateInZone(r.date, timeZone),
            employeeId: r.user.employeeId,
            employeeName: `${r.user.firstName} ${r.user.lastName}`,
            department: r.user.department?.name ?? "-",
            status: r.status,
            checkIn: r.checkIn ? formatTimeInZone(r.checkIn, timeZone) : "-",
            checkOut: r.checkOut ? formatTimeInZone(r.checkOut, timeZone) : "-",
            workingHours: resolveWorkingHours(
              r.date,
              r.checkIn,
              r.checkOut,
              r.workingHours,
              timeZone,
            ),
            weeklyHours:
              weekly.get(`${r.userId}:${weekKeyInZone(r.date, timeZone)}`) ?? 0,
            monthlyHours:
              monthly.get(`${r.userId}:${monthKeyInZone(r.date, timeZone)}`) ?? 0,
            isLate: r.isLate,
            lateReason: r.lateReason?.trim() || "",
          }))
        );
      }

      case "leave": {
        const timeZone = await getCompanyTimezone();
        const records = await prisma.leaveRequest.findMany({
          where: {
            ...(userIdFilter ? { userId: userIdFilter } : {}),
            ...(dateFilter
              ? {
                  fromDate: { lte: dateFilter.lte },
                  toDate: { gte: dateFilter.gte },
                }
              : {}),
          },
          include: {
            user: {
              select: {
                employeeId: true,
                firstName: true,
                lastName: true,
                department: { select: { name: true } },
              },
            },
            leaveType: { select: { name: true, code: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 500,
        });

        return apiSuccess(
          records.map((r) => ({
            employeeId: r.user.employeeId,
            employeeName: `${r.user.firstName} ${r.user.lastName}`,
            department: r.user.department?.name ?? "-",
            leaveType: r.leaveType.name,
            fromDate: formatDateInZone(r.fromDate, timeZone),
            toDate: formatDateInZone(r.toDate, timeZone),
            totalDays: r.totalDays,
            status: r.status,
            reason: r.reason,
          }))
        );
      }

      case "employee": {
        const where =
          employeeId
            ? { id: employeeId }
            : user!.role === "MANAGER"
              ? { OR: [{ managerId: user!.id }, { id: user!.id }] }
              : {};

        const records = await prisma.user.findMany({
          where,
          include: {
            department: { select: { name: true } },
            designation: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        });

        const timeZone = await getCompanyTimezone();
        const reference = to ? new Date(to) : new Date();
        const weekKey = weekKeyInZone(reference, timeZone);
        const monthKey = monthKeyInZone(reference, timeZone);
        const weekBounds = expandToWeekBounds(weekKey);
        const monthBounds = expandToMonthBounds(monthKey);
        const aggStart =
          weekBounds.start < monthBounds.start ? weekBounds.start : monthBounds.start;
        const aggEnd = new Date(
          Math.max(weekBounds.end.getTime(), monthBounds.end.getTime()),
        );
        aggEnd.setUTCHours(23, 59, 59, 999);

        const attendance = await prisma.attendance.findMany({
          where: {
            userId: { in: records.map((r) => r.id) },
            date: { gte: aggStart, lte: aggEnd },
          },
          select: {
            userId: true,
            date: true,
            checkIn: true,
            checkOut: true,
            workingHours: true,
          },
        });
        const { weekly, monthly } = accumulateUserPeriodHours(attendance, timeZone);

        return apiSuccess(
          records.map((r) => ({
            employeeId: r.employeeId,
            name: `${r.firstName} ${r.lastName}`,
            email: r.email,
            role: r.role,
            status: r.status,
            employmentType: r.employmentType,
            department: r.department?.name ?? "-",
            designation: r.designation?.name ?? "-",
            joiningDate: formatDateInZone(r.joiningDate, timeZone),
            weeklyHours: weekly.get(`${r.id}:${weekKey}`) ?? 0,
            monthlyHours: monthly.get(`${r.id}:${monthKey}`) ?? 0,
          }))
        );
      }

      case "department": {
        const timeZone = await getCompanyTimezone();
        if (user!.role === "MANAGER") {
          const teamUsers = await prisma.user.findMany({
            where: { OR: [{ managerId: user!.id }, { id: user!.id }], status: "ACTIVE" },
            select: { departmentId: true },
          });
          const deptIds = [...new Set(teamUsers.map((u) => u.departmentId).filter(Boolean))] as string[];

          const records = await prisma.department.findMany({
            where: { id: { in: deptIds } },
            include: {
              _count: { select: { employees: true } },
              employees: { where: { status: "ACTIVE" }, select: { id: true } },
            },
            orderBy: { name: "asc" },
          });

          return apiSuccess(
            records.map((r) => ({
              name: r.name,
              description: r.description ?? "-",
              totalEmployees: r._count.employees,
              activeEmployees: r.employees.length,
              isActive: r.isActive,
              createdAt: formatDateInZone(r.createdAt, timeZone),
            }))
          );
        }

        const records = await prisma.department.findMany({
          include: {
            _count: { select: { employees: true } },
            employees: {
              where: { status: "ACTIVE" },
              select: { id: true },
            },
          },
          orderBy: { name: "asc" },
        });

        return apiSuccess(
          records.map((r) => ({
            name: r.name,
            description: r.description ?? "-",
            totalEmployees: r._count.employees,
            activeEmployees: r.employees.length,
            isActive: r.isActive,
            createdAt: formatDateInZone(r.createdAt, timeZone),
          }))
        );
      }

      default:
        return apiError("Invalid report type", 400);
    }
  } catch (err) {
    console.error("Reports error:", err);
    return apiError("Failed to generate report", 500);
  }
}
