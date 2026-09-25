"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { updateBillingHours } from "@/actions/projects";
import { Button, Field, Input } from "@/components/ui";

export function BillingHoursForm({
  projectId,
  initialHours,
  changesHours,
  liveHours,
}: {
  projectId: string;
  initialHours: number;
  changesHours: number;
  liveHours: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onSubmit(formData: FormData) {
    start(async () => {
      const result = await updateBillingHours(projectId, formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Billing hours updated.");
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="grid gap-3 sm:grid-cols-4">
      <Field label="Initial hours">
        <Input name="billingInitialHours" type="number" min="0" step="0.1" defaultValue={initialHours} />
      </Field>
      <Field label="Changes hours">
        <Input name="billingChangesHours" type="number" min="0" step="0.1" defaultValue={changesHours} />
      </Field>
      <Field label="Live hours">
        <Input name="billingLiveHours" type="number" min="0" step="0.1" defaultValue={liveHours} />
      </Field>
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save billing hours"}
        </Button>
      </div>
    </form>
  );
}
