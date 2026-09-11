import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDate, formatHours } from "@/lib/format";
import { TASK_STATUS_LABEL } from "@/lib/constants";
import { STAFF_ROLES, isAdminLike, requireRole } from "@/lib/permissions";
import { syncActiveHrmsPeople } from "@/lib/people-sync";
import { TeamAssignForm } from "@/components/team-assign-form";
import { Card, PageHeader, Select } from "@/components/ui";
import { TaskBadge } from "@/components/status";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string; status?: string }>;
}) {
  const user = await requireRole(...STAFF_ROLES);
  const { employeeId = "", status = "" } = await searchParams;
  const managedOnly = !isAdminLike(user.role);

  await syncActiveHrmsPeople().catch((error) => console.error("People directory sync failed", error));

  const employees = await prisma.user.findMany({
    where: {
      role: "EMPLOYEE",
      active: true,
      ...(managedOnly
        ? { assignments: { some: { project: { managerId: user.id, status: { notIn: ["CLOSE", "CANCEL"] } } } } }
        : {}),
    },
    orderBy: { name: "asc" },
  });

  const projects = await prisma.project.findMany({
    where: {
      status: status ? (status as "SCRIPT_WIP") : { notIn: ["CLOSE", "CANCEL"] },
      ...(managedOnly ? { managerId: user.id } : {}),
      ...(employeeId ? { assignments: { some: { employeeId } } } : {}),
    },
    include: {
      assignments: true,
      timeEntries: true,
      tasks: {
        where: { status: { not: "COMPLETED" } },
        include: { assignedEmployee: true },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });

  const assignableProjects = await prisma.project.findMany({
    where: {
      status: { notIn: ["CLOSE", "CANCEL"] },
      ...(managedOnly ? { managerId: user.id } : {}),
    },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  const rows = employees
    .filter((employee) => !employeeId || employee.id === employeeId)
    .map((employee) => {
      const assigned = projects.filter((p) => p.assignments.some((a) => a.employeeId === employee.id));
      const actual = assigned.reduce(
        (sum, p) => sum + p.timeEntries.filter((e) => e.employeeId === employee.id).reduce((s, e) => s + e.hours, 0),
        0,
      );
      const currentTasks = assigned.flatMap((project) =>
        project.tasks
          .filter((task) => task.assignedEmployeeId === employee.id)
          .map((task) => ({ task, project })),
      );
      const current = currentTasks[0];
      return {
        employee,
        assigned: assigned.length,
        estimated: assigned.reduce((sum, p) => sum + p.estimatedHours, 0),
        actual,
        current,
      };
    });

  return (
    <div>
      <PageHeader
        title="My team"
        description={
          managedOnly
            ? "See current tasks on your projects and assign work when someone is free."
            : "See who is loaded and where hours are landing."
        }
      />
      <Card className="mb-6 p-6">
        <h2 className="mb-4 font-display text-xl">Assign a task</h2>
        <TeamAssignForm
          employees={employees}
          projects={assignableProjects.map((project) => ({
            id: project.id,
            name: project.name,
            code: project.code,
          }))}
        />
      </Card>
      <form className="mb-4 flex flex-wrap gap-3">
        <Select name="employeeId" defaultValue={employeeId}>
          <option value="">All employees</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={status}>
          <option value="">Active projects</option>
          <option value="SCRIPT_WIP">Script WIP</option>
          <option value="CHANGES">Changes</option>
          <option value="LIVE">Live</option>
        </Select>
        <button className="h-10 rounded-lg border border-line px-4 text-sm">Filter</button>
      </form>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
            <tr>
              <th className="px-5 py-3">Employee</th>
              <th className="px-5 py-3">Current task</th>
              <th className="px-5 py-3 text-right">Active projects</th>
              <th className="px-5 py-3 text-right">Estimated hours</th>
              <th className="px-5 py-3 text-right">Actual hours</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.employee.id} className="border-t border-line align-top">
                <td className="px-5 py-3">{row.employee.name}</td>
                <td className="px-5 py-3">
                  {row.current ? (
                    <div>
                      <Link href={`/projects/${row.current.project.id}?tab=tasks`} className="font-medium text-teal">
                        {row.current.task.name}
                      </Link>
                      <p className="text-xs text-muted">
                        {row.current.project.name}
                        {row.current.task.dueDate ? ` · due ${formatDate(row.current.task.dueDate)}` : ""}
                      </p>
                      <div className="mt-1">
                        <TaskBadge status={row.current.task.status} />
                        <span className="ml-2 text-xs text-muted">{TASK_STATUS_LABEL[row.current.task.status]}</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted">No current task</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">{row.assigned}</td>
                <td className="px-5 py-3 text-right">{formatHours(row.estimated)}</td>
                <td className="px-5 py-3 text-right">{formatHours(row.actual)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
