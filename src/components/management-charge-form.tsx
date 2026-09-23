"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateManagementCharge } from "@/actions/billing";
import { Button, Input } from "@/components/ui";

export function ManagementChargeForm({
  projectId,
  hours,
}: {
  projectId: string;
  hours: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onSubmit(formData: FormData) {
    start(async () => {
      const result = await updateManagementCharge(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Project management charge saved.");
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="flex items-center justify-end gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <Input
        name="managementChargeHours"
        type="number"
        min="0"
        step="0.5"
        defaultValue={hours}
        aria-label="Project management charge hours"
        className="h-9 w-24 text-right"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Save
      </Button>
    </form>
  );
}
