import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { AddHoursForm } from "@/components/hours-form";
import { HourEntryEditor } from "@/components/hour-entry-editor";
import { AddWorkTypeForm } from "@/components/catalog-settings";
import { Card, PageHeader, Select, StatCard } from "@/components/ui";
import { workTypeLabel } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getActiveClients, getActiveWorkTypes } from "@/lib/catalog";
import { changesExceedInitialShare } from "@/lib/finance";
import { companyDateKey, companyToday, formatDate, formatHours, getActiveTimeZone } from "@/lib/format";
import { formatDateTimeInZone } from "@hrms/lib/timezone-utils";
import Link from "next/link";
import { APPROVED_HOUR_STATUSES, productivityHours, sumProductivity } from "@/lib/hour-approval";
import { STAFF_ROLES, isAdminLike, requireRole } from "@/lib/permissions";
import { listDirectReportUsers, managerProjectWhere } from "@/lib/direct-reports";

export default async function HoursPage({
  searchParams,
}: {
  searchParams: Promise<{
    employeeId?: string;
    projectId?: string;
    status?: string;
    client?: string;
    workType?: string;
    over?: string;
  }>;
}) {
  const user = await requireRole(...STAFF_ROLES);
  const { employeeId = "", projectId = "", status = "", client = "", workType = "", over = "" } = await searchParams;
  const teamOnly = !isAdminLike(user.role);
  const managerScope = teamOnly ? await managerProjectWhere(user.id) : {};
  const employees = teamOnly
    ? await listDirectReportUsers(user.id)
    : await prisma.user.findMany({
        where: { active: true, role: "EMPLOYEE" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
  const teamIds = employees.map((employee) => employee.id);
  const scopedEmployeeId =
    employeeId && (!teamOnly || teamIds.includes(employeeId)) ? employeeId : "";
  const overOnly = over === "1";
  const [projects, tasks, workTypes, clients] = await Promise.all([
    prisma.project.findMany({
      where: {
        status: { notIn: ["CLOSE", "CANCEL"] },
        ...managerScope,
      },
      orderBy: { name: "asc" },
    }),
    prisma.task.findMany({
      where: teamOnly ? { project: managerScope } : undefined,
    }),
    getActiveWorkTypes(),
    getActiveClients(),
  ]);
  const selectedWorkType = workTypes.some((item) => item.code === workType) ? workType : "";
  const overProjectIds = overOnly
    ? (
        await prisma.project.findMany({
          where: {
            ...managerScope,
            ...(client ? { clientName: client } : {}),
            ...(projectId ? { id: projectId } : {}),
          },
          select: {
            id: true,
            sellValue: true,
            billingChangesHours: true,
          },
        })
      )
        .filter((project) => changesExceedInitialShare(project.sellValue, project.billingChangesHours))
        .map((project) => project.id)
    : null;
  const entries = await prisma.timeEntry.findMany({
      where: {
        ...(scopedEmployeeId ? { employeeId: scopedEmployeeId } : {}),
        ...(selectedWorkType ? { workType: selectedWorkType } : {}),
        ...(status === "APPROVED" ? { status: { in: APPROVED_HOUR_STATUSES } } : {}),
        ...(overProjectIds
          ? { projectId: { in: overProjectIds } }
          : {
              ...(projectId ? { projectId } : {}),
              ...((teamOnly || client)
                ? {
                    project: {
                      ...managerScope,
                      ...(client ? { clientName: client } : {}),
                    },
                  }
                : {}),
            }),
      },
      include: { employee: true, project: true, task: true },
      orderBy: { date: "desc" },
    });
  const now = companyToday();
  const todayKey = companyDateKey(now);
  const todayEntries = entries.filter((entry) => companyDateKey(entry.date) === todayKey);
  const weekEntries = entries.filter(
    (entry) => entry.date >= startOfWeek(now, { weekStartsOn: 1 }) && entry.date <= endOfWeek(now, { weekStartsOn: 1 }),
  );
  const monthEntries = entries.filter((entry) => entry.date >= startOfMonth(now) && entry.date <= endOfMonth(now));
  const activity = await prisma.projectActivity.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    include: { actor: true, project: { select: { id: true, name: true, dxlCode: true } } },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  return (
    <div>
      <PageHeader
        title="Hours"
        description={
          teamOnly
            ? "Review hours for your team. Totals follow the filters below."
            : "Employee hours stay on productivity. Hours an admin updates, other than initial scripting, are added to billing at 20 each."
        }
      />
      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <Select name="employeeId" defaultValue={scopedEmployeeId} className="w-auto min-w-44">
          <option value="">All employees</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </Select>
        <Select name="client" defaultValue={client} className="w-auto min-w-40">
          <option value="">All clients</option>
          {clients.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}
            </option>
          ))}
        </Select>
        <Select name="projectId" defaultValue={projectId} className="w-auto min-w-48">
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
        <Select name="workType" defaultValue={selectedWorkType} className="w-auto min-w-44">
          <option value="">All work types</option>
          {workTypes.map((item) => (
            <option key={item.id} value={item.code}>
              {item.name}
            </option>
          ))}
        </Select>
        <Select name="over" defaultValue={overOnly ? "1" : ""} className="w-auto min-w-72">
          <option value="">All change levels</option>
          <option value="1">Changes over 20% of project value</option>
        </Select>
        <button className="h-10 rounded-lg border border-line px-4 text-sm">Filter</button>
      </form>
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Today" value={formatHours(sumProductivity(todayEntries))} />
        <StatCard label="This week" value={formatHours(sumProductivity(weekEntries))} />
        <StatCard label="This month" value={formatHours(sumProductivity(monthEntries))} />
        <StatCard label="Total" value={formatHours(sumProductivity(entries))} />
      </div>
      {user.role === "ADMIN" ? null : (
      <Card className="mb-6 p-6">
        <h2 className="mb-4 font-display text-xl">Log hours for someone</h2>
        <AddHoursForm
          projects={projects.map((p) => ({ id: p.id, name: p.name, code: p.code }))}
          tasks={tasks.map((t) => ({ id: t.id, name: t.name, projectId: t.projectId }))}
          workTypes={workTypes}
          employees={employees}
          canChooseEmployee
        />
      </Card>
      )}
      {user.role === "ADMIN" ? null : (
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
            <tr>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Employee</th>
              <th className="px-5 py-3">Project</th>
              <th className="px-5 py-3">Work type</th>
              <th className="px-5 py-3 text-right">Original hours</th>
              <th className="px-5 py-3 text-right">Billable hours</th>
              <th className="px-5 py-3">Notes</th>
              <th className="px-5 py-3">Update</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-t border-line">
                <td className="px-5 py-3">{formatDate(entry.date)}</td>
                <td className="px-5 py-3">{entry.employee.name}</td>
                <td className="px-5 py-3">{entry.project.name}</td>
                <td className="px-5 py-3">{workTypeLabel(entry.workType)}</td>
                <td className="px-5 py-3 text-right">{formatHours(productivityHours(entry))}</td>
                <td className="px-5 py-3 text-right">{formatHours(entry.hours)}</td>
                <td className="px-5 py-3">{entry.notes || "—"}</td>
                <td className="px-5 py-3">
                  <HourEntryEditor
                    entryId={entry.id}
                    hours={entry.hours}
                    notes={entry.notes}
                    canEdit={entry.employeeId === user.id || isAdminLike(user.role) || teamOnly}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      )}
      {isAdminLike(user.role) ? (
        <Card className="mt-6 p-6">
          <h2 className="mb-4 font-display text-xl">Add a work type</h2>
          <AddWorkTypeForm />
        </Card>
      ) : null}
      <Card className="mt-6 overflow-x-auto">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-xl">Last 7 days</h2>
        </div>
        {activity.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">No project status, hours, or billing changes in the last 7 days.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
              <tr>
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">Project</th>
                <th className="px-5 py-3">Who</th>
                <th className="px-5 py-3">Change</th>
                <th className="px-5 py-3">Detail</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-5 py-3">{formatDateTimeInZone(row.createdAt, getActiveTimeZone())}</td>
                  <td className="px-5 py-3">
                    <Link href={`/projects/${row.project.id}`} className="hover:text-teal">
                      {row.project.name}
                    </Link>
                    <p className="text-xs text-muted">{row.project.dxlCode || "—"}</p>
                  </td>
                  <td className="px-5 py-3">{row.actor.name}</td>
                  <td className="px-5 py-3">{row.action}</td>
                  <td className="px-5 py-3">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
