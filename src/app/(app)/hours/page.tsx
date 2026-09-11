import { reviewHours } from "@/actions/hours";
import { AddHoursForm } from "@/components/hours-form";
import { AddWorkTypeForm } from "@/components/catalog-settings";
import { Button, Card, PageHeader, Select } from "@/components/ui";
import { HOUR_STATUS_LABEL, workTypeLabel } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getActiveClients, getActiveWorkTypes } from "@/lib/catalog";
import { formatDate, formatHours } from "@/lib/format";
import { STAFF_ROLES, isAdminLike, requireRole } from "@/lib/permissions";
import { listAssignablePeople, listManagedTeamPeople } from "@/lib/people-sync";

export default async function HoursPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string; projectId?: string; status?: string; client?: string }>;
}) {
  const user = await requireRole(...STAFF_ROLES);
  const { employeeId = "", projectId = "", status = "", client = "" } = await searchParams;
  const teamOnly = !isAdminLike(user.role);
  const employees = teamOnly
    ? await listManagedTeamPeople(user.id)
    : await listAssignablePeople({ role: "EMPLOYEE" });
  const teamIds = employees.map((employee) => employee.id);
  const scopedEmployeeId =
    employeeId && (!teamOnly || teamIds.includes(employeeId)) ? employeeId : "";
  const [entries, projects, tasks, workTypes, clients] = await Promise.all([
    prisma.timeEntry.findMany({
      where: {
        ...(scopedEmployeeId
          ? { employeeId: scopedEmployeeId }
          : teamOnly
            ? { employeeId: { in: teamIds.length ? teamIds : ["__none__"] } }
            : {}),
        ...(projectId ? { projectId } : {}),
        ...(status ? { status: status as "SUBMITTED" } : {}),
        ...((teamOnly || client)
          ? {
              project: {
                ...(teamOnly ? { managerId: user.id } : {}),
                ...(client ? { clientName: client } : {}),
              },
            }
          : {}),
      },
      include: { employee: true, project: true, task: true },
      orderBy: { date: "desc" },
      take: 200,
    }),
    prisma.project.findMany({
      where: {
        status: { notIn: ["CLOSE", "CANCEL"] },
        ...(teamOnly ? { managerId: user.id } : {}),
      },
      orderBy: { name: "asc" },
    }),
    prisma.task.findMany({
      where: teamOnly ? { project: { managerId: user.id } } : undefined,
    }),
    getActiveWorkTypes(),
    getActiveClients(),
  ]);

  return (
    <div>
      <PageHeader
        title="Hours"
        description={
          teamOnly
            ? "Review hours for your team only."
            : "Employee enters hours. Manager reviews. Admin can see all."
        }
      />
      <form className="mb-4 grid gap-3 md:grid-cols-5">
        <Select name="employeeId" defaultValue={scopedEmployeeId}>
          <option value="">All employees</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </Select>
        <Select name="client" defaultValue={client}>
          <option value="">All clients</option>
          {clients.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}
            </option>
          ))}
        </Select>
        <Select name="projectId" defaultValue={projectId}>
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={status}>
          <option value="">All statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="REVIEWED">Reviewed</option>
        </Select>
        <button className="h-10 rounded-lg border border-line px-4 text-sm">Filter</button>
      </form>
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
      {isAdminLike(user.role) ? (
        <Card className="mb-6 p-6">
          <h2 className="mb-4 font-display text-xl">Add a work type</h2>
          <AddWorkTypeForm />
        </Card>
      ) : null}
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
            <tr>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Employee</th>
              <th className="px-5 py-3">Project</th>
              <th className="px-5 py-3">Work type</th>
              <th className="px-5 py-3 text-right">Hours</th>
              <th className="px-5 py-3">Notes</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-t border-line">
                <td className="px-5 py-3">{formatDate(entry.date)}</td>
                <td className="px-5 py-3">{entry.employee.name}</td>
                <td className="px-5 py-3">{entry.project.name}</td>
                <td className="px-5 py-3">{workTypeLabel(entry.workType)}</td>
                <td className="px-5 py-3 text-right">{formatHours(entry.hours)}</td>
                <td className="px-5 py-3">{entry.notes || "—"}</td>
                <td className="px-5 py-3">
                  {entry.status === "REVIEWED" ? (
                    HOUR_STATUS_LABEL.REVIEWED
                  ) : (
                    <form action={reviewHours.bind(null, entry.id)}>
                      <Button size="sm" variant="outline">
                        Review
                      </Button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
