"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { ProjectStatus } from "@prisma/client";
import { updateProjectStatus } from "@/actions/projects";
import { Select } from "@/components/ui";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_ORDER } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { statusesAvailable } from "@/lib/project-status";

export function ProjectStatusForm({
  projectId,
  status,
  changedByName,
  changedAt,
  resumeFrom = null,
  compact = false,
  unrestricted = false,
}: {
  projectId: string;
  status: ProjectStatus;
  changedByName?: string | null;
  changedAt?: Date | string | null;
  resumeFrom?: ProjectStatus | null;
  compact?: boolean;
  unrestricted?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const options = unrestricted ? PROJECT_STATUS_ORDER : statusesAvailable(status, resumeFrom);

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as ProjectStatus;
    if (next === status) return;
    const formData = new FormData();
    formData.set("status", next);
    start(async () => {
      const result = await updateProjectStatus(projectId, formData);
      if (result?.error) {
        toast.error(result.error);
        event.target.value = status;
        return;
      }
      toast.success("Project status updated.");
      router.refresh();
    });
  }

  return (
    <div className={compact ? "grid gap-1" : "grid gap-1.5"}>
      <Select key={status} name="status" defaultValue={status} disabled={pending} onChange={onChange} className={compact ? "h-9 min-w-[10rem]" : undefined}>
        {options.map((value) => (
          <option key={value} value={value}>
            {PROJECT_STATUS_LABEL[value]}
          </option>
        ))}
      </Select>
      <p className="text-[11px] text-muted">
        {changedByName && changedAt
          ? `Last changed by ${changedByName} on ${formatDate(changedAt)}`
          : "Not changed yet"}
      </p>
    </div>
  );
}
