"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { updateProjectManager } from "@/actions/projects";
import { Select } from "@/components/ui";

export function ProjectManagerForm({
  projectId,
  managerId,
  managerName,
  managers,
}: {
  projectId: string;
  managerId: string;
  managerName: string;
  managers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const options = managers.some((manager) => manager.id === managerId)
    ? managers
    : [{ id: managerId, name: managerName }, ...managers];

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    if (next === managerId) return;
    const formData = new FormData();
    formData.set("managerId", next);
    start(async () => {
      const result = await updateProjectManager(projectId, formData);
      if (result?.error) {
        toast.error(result.error);
        event.target.value = managerId;
        return;
      }
      toast.success("Project manager updated.");
      router.refresh();
    });
  }

  return (
    <Select
      key={managerId}
      name="managerId"
      defaultValue={managerId}
      disabled={pending}
      onChange={onChange}
      aria-label="Project manager"
      className="h-9 min-w-[10rem]"
    >
      {options.map((manager) => (
        <option key={manager.id} value={manager.id}>
          {manager.name}
        </option>
      ))}
    </Select>
  );
}
