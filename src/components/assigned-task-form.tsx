"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { TaskStatus } from "@prisma/client";
import { toast } from "sonner";
import { updateTask } from "@/actions/tasks";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { TASK_STATUS_LABEL, TASK_STATUS_ORDER } from "@/lib/constants";

export function AssignedTaskForm({
  taskId,
  name,
  projectName,
  dueLabel,
  status,
  notes,
  loggedLabel,
}: {
  taskId: string;
  name: string;
  projectName: string;
  dueLabel: string;
  status: TaskStatus;
  notes: string;
  loggedLabel: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const locked = status === "COMPLETED";

  function onSubmit(formData: FormData) {
    const hours = String(formData.get("hours") ?? "").trim();
    start(async () => {
      const result = await updateTask(taskId, formData);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(hours ? "Hours logged on the project." : "Task updated.");
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[12rem] flex-1">
          <p className="truncate font-medium">{name}</p>
          <p className="truncate text-xs text-muted">
            {projectName} · due {dueLabel}
            {loggedLabel ? ` · ${loggedLabel}` : ""}
          </p>
        </div>
        {locked ? (
          <p className="text-sm font-medium">Completed</p>
        ) : (
        <Select name="status" defaultValue={status} aria-label="Status" className="w-40">
          {TASK_STATUS_ORDER.map((value) => (
            <option key={value} value={value}>
              {TASK_STATUS_LABEL[value]}
            </option>
          ))}
        </Select>
        )}
        {locked ? null : (
          <>
            <Input name="hours" type="number" min="0.5" max="24" step="0.5" placeholder="Hours" aria-label="Hours" className="w-28" />
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </>
        )}
      </div>
      {locked ? (
        <div className="grid gap-1">
          {notes ? <p className="text-sm">{notes}</p> : null}
          <p className="text-xs text-muted">Completed tasks can&apos;t be edited.</p>
        </div>
      ) : (
        <Textarea name="notes" defaultValue={notes} placeholder="Comment" aria-label="Comment" className="min-h-16" />
      )}
    </form>
  );
}
