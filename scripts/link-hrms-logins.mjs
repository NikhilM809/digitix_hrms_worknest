import { PrismaClient, Role } from "@prisma/client";
import { PrismaClient as HrmsClient } from "@prisma/hrms-client";

const flow = new PrismaClient();
const hrms = new HrmsClient();

function worknestRole(role) {
  if (role === "ADMIN") return Role.ADMIN;
  if (role === "HR") return Role.SENIOR_MANAGER;
  if (role === "MANAGER") return Role.MANAGER;
  return Role.EMPLOYEE;
}

async function main() {
  const people = await hrms.user.findMany({
    where: { status: "ACTIVE" },
    select: { email: true, password: true, firstName: true, lastName: true, role: true },
  });

  for (const person of people) {
    const email = person.email.trim().toLowerCase();
    const name = `${person.firstName} ${person.lastName}`.trim();
    await flow.user.upsert({
      where: { email },
      update: { password: person.password, name, active: true },
      create: {
        email,
        name,
        password: person.password,
        role: worknestRole(person.role),
        active: true,
      },
    });
    console.log("linked", email, person.role);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await flow.$disconnect();
    await hrms.$disconnect();
  });
