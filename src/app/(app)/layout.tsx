import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { canViewOrgStructure, getOrgHierarchyVisibility } from "@hrms/lib/org-hierarchy-settings";
import { getCompanyTimezone } from "@hrms/lib/company-timezone";
import { setActiveTimeZone } from "@/lib/format";
import { TimezoneSync } from "@/components/timezone-sync";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const sessionUser = session?.user;
  if (!sessionUser?.id || !sessionUser.role) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: sessionUser.id },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const [orgVisible, timeZone] = await Promise.all([
    sessionUser.hrmsRole
      ? canViewOrgStructure(sessionUser.hrmsRole, await getOrgHierarchyVisibility())
      : Promise.resolve(false),
    getCompanyTimezone(),
  ]);
  setActiveTimeZone(timeZone);

  return (
    <TimezoneSync timeZone={timeZone}>
    <AppShell
      user={{
        name: sessionUser.name ?? "",
        email: sessionUser.email ?? "",
        role: sessionUser.role,
        hrmsRole: sessionUser.hrmsRole,
      }}
      notifications={notifications}
      orgVisible={orgVisible}
    >
      {children}
    </AppShell>
    </TimezoneSync>
  );
}