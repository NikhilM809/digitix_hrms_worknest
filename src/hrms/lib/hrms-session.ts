"use client";

import {
  useSession as useNextSession,
  signIn,
  signOut,
  SessionProvider,
} from "next-auth/react";

export { signIn, signOut, SessionProvider };

export function useSession() {
  const result = useNextSession();
  const user = result.data?.user;
  if (!user?.hrmsUserId || !user.hrmsRole) {
    return {
      ...result,
      data: result.data
        ? {
            ...result.data,
            user: undefined as never,
          }
        : null,
    };
  }

  return {
    ...result,
    data: {
      ...result.data,
      user: {
        id: user.hrmsUserId,
        employeeId: user.hrmsEmployeeId ?? "",
        email: user.email ?? "",
        firstName: user.hrmsFirstName ?? user.name?.split(" ")[0] ?? "",
        lastName: user.hrmsLastName ?? "",
        role: user.hrmsRole,
        avatar: user.hrmsAvatar,
        departmentId: user.hrmsDepartmentId,
        mustChangePassword: user.hrmsMustChangePassword ?? false,
      },
    },
  };
}
