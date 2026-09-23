import { HourStatus, TrackingStatus } from "@prisma/client";
import { hoursByWorkType } from "@/lib/data";
import { workTypeBucket } from "@/lib/work-types";

export const PENDING_HOUR_STATUSES: HourStatus[] = [HourStatus.PENDING, HourStatus.SUBMITTED];
export const APPROVED_HOUR_STATUSES: HourStatus[] = [HourStatus.APPROVED, HourStatus.REVIEWED];

const TRACKING_STATUSES: TrackingStatus[] = ["NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "COMPLETED"];

export function isTrackingStatus(value: string): value is TrackingStatus {
  return TRACKING_STATUSES.includes(value as TrackingStatus);
}

export function isHourPending(status: HourStatus) {
  return status === "PENDING" || status === "SUBMITTED";
}

export function isHourApproved(status: HourStatus) {
  return status === "APPROVED" || status === "REVIEWED";
}

export function requiresChangeApproval(workType: string) {
  return workTypeBucket(workType) === "changes";
}

export function productivityHours(entry: { hours: number; originalHours: number }) {
  return entry.originalHours > 0 ? entry.originalHours : entry.hours;
}

export function sumProductivity<T extends { hours: number; originalHours: number }>(entries: T[]) {
  return entries.reduce((total, entry) => total + productivityHours(entry), 0);
}

export function approvedBillingBreakdown(
  entries: { hours: number; workType: string; status: HourStatus }[],
  managementChargeHours: number,
) {
  const approved = entries.filter((entry) => isHourApproved(entry.status));
  const buckets = hoursByWorkType(approved);
  const initial = buckets.initial;
  const changeExtra = buckets.changes + buckets.live + buckets.other;
  const management = buckets.management + Math.max(0, managementChargeHours || 0);
  return {
    initial,
    changeExtra,
    management,
    total: initial + changeExtra + management,
  };
}
