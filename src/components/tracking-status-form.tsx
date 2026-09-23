"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { TrackingStatus } from "@prisma/client";
import { updateTrackingStatus } from "@/actions/projects";
import { Select } from "@/components/ui";
import { TRACKING_STATUS_LABEL, TRACKING_STATUS_ORDER } from "@/lib/constants";

export function TrackingStatusForm({
  projectId,
  status,
}: {
  projectId: string;
  status: TrackingStatus;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as TrackingStatus;
    if (next === status) return;
    const formData = new FormData();
    formData.set("trackingStatus", next);
    start(async () => {
      const result = await updateTrackingStatus(projectId, formData);
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
    <Select
      key={status}
      aria-label="Project status"
      defaultValue={status}
      disabled={pending}
      onChange={onChange}
      className="h-9 min-w-[9.5rem]"
    >
      {TRACKING_STATUS_ORDER.map((value) => (
        <option key={value} value={value}>
          {TRACKING_STATUS_LABEL[value]}
        </option>
      ))}
    </Select>
  );
}
