import { prisma } from "@/lib/db";
import { getCompanyTimezone } from "@hrms/lib/company-timezone";
import { getDateStringInZone } from "@hrms/lib/timezone-utils";

export async function nextDxlCode() {
  const today = getDateStringInZone(new Date(), await getCompanyTimezone());
  const [year, month, day] = today.split("-");
  const prefix = `${day}${month}${year.slice(2)}`;
  const latest = await prisma.project.findFirst({
    where: { dxlCode: { startsWith: prefix } },
    orderBy: { dxlCode: "desc" },
    select: { dxlCode: true },
  });
  const current = latest?.dxlCode ? Number(latest.dxlCode.slice(prefix.length)) : 0;
  const next = (Number.isFinite(current) ? current : 0) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}
