import { prisma } from "@/lib/db";

export async function logProjectActivity(input: {
  projectId: string;
  actorId: string;
  action: string;
  detail: string;
}) {
  await prisma.projectActivity.create({ data: input });
}
