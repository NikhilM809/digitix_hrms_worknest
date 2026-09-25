import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { AddHoursForm } from "@/components/hours-form";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { workTypeLabel } from "@/lib/constants";
import { productivityHours, sumProductivity } from "@/lib/hour-approval";
import { prisma } from "@/lib/db";
import { companyDateKey, companyToday, formatDate, formatHours } from "@/lib/format";
import { requireRole } from "@/lib/permissions";
import { getActiveWorkTypes } from "@/lib/catalog";

export default async function MyHoursPage() {
  const user = await requireRole("EMPLOYEE");
  const now = companyToday();
  const [entries, projects, tasks, workTypes] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { employeeId: user.id },
      include: { project: true, task: true },
      orderBy: { date: "desc" },
    }),
    prisma.project.findMany({
      where: { status: { notIn: ["CLOSE", "CANCEL"] } },
      orderBy: { name: "asc" },
    }),
    prisma.task.findMany({ where: { assignedEmployeeId: user.id } }),
    getActiveWorkTypes(),
  ]);
  const today = entries.filter((e) => companyDateKey(e.date) === companyDateKey(now));
  const week = entries.filter(
    (e) => e.date >= startOfWeek(now, { weekStartsOn: 1 }) && e.date <= endOfWeek(now, { weekStartsOn: 1 }),
  );
  const month = entries.filter((e) => e.date >= startOfMonth(now) && e.date <= endOfMonth(now));

  return (
    <div>
      <PageHeader title="My hours" description="Hours you entered. Admin changes to billable hours stay on the admin side." />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Today" value={formatHours(sumProductivity(today))} />
        <StatCard label="This week" value={formatHours(sumProductivity(week))} />
        <StatCard label="This month" value={formatHours(sumProductivity(month))} />
        <StatCard label="Total" value={formatHours(sumProductivity(entries))} />
      </div>
      <Card className="mb-6 p-6">
        <h2 className="mb-4 font-display text-xl">+ Add hours</h2>
        <AddHoursForm
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
            code: project.code,
          }))}
          tasks={tasks.map((t) => ({ id: t.id, name: t.name, projectId: t.projectId }))}
          workTypes={workTypes}
        />
      </Card>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
            <tr>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Project</th>
              <th className="px-5 py-3">Work type</th>
              <th className="px-5 py-3 text-right">Hours</th>
              <th className="px-5 py-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-t border-line">
                <td className="px-5 py-3">{formatDate(entry.date)}</td>
                <td className="px-5 py-3">{entry.project.name}</td>
                <td className="px-5 py-3">{workTypeLabel(entry.workType)}</td>
                <td className="px-5 py-3 text-right">{formatHours(productivityHours(entry))}</td>
                <td className="px-5 py-3">{entry.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
