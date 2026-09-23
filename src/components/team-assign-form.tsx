"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { createTask } from "@/actions/tasks";
import { Button, Field, Input, Select } from "@/components/ui";

export function TeamAssignForm({
  employees,
  projects,
  workTypes,
}: {
  employees: { id: string; name: string }[];
  projects: { id: string; name: string; code: string }[];
  workTypes: { code: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onSubmit(formData: FormData) {
    const projectId = String(formData.get("projectId") ?? "");
    if (!projectId) {
      toast.error("Select a project.");
      return;
    }
    start(async () => {
      const result = await createTask(projectId, formData);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Task assigned.");
      router.refresh();
    });
  }

  if (projects.length === 0) {
    return <p className="text-sm text-muted">There are no open projects to assign.</p>;
  }
  if (employees.length === 0) {
    return <p className="text-sm text-muted">There is no one to assign.</p>;
  }
  if (workTypes.length === 0) {
    return <p className="text-sm text-muted">Add a work type before assigning a task.</p>;
  }

  const orderedProjects = [...projects].sort((a, b) =>
    a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: "base" }),
  );

  return (
    <form action={onSubmit} className="grid gap-4">
      <Field label="Project" className="max-w-xl">
        <Select name="projectId" required defaultValue={orderedProjects[0]?.id}>
          {orderedProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.code} · {project.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Assign to" className="w-52">
          <Select name="assignedEmployeeId" required defaultValue={employees[0]?.id}>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Work type" className="w-48">
          <Select name="workType" required defaultValue={workTypes[0]?.code}>
            {workTypes.map((workType) => (
              <option key={workType.code} value={workType.code}>
                {workType.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Hours" className="w-28">
          <Input name="hours" type="number" min="0.5" max="24" step="0.5" placeholder="Optional" />
        </Field>
        <Field label="Due date" className="w-40">
          <Input name="dueDate" type="date" />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Assigning..." : "Assign task"}
        </Button>
      </div>
    </form>
  );
}
