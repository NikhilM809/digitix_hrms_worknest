import { NextRequest } from "next/server";
import { prisma } from "@hrms/lib/prisma";
import { apiSuccess, apiError } from "@hrms/lib/api-utils";
import { forgotPasswordSchema } from "@hrms/lib/validations";
import { createPasswordResetRequest } from "@hrms/lib/password-reset";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Enter a valid email address", 400);
    }

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: parsed.data.email.trim(), mode: "insensitive" },
        status: "ACTIVE",
      },
      select: { email: true, firstName: true, lastName: true },
    });

    if (user) {
      await createPasswordResetRequest(
        user.email,
        `${user.firstName} ${user.lastName}`.trim(),
      );
    }

    return apiSuccess({
      message: "If this email is registered, an admin has been asked to reset the password.",
    });
  } catch (error) {
    console.error("Forgot password request failed:", error);
    return apiError("Could not submit the reset request", 500);
  }
}
