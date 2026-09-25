"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "@hrms/lib/hrms-session";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BarChart3,
  FileSpreadsheet,
  FileText,
  Download,
  Calendar,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { companyDateKey, companyToday } from "@/lib/format";
import { Button } from "@hrms/components/ui/button";
import { Input } from "@hrms/components/ui/input";
import { Label } from "@hrms/components/ui/label";
import { Skeleton } from "@hrms/components/ui/skeleton";
import { Badge } from "@hrms/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@hrms/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@hrms/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@hrms/components/ui/tabs";
import { apiFetch, apiFetchArray } from "@hrms/lib/client-api";
import {
  exportToCsv,
  exportToExcel,
  exportToPdf,
  type ExportRow,
} from "@hrms/lib/export-utils";

type ReportType = "attendance" | "leave" | "employee" | "department";

type ReportEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
};

const REPORT_TITLES: Record<ReportType, string> = {
  attendance: "Attendance Report",
  leave: "Leave Report",
  employee: "Employee Report",
  department: "Department Report",
};

function ExportButtons({
  rows,
  reportType,
}: {
  rows: ExportRow[];
  reportType: ReportType;
}) {
  const filename = `${reportType}-report-${companyDateKey(new Date())}`;
  const title = REPORT_TITLES[reportType];

  const handleExport = (type: "excel" | "csv" | "pdf") => {
    if (rows.length === 0) {
      toast.error("No data to export");
      return;
    }
    if (type === "excel") exportToExcel(rows, filename);
    if (type === "csv") exportToCsv(rows, filename);
    if (type === "pdf") exportToPdf(rows, filename, title);
    toast.success(`Exported as ${type.toUpperCase()}`);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => handleExport("excel")}>
        <FileSpreadsheet className="h-4 w-4" />
        Excel
      </Button>
      <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
        <Download className="h-4 w-4" />
        CSV
      </Button>
      <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>
        <FileText className="h-4 w-4" />
        PDF
      </Button>
    </div>
  );
}

function ReportTable({
  rows,
  isLoading,
}: {
  rows: ExportRow[];
  isLoading: boolean;
}) {
  const [lateTip, setLateTip] = useState<{ text: string; left: number; top: number } | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mb-4 opacity-40" />
        <p>No data available for this report</p>
      </div>
    );
  }

  const headers = Object.keys(rows[0]).filter((header) => header !== "lateReason");

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">
            {headers.map((header) => (
              <th
                key={header}
                className="h-11 px-4 text-left font-medium text-muted-foreground capitalize whitespace-nowrap"
              >
                {header.replace(/([A-Z])/g, " $1").trim()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-border/50 hover:bg-muted/30 transition-colors"
            >
              {headers.map((header) => {
                const value = String(row[header] ?? "-");
                const isLateStatus = header === "status" && value.toUpperCase() === "LATE";
                return (
                  <td key={header} className="px-4 py-2.5 whitespace-nowrap">
                    {isLateStatus ? (
                      <span
                        className="cursor-help font-medium text-teal underline decoration-dotted underline-offset-2"
                        onMouseEnter={(event) => {
                          const box = event.currentTarget.getBoundingClientRect();
                          setLateTip({
                            text: String(row.lateReason || "No comment was entered."),
                            left: box.left + box.width / 2,
                            top: box.top,
                          });
                        }}
                        onMouseLeave={() => setLateTip(null)}
                      >
                        {value}
                      </span>
                    ) : (
                      value
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {lateTip &&
        createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-[80] w-56 rounded-lg border border-line bg-paper px-3 py-2 text-center text-xs font-normal text-ink shadow-lg"
            style={{ left: lateTip.left, top: lateTip.top, transform: "translate(-50%, calc(-100% - 6px))" }}
          >
            {lateTip.text}
          </span>,
          document.body,
        )}
    </div>
  );
}

function ReportPanel({
  type,
  from,
  to,
  employeeId,
  lateOnly,
}: {
  type: ReportType;
  from: string;
  to: string;
  employeeId: string;
  lateOnly: boolean;
}) {
  const params = new URLSearchParams({ type });
  if (from && to) {
    params.set("from", from);
    params.set("to", to);
  }
  if (employeeId) params.set("employeeId", employeeId);
  if (type === "attendance" && lateOnly) params.set("late", "true");

  const { data: rows = [], isLoading, isFetching } = useQuery({
    queryKey: ["reports", type, from, to, employeeId, type === "attendance" && lateOnly],
    queryFn: () => apiFetch<ExportRow[]>(`/api/reports?${params.toString()}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{rows.length} records</Badge>
          {isFetching && !isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <ExportButtons rows={rows} reportType={type} />
      </div>
      <ReportTable rows={rows} isLoading={isLoading} />
    </div>
  );
}

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const canAccess = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";
  const today = companyToday();
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const [fromDate, setFromDate] = useState(companyDateKey(monthAgo));
  const [toDate, setToDate] = useState(companyDateKey(today));
  const [employeeId, setEmployeeId] = useState("");
  const [lateOnly, setLateOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<ReportType>("attendance");

  const { data: employees = [] } = useQuery({
    queryKey: ["report-employees"],
    queryFn: () => apiFetchArray<ReportEmployee>("/api/employees?activeOnly=true"),
    enabled: status === "authenticated" && canAccess,
  });

  if (status === "loading") {
    return <Skeleton className="h-96 w-full rounded-2xl" />;
  }

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <ShieldAlert className="h-16 w-16 text-destructive/60 mb-4" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground mt-2">Reports are available to managers and admins only.</p>
        <Button className="mt-6" variant="outline" onClick={() => router.push("/dashboard")}>
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="font-display text-3xl tracking-tight text-ink flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-brand-600" />
          People reports
        </h1>
        <p className="text-muted-foreground mt-1">
          Attendance, leave, and employee exports
        </p>
      </div>

      <Card glass>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Date Range
          </CardTitle>
          <CardDescription>
            Attendance and leave use this range. Filter by employee on any tab, and by late
            arrivals on Attendance. Weekly and monthly hours are included on Attendance and
            Employee reports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-nowrap items-end gap-3 overflow-x-auto">
            <div className="w-40 shrink-0 space-y-2">
              <Label htmlFor="fromDate">From</Label>
              <Input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="w-40 shrink-0 space-y-2">
              <Label htmlFor="toDate">To</Label>
              <Input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div className="w-72 shrink-0 space-y-2">
              <Label>Employee</Label>
              <Select
                value={employeeId || "all"}
                onValueChange={(value) => setEmployeeId(value === "all" ? "" : value)}
              >
                <SelectTrigger aria-label="Filter by employee">
                  <SelectValue placeholder="All employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All employees</SelectItem>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.firstName} {employee.lastName} ({employee.employeeId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-44 shrink-0 space-y-2">
              <Label>Late</Label>
              <Select
                value={lateOnly ? "late" : "all"}
                onValueChange={(value) => setLateOnly(value === "late")}
                disabled={activeTab !== "attendance"}
              >
                <SelectTrigger aria-label="Filter late attendance">
                  <SelectValue placeholder="All records" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All records</SelectItem>
                  <SelectItem value="late">Late only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card glass>
        <CardContent className="p-4 sm:p-6">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as ReportType)}
          >
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="leave">Leave</TabsTrigger>
              <TabsTrigger value="employee">Employee</TabsTrigger>
              <TabsTrigger value="department">Department</TabsTrigger>
            </TabsList>

            <TabsContent value="attendance">
              <ReportPanel
                type="attendance"
                from={fromDate}
                to={toDate}
                employeeId={employeeId}
                lateOnly={lateOnly}
              />
            </TabsContent>
            <TabsContent value="leave">
              <ReportPanel
                type="leave"
                from={fromDate}
                to={toDate}
                employeeId={employeeId}
                lateOnly={false}
              />
            </TabsContent>
            <TabsContent value="employee">
              <ReportPanel
                type="employee"
                from={fromDate}
                to={toDate}
                employeeId={employeeId}
                lateOnly={false}
              />
            </TabsContent>
            <TabsContent value="department">
              <ReportPanel
                type="department"
                from={fromDate}
                to={toDate}
                employeeId={employeeId}
                lateOnly={false}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}
