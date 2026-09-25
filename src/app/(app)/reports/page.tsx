import { getQuarter } from "date-fns";
import { SaleBilledChart } from "@/components/chart";
import { CurrencyTotals } from "@/components/currency-totals";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { prisma } from "@/lib/db";
import { getAllCurrencies } from "@/lib/currency";
import { periodSortKey, remainingByCurrency, totalsByCurrency } from "@/lib/finance";
import { companyToday, formatDate, formatHours } from "@/lib/format";
import { ADMIN_LIKE_ROLES, requireRole } from "@/lib/permissions";
import { getActiveClients } from "@/lib/catalog";

function dayInput(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function periodLabel(date: Date, view: string) {
  if (view === "quarterly") {
    return { label: `Q${getQuarter(date)} ${date.getFullYear()}`, sort: date.getFullYear() * 4 + getQuarter(date) };
  }
  if (view === "yearly") {
    return { label: `${date.getFullYear()}`, sort: date.getFullYear() };
  }
  return {
    label: `${date.toLocaleString("en-IN", { month: "short" })} ${date.getFullYear()}`,
    sort: periodSortKey(date.getMonth() + 1, date.getFullYear()),
  };
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; currency?: string; client?: string; from?: string; to?: string }>;
}) {
  await requireRole(...ADMIN_LIKE_ROLES);
  const { view = "monthly", currency = "", client = "", from: fromParam = "", to: toParam = "" } = await searchParams;
  const [currencies, clients] = await Promise.all([getAllCurrencies(), getActiveClients()]);
  const now = companyToday();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  let from = parseDay(fromParam) ?? defaultFrom;
  let to = parseDay(toParam) ?? defaultTo;
  if (from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  const rangeEnd = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);
  const inRange = (date: Date | null | undefined) => Boolean(date && date >= from && date <= rangeEnd);

  const [projects, invoices, hours] = await Promise.all([
    prisma.project.findMany({
      where: {
        status: { not: "CANCEL" },
        ...(currency ? { currency: { code: currency } } : {}),
        ...(client ? { clientName: client } : {}),
      },
      include: { currency: true },
    }),
    prisma.invoice.findMany({
      where: {
        ...(currency ? { currencyCode: currency } : {}),
        ...(client ? { project: { clientName: client } } : {}),
      },
    }),
    prisma.timeEntry.aggregate({
      where: { date: { gte: from, lte: rangeEnd } },
      _sum: { hours: true },
    }),
  ]);

  const rangedProjects = projects.filter((project) => inRange(project.startDate ?? project.createdAt));
  const rangedInvoices = invoices.filter((invoice) => inRange(invoice.invoiceDate));
  const valueTotals = totalsByCurrency(rangedProjects, (row) => row.sellValue);
  const billedTotals = totalsByCurrency(rangedInvoices, (row) => row.amount);
  const paidTotals = totalsByCurrency(
    rangedInvoices.filter((row) => row.status === "PAID"),
    (row) => row.amount,
  );
  const pendingTotals = remainingByCurrency(valueTotals, billedTotals);
  const chartCode = currency || billedTotals[0]?.[0] || valueTotals[0]?.[0] || "";

  const buckets = new Map<string, { label: string; sort: number; sale: number; billed: number }>();
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const last = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cursor <= last) {
    const period = periodLabel(cursor, view);
    if (!buckets.has(period.label)) buckets.set(period.label, { ...period, sale: 0, billed: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  for (const project of rangedProjects) {
    if ((project.currency?.code ?? "") !== chartCode) continue;
    const period = periodLabel(project.startDate ?? project.createdAt, view);
    const current = buckets.get(period.label) ?? { ...period, sale: 0, billed: 0 };
    current.sale += project.sellValue;
    buckets.set(period.label, current);
  }
  for (const invoice of rangedInvoices) {
    if (invoice.currencyCode !== chartCode) continue;
    const period = periodLabel(invoice.invoiceDate, view);
    const current = buckets.get(period.label) ?? { ...period, sale: 0, billed: 0 };
    current.billed += invoice.amount;
    buckets.set(period.label, current);
  }
  const chart = [...buckets.values()]
    .sort((a, b) => a.sort - b.sort)
    .map(({ label, sale, billed }) => ({ label, sale, billed }));

  return (
    <div>
      <PageHeader
        title="Reports"
        description={`Sale and billed amounts from ${formatDate(from)} to ${formatDate(to)}. The chart starts with the last 6 months. Pending is sale minus billed. Amounts are never mixed across currencies.`}
      />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="From" className="w-40">
          <Input name="from" type="date" defaultValue={dayInput(from)} aria-label="From" />
        </Field>
        <Field label="To" className="w-40">
          <Input name="to" type="date" defaultValue={dayInput(to)} aria-label="To" />
        </Field>
        <Select name="view" defaultValue={view} className="w-40" aria-label="View">
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </Select>
        <Select name="currency" defaultValue={currency} className="w-64" aria-label="Currency">
          <option value="">All currencies (separate totals)</option>
          {currencies.map((item) => (
            <option key={item.id} value={item.code}>
              {item.code}
            </option>
          ))}
        </Select>
        <Select name="client" defaultValue={client} className="w-56" aria-label="Client">
          <option value="">All clients</option>
          {clients.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}
            </option>
          ))}
        </Select>
        <button className="h-10 rounded-lg border border-line px-4 text-sm">Apply</button>
      </form>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CurrencyTotals title="Sale" totals={valueTotals} />
        <CurrencyTotals title="Billed" totals={billedTotals} />
        <CurrencyTotals title="Pending billing" totals={pendingTotals} />
        <CurrencyTotals title="Paid" totals={paidTotals} />
      </div>
      <Card className="p-6">
        <h2 className="mb-2 font-display text-xl">Sale and billed ({chartCode || "no currency"})</h2>
        <p className="mb-4 text-sm text-muted">
          Sale is project value by receive date. Billed is invoice amount by invoice date. Recorded hours:{" "}
          {formatHours(hours._sum.hours ?? 0)}
        </p>
        <SaleBilledChart data={chart} />
      </Card>
    </div>
  );
}
