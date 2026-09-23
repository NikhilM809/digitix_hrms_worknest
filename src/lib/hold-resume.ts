import { ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isProjectStatus } from "@/lib/project-status";

/** Status a held project should resume from: the status it had when it was put on hold. */
export async function holdResumeStatuses(projectIds: string[]) {
  const unique = [...new Set(projectIds)];
  const resume = new Map<string, ProjectStatus>();
  if (!unique.length) return resume;
  const changes = await prisma.projectStatusChange.findMany({
    where: { projectId: { in: unique }, toStatus: "HOLD" },
    orderBy: { changedAt: "desc" },
    select: { projectId: true, fromStatus: true },
  });
  for (const change of changes) {
    if (resume.has(change.projectId)) continue;
    if (isProjectStatus(change.fromStatus) && change.fromStatus !== "HOLD") {
      resume.set(change.projectId, change.fromStatus);
    }
  }
  return resume;
}
