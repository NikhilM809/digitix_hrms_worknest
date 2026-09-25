"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveHourEntry } from "@/actions/hours";
import { Button, Input } from "@/components/ui";

export function HourEntryEditor({
  entryId,
  hours,
  notes,
  canEdit,
}: {
  entryId: string;
  hours: number;
  notes: string;
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
      toast.success("Hours updated.");
      router.refresh();
    });
  }

  if (!canEdit) {
    return <span className="text-xs text-muted">{hours}</span>;
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
      <Button type="submit" name="intent" value="save" size="sm" variant="outline" disabled={pending}>
        Save
      </Button>
    </form>
  );
}
