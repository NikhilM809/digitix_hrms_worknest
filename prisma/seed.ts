import { readFileSync } from "fs";
import { join } from "path";
import {
  PrismaClient,
  ProjectStatus,
  HourStatus,
  InvoiceStatus,
  Role,
  BillingStage,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const password = bcrypt.hashSync("Digitix@123", 10);

type SeedProject = {
  key: string;
  code: string;
  name: string;
  status: ProjectStatus;
  sellValue: number;
  startDate: string | null;
  eta: string | null;
  actualCompletionDate: string | null;
  billed: boolean;
  poc: string;
  remarks: string;
};

type SeedHour = {
  projectKey: string;
  date: string;
  workType: string;
  hours: number;
  notes: string;
};

type TrackerSeed = {
  clientName: string;
  currencyCode: string;
  projects: SeedProject[];
  hours: SeedHour[];
};

function d(iso: string) {
  const date = new Date(`${iso}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function requiredDate(iso: string | null | undefined, fallback = "2026-03-01") {
  return d(iso ?? "") ?? d(fallback)!;
}

async function main() {
  const tracker = JSON.parse(readFileSync(join(__dirname, "tracker-seed.json"), "utf8")) as TrackerSeed;

  await prisma.timeEntry.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.invoiceBatch.deleteMany();
  await prisma.projectExport.deleteMany();
  await prisma.projectNote.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectAssignment.deleteMany();
  await prisma.projectStatusChange.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.invoiceService.deleteMany();
  await prisma.workTypeOption.deleteMany();
  await prisma.currency.deleteMany();
  await prisma.user.deleteMany();
  await prisma.setting.deleteMany();

  await prisma.setting.create({
    data: {
      id: "default",
      companyName: "Digitixlabs LLP",
      companyAddress: "Flat no - 101, Tower - 2, ACE Parkway, Sector - 150, Noida, UP - 201310",
      companyEmail: "billing@digitixlabs.com",
      companyPhone: "+91 20 6767 2100",
      panNumber: "AAXFD9269P",
      gstin: "09AAXFD9269P1Z0",
      lutNumber: "AD0904260343634",
      servicesDescription: "Survey Programming and Consulting",
      gstRate: 0,
      bankAccountName: "DIGITIXLABS LLP",
      bankName: "IDFC FIRST",
      bankAccountNumber: "51903202550",
      bankIfsc: "IDFB0020102",
      bankSwift: "IDFBINBBMUM",
      bankMicr: "110751003",
      bankBranch: "New Friends Colony Branch, Delhi",
      bankBranchCode: "20102",
      bankCountry: "India",
      billToName: "PUREPROFILE LIMITED",
      billToAddress: "(ACN 167 522 901)\n263 Riley Street\nSurry Hills NSW 2010",
      logoUrl: "/logo.png",
      currency: "AUD",
      etaWarningDays: 7,
      invoicePrefix: "PP/DXL",
    },
  });

  const aud = await prisma.currency.create({
    data: { name: "Australian Dollar", code: "AUD", symbol: "$", active: true, isDefault: true },
  });
  await prisma.currency.create({
    data: { name: "Indian Rupee", code: "INR", symbol: "₹", active: true, isDefault: false },
  });
  await prisma.currency.create({
    data: { name: "US Dollar", code: "USD", symbol: "$", active: true, isDefault: false },
  });
  await prisma.currency.create({
    data: { name: "British Pound", code: "GBP", symbol: "£", active: true, isDefault: false },
  });
  await prisma.currency.create({
    data: { name: "Euro", code: "EUR", symbol: "€", active: true, isDefault: false },
  });

  const admin = await prisma.user.create({
    data: { name: "Priya Nair", email: "admin@digitix.local", password, role: Role.ADMIN },
  });
  const asha = await prisma.user.create({
    data: { name: "Asha Menon", email: "asha@digitix.local", password, role: Role.SENIOR_MANAGER },
  });
  const arjun = await prisma.user.create({
    data: { name: "Arjun Mehta", email: "arjun@digitix.local", password, role: Role.MANAGER },
  });
  const kavya = await prisma.user.create({
    data: { name: "Kavya Shah", email: "kavya@digitix.local", password, role: Role.MANAGER },
  });
  const john = await prisma.user.create({
    data: { name: "John D'Souza", email: "john@digitix.local", password, role: Role.EMPLOYEE },
  });
  const sarah = await prisma.user.create({
    data: { name: "Sarah Khan", email: "sarah@digitix.local", password, role: Role.EMPLOYEE },
  });
  const rohan = await prisma.user.create({
    data: { name: "Rohan Patel", email: "rohan@digitix.local", password, role: Role.EMPLOYEE },
  });
  const meera = await prisma.user.create({
    data: { name: "Meera Iyer", email: "meera@digitix.local", password, role: Role.EMPLOYEE },
  });

  const managers = [arjun, kavya];
  const employees = [john, sarah, rohan, meera];
  const idsByKey = new Map<string, string>();
  const hoursByKey = new Map<string, number>();
  for (const entry of tracker.hours) {
    hoursByKey.set(entry.projectKey, (hoursByKey.get(entry.projectKey) ?? 0) + entry.hours);
  }

  for (const [index, project] of tracker.projects.entries()) {
    const manager = managers[index % managers.length];
    const start = requiredDate(project.startDate);
    const eta = requiredDate(project.eta, project.startDate ?? "2026-03-01");
    const closed = project.status === "CLOSE";
    const completion = d(project.actualCompletionDate ?? "") ?? (closed ? eta : null);
    const estimatedHours = Math.max(hoursByKey.get(project.key) ?? 0, 8);
    const programmerHours = Math.round(estimatedHours * 0.6 * 10) / 10;
    const qaHours = Math.round(estimatedHours * 0.3 * 10) / 10;
    const created = await prisma.project.create({
      data: {
        code: project.code,
        name: project.name,
        clientName: tracker.clientName,
        description: [project.poc ? `POC: ${project.poc}` : "", project.remarks].filter(Boolean).join("\n\n"),
        status: project.status,
        managerId: manager.id,
        sellValue: project.sellValue,
        initialSellValue: project.sellValue,
        programmerHours,
        qaHours,
        marginHours: Math.round((estimatedHours - programmerHours - qaHours) * 10) / 10,
        initialEstimatedHours: estimatedHours,
        currencyId: aud.id,
        billingStage: project.billed ? BillingStage.APPROVED : closed ? BillingStage.PENDING : BillingStage.NONE,
        estimatedHours,
        startDate: start,
        actualStartDate: project.status === "NEED_TO_START" ? null : start,
        eta,
        actualCompletionDate: completion,
        createdAt: start,
        statusChangedAt: start,
        statusChangedById: admin.id,
      },
    });
    idsByKey.set(project.key, created.id);
    await prisma.projectAssignment.createMany({
      data: [
        { projectId: created.id, employeeId: employees[index % employees.length].id, assignedById: manager.id },
        { projectId: created.id, employeeId: employees[(index + 1) % employees.length].id, assignedById: manager.id },
      ],
    });
  }

  for (const [index, entry] of tracker.hours.entries()) {
    const projectId = idsByKey.get(entry.projectKey);
    if (!projectId) continue;
    const employee = employees[index % employees.length];
    await prisma.timeEntry.create({
      data: {
        projectId,
        employeeId: employee.id,
        date: requiredDate(entry.date),
        workType: entry.workType,
        hours: entry.hours,
        originalHours: entry.hours,
        notes: entry.notes,
        status: HourStatus.REVIEWED,
        reviewedById: arjun.id,
      },
    });
  }

  const billed = tracker.projects.filter((project) => project.billed && project.sellValue > 0);
  for (const [index, project] of billed.entries()) {
    const projectId = idsByKey.get(project.key);
    if (!projectId) continue;
    const invoiceDate = requiredDate(project.actualCompletionDate ?? project.eta ?? project.startDate, "2026-08-01");
    await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-${String(index + 1).padStart(5, "0")}`,
        projectId,
        billingMonth: invoiceDate.getUTCMonth() + 1,
        billingYear: invoiceDate.getUTCFullYear(),
        invoiceDate,
        amount: project.sellValue || 0,
        currencyCode: "AUD",
        currencySymbol: "$",
        status: InvoiceStatus.GENERATED,
      },
    });
  }

  await prisma.workTypeOption.createMany({
    data: [
      { code: "INITIAL_SCRIPTING", name: "Initial Scripting", category: "initial", sortOrder: 10 },
      { code: "INITIAL_QA", name: "Initial QA", category: "initial", sortOrder: 20 },
      { code: "CHANGES", name: "Changes", category: "changes", sortOrder: 30 },
      { code: "CHANGES_QA", name: "Changes QA", category: "changes", sortOrder: 40 },
      { code: "LIVE", name: "Live", category: "live", sortOrder: 50 },
      { code: "PROJECT_MANAGEMENT", name: "Project Management", category: "pm", sortOrder: 60 },
    ],
  });
  await prisma.invoiceService.create({ data: { name: "Survey Programming and Consulting" } });
  await prisma.client.create({
    data: {
      name: tracker.clientName,
      legalName: "PUREPROFILE LIMITED",
      address: "(ACN 167 522 901)\n263 Riley Street\nSurry Hills NSW 2010",
    },
  });

  await prisma.notification.create({
    data: {
      userId: admin.id,
      title: "Pureprofile tracker imported",
      message: `${tracker.projects.length} projects and ${tracker.hours.length} hour rows loaded from the efforts tracker.`,
      href: "/billing",
    },
  });
  await prisma.notification.create({
    data: {
      userId: asha.id,
      title: "Studio access",
      message: "Senior managers can create projects and use the same admin tools.",
      href: "/projects/new",
    },
  });

  console.log(`Seeded ${tracker.projects.length} Pureprofile projects and ${tracker.hours.length} hour rows.`);
  console.log("Login: admin@digitix.local / Digitix@123");
  console.log("Senior manager: asha@digitix.local / Digitix@123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
