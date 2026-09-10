import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { prisma as hrmsPrisma } from "@hrms/lib/prisma";
import { prisma as worknestPrisma } from "@/lib/db";
import { DEFAULT_PASSWORD } from "@/lib/auth-defaults";
import { createNotification } from "@hrms/lib/api-utils";

const REQUEST_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export { DEFAULT_PASSWORD };

export async function applyDefaultPassword(hrmsUserId: string, email: string) {
  const hrmsHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const worknestHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  await hrmsPrisma.user.update({
    where: { id: hrmsUserId },
    data: { password: hrmsHash, mustChangePassword: true },
  });

  await worknestPrisma.user.updateMany({
    where: { email: { equals: email, mode: "insensitive" } },
    data: { password: worknestHash },
  });

  await hrmsPrisma.passwordResetToken.deleteMany({
    where: { email: { equals: email, mode: "insensitive" } },
  });
}

export async function createPasswordResetRequest(email: string, employeeName: string) {
  const normalized = email.trim().toLowerCase();
  const existing = await hrmsPrisma.passwordResetToken.findFirst({
    where: { email: normalized, expires: { gt: new Date() } },
  });

  await hrmsPrisma.passwordResetToken.deleteMany({ where: { email: normalized } });
  await hrmsPrisma.passwordResetToken.create({
    data: {
      email: normalized,
      token: `request-${randomUUID()}`,
      expires: new Date(Date.now() + REQUEST_TTL_MS),
    },
  });

  if (existing) return { created: false };

  const message = `${employeeName} (${normalized}) requested a password reset. Reset it to the default from Employees.`;

  const admins = await hrmsPrisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });

  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        type: "GENERAL",
        title: "Password reset request",
        message,
        link: "/hr/employees",
      }),
    ),
  );

  const worknestAdmins = await worknestPrisma.user.findMany({
    where: { role: { in: ["ADMIN", "SENIOR_MANAGER"] }, active: true },
    select: { id: true },
  });

  if (worknestAdmins.length > 0) {
    await worknestPrisma.notification.createMany({
      data: worknestAdmins.map((admin) => ({
        userId: admin.id,
        title: "Password reset request",
        message,
        href: "/hr/employees",
      })),
    });
  }

  return { created: true };
}

export async function listPendingPasswordResetRequests() {
  const tokens = await hrmsPrisma.passwordResetToken.findMany({
    where: { expires: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (tokens.length === 0) return [];

  const emails = [...new Set(tokens.map((token) => token.email.toLowerCase()))];
  const users = await hrmsPrisma.user.findMany({
    where: {
      OR: emails.map((email) => ({ email: { equals: email, mode: "insensitive" } })),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      employeeId: true,
    },
  });

  const byEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));

  return tokens.flatMap((token) => {
    const user = byEmail.get(token.email.toLowerCase());
    if (!user) return [];
    return [
      {
        id: token.id,
        requestedAt: token.createdAt,
        userId: user.id,
        email: user.email,
        employeeId: user.employeeId,
        name: `${user.firstName} ${user.lastName}`.trim(),
      },
    ];
  });
}
