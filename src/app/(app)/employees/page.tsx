import { redirect } from "next/navigation";
import { PeopleManager } from "@/components/people-manager";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { ADMIN_LIKE_ROLES, requireRole } from "@/lib/permissions";

export default async function EmployeesPage() {
  const session = await auth();
  if (session?.user?.hrmsUserId) redirect("/hr/employees");

  await requireRole(...ADMIN_LIKE_ROLES);
  const users = await prisma.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] });

  return (
    <div>
      <PageHeader
        title="People"
        description="Project logins for accounts that are not in the employee directory yet."
      />
      <PeopleManager people={users} />
    </div>
  );
}
