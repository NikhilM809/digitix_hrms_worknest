import { prisma } from "@hrms/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
} from "@hrms/lib/api-utils";
import { getDependentDetailsEnabled } from "@hrms/lib/dependent-details-settings";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const enabled = await getDependentDetailsEnabled();
  return apiSuccess({ enabled });
}
