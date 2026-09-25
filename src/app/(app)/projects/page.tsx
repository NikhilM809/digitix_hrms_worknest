import Link from "next/link";
import { ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/data";
import { companyDateKey, formatDate, formatHours, formatMoney } from "@/lib/format";
import { PAGE_SIZE, PROJECT_STATUS_LABEL, PROJECT_STATUS_ORDER } from "@/lib/constants";
import { PROJECT_MANAGER_ROLES, STAFF_ROLES, canCreateProject, canSeeFinance, requireRole } from "@/lib/permissions";
import { listDirectReportUsers, managerProjectWhere } from "@/lib/direct-reports";
import { withVisibleProjects } from "@/lib/project-access";
import { holdResumeStatuses } from "@/lib/hold-resume";
import { listAssignablePeople } from "@/lib/people-sync";
import { getActiveClients, getActiveWorkTypes } from "@/lib/catalog";
import { sumProductivity } from "@/lib/hour-approval";
import { AlertPills } from "@/components/status";
import { ProjectManagerForm } from "@/components/project-manager-form";
import { ProjectStatusForm } from "@/components/project-status-form";
import { AddProjectHours } from "@/components/add-project-hours";
import { Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

const TABS = ["ALL", ...PROJECT_STATUS_ORDER] as const;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(...STAFF_ROLES);
  const params = await searchParams;
  const tab = String(params.status || "ALL").toUpperCase();
  const q = String(params.q || "").trim();
  const client = String(params.client || "");
  const managerId = String(params.managerId || "");
  const employeeId = String(params.employeeId || "");
  const exportDate = companyDateKey(new Date());
  const page = Math.max(1, Number(params.page || 1));
  const finance = canSeeFinance(user.role);
  const settings = await getSettings();

  const managerScope = user.role === "MANAGER" ? await managerProjectWhere(user.id) : {};
  const where = withVisibleProjects(user.role, {
    AND: [
      {
        ...(tab !== "ALL" && tab !== "CLOSE" && tab !== "CANCEL" ? { status: tab as ProjectStatus } : {}),
        ...(tab === "ALL" ? { status: { notIn: ["CLOSE" as const, "CANCEL" as const] } } : {}),
        ...(tab === "CLOSE" ? { status: "CLOSE" as const } : {}),
        ...(tab === "CANCEL" ? { status: "CANCEL" as const } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { code: { contains: q } },
                { clientName: { contains: q } },
              ],
            }
          : {}),
        ...(client ? { clientName: client } : {}),
        ...(managerId ? { managerId } : {}),
        ...(employeeId ? { assignments: { some: { employeeId } } } : {}),
      },
      ...(Object.keys(managerScope).length ? [managerScope] : []),
    ],
  });
  const [total, projects, managers, employees, clients, workTypes] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      include: {
        manager: true,
        currency: true,
        statusChangedBy: true,
        timeEntries: { select: { hours: true, originalHours: true } },
        invoices: finance ? true : false,
      },
      orderBy: { eta: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    listAssignablePeople({ role: { in: PROJECT_MANAGER_ROLES } }),
    user.role === "MANAGER" ? listDirectReportUsers(user.id) : listAssignablePeople({ role: "EMPLOYEE" }),
    getActiveClients(),
    getActiveWorkTypes(),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const workTypeOptions = workTypes.map((item) => ({ code: item.code, name: item.name }));
  const holdResume = await holdResumeStatuses(projects.filter((project) => project.status === "HOLD").map((project) => project.id));

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Track every job from bid to close."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <form action="/api/hours/daily-export" className="flex flex-wrap items-center gap-2">
              <Input name="from" type="date" defaultValue={exportDate} aria-label="Start date" className="w-40" />
              <Input name="to" type="date" defaultValue={exportDate} aria-label="End date" className="w-40" />
              <Button type="submit" variant="outline">
                Export hours
              </Button>
            </form>
            {canCreateProject(user.role) ? (
              <Link href="/projects/new">
                <Button>New project</Button>
              </Link>
            ) : null}
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((item) => {
          const tabParams = new URLSearchParams();
          if (item !== "ALL") tabParams.set("status", item);
          if (client) tabParams.set("client", client);
          const href = tabParams.toString() ? `/projects?${tabParams.toString()}` : "/projects";
          const active = tab === item || (item === "ALL" && tab === "ALL");
          return (
            <Link
              key={item}
              href={href}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm",
                active ? "bg-navy text-white" : "bg-black/5 dark:bg-white/5",
              )}
            >
              {item === "ALL" ? "All" : PROJECT_STATUS_LABEL[item as ProjectStatus]}
            </Link>
          );
        })}
      </div>
      <form className="mb-4 grid gap-3 md:grid-cols-5">
        <Input name="q" placeholder="Search name, ID, client" defaultValue={q} />
        <Select name="client" defaultValue={client}>
          <option value="">All clients</option>
          {clients.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}
            </option>
          ))}
        </Select>
        <Select name="managerId" defaultValue={managerId}>
          <option value="">All managers</option>
          {managers.map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.name}
            </option>
          ))}
        </Select>
        <Select name="employeeId" defaultValue={employeeId}>
          <option value="">All employees</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>
      <Card className="overflow-x-auto">
        {projects.length === 0 ? (
          <EmptyState title="No projects" description="Nothing matches these filters." />
        ) : (
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-black/5 text-left text-xs uppercase tracking-wide text-muted dark:bg-white/5">
              <tr>
                <th className="px-5 py-3">Project</th>
                <th className="px-5 py-3">DXL Project ID</th>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Manager</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">ETA</th>
                {finance ? <th className="px-5 py-3 text-right">Project value</th> : null}
                <th className="px-5 py-3 text-right">Est. hours</th>
                <th className="px-5 py-3 text-right">Actual hours</th>
                <th className="px-5 py-3">Log hours</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const actual = sumProductivity(project.timeEntries);
                return (
                  <tr key={project.id} className="border-t border-line">
                    <td className="px-5 py-3">
                      <Link href={`/projects/${project.id}`} className="font-medium hover:text-teal">
                        {project.name}
                      </Link>
                      <p className="text-xs text-muted">{project.code}</p>
                      <div className="mt-1">
                        <AlertPills
                          eta={project.eta}
                          status={project.status}
                          actual={actual}
                          estimated={project.estimatedHours}
                          warningDays={settings.etaWarningDays}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-3">{project.dxlCode || "—"}</td>
                    <td className="px-5 py-3">{project.clientName}</td>
                    <td className="px-5 py-3">
                      {user.role === "ADMIN" ? (
                        <ProjectManagerForm
                          projectId={project.id}
                          managerId={project.managerId}
                          managerName={project.manager.name}
                          managers={managers.map((manager) => ({ id: manager.id, name: manager.name }))}
                        />
                      ) : (
                        project.manager.name
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <ProjectStatusForm
                        compact
                        unrestricted={user.role === "ADMIN"}
                        projectId={project.id}
                        status={project.status}
                        changedByName={project.statusChangedBy?.name}
                        changedAt={project.statusChangedAt}
                        resumeFrom={holdResume.get(project.id) ?? null}
                      />
                    </td>
                    <td className="px-5 py-3">{formatDate(project.eta)}</td>
                    {finance ? (
                      <td className="px-5 py-3 text-right">
                        {formatMoney(project.sellValue, project.currency?.code)}
                      </td>
                    ) : null}
                    <td className="px-5 py-3 text-right">{formatHours(project.estimatedHours)}</td>
                    <td className="px-5 py-3 text-right">{formatHours(actual)}</td>
                    <td className="px-5 py-3">
                      <AddProjectHours projectId={project.id} projectName={project.name} workTypes={workTypeOptions} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      {pages > 1 ? (
        <div className="mt-4 flex gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={`?${new URLSearchParams({ ...(tab !== "ALL" ? { status: tab } : {}), q, client, managerId, employeeId, page: String(n) }).toString()}`}
              className={cn("rounded-lg px-3 py-1 text-sm", n === page ? "bg-navy text-white" : "bg-black/5")}
            >
              {n}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
