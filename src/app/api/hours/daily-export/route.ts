import { NextResponse } from "next/server";
import { format, parseISO } from "date-fns";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/data";
import { buildDailyHoursWorkbook } from "@/lib/daily-hours-excel";
import { isTrackingStatus } from "@/lib/hour-approval";
import { TRACKING_STATUS_LABEL } from "@/lib/constants";
import { managerProjectWhere } from "@/lib/direct-reports";
import { STAFF_ROLES, isAdminLike, requireApiRole } from "@/lib/permissions";

function parseDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = parseISO(value);
  const start = new Date(`${value}T00:00:00`);
  const end = new Date(`${value}T23:59:59.999`);
  if (Number.isNaN(parsed.getTime()) || Number.isNaN(start.getTime())) return null;
  return { parsed, start, end };
}

export async function GET(request: Request) {
  const authz = await requireApiRole(...STAFF_ROLES);
  if (!authz.ok) return authz.response;

  const url = new URL(request.url);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const fromValue = url.searchParams.get("from") || url.searchParams.get("date") || today;
  const toValue = url.searchParams.get("to") || fromValue;
  const from = parseDay(fromValue);
  const to = parseDay(toValue);
  if (!from || !to) {
    return NextResponse.json({ error: "Choose a valid start and end date." }, { status: 400 });
  }
  if (from.start > to.end) {
    return NextResponse.json({ error: "Start date must be on or before the end date." }, { status: 400 });
  }
  const tracking = url.searchParams.get("tracking") || "";
  const trackingStatus = isTrackingStatus(tracking) ? tracking : undefined;
  const teamOnly = !isAdminLike(authz.user.role);
  const managerScope = teamOnly ? await managerProjectWhere(authz.user.id) : {};

  const entries = await prisma.timeEntry.findMany({
    where: {
      date: { gte: from.start, lte: to.end },
      project: {
        ...managerScope,
        ...(trackingStatus ? { trackingStatus } : {}),
      },
    },
    include: {
      employee: { select: { name: true } },
      editedBy: { select: { name: true } },
      project: { include: { manager: { select: { name: true } } } },
    },
    orderBy: [{ project: { name: "asc" } }, { employee: { name: "asc" } }],
  });

  const sameDay = fromValue === toValue;
  const dateLabel = sameDay
    ? format(from.parsed, "dd MMM yyyy")
    : `${format(from.parsed, "dd MMM yyyy")} – ${format(to.parsed, "dd MMM yyyy")}`;
  const settings = await getSettings();
  const bytes = await buildDailyHoursWorkbook({
    companyName: settings.companyName,
    dateLabel,
    exportedBy: authz.user.name,
    statusLabel: trackingStatus ? TRACKING_STATUS_LABEL[trackingStatus] : "All statuses",
    rows: entries.map((entry) => ({
      date: entry.date,
      employeeName: entry.employee.name,
      clientName: entry.project.clientName,
      projectName: entry.project.name,
      projectCode: entry.project.code,
      managerName: entry.project.manager.name,
      trackingStatus: entry.project.trackingStatus,
      workType: entry.workType,
      hours: entry.hours,
      originalHours: entry.originalHours,
      status: entry.status,
      notes: entry.notes,
      editedByName: entry.editedBy?.name ?? null,
      editedAt: entry.editedAt,
      updatedAt: entry.updatedAt,
    })),
  });

  const filename = `hours-${fromValue}${sameDay ? "" : `-to-${toValue}`}${trackingStatus ? `-${trackingStatus.toLowerCase()}` : ""}.xlsx`;
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
