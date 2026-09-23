import {
  ProjectStatus,
  Role,
  TaskStatus,
  HourStatus,
  InvoiceStatus,
  TrackingStatus,
} from "@prisma/client";
import type { RoleName } from "@prisma/hrms-client";

export const APP_NAME = "WorkNest";
export const APP_TAGLINE = "Your people. Your projects. One workspace.";

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  BID: "Bid",
  NEED_TO_START: "Need to Start",
  SCRIPT_WIP: "Script WIP",
  CHANGES: "Changes",
  LIVE: "Live",
  HOLD: "Hold",
  CLOSE: "Close",
  CANCEL: "Cancelled",
};

/** Labels used on the efforts tracker Excel (Project_Billing_details_status). */
export function trackerProjectStatusLabel(status: ProjectStatus) {
  if (status === "CLOSE") return "Closed";
  if (status === "LIVE") return "Full Launched";
  if (status === "HOLD") return "Hold";
  if (status === "SCRIPT_WIP") return "Programming";
  if (status === "NEED_TO_START") return "Need to Start";
  return PROJECT_STATUS_LABEL[status];
}

export const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  "BID",
  "NEED_TO_START",
  "SCRIPT_WIP",
  "CHANGES",
  "LIVE",
  "HOLD",
  "CLOSE",
  "CANCEL",
];

export const TASK_STATUS_ORDER: TaskStatus[] = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETED"];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  COMPLETED: "Completed",
};

export const WORK_TYPE_LABEL: Record<string, string> = {
  INITIAL_SCRIPTING: "Initial Scripting",
  INITIAL_QA: "Initial QA",
  CHANGES: "Changes",
  CHANGES_QA: "Changes QA",
  LIVE: "Live",
  PROJECT_MANAGEMENT: "Project Management",
};

export function workTypeLabel(code: string) {
  if (WORK_TYPE_LABEL[code]) return WORK_TYPE_LABEL[code];
  return code
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export const HOUR_STATUS_LABEL: Record<HourStatus, string> = {
  SUBMITTED: "Pending approval",
  REVIEWED: "Approved",
  PENDING: "Pending approval",
  APPROVED: "Approved",
};

export const TRACKING_STATUS_LABEL: Record<TrackingStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
};

export const TRACKING_STATUS_ORDER: TrackingStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
];

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  GENERATED: "Invoice Generated",
  PAID: "Paid",
};

export const BILLING_STATUS_LABEL = {
  NONE: "Not billed",
  PENDING: "Pending Billing",
  APPROVAL_REQUIRED: "Approval Required",
  APPROVED: "Approved",
  GENERATED: "Invoice Generated",
  PAID: "Paid",
} as const;

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  SENIOR_MANAGER: "Senior Manager",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
};

export const HRMS_ROLE_LABEL: Record<RoleName, string> = {
  ADMIN: "Admin",
  HR: "HR",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
};

export const PAGE_SIZE = 20;
