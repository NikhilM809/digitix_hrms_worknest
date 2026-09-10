import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { canViewOrgStructure, getOrgHierarchyVisibility } from "@hrms/lib/org-hierarchy-settings";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const sessionUser = session?.user;
  if (!sessionUser?.id || !sessionUser.role) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: sessionUser.id },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const orgVisible = sessionUser.hrmsRole
    ? canViewOrgStructure(sessionUser.hrmsRole, await getOrgHierarchyVisibility())
    : false;

  return (
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
  );
}