"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HourStatus } from "@prisma/client";
import { saveHourEntry } from "@/actions/hours";
import { Button, Input } from "@/components/ui";
import { HOUR_STATUS_LABEL } from "@/lib/constants";
import { isHourPending } from "@/lib/hour-approval";

export function HourEntryEditor({
  entryId,
  hours,
  notes,
  status,
  canApprove,
  canEdit,
}: {
  entryId: string;
  hours: number;
  notes: string;
  status: HourStatus;
  canApprove: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onSubmit(formData: FormData) {
    start(async () => {
      const result = await saveHourEntry(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(formData.get("intent") === "approve" ? "Hours approved." : "Hours updated.");
      router.refresh();
    });
  }

  if (!canEdit && !canApprove) {
    return <span>{HOUR_STATUS_LABEL[status]}</span>;
  }

  return (
    <form action={onSubmit} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="entryId" value={entryId} />
      <input type="hidden" name="notes" value={notes} />
      {canEdit ? (
        <Input
          name="hours"
          type="number"
          min="0.5"
          max="24"
          step="0.5"
          defaultValue={hours}
          aria-label="Hours"
          className="h-9 w-24"
        />
      ) : (
        <input type="hidden" name="hours" value={hours} />
      )}
      {canEdit ? (
        <Button type="submit" name="intent" value="save" size="sm" variant="outline" disabled={pending}>
          Save
        </Button>
      ) : null}
      {canApprove && isHourPending(status) ? (
        <Button type="submit" name="intent" value="approve" size="sm" disabled={pending}>
          Approve
        </Button>
      ) : (
        <span className="text-xs text-muted">{HOUR_STATUS_LABEL[status]}</span>
      )}
    </form>
  );
}
