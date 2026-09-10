import { requireAuth, apiSuccess, apiError } from "@hrms/lib/api-utils";
import { listPendingPasswordResetRequests } from "@hrms/lib/password-reset";

export async function GET() {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  try {
    const requests = await listPendingPasswordResetRequests();
    return apiSuccess(requests);
  } catch (err) {
    console.error("Password reset requests failed:", err);
    return apiError("Failed to load password reset requests", 500);
  }
}
