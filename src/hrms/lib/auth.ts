import { auth as worknestAuth } from "@/auth";
import type { RoleName } from "@prisma/hrms-client";
import { canApproveLeave, isAdmin as checkIsAdmin } from "@hrms/lib/permissions";

export async function auth() {
  const session = await worknestAuth();
  if (!session?.user?.hrmsUserId || !session.user.hrmsRole) return null;

  return {
    user: {
      id: session.user.hrmsUserId,
      employeeId: session.user.hrmsEmployeeId ?? "",
      email: session.user.email ?? "",
      firstName: session.user.hrmsFirstName ?? session.user.name?.split(" ")[0] ?? "",
      lastName: session.user.hrmsLastName ?? "",
      role: session.user.hrmsRole,
      avatar: session.user.hrmsAvatar,
      departmentId: session.user.hrmsDepartmentId,
      mustChangePassword: session.user.hrmsMustChangePassword ?? false,
    },
  };
}

export function hasRole(userRole: RoleName, allowedRoles: RoleName[]) {
  return allowedRoles.includes(userRole);
}

export function isAdmin(role: RoleName) {
  return checkIsAdmin(role);
}

export function isManager(role: RoleName) {
  return canApproveLeave(role);
}
