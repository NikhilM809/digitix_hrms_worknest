import ExcelJS from "exceljs";
import { HOUR_STATUS_LABEL, TRACKING_STATUS_LABEL, workTypeLabel } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { productivityHours } from "@/lib/hour-approval";
import type { HourStatus, TrackingStatus } from "@prisma/client";

export type DailyHourRow = {
  date: Date;
  employeeName: string;
  clientName: string;
  projectName: string;
  projectCode: string;
  managerName: string;
  trackingStatus: TrackingStatus;
  workType: string;
  hours: number;
  originalHours: number;
  status: HourStatus;
  notes: string;
  editedByName: string | null;
  editedAt: Date | null;
  updatedAt: Date;
};

export async function buildDailyHoursWorkbook(input: {
  companyName: string;
  dateLabel: string;
  exportedBy: string;
  statusLabel: string;
  rows: DailyHourRow[];
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Worknest";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Daily hours");
  sheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Employee", key: "employee", width: 22 },
    { header: "Client", key: "client", width: 22 },
    { header: "Project", key: "project", width: 28 },
    { header: "Project ID", key: "code", width: 16 },
    { header: "Manager", key: "manager", width: 22 },
    { header: "Project status", key: "status", width: 16 },
    { header: "Work type", key: "workType", width: 22 },
    { header: "Original hours", key: "original", width: 16 },
    { header: "Current hours", key: "current", width: 16 },
    { header: "Approval", key: "approval", width: 18 },
    { header: "Notes", key: "notes", width: 32 },
    { header: "Edited by", key: "editedBy", width: 22 },
    { header: "Edited at", key: "editedAt", width: 20 },
    { header: "Last updated", key: "updated", width: 20 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.insertRow(1, [`Daily logged hours · ${input.dateLabel} · ${input.statusLabel} · Exported by ${input.exportedBy}`]);
  sheet.mergeCells("A1:O1");
  sheet.getRow(1).font = { bold: true, size: 14 };

  for (const row of input.rows) {
    sheet.addRow({
      date: formatDate(row.date),
      employee: row.employeeName,
      client: row.clientName,
      project: row.projectName,
      code: row.projectCode,
      manager: row.managerName,
      status: TRACKING_STATUS_LABEL[row.trackingStatus],
      workType: workTypeLabel(row.workType),
      original: productivityHours(row),
      current: row.hours,
      approval: HOUR_STATUS_LABEL[row.status],
      notes: row.notes,
      editedBy: row.editedByName ?? "",
      editedAt: row.editedAt ? formatDate(row.editedAt) : "",
      updated: formatDate(row.updatedAt),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
