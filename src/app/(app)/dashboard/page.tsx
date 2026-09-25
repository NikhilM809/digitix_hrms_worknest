import Link from "next/link";
import { redirect } from "next/navigation";
import { isSameDay, startOfDay } from "date-fns";
import { CalendarDays, ClipboardCheck, Users, Cake } from "lucide-react";
import { FocusList, type FocusItem } from "@/components/focus-list";
import { TaskBadge } from "@/components/status";
import { Button, Card, Select, StatCard } from "@/components/ui";
import { PROJECT_STATUS_LABEL } from "@/lib/constants";
import { CurrencyTotals } from "@/components/currency-totals";
import { prisma } from "@/lib/db";
import { getSettings, sumHours } from "@/lib/data";
import { ensureCurrencies } from "@/lib/currency";
import { getActiveClients, getActiveWorkTypes } from "@/lib/catalog";
import { totalsByCurrency, remainingByCurrency } from "@/lib/finance";
import { formatDate, formatHours, isEtaSoon, isOverdue } from "@/lib/format";
import { auth } from "@/auth";
import { isAdminLike, requireUser } from "@/lib/permissions";
import { managerProjectWhere } from "@/lib/direct-reports";
import { peopleOverviewStats } from "@/lib/people-sync";
import { PeopleInsights, PeopleRecentActivity } from "@/components/people-insights";
import { AddHoursForm } from "@/components/hours-form";
import { HighlightStat, dayGreeting } from "@/components/studio-home";
import type { RoleName } from "@prisma/hrms-client";
import { isInactiveStatus } from "@/lib/project-status";
import { ProjectStatus, TaskStatus } from "@prisma/client";
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; tracking?: string; sort?: string; dir?: string; page?: string }>;
}) {
  const user = await requireUser();
  const session = await auth();
  const params = await searchParams;
  const client = String(params.client || "");
  const peopleLinked = Boolean(session?.user?.hrmsRole);
  const hrmsRole = session?.user?.hrmsRole;
  const hrmsUserId = session?.user?.hrmsUserId;
  if (user.role === "EMPLOYEE") redirect("/my-projects");
  if (isAdminLike(user.role)) {
    return <AdminDashboard client={client} peopleLinked={peopleLinked} name={user.name} />;
  }
  return (
    <ManagerDashboard
      userId={user.id}
      name={user.name}
      peopleLinked={peopleLinked}
      hrmsUserId={hrmsUserId}
      hrmsRole={hrmsRole}
    />
  );
}

async function AdminDashboard({
  client,
  peopleLinked,
  name,
}: {
  client: string;
  peopleLinked: boolean;
  name: string;
}) {
  const [settings, clients, projects, peopleStats] = await Promise.all([
    getSettings(),
    getActiveClients(),
    prisma.project.findMany({
      where: client ? { clientName: client } : {},
      include: { timeEntries: { select: { hours: true } }, invoices: true, currency: true },
    }),
    peopleOverviewStats(),
  ]);
  await ensureCurrencies();
  const byStatus = (status: ProjectStatus) => projects.filter((p) => p.status === status).length;
  const active = projects.filter((p) => !isInactiveStatus(p.status));
  const overdue = active.filter((p) => isOverdue(p.eta, p.status)).length;
  const dueSoon = active.filter((p) => isEtaSoon(p.eta, settings.etaWarningDays, p.status)).length;
  const actual = projects.reduce((sum, p) => sum + sumHours(p.timeEntries), 0);
  const estimated = projects.reduce((sum, p) => sum + p.estimatedHours, 0);
  const pendingBilling = projects.filter((p) => p.status !== "CANCEL");
  const valueTotals = totalsByCurrency(pendingBilling, (p) => p.sellValue);
  const billedTotals = totalsByCurrency(
    pendingBilling.flatMap((p) => p.invoices),
    (i) => i.amount,
  );
  const pendingTotals = remainingByCurrency(valueTotals, billedTotals);
  const firstName = name.split(" ")[0];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Hello {firstName}</p>
          <h1 className="font-display text-3xl tracking-tight text-ink">{dayGreeting()}</h1>
        </div>
        <Link href="/projects/new">
          <Button>New project</Button>
        </Link>
      </div>

      {peopleStats ? (
        <div className="mb-8 grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
          <div className="grid gap-3 sm:grid-cols-2">
            <HighlightStat
              label="Employees"
              value={`${peopleStats.presentToday}/${peopleStats.employees}`}
              icon={Users}
              tone="lilac"
            />
            <HighlightStat
              label="On leave"
              value={peopleStats.onLeaveToday}
              icon={CalendarDays}
              tone="peach"
            />
            <HighlightStat
              label="Pending approvals"
              value={peopleStats.pendingLeave}
              icon={ClipboardCheck}
              tone="mint"
            />
            <HighlightStat
              label="Upcoming events"
              value={peopleStats.upcomingEvents}
              icon={Cake}
              tone="sky"
            />
          </div>
          <PeopleRecentActivity />
        </div>
      ) : null}

      <h2 className="mb-3 font-display text-xl text-ink">Projects</h2>
      <form method="get" className="mb-4 flex max-w-sm gap-3">
        <Select name="client" defaultValue={client}>
          <option value="">All clients</option>
          {clients.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}
            </option>
          ))}
        </Select>
        <button className="h-10 rounded-lg border border-line px-4 text-sm">Filter</button>
      </form>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Total projects" value={projects.length} />
        <StatCard label="Active" value={active.length} />
        <StatCard label="Overdue" value={overdue} warn={overdue > 0} />
        <StatCard label="Due soon" value={dueSoon} warn={dueSoon > 0} />
        <StatCard label="Closed" value={byStatus("CLOSE")} />
        <StatCard label="Cancelled" value={byStatus("CANCEL")} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {(["BID", "NEED_TO_START", "SCRIPT_WIP", "CHANGES", "LIVE", "HOLD"] as ProjectStatus[]).map((status) => (
          <StatCard key={status} label={PROJECT_STATUS_LABEL[status]} value={byStatus(status)} />
        ))}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <CurrencyTotals title="Project value by currency" totals={valueTotals} />
        <CurrencyTotals title="Billed by currency" totals={billedTotals} />
        <CurrencyTotals title="Pending billing (value minus billed)" totals={pendingTotals} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <StatCard label="Estimated hours" value={formatHours(estimated)} />
        <StatCard label="Actual hours" value={formatHours(actual)} />
      </div>
      {peopleLinked ? <PeopleInsights /> : null}
    </div>
  );
}

function isTaskOverdue(due: Date | null, status: TaskStatus, now = new Date()) {
  return Boolean(due) && status !== "COMPLETED" && startOfDay(now) > startOfDay(due!);
}

function isDueToday(due: Date | null, status: TaskStatus, now = new Date()) {
  return Boolean(due) && status !== "COMPLETED" && isSameDay(due!, now);
}

async function ManagerDashboard({
  userId,
  name,
  peopleLinked,
  hrmsUserId,
  hrmsRole,
}: {
  userId: string;
  name: string;
  peopleLinked: boolean;
  hrmsUserId?: string;
  hrmsRole?: RoleName;
}) {
  const settings = await getSettings();
  const now = new Date();
  const scope = await managerProjectWhere(userId);
  const [projects, peopleStats, workTypes] = await Promise.all([
    prisma.project.findMany({
      where: { status: { notIn: ["CLOSE", "CANCEL"] }, ...scope },
      include: {
        timeEntries: { select: { hours: true, employeeId: true } },
        assignments: { include: { employee: true } },
        tasks: { include: { assignedEmployee: true } },
      },
      orderBy: { eta: "asc" },
    }),
    peopleLinked ? peopleOverviewStats({ hrmsUserId, hrmsRole }) : Promise.resolve(null),
    getActiveWorkTypes(),
  ]);
  const mine = projects;
  const overdue = mine.filter((p) => isOverdue(p.eta, p.status)).length;
  const dueSoon = mine.filter((p) => isEtaSoon(p.eta, settings.etaWarningDays, p.status)).length;
  const teamTasks = mine.flatMap((project) => project.tasks.map((task) => ({ task, project })));
  const openTeamTasks = teamTasks.filter(({ task }) => task.status !== "COMPLETED");
  const blocked = openTeamTasks.filter(({ task }) => task.status === "BLOCKED");
  const unassigned = openTeamTasks.filter(({ task }) => !task.assignedEmployeeId);
  const overdueTasks = openTeamTasks.filter(({ task }) => isTaskOverdue(task.dueDate, task.status, now));
  const dueToday = openTeamTasks.filter(({ task }) => isDueToday(task.dueDate, task.status, now));
  const inProgress = openTeamTasks.filter(({ task }) => task.status === "IN_PROGRESS");

  const attention: FocusItem[] = [];
  const seen = new Set<string>();
  const pushAttention = (item: FocusItem) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    attention.push(item);
  };

  for (const project of mine.filter((project) => isOverdue(project.eta, project.status))) {
    pushAttention({
      id: `project-${project.id}`,
      href: `/projects/${project.id}`,
      title: project.name,
      meta: `Project overdue · ETA ${formatDate(project.eta)}`,
      tone: "danger",
    });
  }
  for (const { task, project } of overdueTasks) {
    pushAttention({
      id: `task-${task.id}`,
      href: `/projects/${project.id}?tab=tasks`,
      title: task.name,
      meta: `Overdue on ${project.name} · due ${formatDate(task.dueDate)}`,
      status: task.status,
      tone: "danger",
    });
  }
  for (const { task, project } of blocked) {
    pushAttention({
      id: `task-${task.id}`,
      href: `/projects/${project.id}?tab=tasks`,
      title: task.name,
      meta: `Blocked on ${project.name}${task.assignedEmployee ? ` · ${task.assignedEmployee.name}` : ""}`,
      status: task.status,
      tone: "gold",
    });
  }
  for (const { task, project } of unassigned) {
    pushAttention({
      id: `task-${task.id}`,
      href: `/projects/${project.id}?tab=tasks`,
      title: task.name,
      meta: `Unassigned on ${project.name}`,
      status: task.status,
    });
  }
  attention.splice(8);

  const todayWork = [...dueToday, ...inProgress.filter((row) => !dueToday.includes(row))].slice(0, 10);

  const teamIds = [...new Set(mine.flatMap((project) => project.assignments.map((row) => row.employeeId)))];
  const employees = teamIds.length
    ? await prisma.user.findMany({
        where: { role: "EMPLOYEE", active: true, id: { in: teamIds } },
      })
    : [];
  const workload = employees.map((employee) => {
    const assigned = mine.filter((p) => p.assignments.some((a) => a.employeeId === employee.id));
    const actual = assigned.reduce(
      (sum, p) => sum + p.timeEntries.filter((e) => e.employeeId === employee.id).reduce((s, e) => s + e.hours, 0),
      0,
    );
    const nextTask = openTeamTasks.find(({ task }) => task.assignedEmployeeId === employee.id);
    return {
      employee,
      assigned: assigned.length,
      actual,
      estimated: assigned.reduce((sum, p) => sum + p.estimatedHours, 0),
      next: nextTask ? `${nextTask.task.name} · ${nextTask.project.name}` : "No open task",
    };
  });

  const firstName = name.split(" ")[0];
  const timesheetProjects = mine.map((project) => ({
    id: project.id,
    name: project.name,
    code: project.code,
  }));
  const timesheetTasks = mine.flatMap((project) =>
    project.tasks.map((task) => ({ id: task.id, name: task.name, projectId: project.id })),
  );

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-muted">Hello {firstName}</p>
        <h1 className="font-display text-3xl tracking-tight text-ink">{dayGreeting()}</h1>
      </div>

      <div className="mb-8 grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        {peopleStats ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <HighlightStat
              label="Team members"
              value={peopleStats.employees}
              icon={Users}
              tone="lilac"
            />
            <HighlightStat
              label="On leave"
              value={peopleStats.onLeaveToday}
              icon={CalendarDays}
              tone="peach"
            />
            <HighlightStat
              label="Pending approvals"
              value={peopleStats.pendingLeave}
              icon={ClipboardCheck}
              tone="mint"
            />
            <HighlightStat
              label="Upcoming events"
              value={peopleStats.upcomingEvents}
              icon={Cake}
              tone="sky"
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Your projects" value={mine.length} />
            <StatCard label="Due today" value={dueToday.length} />
            <StatCard label="Blocked" value={blocked.length} warn={blocked.length > 0} />
            <StatCard label="Overdue" value={overdue + overdueTasks.length} warn={overdue + overdueTasks.length > 0} />
          </div>
        )}
        {peopleLinked ? <PeopleRecentActivity /> : <div />}
      </div>

      {peopleStats?.latestLeave ? (
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="font-display text-xl text-ink">Team leave</h2>
            <div className="mt-4 flex items-start gap-4">
              <div className="rounded-2xl bg-[#F8D7E8] px-4 py-3 text-center dark:bg-[#4A2A38]">
                <p className="font-display text-2xl text-ink">
                  {peopleStats.latestLeave.fromDate.getDate()}
                </p>
                <p className="text-xs uppercase text-muted">
                  {peopleStats.latestLeave.fromDate.toLocaleString("en-IN", { month: "short" })}
                </p>
              </div>
              <div>
                <p className="font-medium text-ink">{peopleStats.latestLeave.name}</p>
                <p className="text-xs text-muted">Type: {peopleStats.latestLeave.type}</p>
                <p className="mt-2 text-sm text-muted">{peopleStats.latestLeave.reason}</p>
              </div>
            </div>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Present today" value={peopleStats.presentToday} />
            <StatCard label="Leave pending" value={peopleStats.pendingLeave} warn={peopleStats.pendingLeave > 0} />
            <StatCard label="Due today" value={dueToday.length} />
            <StatCard
              label="Overdue"
              value={overdue + overdueTasks.length}
              warn={overdue + overdueTasks.length > 0}
            />
          </div>
        </div>
      ) : null}

      {peopleLinked ? <PeopleInsights /> : null}

      <h2 className="mt-8 mb-3 font-display text-xl text-ink">Projects</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Your projects" value={mine.length} hint={`${projects.length} active in the studio`} />
        <StatCard label="Due today" value={dueToday.length} />
        <StatCard label="Blocked" value={blocked.length} warn={blocked.length > 0} />
        <StatCard label="Unassigned" value={unassigned.length} warn={unassigned.length > 0} />
        <StatCard
          label="Overdue"
          value={overdue + overdueTasks.length}
          warn={overdue + overdueTasks.length > 0}
          hint={dueSoon ? `${dueSoon} due soon` : undefined}
        />
      </div>
      <Card className="mt-6 p-5">
        <h2 className="mb-4 font-display text-xl text-ink">Time sheet</h2>
        <AddHoursForm
          projects={timesheetProjects}
          tasks={timesheetTasks}
          workTypes={workTypes}
        />
      </Card>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <FocusList
          title="Needs attention"
          empty="No overdue, blocked, or unassigned work on your projects."
          items={attention}
        />
        <Card>
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-xl">Team: do this today</h2>
          </div>
          {todayWork.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted">
              No tasks due today or in progress. Assign work from a project.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {todayWork.map(({ task, project }) => (
                <li key={task.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="font-medium">{task.name}</p>
                    <p className="text-xs text-muted">
                      {project.name} · {task.assignedEmployee?.name ?? "Unassigned"}
                      {task.dueDate ? ` · due ${formatDate(task.dueDate)}` : ""}
                    </p>
                  </div>
                  <TaskBadge status={task.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-xl">Team workload</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-black/5 text-left text-xs uppercase tracking-wide text-muted dark:bg-white/5">
            <tr>
              <th className="px-5 py-3">Employee</th>
              <th className="px-5 py-3">Next task</th>
              <th className="px-5 py-3 text-right">Projects</th>
              <th className="px-5 py-3 text-right">Hours</th>
            </tr>
          </thead>
          <tbody>
            {workload.map((row) => (
              <tr key={row.employee.id} className="border-t border-line">
                <td className="px-5 py-3">{row.employee.name}</td>
                <td className="px-5 py-3 text-muted">{row.next}</td>
                <td className="px-5 py-3 text-right">{row.assigned}</td>
                <td className="px-5 py-3 text-right">
                  {formatHours(row.actual)} / {formatHours(row.estimated)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

