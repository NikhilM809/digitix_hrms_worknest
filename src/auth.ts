import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { JWT } from "next-auth/jwt";
import { Role } from "@prisma/client";
import type { RoleName, UserStatus } from "@prisma/hrms-client";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/db";
import { prisma as hrmsPrisma } from "@hrms/lib/prisma";
import { worknestRoleFromHrms } from "@/lib/people-sync";

async function hrmsUserByEmail(email: string) {
  try {
    return await hrmsPrisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
  } catch (error) {
    console.error("HRMS lookup failed", error);
    return null;
  }
}

function hrmsFields(hrmsUser: {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  role: RoleName;
  status: UserStatus;
  avatar: string | null;
  departmentId: string | null;
  mustChangePassword: boolean;
} | null) {
  if (!hrmsUser || hrmsUser.status !== "ACTIVE") {
    return {
      hrmsUserId: undefined,
      hrmsEmployeeId: undefined,
      hrmsFirstName: undefined,
      hrmsLastName: undefined,
      hrmsRole: undefined,
      hrmsAvatar: undefined,
      hrmsDepartmentId: undefined,
      hrmsMustChangePassword: undefined,
    };
  }
  return {
    hrmsUserId: hrmsUser.id,
    hrmsEmployeeId: hrmsUser.employeeId,
    hrmsFirstName: hrmsUser.firstName,
    hrmsLastName: hrmsUser.lastName,
    hrmsRole: hrmsUser.role,
    hrmsAvatar: hrmsUser.avatar,
    hrmsDepartmentId: hrmsUser.departmentId,
    hrmsMustChangePassword: hrmsUser.mustChangePassword,
  };
}

async function enrichTokenWithHrms(token: JWT) {
  const email = typeof token.email === "string" ? token.email : undefined;
  if (!email) return token;
  if (token.hrmsUserId && token.hrmsRole) return token;
  const hrmsUser = await hrmsUserByEmail(email);
  Object.assign(token, hrmsFields(hrmsUser));
  return token;
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials.password ?? "");
        if (!email || !password) return null;

        let [user, hrmsUser] = await Promise.all([
          prisma.user.findUnique({ where: { email } }),
          hrmsUserByEmail(email),
        ]);

        const [worknestValid, hrmsValid] = await Promise.all([
          user?.active ? bcrypt.compare(password, user.password) : Promise.resolve(false),
          hrmsUser?.status === "ACTIVE"
            ? bcrypt.compare(password, hrmsUser.password)
            : Promise.resolve(false),
        ]);

        if (!worknestValid && !hrmsValid) return null;

        if (hrmsUser?.status === "ACTIVE") {
          const { syncWorknestUserFromHrms } = await import("@/lib/people-sync");
          if (hrmsValid) {
            user = await syncWorknestUserFromHrms({
              email,
              firstName: hrmsUser.firstName,
              lastName: hrmsUser.lastName,
              role: hrmsUser.role,
              status: hrmsUser.status,
              password: hrmsUser.password,
            });
          } else if (user) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                name: `${hrmsUser.firstName} ${hrmsUser.lastName}`.trim() || email,
                role: worknestRoleFromHrms(hrmsUser.role),
                active: true,
              },
            });
          }
        }

        if (!user || !user.active) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          ...hrmsFields(hrmsUser),
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role as Role;
        token.name = user.name;
        token.email = user.email;
        token.hrmsUserId = user.hrmsUserId;
        token.hrmsEmployeeId = user.hrmsEmployeeId;
        token.hrmsFirstName = user.hrmsFirstName;
        token.hrmsLastName = user.hrmsLastName;
        token.hrmsRole = user.hrmsRole;
        token.hrmsAvatar = user.hrmsAvatar;
        token.hrmsDepartmentId = user.hrmsDepartmentId;
        token.hrmsMustChangePassword = user.hrmsMustChangePassword;
      }
      return enrichTokenWithHrms(token);
    },
  },
});
