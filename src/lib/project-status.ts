import { ProjectStatus } from "@prisma/client";
import { PROJECT_STATUS_ORDER } from "@/lib/constants";

export const INACTIVE_STATUSES: ProjectStatus[] = ["CLOSE", "CANCEL"];

/** Forward path. Live may return to Changes, then move to Live again. */
const PIPELINE: ProjectStatus[] = ["BID", "NEED_TO_START", "SCRIPT_WIP", "CHANGES", "LIVE"];

export function isInactiveStatus(status: ProjectStatus) {
  return status === "CLOSE" || status === "CANCEL";
}

export function isProjectStatus(value: string): value is ProjectStatus {
  return (PROJECT_STATUS_ORDER as string[]).includes(value);
}

export function canSelectCancel(current: ProjectStatus) {
  return current === "BID" || current === "CANCEL";
}

export function statusesAvailable(current: ProjectStatus, resumeFrom?: ProjectStatus | null): ProjectStatus[] {
  if (current === "CLOSE" || current === "CANCEL") return [current];

  const stage: ProjectStatus =
    current === "HOLD"
      ? resumeFrom && resumeFrom !== "HOLD" && resumeFrom !== "CLOSE" && resumeFrom !== "CANCEL"
        ? resumeFrom
        : "NEED_TO_START"
      : current;

  const index = PIPELINE.indexOf(stage);
  const options: ProjectStatus[] = [];
  if (index >= 0) options.push(stage);
  if (index >= 0 && index < PIPELINE.length - 1) options.push(PIPELINE[index + 1]);
  if (stage === "LIVE") options.push("CHANGES");
  options.push("HOLD", "CLOSE");
  if (canSelectCancel(stage)) options.push("CANCEL");
  return options;
}
