"use server";

import { revalidatePath } from "next/cache";
import { Role, TaskStatus } from "@prisma/client";
import { addHours } from "@/actions/hours";
import { prisma } from "@/lib/db";
import { listDirectReportUsers, managerCanAccessProject } from "@/lib/direct-reports";
import { notifyUsers } from "@/lib/notify";
import { ActionError, STAFF_ROLES, assertRole, requireUser } from "@/lib/permissions";
import { isInactiveStatus } from "@/lib/project-status";

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function ensureAssignment(projectId: string, employeeId: string, assignedById: string) {
  await prisma.projectAssignment.upsert({
    where: { projectId_employeeId: { projectId, employeeId } },
    update: {},
    create: { projectId, employeeId, assignedById },
  });
}

async function todayValue() {
  const { getCompanyTimezone } = await import("@hrms/lib/company-timezone");
  const { getDateStringInZone } = await import("@hrms/lib/timezone-utils");
  return getDateStringInZone(new Date(), await getCompanyTimezone());
}

export async function createOwnTask(formData: FormData) {
  const user = await requireUser();
  if (user.role !== Role.EMPLOYEE) return { error: "Only employees can add a task for themselves." };
  formData.set("assignedEmployeeId", user.id);
  const projectId = String(formData.get("projectId") ?? "");
  return createTask(projectId, formData);
}

export async function createTask(projectId: string, formData: FormData) {
  const user = await requireUser();
  const workType = String(formData.get("workType") ?? "").trim();
  const workTypeOption = workType
    ? await prisma.workTypeOption.findFirst({ where: { code: workType, active: true } })
    : null;
  if (!workTypeOption) return { error: "Select a work type." };
  const name = workTypeOption.name;

  const hoursRaw = String(formData.get("hours") ?? "").trim();
  const hours = hoursRaw ? Number(hoursRaw) : 0;
  if (hoursRaw && (!hours || hours <= 0 || hours > 24)) {
    return { error: "Enter hours between 0 and 24." };
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { error: "Project not found." };
  if (isInactiveStatus(project.status)) return { error: "This project is closed or cancelled." };

  const assignedEmployeeId = String(formData.get("assignedEmployeeId") || "") || null;
  if (user.role === Role.EMPLOYEE) {
    if (assignedEmployeeId !== user.id) return { error: "You can only add a task for yourself." };
  } else {
    assertRole(user, STAFF_ROLES);
  }

  if (user.role === Role.MANAGER) {
    if (!assignedEmployeeId) return { error: "Select a direct report." };
    if (!(await managerCanAccessProject(user.id, projectId))) {
      return { error: "You can only assign tasks on your projects or your direct reports' projects." };
    }
    const reports = await listDirectReportUsers(user.id);
    if (!reports.some((person) => person.id === assignedEmployeeId)) {
      return { error: "You can only assign tasks to your direct reports." };
    }
  } else if (assignedEmployeeId && user.role !== Role.EMPLOYEE) {
    const employee = await prisma.user.findFirst({
      where: { id: assignedEmployeeId, active: true },
    });
    if (!employee) return { error: "Select a person." };
  }

  if (hours > 0 && !assignedEmployeeId) return { error: "Select someone before logging hours." };

  const task = await prisma.task.create({
    data: {
      projectId,
      name,
      description: String(formData.get("description") ?? ""),
      assignedEmployeeId,
      assignedById: assignedEmployeeId ? user.id : null,
      assignedAt: assignedEmployeeId ? new Date() : null,
      estimatedHours: Number(formData.get("estimatedHours") || 0),
      startDate: parseDate(String(formData.get("startDate") || "")),
      dueDate: parseDate(String(formData.get("dueDate") || "")),
      status: (String(formData.get("status") || "NOT_STARTED") as TaskStatus) || "NOT_STARTED",
      notes: String(formData.get("notes") ?? ""),
      selfAssignEnabled: formData.get("selfAssignEnabled") === "on",
    },
  });

  if (assignedEmployeeId) {
    await ensureAssignment(projectId, assignedEmployeeId, user.id);
    if (assignedEmployeeId !== user.id) {
      await notifyUsers([assignedEmployeeId], {
        title: "Task assigned",
        message: `${task.name} on ${project.name}.`,
        href: "/my-tasks",
      });
    }
  }

  if (hours > 0 && assignedEmployeeId) {
    const hoursForm = new FormData();
    hoursForm.set("projectId", projectId);
    hoursForm.set("taskId", task.id);
    hoursForm.set("workType", workType);
    hoursForm.set("hours", String(hours));
    hoursForm.set("date", await todayValue());
    hoursForm.set("employeeId", assignedEmployeeId);
    hoursForm.set("notes", name);
    const logged = await addHours(hoursForm);
    if (logged?.error) return logged;
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/my-tasks");
  revalidatePath("/my-hours");
  revalidatePath("/team");
  revalidatePath("/projects");
  return { ok: true };
}

function parseOptionalHours(formData: FormData) {
  const hoursRaw = String(formData.get("hours") ?? "").trim();
  if (!hoursRaw) return { hours: 0 };
  const hours = Number(hoursRaw);
  if (!hours || hours <= 0 || hours > 24) return { error: "Enter hours between 0 and 24." };
  return { hours };
}

async function logTaskHours(task: { id: string; projectId: string; name: string }, employeeId: string, hours: number, notes: string) {
  const workType = await prisma.workTypeOption.findFirst({
    where: { active: true, OR: [{ name: task.name }, { code: task.name }] },
  });
  if (!workType) return { error: "This task has no work type, so hours cannot be logged." };
  const hoursForm = new FormData();
  hoursForm.set("projectId", task.projectId);
  hoursForm.set("taskId", task.id);
  hoursForm.set("workType", workType.code);
  hoursForm.set("hours", String(hours));
  hoursForm.set("date", await todayValue());
  hoursForm.set("employeeId", employeeId);
  hoursForm.set("notes", notes || task.name);
  return addHours(hoursForm);
}

export async function updateTask(taskId: string, formData: FormData) {
  const user = await requireUser();
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { project: true },
  });
  if (!task) return { error: "Task not found." };

  const updatingOwnTask =
    task.assignedEmployeeId === user.id &&
    (user.role === Role.EMPLOYEE || user.role === Role.MANAGER || user.role === Role.SENIOR_MANAGER);

  if (user.role === Role.EMPLOYEE && !updatingOwnTask) {
    return { error: "You can only update your own tasks." };
  }

  if (task.status === "COMPLETED") {
    return { error: "This task is completed and can no longer be edited." };
  }

  if (updatingOwnTask) {
    const parsedHours = parseOptionalHours(formData);
    if ("error" in parsedHours) return parsedHours;
    const status = String(formData.get("status") || task.status) as TaskStatus;
    const notes = String(formData.get("notes") ?? task.notes);
    await prisma.task.update({
      where: { id: taskId },
      data: { status, notes },
    });
    if (status === "COMPLETED") {
      await notifyUsers([task.project.managerId], {
        title: "Task completed",
        message: `${user.name} completed ${task.name} on ${task.project.name}.`,
        href: `/projects/${task.projectId}`,
      });
    }
    if (parsedHours.hours > 0) {
      const logged = await logTaskHours(task, user.id, parsedHours.hours, notes);
      if (logged && "error" in logged && logged.error) return logged;
    }
    revalidatePath(`/projects/${task.projectId}`);
    revalidatePath("/my-tasks");
    revalidatePath("/my-hours");
    revalidatePath("/hours");
    revalidatePath("/projects");
    return { ok: true, loggedHours: parsedHours.hours > 0 };
  }

  assertRole(user, STAFF_ROLES);
  const assignedEmployeeId = String(formData.get("assignedEmployeeId") || "") || null;
  const previousAssignee = task.assignedEmployeeId;
  await prisma.task.update({
    where: { id: taskId },
    data: {
      name: String(formData.get("name") || task.name).trim(),
      description: String(formData.get("description") ?? task.description),
      assignedEmployeeId,
      assignedById: assignedEmployeeId ? user.id : task.assignedById,
      assignedAt: assignedEmployeeId ? new Date() : null,
      estimatedHours: Number(formData.get("estimatedHours") || task.estimatedHours),
      startDate: parseDate(String(formData.get("startDate") || "")),
      dueDate: parseDate(String(formData.get("dueDate") || "")),
      status: String(formData.get("status") || task.status) as TaskStatus,
      notes: String(formData.get("notes") ?? task.notes),
      selfAssignEnabled: formData.get("selfAssignEnabled") === "on",
    },
  });

  if (assignedEmployeeId && assignedEmployeeId !== previousAssignee) {
    await ensureAssignment(task.projectId, assignedEmployeeId, user.id);
    await notifyUsers([assignedEmployeeId], {
      title: previousAssignee ? "Task reassigned" : "Task assigned",
      message: `${task.name} on ${task.project.name}.`,
      href: "/my-tasks",
    });
    if (previousAssignee) {
      await notifyUsers([previousAssignee], {
        title: "Assignment changed",
        message: `${task.name} was reassigned.`,
        href: "/my-tasks",
      });
    }
  }

  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath("/my-tasks");
  return { ok: true };
}

export async function selfAssignTask(taskId: string) {
  const user = await requireUser();
  if (user.role !== Role.EMPLOYEE) {
    throw new ActionError("Only employees can self-assign tasks.");
  }
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { project: true },
  });
  if (!task) throw new ActionError("Task not found.");
  if (isInactiveStatus(task.project.status)) {
    throw new ActionError("This project is closed or cancelled.");
  }
  if (task.assignedEmployeeId) throw new ActionError("This task is already assigned.");
  if (!task.project.selfAssignEnabled && !task.selfAssignEnabled) {
    throw new ActionError("Self-assignment is not enabled.");
  }

  await ensureAssignment(task.projectId, user.id, user.id);
  await prisma.task.update({
    where: { id: taskId },
    data: {
      assignedEmployeeId: user.id,
      assignedById: user.id,
      assignedAt: new Date(),
      status: task.status === "NOT_STARTED" ? "IN_PROGRESS" : task.status,
    },
  });
  await notifyUsers([task.project.managerId], {
    title: "Task self-assigned",
    message: `${user.name} picked up ${task.name} on ${task.project.name}.`,
    href: `/projects/${task.projectId}`,
  });
  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath("/my-tasks");
  revalidatePath("/my-projects");
}
