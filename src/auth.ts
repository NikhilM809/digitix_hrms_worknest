import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/db";
import { prisma as hrmsPrisma } from "@hrms/lib/prisma";

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

        let user = await prisma.user.findUnique({ where: { email } });
        const hrmsUser = await hrmsUserByEmail(email);

        const worknestValid = user?.active
          ? await bcrypt.compare(password, user.password)
          : false;
        const hrmsValid =
          hrmsUser?.status === "ACTIVE"
            ? await bcrypt.compare(password, hrmsUser.password)
            : false;

        if (!worknestValid && !hrmsValid) return null;

        if (!user && hrmsUser && hrmsValid) {
          user = await prisma.user.create({
            data: {
              name: `${hrmsUser.firstName} ${hrmsUser.lastName}`.trim(),
              email,
              password: hrmsUser.password,
              role: Role.EMPLOYEE,
              active: true,
            },
          });
        }

        if (!user || !user.active) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          hrmsUserId: hrmsUser?.status === "ACTIVE" ? hrmsUser.id : undefined,
          hrmsEmployeeId: hrmsUser?.employeeId,
          hrmsFirstName: hrmsUser?.firstName,
          hrmsLastName: hrmsUser?.lastName,
          hrmsRole: hrmsUser?.status === "ACTIVE" ? hrmsUser.role : undefined,
          hrmsAvatar: hrmsUser?.avatar,
          hrmsDepartmentId: hrmsUser?.departmentId,
          hrmsMustChangePassword: hrmsUser?.mustChangePassword,
        };
      },
    }),
  ],
});
