"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@hrms/components/ui/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
  Legend,
} from "recharts";

const CHART_TOOLTIP = {
  backgroundColor: "var(--paper-card)",
  border: "1px solid var(--line)",
  borderRadius: "12px",
  color: "var(--ink)",
};

const COLORS = ["#0b6e6a", "#15202e", "#c47b1a", "#085753", "#1d2b3d", "#3cb8b1"];

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  delay?: number;
}

export function ChartCard({ title, children, delay = 0 }: ChartCardProps) {
  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card glass className="flex h-full flex-col">
        <CardHeader>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">{children}</CardContent>
      </Card>
    </motion.div>
  );
}

interface AttendanceTrendChartProps {
  data: { month: string; present: number; absent: number; late: number }[];
}

export function AttendanceTrendChart({ data }: AttendanceTrendChartProps) {
  return (
    <ChartCard title="Attendance Trend">
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0b6e6a" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0b6e6a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="month" className="text-xs" />
          <YAxis className="text-xs" />
          <Tooltip contentStyle={CHART_TOOLTIP} />
          <Area type="monotone" dataKey="present" stroke="#0b6e6a" fill="url(#colorPresent)" strokeWidth={2} />
          <Area type="monotone" dataKey="late" stroke="#c47b1a" fill="transparent" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

interface AttendanceLeaveTrendChartProps {
  attendance: { month: string; present: number; absent: number; late: number }[];
  leave: { month: string; approved: number; rejected: number; pending: number }[];
}

export function AttendanceLeaveTrendChart({
  attendance,
  leave,
}: AttendanceLeaveTrendChartProps) {
  const leaveByMonth = Object.fromEntries(leave.map((row) => [row.month, row]));
  const data = attendance.map((row) => ({
    month: row.month,
    present: row.present,
    late: row.late,
    approved: leaveByMonth[row.month]?.approved ?? 0,
    pending: leaveByMonth[row.month]?.pending ?? 0,
  }));

  return (
    <ChartCard title="Attendance & leave">
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data}>
          <defs>
            <linearGradient id="colorPresentMerged" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0b6e6a" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0b6e6a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="month" className="text-xs" />
          <YAxis className="text-xs" />
          <Tooltip contentStyle={CHART_TOOLTIP} />
          <Legend />
          <Area
            type="monotone"
            dataKey="present"
            name="Present"
            stroke="#0b6e6a"
            fill="url(#colorPresentMerged)"
            strokeWidth={2}
          />
          <Line type="monotone" dataKey="late" name="Late" stroke="#c47b1a" strokeWidth={2} dot={false} />
          <Bar dataKey="approved" name="Leave approved" fill="#15202e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="pending" name="Leave pending" fill="#3cb8b1" radius={[4, 4, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

interface LeaveTrendChartProps {
  data: { month: string; approved: number; rejected: number; pending: number }[];
}

export function LeaveTrendChart({ data }: LeaveTrendChartProps) {
  return (
    <ChartCard title="Leave Trend">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="month" className="text-xs" />
          <YAxis className="text-xs" />
          <Tooltip contentStyle={CHART_TOOLTIP} />
          <Bar dataKey="approved" fill="#0b6e6a" radius={[4, 4, 0, 0]} />
          <Bar dataKey="pending" fill="#c47b1a" radius={[4, 4, 0, 0]} />
          <Bar dataKey="rejected" fill="#b42318" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

interface DepartmentChartProps {
  data: { name: string; count: number }[];
}

export function DepartmentChart({ data }: DepartmentChartProps) {
  return (
    <ChartCard title="Employees by department">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={4}
            dataKey="count"
            nameKey="name"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={CHART_TOOLTIP} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        {data.map((item, index) => (
          <div key={item.name} className="flex items-center gap-1.5 text-xs">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span>{item.name} ({item.count})</span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

interface MonthlyLeaveChartProps {
  data: { type: string; days: number }[];
}

export function MonthlyLeaveChart({ data }: MonthlyLeaveChartProps) {
  return (
    <ChartCard title="Monthly Leave Summary">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis type="number" className="text-xs" />
          <YAxis dataKey="type" type="category" className="text-xs" width={100} />
          <Tooltip contentStyle={CHART_TOOLTIP} />
          <Bar dataKey="days" fill="#15202e" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
