import { NextRequest } from "next/server";
import { prisma } from "@hrms/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@hrms/lib/api-utils";
import { applyDefaultPassword, DEFAULT_PASSWORD } from "@hrms/lib/password-reset";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, context: RouteContext) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await context.params;

  try {
    const employee = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!employee) return apiError("Employee not found", 404);

    await applyDefaultPassword(employee.id, employee.email);

    await createAuditLog({
      userId: user!.id,
      action: "UPDATE",
      entity: "User",
      entityId: employee.id,
      details: `Reset password to default for ${employee.firstName} ${employee.lastName}`,
    });

    return apiSuccess({
      message: `Password reset for ${employee.firstName} ${employee.lastName}`,
      password: DEFAULT_PASSWORD,
    });
  } catch (err) {
    console.error("Reset employee password failed:", err);
    return apiError("Failed to reset password", 500);
  }
}
