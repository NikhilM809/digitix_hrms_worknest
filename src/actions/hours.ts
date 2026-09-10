"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hoursByWorkType } from "@/lib/data";
import { ensureCatalog } from "@/lib/catalog";
import { notifyAdmins, notifyUsers } from "@/lib/notify";
import { ActionError, STAFF_ROLES, assertRole, isAdminLike, requireUser } from "@/lib/permissions";
import { isInactiveStatus } from "@/lib/project-status";

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function addHours(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const taskId = String(formData.get("taskId") || "") || null;
  const workType = String(formData.get("workType") ?? "").trim();
  const hours = Number(formData.get("hours"));
  const date = parseDate(String(formData.get("date") || ""));
  const notes = String(formData.get("notes") ?? "");

  if (!projectId) return { error: "Select a project." };
  if (!date) return { error: "Date is required." };
  await ensureCatalog();
  const workTypeOption = await prisma.workTypeOption.findFirst({
    where: { code: workType, active: true },
  });
  if (!workType || !workTypeOption) {
    return { error: "Select a work type." };
  }
  if (!hours || hours <= 0 || hours > 24) return { error: "Enter hours between 0 and 24." };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { assignments: true, timeEntries: { select: { hours: true, workType: true } } },
  });
  if (!project) return { error: "Project not found." };
  if (isInactiveStatus(project.status)) {
    return { error: "Hours cannot be logged on a closed or cancelled project." };
  }

  if (user.role === Role.MANAGER && project.managerId !== user.id) {
    return { error: "You can only log hours on your team's projects." };
  }

  const employeeId =
    user.role === Role.EMPLOYEE ? user.id : String(formData.get("employeeId") || user.id);
  if (user.role !== Role.EMPLOYEE && employeeId !== user.id) {
    const employee = await prisma.user.findFirst({
      where: { id: employeeId, role: Role.EMPLOYEE, active: true },
    });
    if (!employee) return { error: "Select a valid employee." };
  }

  if (user.role === Role.MANAGER && employeeId !== user.id) {
    const onTeam = await prisma.projectAssignment.findFirst({
      where: {
        employeeId,
        project: { managerId: user.id, status: { notIn: ["CLOSE", "CANCEL"] } },
      },
      select: { id: true },
    });
    if (!onTeam) return { error: "You can only log hours for your team." };
  }

  if (taskId) {
    const task = await prisma.task.findFirst({ where: { id: taskId, projectId } });
    if (!task) return { error: "Select a valid task." };
    if (user.role === Role.EMPLOYEE && task.assignedEmployeeId && task.assignedEmployeeId !== user.id) {
      return { error: "You can only log hours on your tasks." };
    }
  }

  await prisma.timeEntry.create({
    data: {
      projectId,
      taskId,
      employeeId,
      date,
      workType,
      hours,
      notes,
    },
  });

  const allHours = hoursByWorkType([...project.timeEntries, { hours, workType }]);
  if (allHours.total > project.estimatedHours && project.timeEntries.reduce((s, e) => s + e.hours, 0) <= project.estimatedHours) {
    await notifyUsers([project.managerId], {
      title: "Hours exceeded estimate",
      message: `${project.name} is now ${allHours.total - project.estimatedHours} hours over estimate.`,
      href: `/projects/${project.id}`,
    });
  }
  const initialHours = project.initialEstimatedHours > 0 ? project.initialEstimatedHours : project.estimatedHours;
  if (!project.changesAlertSent && initialHours > 0 && allHours.changes > initialHours * 0.2) {
    await prisma.project.update({
      where: { id: project.id },
      data: { changesAlertSent: true },
    });
    await notifyAdmins({
      title: "Changes exceeded 20% of initial hours",
      message: `${project.name} (${project.code}) has ${allHours.changes} change hours versus ${initialHours} hours estimated at creation.`,
      href: `/projects/${project.id}`,
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/my-hours");
  revalidatePath("/hours");
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function reviewHours(entryId: string) {
  const user = await requireUser();
  assertRole(user, STAFF_ROLES);
  const entry = await prisma.timeEntry.findUnique({
    where: { id: entryId },
    include: { project: { select: { managerId: true } } },
  });
  if (!entry) throw new ActionError("Entry not found.");
  if (!isAdminLike(user.role) && entry.project.managerId !== user.id) {
    throw new ActionError("You can only review your team's hours.");
  }
  await prisma.timeEntry.update({
    where: { id: entryId },
    data: { status: "REVIEWED", reviewedById: user.id },
  });
  revalidatePath("/hours");
  revalidatePath(`/projects/${entry.projectId}`);
}
