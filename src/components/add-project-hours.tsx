"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addHours } from "@/actions/hours";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { companyDateKey } from "@/lib/format";

type WorkTypeOption = { code: string; name: string };

export function AddProjectHours({
  projectId,
  projectName,
  workTypes,
}: {
  projectId: string;
  projectName: string;
  workTypes: WorkTypeOption[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [openKey, setOpenKey] = useState(0);

  function onSubmit(formData: FormData) {
    start(async () => {
      const result = await addHours(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Hours submitted for approval.");
      dialogRef.current?.close();
      setOpenKey((value) => value + 1);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => dialogRef.current?.showModal()}>
        Add hours
      </Button>
      <dialog
        ref={dialogRef}
        className="w-[min(32rem,calc(100%-2rem))] rounded-2xl border border-line bg-paper-card p-0 text-ink shadow-xl backdrop:bg-black/40"
      >
        <form key={openKey} action={onSubmit} className="grid gap-4 p-5">
          <div>
            <h2 className="font-display text-xl">Add hours</h2>
            <p className="mt-1 text-sm text-muted">{projectName}</p>
          </div>
          <input type="hidden" name="projectId" value={projectId} />
          <Field label="Date">
            <Input name="date" type="date" required defaultValue={companyDateKey(new Date())} />
          </Field>
          <Field label="Work type">
            <Select name="workType" required defaultValue={workTypes[0]?.code ?? ""}>
              {workTypes.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Hours">
            <Input name="hours" type="number" min="0.5" max="24" step="0.5" required />
          </Field>
          <Field label="Notes">
            <Textarea name="notes" placeholder="What did you work on?" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => dialogRef.current?.close()}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Submit hours"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
