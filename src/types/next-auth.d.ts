import { Role } from "@prisma/client";
import type { RoleName } from "@prisma/hrms-client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      hrmsUserId?: string;
      hrmsEmployeeId?: string;
      hrmsFirstName?: string;
      hrmsLastName?: string;
      hrmsRole?: RoleName;
      hrmsAvatar?: string | null;
      hrmsDepartmentId?: string | null;
      hrmsMustChangePassword?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: Role;
    hrmsUserId?: string;
    hrmsEmployeeId?: string;
    hrmsFirstName?: string;
    hrmsLastName?: string;
    hrmsRole?: RoleName;
    hrmsAvatar?: string | null;
    hrmsDepartmentId?: string | null;
    hrmsMustChangePassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    hrmsUserId?: string;
    hrmsEmployeeId?: string;
    hrmsFirstName?: string;
    hrmsLastName?: string;
    hrmsRole?: RoleName;
    hrmsAvatar?: string | null;
    hrmsDepartmentId?: string | null;
    hrmsMustChangePassword?: boolean;
  }
}
