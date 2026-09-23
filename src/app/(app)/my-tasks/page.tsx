import { subDays } from "date-fns";
import { selfAssignTask } from "@/actions/tasks";
import { AssignedTaskForm } from "@/components/assigned-task-form";
import { SelfTaskForm } from "@/components/self-task-form";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { getActiveWorkTypes } from "@/lib/catalog";
import { TASK_STATUS_ORDER } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatDate, formatHours } from "@/lib/format";
import { sumProductivity } from "@/lib/hour-approval";
import { requireRole } from "@/lib/permissions";
import { visibleProjectsWhere } from "@/lib/project-access";

const TASK_VISIBLE_DAYS = 30;

export default async function MyTasksPage() {
  const user = await requireRole("EMPLOYEE", "MANAGER", "SENIOR_MANAGER");
  const cutoff = subDays(new Date(), TASK_VISIBLE_DAYS);
  const [mine, projects, workTypes] = await Promise.all([
    prisma.task.findMany({
      where: {
        assignedEmployeeId: user.id,
        createdAt: { gte: cutoff },
        project: visibleProjectsWhere(user.role),
      },
      include: { project: true, timeEntries: { select: { hours: true, originalHours: true, employeeId: true } } },
    }),
    prisma.project.findMany({
      where: { status: { notIn: ["CLOSE", "CANCEL"] } },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    getActiveWorkTypes(),
  ]);
  const tasks = [...mine].sort((a, b) => {
    const statusDelta = TASK_STATUS_ORDER.indexOf(a.status) - TASK_STATUS_ORDER.indexOf(b.status);
    if (statusDelta !== 0) return statusDelta;
    const aDue = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bDue = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return aDue - bDue;
  });
  const available =
    user.role === "EMPLOYEE"
      ? await prisma.task.findMany({
          where: {
            assignedEmployeeId: null,
            createdAt: { gte: cutoff },
            OR: [{ selfAssignEnabled: true }, { project: { selfAssignEnabled: true } }],
            project: {
              AND: [
                visibleProjectsWhere("EMPLOYEE"),
                {
                  OR: [{ assignments: { some: { employeeId: user.id } } }, { selfAssignEnabled: true }],
                  status: { notIn: ["CLOSE", "CANCEL"] },
                },
              ],
            },
          },
          include: { project: true },
        })
      : [];

  return (
    <div>
      <PageHeader
        title="My tasks"
        description="Not started tasks stay at the top. Hours you enter are logged on that project. Tasks leave this list 30 days after they were added."
      />
      {user.role === "EMPLOYEE" ? (
        <Card className="mb-6 p-6">
          <h2 className="mb-4 font-display text-xl">Add a task</h2>
          <SelfTaskForm
            projects={projects}
            workTypes={workTypes.map((item) => ({ code: item.code, name: item.name }))}
          />
        </Card>
      ) : null}
      {available.length > 0 ? (
        <Card className="mb-6 overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-xl">Available to self-assign</h2>
          </div>
          <div className="divide-y divide-line">
            {available.map((task) => (
              <div key={task.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div>
                  <p className="font-medium">{task.name}</p>
                  <p className="text-xs text-muted">{task.project.name}</p>
                </div>
                <form action={selfAssignTask.bind(null, task.id)}>
                  <Button size="sm">Assign to me</Button>
                </form>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
      <div className="grid gap-4">
        {tasks.length === 0 ? (
          <Card>
            <EmptyState title="No tasks" description="Assigned work from the last 30 days will appear here." />
          </Card>
        ) : (
          tasks.map((task) => {
            const logged = sumProductivity(task.timeEntries.filter((entry) => entry.employeeId === user.id));
            return (
              <Card key={task.id} className="p-5">
                <AssignedTaskForm
                  key={`${task.id}-${task.status}-${task.notes}-${logged}`}
                  taskId={task.id}
                  name={task.name}
                  projectName={task.project.name}
                  dueLabel={formatDate(task.dueDate)}
                  status={task.status}
                  notes={task.notes}
                  loggedLabel={logged > 0 ? `${formatHours(logged)} logged` : ""}
                />
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
