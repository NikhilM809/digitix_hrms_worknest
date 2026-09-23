import type { NextAuthConfig } from "next-auth";
import { appHomePath } from "@/lib/home-path";

type Role = "ADMIN" | "SENIOR_MANAGER" | "MANAGER" | "EMPLOYEE";
const ADMIN_LIKE: Role[] = ["ADMIN", "SENIOR_MANAGER"];

const ADMIN_PREFIXES = ["/employees", "/reports", "/sales", "/billing", "/settings"];

const STAFF_PREFIXES = ["/projects", "/closed", "/team", "/hours"];
const EMPLOYEE_PREFIXES = ["/my-projects", "/my-tasks", "/my-hours"];

function startsWithAny(path: string, prefixes: string[]) {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const isLoggedIn = Boolean(auth?.user);
      const role = (auth?.user as { role?: Role } | undefined)?.role;
      const hrmsRole = (auth?.user as { hrmsRole?: string } | undefined)?.hrmsRole;
      const home = appHomePath(role, hrmsRole);

      if (path.startsWith("/login") || path.startsWith("/forgot-password")) {
        if (isLoggedIn) {
          return Response.redirect(new URL(home, request.nextUrl));
        }
        return true;
      }

      if (!isLoggedIn) return false;

      if (role === "EMPLOYEE" && (path === "/dashboard" || path.startsWith("/dashboard/"))) {
        return Response.redirect(new URL("/my-projects", request.nextUrl));
      }

      if (startsWithAny(path, ADMIN_PREFIXES) && (!role || !ADMIN_LIKE.includes(role))) {
        return Response.redirect(new URL(home, request.nextUrl));
      }

      if (
        (path === "/projects/new" || path.startsWith("/projects/new/")) &&
        (!role || !ADMIN_LIKE.includes(role))
      ) {
        return Response.redirect(new URL("/projects", request.nextUrl));
      }

      if (startsWithAny(path, STAFF_PREFIXES) && role === "EMPLOYEE") {
        return Response.redirect(new URL(home, request.nextUrl));
      }

      if (startsWithAny(path, EMPLOYEE_PREFIXES) && role === "EMPLOYEE") {
        return true;
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: Role }).role;
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
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.name = (token.name as string) ?? session.user.name;
        session.user.email = (token.email as string) ?? session.user.email;
        session.user.hrmsUserId = token.hrmsUserId as string | undefined;
        session.user.hrmsEmployeeId = token.hrmsEmployeeId as string | undefined;
        session.user.hrmsFirstName = token.hrmsFirstName as string | undefined;
        session.user.hrmsLastName = token.hrmsLastName as string | undefined;
        session.user.hrmsRole = token.hrmsRole as typeof session.user.hrmsRole;
        session.user.hrmsAvatar = token.hrmsAvatar as string | null | undefined;
        session.user.hrmsDepartmentId = token.hrmsDepartmentId as string | null | undefined;
        session.user.hrmsMustChangePassword = token.hrmsMustChangePassword as boolean | undefined;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
