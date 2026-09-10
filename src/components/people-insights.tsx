"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AttendanceLeaveTrendChart,
  DepartmentChart,
} from "@hrms/components/dashboard/charts";
import { RecentActivities } from "@hrms/components/dashboard/activity-feed";
import { Skeleton } from "@hrms/components/ui/skeleton";
import { fetchApi } from "@hrms/lib/api-client";

interface DashboardData {
  charts: {
    attendanceTrend: { month: string; present: number; absent: number; late: number }[];
    leaveTrend: { month: string; approved: number; rejected: number; pending: number }[];
    departmentWiseEmployees: { name: string; count: number }[];
  };
  recentActivities: {
    id: string;
    title: string;
    description: string;
    time: string;
    type: "leave" | "attendance" | "announcement" | "birthday" | "anniversary";
  }[];
}

function usePeopleDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchApi<DashboardData>("/api/dashboard"),
  });
}

export function PeopleRecentActivity() {
  const { data, isLoading, isError } = usePeopleDashboard();

  if (isLoading) {
    return <Skeleton className="h-full min-h-[22rem] rounded-3xl" />;
  }

  if (isError || !data) {
    return (
      <section className="flex h-full min-h-[22rem] items-center justify-center rounded-3xl border border-line bg-paper-card p-5 text-sm text-muted">
        Recent activity is unavailable.
      </section>
    );
  }

  return (
    <div className="h-full min-h-[22rem]">
      <RecentActivities activities={data.recentActivities} />
    </div>
  );
}

export function PeopleInsights() {
  const { data, isLoading, isError } = usePeopleDashboard();

  if (isLoading) {
    return (
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  if (isError || !data) return null;

  return (
    <div className="mt-8 space-y-6">
      <div>
        <h2 className="font-display text-xl text-ink">People</h2>
        <p className="mt-1 text-sm text-muted">
          Attendance, leave, and the directory — same employees used on projects.
        </p>
      </div>
      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <AttendanceLeaveTrendChart
          attendance={data.charts.attendanceTrend}
          leave={data.charts.leaveTrend}
        />
        {data.charts.departmentWiseEmployees.length > 0 ? (
          <DepartmentChart data={data.charts.departmentWiseEmployees} />
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
