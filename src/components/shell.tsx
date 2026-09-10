"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ClipboardList,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  Sun,
  Timer,
  Users,
  Wallet,
  Archive,
  ChartColumn,
  CalendarDays,
  CalendarCheck,
  FileText,
  Target,
  Network,
  FolderOpen,
  FolderArchive,
  Building2,
  Briefcase,
  GitBranch,
  UsersRound,
  Clock,
  Shield,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Role } from "@prisma/client";
import type { RoleName } from "@prisma/hrms-client";
import { logoutAction } from "@/actions/auth";
import { markAllNotificationsRead, markNotificationRead } from "@/actions/misc";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { APP_NAME, APP_TAGLINE, ROLE_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { BrandLogo } from "@/components/logo";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };

const ADMIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/hours", label: "Hours", icon: Timer },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/reports", label: "Reports", icon: ChartColumn },
  { href: "/billing", label: "Billing", icon: Wallet },
  { href: "/closed", label: "Closed Projects", icon: Archive },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MANAGER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/team", label: "My Team", icon: Users },
  { href: "/hours", label: "Hours", icon: Timer },
  { href: "/closed", label: "Closed Projects", icon: Archive },
];

const EMPLOYEE_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/my-projects", label: "My Projects", icon: FolderKanban },
  { href: "/my-tasks", label: "My Tasks", icon: ClipboardList },
  { href: "/my-hours", label: "My Hours", icon: Timer },
];

type HrmsNavItem = NavItem & { roles: RoleName[] };

const HRMS_NAV: HrmsNavItem[] = [
  { href: "/hr/dashboard", label: "HR Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "HR", "MANAGER"] },
  { href: "/hr/employees", label: "HR Employees", icon: Users, roles: ["ADMIN", "HR", "MANAGER"] },
  { href: "/hr/employee-documents", label: "Employee Documents", icon: FolderArchive, roles: ["ADMIN", "HR"] },
  { href: "/hr/attendance", label: "Attendance", icon: CalendarCheck, roles: ["HR", "MANAGER", "EMPLOYEE"] },
  { href: "/hr/leave", label: "Leave", icon: CalendarDays, roles: ["ADMIN", "HR", "MANAGER", "EMPLOYEE"] },
  { href: "/hr/payslips", label: "Payslips", icon: FileText, roles: ["ADMIN", "HR", "MANAGER", "EMPLOYEE"] },
  { href: "/hr/kra", label: "KRA", icon: Target, roles: ["ADMIN", "HR", "MANAGER", "EMPLOYEE"] },
  { href: "/hr/my-documents", label: "My Documents", icon: FolderOpen, roles: ["ADMIN", "HR", "MANAGER", "EMPLOYEE"] },
  { href: "/hr/organization", label: "Organization", icon: Network, roles: ["ADMIN", "HR", "MANAGER", "EMPLOYEE"] },
  { href: "/hr/work-schedules", label: "Work Schedules", icon: Clock, roles: ["ADMIN"] },
  { href: "/hr/departments", label: "Departments", icon: Building2, roles: ["ADMIN"] },
  { href: "/hr/designations", label: "Designations", icon: Briefcase, roles: ["ADMIN"] },
  { href: "/hr/org-hierarchy", label: "Manage Hierarchy", icon: GitBranch, roles: ["ADMIN"] },
  { href: "/hr/my-team", label: "HR My Team", icon: UsersRound, roles: ["ADMIN", "HR", "MANAGER"] },
  { href: "/hr/reports", label: "HR Reports", icon: ChartColumn, roles: ["ADMIN", "MANAGER"] },
  { href: "/hr/policies", label: "Policies", icon: Shield, roles: ["ADMIN", "HR", "MANAGER", "EMPLOYEE"] },
  { href: "/hr/profile", label: "HR Profile", icon: Users, roles: ["ADMIN", "HR", "MANAGER", "EMPLOYEE"] },
  { href: "/hr/settings", label: "HR Settings", icon: Settings, roles: ["ADMIN"] },
];

function hrmsNavFor(role?: RoleName) {
  if (!role) return [];
  return HRMS_NAV.filter((item) => item.roles.includes(role));
}

function NavLinks({
  items,
  pathname,
}: {
  items: NavItem[];
  pathname: string;
}) {
  return (
    <>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
              active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon size={18} />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

function navFor(role: Role) {
  if (role === "ADMIN" || role === "SENIOR_MANAGER") return ADMIN_NAV;
  if (role === "MANAGER") return MANAGER_NAV;
  return EMPLOYEE_NAV;
}

function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white disabled:opacity-60"
      disabled={pending}
    >
      <LogOut size={18} />
      {pending ? "Signing out..." : "Sign out"}
    </button>
  );
}

export function AppShell({
  user,
  notifications,
  children,
}: {
  user: { name: string; email: string; role: Role; hrmsRole?: RoleName };
  notifications: { id: string; title: string; message: string; href: string | null; read: boolean; createdAt: Date }[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = navFor(user.role);
  const hrmsItems = hrmsNavFor(user.hrmsRole);
  const unread = notifications.filter((item) => !item.read).length;
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-paper text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-navy text-white lg:flex">
        <div className="flex items-center gap-3 px-6 py-6">
          <BrandLogo className="h-10 w-10 ring-1 ring-white/15" />
          <div>
            <p className="font-display text-2xl tracking-tight">{APP_NAME}</p>
            <p className="mt-0.5 text-xs text-white/60">{APP_TAGLINE}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          <NavLinks items={items} pathname={pathname} />
          {hrmsItems.length > 0 ? (
            <>
              <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                HRMS
              </p>
              <NavLinks items={hrmsItems} pathname={pathname} />
            </>
          ) : null}
        </nav>
        <form action={logoutAction} className="p-4">
          <SignOutButton />
        </form>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-paper/90 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <BrandLogo className="h-8 w-8" />
            <p className="font-display text-lg">{APP_NAME}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              <Sun className="hidden dark:block" size={16} />
              <Moon className="dark:hidden" size={16} />
            </Button>
            <div className="relative">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
                <Bell size={16} />
                {unread > 0 ? (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-gold" />
                ) : null}
              </Button>
              {open ? (
                <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-line bg-paper-card shadow-xl">
                  <div className="flex items-center justify-between border-b border-line px-3 py-2">
                    <p className="text-sm font-medium">Notifications</p>
                    <form action={markAllNotificationsRead}>
                      <button className="text-xs text-teal">Mark all read</button>
                    </form>
                  </div>
                  <div className="max-h-80 overflow-auto">
                    {notifications.length === 0 ? (
                      <p className="px-3 py-8 text-center text-sm text-muted">No notifications yet.</p>
                    ) : (
                      notifications.map((item) => (
                        <form key={item.id} action={markNotificationRead.bind(null, item.id)}>
                          <button className="block w-full px-3 py-3 text-left hover:bg-black/5 dark:hover:bg-white/5">
                            <p className="text-sm font-medium">{item.title}</p>
                            <p className="text-xs text-muted">{item.message}</p>
                            <p className="mt-1 text-[11px] text-muted">{formatDate(item.createdAt)}</p>
                          </button>
                        </form>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted">{ROLE_LABEL[user.role]}</p>
            </div>
          </div>
        </header>
        <div className="flex gap-2 overflow-x-auto border-b border-line px-4 py-2 lg:hidden">
          {[...items, ...hrmsItems].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1 text-sm",
                pathname.startsWith(item.href) ? "bg-navy text-white" : "bg-black/5 dark:bg-white/5",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <main className="px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
