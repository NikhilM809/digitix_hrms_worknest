import Link from "next/link";
import { Role } from "@prisma/client";
import { AddProjectHours } from "@/components/add-project-hours";
import { TrackingStatusForm } from "@/components/tracking-status-form";
import { Card, EmptyState, PageHeader, Select } from "@/components/ui";
import { PAGE_SIZE, TRACKING_STATUS_LABEL, TRACKING_STATUS_ORDER } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getActiveWorkTypes } from "@/lib/catalog";
import { formatDate, formatHours } from "@/lib/format";
import { isTrackingStatus } from "@/lib/hour-approval";
import type { SessionUser } from "@/lib/permissions";
import { managerProjectWhere } from "@/lib/direct-reports";
import { withVisibleProjects } from "@/lib/project-access";
import { cn } from "@/lib/utils";

function listHref(
  basePath: string,
  current: { tracking: string; sort: string; dir: string; page?: number },
  patch: Partial<{ tracking: string; sort: string; dir: string; page: number }>,
) {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  if (next.tracking) params.set("tracking", next.tracking);
  if (next.sort === "status") {
    params.set("sort", "status");
    params.set("dir", next.dir === "desc" ? "desc" : "asc");
  }
  if (next.page && next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export async function ProjectTrackingList({
  user,
  basePath,
  tracking,
  sort,
  dir,
  page = 1,
  title = "Projects",
  description = "Every project. Update the status, log hours, and sort by status.",
}: {
  user: SessionUser;
  basePath: string;
  tracking: string;
  sort: string;
  dir: "asc" | "desc";
  page?: number;
  title?: string;
  description?: string;
}) {
  const trackingStatus = isTrackingStatus(tracking) ? tracking : "";
  const sortByStatus = sort === "status";
  const currentPage = Math.max(1, page);
  const managerScope = user.role === Role.MANAGER ? await managerProjectWhere(user.id) : {};
  const filters = [
    ...(trackingStatus ? [{ trackingStatus }] : []),
    ...(Object.keys(managerScope).length ? [managerScope] : []),
  ];
  const where = withVisibleProjects(user.role, filters.length ? { AND: filters } : {});
  const [total, projects, workTypes, hourGroups] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      include: {
        manager: { select: { name: true } },
      },
      orderBy: sortByStatus ? { trackingStatus: dir } : { eta: "asc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    getActiveWorkTypes(),
    prisma.timeEntry.groupBy({
      by: ["projectId"],
      _sum: { originalHours: true, hours: true },
    }),
  ]);
  const hoursByProject = new Map(
    hourGroups.map((row) => [row.projectId, row._sum.originalHours || row._sum.hours || 0]),
  );
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const workTypeOptions = workTypes.map((item) => ({ code: item.code, name: item.name }));
  const nextDir = sortByStatus && dir === "asc" ? "desc" : "asc";
  const statusHref = listHref(basePath, { tracking: trackingStatus, sort, dir, page: currentPage }, { sort: "status", dir: nextDir, page: 1 });
  const clearHref = listHref(basePath, { tracking: "", sort, dir, page: currentPage }, { tracking: "", page: 1 });

  return (
    <div>
      <PageHeader title={title} description={description} />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        {sortByStatus ? <input type="hidden" name="sort" value="status" /> : null}
        {sortByStatus ? <input type="hidden" name="dir" value={dir} /> : null}
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Project status</span>
          <Select name="tracking" defaultValue={trackingStatus} className="min-w-[12rem]">
            <option value="">All statuses</option>
            {TRACKING_STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {TRACKING_STATUS_LABEL[status]}
              </option>
            ))}
          </Select>
        </label>
        <button className="h-10 rounded-lg border border-line px-4 text-sm">Apply filter</button>
        {trackingStatus ? (
          <Link href={clearHref} className="text-sm text-teal">
            Clear filter
          </Link>
        ) : null}
      </form>
      <Card className="overflow-x-auto">
        {projects.length === 0 ? (
          <EmptyState title="No projects" description="Nothing matches this status." />
        ) : (
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-black/5 text-left text-xs uppercase tracking-wide text-muted dark:bg-white/5">
              <tr>
                <th className="px-5 py-3">Client name</th>
                <th className="px-5 py-3">Project name</th>
                <th className="px-5 py-3">Manager</th>
                <th className="px-5 py-3">
                  <Link href={statusHref} className="inline-flex items-center gap-1 hover:text-ink">
                    Status
                    <span aria-hidden="true">{sortByStatus ? (dir === "asc" ? "↑" : "↓") : "↕"}</span>
                  </Link>
                </th>
                <th className="px-5 py-3">ETA</th>
                <th className="px-5 py-3 text-right">Actual hours</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-t border-line">
                  <td className="px-5 py-3">{project.clientName}</td>
                  <td className="px-5 py-3">
                    <p className="font-medium">{project.name}</p>
                    <p className="text-xs text-muted">{project.code}</p>
                  </td>
                  <td className="px-5 py-3">{project.manager.name}</td>
                  <td className="px-5 py-3">
                    <TrackingStatusForm projectId={project.id} status={project.trackingStatus} />
                  </td>
                  <td className="px-5 py-3">{formatDate(project.eta)}</td>
                  <td className={cn("px-5 py-3 text-right")}>{formatHours(hoursByProject.get(project.id) ?? 0)}</td>
                  <td className="px-5 py-3">
                    <AddProjectHours
                      projectId={project.id}
                      projectName={project.name}
                      workTypes={workTypeOptions}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {pages > 1 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: pages }, (_, index) => index + 1).map((n) => (
            <Link
              key={n}
              href={listHref(
                basePath,
                { tracking: trackingStatus, sort, dir, page: n },
                { sort: sortByStatus ? "status" : "", page: n },
              )}
              className={cn("rounded-lg px-3 py-1 text-sm", n === currentPage ? "bg-navy text-white" : "bg-black/5")}
            >
              {n}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
