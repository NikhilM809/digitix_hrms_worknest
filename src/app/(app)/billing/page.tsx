import Link from "next/link";
import { endOfMonth, startOfMonth } from "date-fns";
import { GenerateBillsForm } from "@/components/billing-form";
import { UnbilledBillingReport } from "@/components/unbilled-billing";
import { CurrencyTotals } from "@/components/currency-totals";
import { Card, Input, PageHeader, Select, StatCard } from "@/components/ui";
import { prisma } from "@/lib/db";
import { hoursByWorkType, getSettings, projectSearchWhere } from "@/lib/data";
import { ensureCurrencies } from "@/lib/currency";
import { getActiveClients, getActiveInvoiceServices } from "@/lib/catalog";
import { billableAmount, changesExceedInitialShare, displayBillingStatus, totalsByCurrency } from "@/lib/finance";
import { formatHours, formatMonthYear } from "@/lib/format";
import { ADMIN_LIKE_ROLES, requireRole } from "@/lib/permissions";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; client?: string; scope?: string; q?: string; over?: string }>;
}) {
  await requireRole(...ADMIN_LIKE_ROLES);
  await ensureCurrencies();
  const settings = await getSettings();
  const now = new Date();
  const params = await searchParams;
  const month = Number(params.month || now.getMonth() + 1);
  const year = Number(params.year || now.getFullYear());
  const client = String(params.client || "");
  const q = String(params.q || "").trim();
  const overOnly = params.over === "1";
  const scope = params.scope === "month" ? "month" : "all";
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);

  const unbilled = await prisma.project.findMany({
    where: {
      status: { not: "CANCEL" },
      invoices: { none: {} },
      ...(client ? { clientName: client } : {}),
      AND: [
        ...(q ? [projectSearchWhere(q)] : []),
        ...(scope === "month"
          ? [
              {
                OR: [
                  { actualCompletionDate: { gte: monthStart, lte: monthEnd } },
                  { timeEntries: { some: { date: { gte: monthStart, lte: monthEnd } } } },
                ],
              },
            ]
          : []),
      ],
    },
    include: {
      manager: true,
      currency: true,
      timeEntries: { select: { hours: true, workType: true, status: true } },
    },
    orderBy: [{ status: "asc" }, { eta: "asc" }],
  });

  const unbilledRows = unbilled.map((project) => {
    const approvedEntries = project.timeEntries.filter(
      (entry) => entry.status === "APPROVED" || entry.status === "REVIEWED",
    );
    const hours = hoursByWorkType(approvedEntries);
    return {
      id: project.id,
      code: project.code,
      name: project.name,
      clientName: project.clientName,
      status: project.status,
      managerName: project.manager.name,
      currencyCode: project.currency?.code ?? "",
      sellValue: project.sellValue,
      initialHours: hours.initial,
      changesHours: hours.changes,
      liveHours: hours.live,
      totalHours: hours.total,
      eta: project.eta,
      actualCompletionDate: project.actualCompletionDate,
      startDate: project.startDate,
      createdAt: project.createdAt,
      description: project.description,
      closed: project.status === "CLOSE",
      markedForBilling: project.billingStage === "APPROVED",
    };
  });
  const visibleRows = overOnly
    ? unbilledRows.filter((row) => changesExceedInitialShare(row.sellValue, row.changesHours))
    : unbilledRows;

  const hourTotals = visibleRows.reduce(
    (sum, row) => ({
      initial: sum.initial + row.initialHours,
      changes: sum.changes + row.changesHours,
      total: sum.total + row.totalHours,
    }),
    { initial: 0, changes: 0, total: 0 },
  );

  const ready = await prisma.project.findMany({
    where: {
      status: { not: "CANCEL" },
      billingStage: "APPROVED",
      invoices: { none: {} },
      ...(client ? { clientName: client } : {}),
      ...projectSearchWhere(q),
    },
    include: {
      invoices: true,
      currency: true,
      timeEntries: { select: { hours: true, workType: true, status: true } },
    },
    orderBy: { actualCompletionDate: "desc" },
  });
  const readyRows = ready.map((project) => {
    const hours = hoursByWorkType(
      project.timeEntries.filter((entry) => entry.status === "APPROVED" || entry.status === "REVIEWED"),
    );
    return {
      id: project.id,
      code: project.code,
      name: project.name,
      clientName: project.clientName,
      status: project.status,
      actualCompletionDate: project.actualCompletionDate,
      sellValue: project.sellValue,
      billableTotal: billableAmount(project.sellValue, hours.changes, hours.live),
      currencyCode: project.currency?.code ?? "",
      billingStatus: displayBillingStatus(project),
      billed: false,
      approved: true,
      closed: project.status === "CLOSE",
    };
  });

  const invoices = await prisma.invoice.findMany({
    where: { billingMonth: month, billingYear: year },
  });
  const billedTotals = totalsByCurrency(invoices, (row) => row.amount);
  const paidTotals = totalsByCurrency(invoices.filter((row) => row.status === "PAID"), (row) => row.amount);
  const pendingTotals = totalsByCurrency(invoices.filter((row) => row.status === "GENERATED"), (row) => row.amount);
  const [catalogClients, invoiceServices] = await Promise.all([getActiveClients(), getActiveInvoiceServices()]);
  const clients = catalogClients.map((item) => item.name);
  const exports = await prisma.projectExport.findMany({
    where: { billingMonth: month, billingYear: year, exportType: "EFFORTS_TRACKER" },
    include: { project: true, exportedBy: true },
    orderBy: { exportedAt: "desc" },
    take: 12,
  });

  return (
    <div>
      <PageHeader
        title="Billing"
        description="Review unbilled work, then generate one client invoice. The billable total is the project value plus change and live hours at 20 each. Use the change filter to list projects whose change hours, at 20 each, are more than 20% of the project value."
        actions={
          <Link href="/billing/history" className="text-sm text-teal">
            Billing history
          </Link>
        }
      />
      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <Input name="q" placeholder="Project IDs, comma separated" defaultValue={q} className="w-auto min-w-56" />
        <Select name="month" defaultValue={String(month)} className="w-auto min-w-36">
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {formatMonthYear(i + 1, year).split(" ")[0]}
            </option>
          ))}
        </Select>
        <Select name="year" defaultValue={String(year)} className="w-auto min-w-28">
          {[year - 1, year, year + 1].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        <Select name="client" defaultValue={client} className="w-auto min-w-40">
          <option value="">All clients</option>
          {clients.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
        <Select name="scope" defaultValue={scope} className="w-auto min-w-44">
          <option value="all">All unbilled</option>
          <option value="month">Active in this month</option>
        </Select>
        <Select name="over" defaultValue={overOnly ? "1" : ""} className="w-auto min-w-72">
          <option value="">All change levels</option>
          <option value="1">Changes over 20% of project value</option>
        </Select>
        <button className="h-10 rounded-lg border border-line px-4 text-sm">Run report</button>
      </form>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Unbilled projects" value={visibleRows.length} />
        <StatCard label="Initial hours" value={formatHours(hourTotals.initial)} />
        <StatCard label="Changes hours" value={formatHours(hourTotals.changes)} />
        <StatCard label="Total hours" value={formatHours(hourTotals.total)} />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <CurrencyTotals title="Billed this month" totals={billedTotals} />
        <CurrencyTotals title="Paid" totals={paidTotals} />
        <CurrencyTotals title="Pending payment" totals={pendingTotals} />
      </div>
      <Card className="p-6">
        <UnbilledBillingReport
          key={`${month}-${year}-${client}-${scope}-${q}-${overOnly ? "over" : "all"}`}
          month={month}
          year={year}
          rows={visibleRows}
        />
      </Card>
      <Card className="mt-6 p-6">
        <h2 className="mb-4 font-display text-xl">Generate invoices · {formatMonthYear(month, year)}</h2>
        {readyRows.length === 0 ? (
          <p className="text-sm text-muted">
            Mark unbilled projects above. They will appear here so you can generate one client invoice. Amounts default
            to the project value plus change and live hours at 20 each.
          </p>
        ) : (
          <GenerateBillsForm
            key={readyRows.map((row) => row.id).join(",")}
            month={month}
            year={year}
            gstRate={settings.gstRate}
            rows={readyRows}
            clients={catalogClients}
            services={invoiceServices}
          />
        )}
      </Card>
      {exports.length > 0 ? (
        <Card className="mt-6 overflow-x-auto">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-xl">Tracker exports</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
              <tr>
                <th className="px-5 py-3">Project</th>
                <th className="px-5 py-3">Exported by</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Period</th>
              </tr>
            </thead>
            <tbody>
              {exports.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-5 py-3">{row.project.name}</td>
                  <td className="px-5 py-3">{row.exportedBy.name}</td>
                  <td className="px-5 py-3">{row.exportedAt.toLocaleString("en-IN")}</td>
                  <td className="px-5 py-3">{formatMonthYear(row.billingMonth, row.billingYear)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  );
}
