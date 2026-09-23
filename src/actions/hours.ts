"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hoursByWorkType } from "@/lib/data";
import { ensureCatalog } from "@/lib/catalog";
import { notifyAdmins, notifyUsers } from "@/lib/notify";
import { requireUser } from "@/lib/permissions";
import { listDirectReportUsers, managerCanAccessProject } from "@/lib/direct-reports";
import { requiresChangeApproval } from "@/lib/hour-approval";
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

  const employeeId =
    user.role === Role.EMPLOYEE ? user.id : String(formData.get("employeeId") || user.id);
  const task = taskId ? await prisma.task.findFirst({ where: { id: taskId, projectId } }) : null;
  if (taskId && !task) return { error: "Select a valid task." };
  if (task && user.role === Role.EMPLOYEE && task.assignedEmployeeId && task.assignedEmployeeId !== user.id) {
    return { error: "You can only log hours on your tasks." };
  }
  const loggingAssignedTask = Boolean(task && task.assignedEmployeeId === employeeId);

  if (user.role === Role.MANAGER && !(await managerCanAccessProject(user.id, project.id))) {
    if (!(loggingAssignedTask && employeeId === user.id)) {
      return { error: "You can only log hours on your projects or your direct reports' projects." };
    }
  }

  if (user.role !== Role.EMPLOYEE && employeeId !== user.id) {
    const person = await prisma.user.findFirst({
      where: { id: employeeId, active: true },
    });
    const allowedRole = person?.role === Role.EMPLOYEE || (loggingAssignedTask && (person?.role === Role.MANAGER || person?.role === Role.SENIOR_MANAGER));
    if (!person || !allowedRole) return { error: "Select a valid person." };
  }

  if (user.role === Role.MANAGER && employeeId !== user.id) {
    const reports = await listDirectReportUsers(user.id);
    if (!reports.some((person) => person.id === employeeId)) {
      return { error: "You can only log hours for your direct reports." };
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
      originalHours: hours,
      notes,
      status: requiresChangeApproval(workType) ? "PENDING" : "APPROVED",
    },
  });
  if (requiresChangeApproval(workType)) {
    await notifyAdmins({
      title: "Change hours pending approval",
      message: `${hours} change hours on ${project.name} are waiting for admin approval.`,
      href: "/hours?status=PENDING",
    });
  }

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

export async function saveHourEntry(formData: FormData) {
  const user = await requireUser();
  const entryId = String(formData.get("entryId") ?? "");
  const hours = Number(formData.get("hours"));
  const notes = formData.has("notes") ? String(formData.get("notes") ?? "") : undefined;
  const intent = String(formData.get("intent") || "save");

  if (!entryId) return { error: "Hour entry not found." };
  if (!hours || hours <= 0 || hours > 24) return { error: "Enter hours between 0 and 24." };

  const entry = await prisma.timeEntry.findUnique({
    where: { id: entryId },
    include: { project: { select: { id: true, managerId: true, name: true } } },
  });
  if (!entry) return { error: "Hour entry not found." };

  const isAdmin = user.role === Role.ADMIN;
  const changeHours = requiresChangeApproval(entry.workType);
  if (intent === "approve" && !isAdmin) {
    return { error: "Only admins can approve change hours." };
  }
  if (intent === "approve" && !changeHours) {
    return { error: "Only change hours need admin approval." };
  }
  if (!isAdmin && user.role === Role.EMPLOYEE && entry.employeeId !== user.id) {
    return { error: "You can only update your own hours." };
  }
  if (!isAdmin && user.role === Role.MANAGER && !(await managerCanAccessProject(user.id, entry.project.id))) {
    return { error: "You can only update hours on your projects or your direct reports' projects." };
  }

  const approving = intent === "approve" && isAdmin;
  await prisma.timeEntry.update({
    where: { id: entryId },
    data: {
      hours,
      ...(notes !== undefined ? { notes } : {}),
      editedById: user.id,
      editedAt: new Date(),
      ...(approving
        ? { status: "APPROVED", reviewedById: user.id }
        : isAdmin || !changeHours
          ? changeHours
            ? {}
            : { status: "APPROVED" }
          : { status: "PENDING", reviewedById: null }),
    },
  });

  if (!approving && !isAdmin && changeHours) {
    await notifyAdmins({
      title: "Change hours updated and pending approval",
      message: `${entry.project.name} change hours were edited and need admin approval.`,
      href: "/hours?status=PENDING",
    });
  }

  revalidatePath("/hours");
  revalidatePath("/my-hours");
  revalidatePath("/dashboard");
  revalidatePath("/my-projects");
  revalidatePath("/projects");
  revalidatePath("/billing");
  revalidatePath(`/projects/${entry.projectId}`);
  return { ok: true };
}
