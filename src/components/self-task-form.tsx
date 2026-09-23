"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { createOwnTask } from "@/actions/tasks";
import { Button, Field, Input, Select } from "@/components/ui";

export function SelfTaskForm({
  projects,
  workTypes,
}: {
  projects: { id: string; name: string; code: string }[];
  workTypes: { code: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onSubmit(formData: FormData) {
    start(async () => {
      const result = await createOwnTask(formData);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(formData.get("hours") ? "Task added and hours logged." : "Task added.");
      router.refresh();
    });
  }

  if (projects.length === 0 || workTypes.length === 0) {
    return <p className="text-sm text-muted">Open projects and work types are needed before you can add a task.</p>;
  }

  return (
    <form action={onSubmit} className="flex flex-nowrap items-end gap-3 overflow-x-auto">
      <Field label="Project" className="w-72 shrink-0">
        <Select name="projectId" required defaultValue={projects[0]?.id}>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.code} · {project.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Work type" className="w-52 shrink-0">
        <Select name="workType" required defaultValue={workTypes[0]?.code}>
          {workTypes.map((workType) => (
            <option key={workType.code} value={workType.code}>
              {workType.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Hours" className="w-28 shrink-0">
        <Input name="hours" type="number" min="0.5" max="24" step="0.5" placeholder="Optional" />
      </Field>
      <Button type="submit" disabled={pending} className="shrink-0">
        {pending ? "Adding..." : "Add task"}
      </Button>
    </form>
  );
}
