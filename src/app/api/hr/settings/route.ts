import { NextRequest } from "next/server";
import { prisma } from "@hrms/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@hrms/lib/api-utils";
import { companySettingsSchema } from "@hrms/lib/validations";
import { DEFAULT_COMPANY_TIMEZONE } from "@hrms/lib/timezone-utils";

export async function GET() {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  let settings = await prisma.companySettings.findFirst();

  if (!settings) {
    settings = await prisma.companySettings.create({ data: {} });
  }

  const zones = await prisma.$queryRaw<Array<{ timezone: string }>>`
    SELECT "timezone" FROM "CompanySettings" WHERE "id" = ${settings.id} LIMIT 1
  `;

  return apiSuccess({ ...settings, timezone: zones[0]?.timezone || DEFAULT_COMPANY_TIMEZONE });
}

export async function PUT(req: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = companySettingsSchema.parse(body);
    const { timezone, ...settingsData } = parsed;

    if (parsed.topLevelEmployeeId) {
      const topLevel = await prisma.user.findUnique({
        where: { id: parsed.topLevelEmployeeId },
        select: { id: true, status: true },
      });
      if (!topLevel || topLevel.status !== "ACTIVE") {
        return apiError("Top-level employee must be an active employee", 400);
      }
    }

    const existing = await prisma.companySettings.findFirst();

    const settings = existing
      ? await prisma.companySettings.update({
          where: { id: existing.id },
          data: {
            ...settingsData,
            companyEmail: parsed.companyEmail || null,
            companyTan: parsed.companyTan || null,
          },
        })
      : await prisma.companySettings.create({
          data: {
            ...settingsData,
            companyEmail: parsed.companyEmail || null,
            companyTan: parsed.companyTan || null,
          },
        });

    await prisma.$executeRaw`
      UPDATE "CompanySettings" SET "timezone" = ${timezone} WHERE "id" = ${settings.id}
    `;

    await createAuditLog({
      userId: user!.id,
      action: "UPDATE",
      entity: "CompanySettings",
      entityId: settings.id,
      details: "Updated company settings",
    });

    return apiSuccess({ ...settings, timezone });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return apiError("Invalid settings data", 422);
    }
    return apiError("Failed to update settings", 500);
  }
}
