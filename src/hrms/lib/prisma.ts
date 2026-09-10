import { PrismaClient } from "@prisma/hrms-client";

const globalForHrms = globalThis as unknown as { hrmsPrisma?: PrismaClient };

export const prisma =
  globalForHrms.hrmsPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForHrms.hrmsPrisma = prisma;
}
