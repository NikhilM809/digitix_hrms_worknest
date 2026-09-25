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
  CircleUser,
  SlidersHorizontal,
  ScrollText,
  UserCheck,
  Clock,
  Wallet,
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
import { APP_NAME, APP_TAGLINE, HRMS_ROLE_LABEL, ROLE_LABEL } from "@/lib/constants";
import {
  canAccessCompanySettings,
  canAccessDepartments,
  canAccessKra,
  canAccessReports,
  canAccessWorkSchedules,
  canManageEmployeeDocuments,
  canManageEmployees,
  canManageManualAttendance,
  canManageOrgHierarchy,
  canViewTeam,
} from "@hrms/lib/permissions";
import { formatDate } from "@/lib/format";
import { BrandLogo } from "@/components/logo";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };
type NavGroup = { title?: string; items: NavItem[] };

function buildNav(role: Role, hrmsRole?: RoleName, orgVisible = true): NavGroup[] {
  const staff = role === "ADMIN" || role === "SENIOR_MANAGER" || role === "MANAGER";
  const adminLike = role === "ADMIN" || role === "SENIOR_MANAGER";
  const linked = Boolean(hrmsRole);

  const overview: NavItem[] =
    role === "EMPLOYEE" ? [] : [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }];

  const people: NavItem[] = [];
  if (hrmsRole && canManageEmployees(hrmsRole)) {
    people.push({ href: "/hr/employees", label: "Employees", icon: Users });
  } else if (!linked && role === "ADMIN") {
    people.push({ href: "/employees", label: "People", icon: Users });
  }
  if (hrmsRole) {
    if (hrmsRole !== "ADMIN") {
      people.push({ href: "/hr/attendance", label: "Attendance", icon: CalendarCheck });
    }
    if (canManageManualAttendance(hrmsRole)) {
      people.push({ href: "/hr/attendance/manage", label: "Manage attendance", icon: UserCheck });
    }
    people.push(
      { href: "/hr/leave", label: "Leave", icon: CalendarDays },
      { href: "/hr/payslips", label: "Payslips", icon: FileText },
    );
    if (canAccessReports(hrmsRole)) {
      people.push({ href: "/hr/reports", label: "People reports", icon: ChartColumn });
    }
    if (canAccessKra(hrmsRole)) {
      people.push({ href: "/hr/kra", label: "KRA", icon: Target });
    }
    people.push({ href: "/hr/my-documents", label: "My documents", icon: FolderOpen });
    if (canManageEmployeeDocuments(hrmsRole)) {
      people.push({ href: "/hr/employee-documents", label: "Employee files", icon: FolderArchive });
    }
    if (canViewTeam(hrmsRole) && orgVisible) {
      people.push({ href: "/hr/my-team", label: "My team", icon: UsersRound });
    }
    people.push(
      { href: "/hr/notifications", label: "Notifications", icon: Bell },
      { href: "/hr/profile", label: "Profile", icon: CircleUser },
    );
  }

  const work: NavItem[] = [];
  if (staff) {
    work.push(
      { href: "/projects", label: "Projects", icon: FolderKanban },
      { href: "/hours", label: "Hours", icon: Timer },
      { href: "/team", label: "Team", icon: Users },
      { href: "/closed", label: "Closed projects", icon: Archive },
    );
  }
  if (role === "MANAGER" || role === "SENIOR_MANAGER") {
    work.push({ href: "/my-tasks", label: "My tasks", icon: ClipboardList });
  }
  if (role === "EMPLOYEE") {
    work.push(
      { href: "/my-projects", label: "Projects", icon: FolderKanban },
      { href: "/my-tasks", label: "My tasks", icon: ClipboardList },
      { href: "/my-hours", label: "My hours", icon: Timer },
    );
  }
  if (adminLike) {
    work.push({ href: "/reports", label: "Reports", icon: ChartColumn });
  }
  if (role === "ADMIN") {
    work.push({ href: "/billing", label: "Billing", icon: Wallet });
  }

  const company: NavItem[] = [];
  if (hrmsRole) {
    if (orgVisible) {
      company.push({ href: "/hr/organization", label: "Organization", icon: Network });
    }
    company.push({ href: "/hr/policies", label: "Policies", icon: ScrollText });
  }
  if (hrmsRole && canAccessWorkSchedules(hrmsRole)) {
    company.push({ href: "/hr/work-schedules", label: "Work schedules", icon: Clock });
  }
  if (hrmsRole && canAccessDepartments(hrmsRole)) {
    company.push({ href: "/hr/departments", label: "Departments", icon: Building2 });
  }
  if (hrmsRole && canAccessCompanySettings(hrmsRole)) {
    company.push({ href: "/hr/designations", label: "Designations", icon: Briefcase });
    if (canManageOrgHierarchy(hrmsRole)) {
      company.push({ href: "/hr/org-hierarchy", label: "Hierarchy", icon: GitBranch });
    }
    company.push({ href: "/hr/settings", label: "Company", icon: Settings });
  }
  if (adminLike) {
    company.push({ href: "/settings", label: "Workspace", icon: SlidersHorizontal });
  }

  return [
    ...(overview.length ? [{ items: overview }] : []),
    ...(people.length ? [{ title: "People", items: people }] : []),
    ...(work.length ? [{ title: "Work", items: work }] : []),
    ...(company.length ? [{ title: "Company", items: company }] : []),
  ];
}

function navActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  if (href === "/hr/attendance" && pathname.startsWith("/hr/attendance/manage")) return false;
  return true;
}

function NavLinks({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        const active = navActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
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
  orgVisible = true,
  children,
}: {
  user: { name: string; email: string; role: Role; hrmsRole?: RoleName };
  notifications: { id: string; title: string; message: string; href: string | null; read: boolean; createdAt: Date }[];
  orgVisible?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const groups = buildNav(user.role, user.hrmsRole, orgVisible);
  const flatItems = groups.flatMap((group) => group.items);
  const unread = notifications.filter((item) => !item.read).length;
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-paper text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-navy text-white lg:flex">
        <div className="flex items-center gap-3 px-6 py-6">
          <BrandLogo className="ring-1 ring-white/15" />
          <div>
            <p className="font-display text-2xl tracking-tight">{APP_NAME}</p>
            <p className="mt-0.5 text-xs text-white/60">{APP_TAGLINE}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
          {groups.map((group, index) => (
            <div key={group.title ?? `group-${index}`}>
              {group.title ? (
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                  {group.title}
                </p>
              ) : null}
              <div className="space-y-1">
                <NavLinks items={group.items} pathname={pathname} />
              </div>
            </div>
          ))}
        </nav>
        <form action={logoutAction} className="p-4">
          <SignOutButton />
        </form>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-paper/90 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <BrandLogo />
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
                          {item.href ? (
                            <Link
                              href={item.href}
                              prefetch={false}
                              className="block w-full px-3 py-3 text-left hover:bg-black/5 dark:hover:bg-white/5"
                              onClick={() => {
                                if (!item.read) {
                                  void markNotificationRead(item.id);
                                }
                                setOpen(false);
                              }}
                            >
                              <p className="text-sm font-medium">{item.title}</p>
                              <p className="text-xs text-muted">{item.message}</p>
                              <p className="mt-1 text-[11px] text-muted">{formatDate(item.createdAt)}</p>
                            </Link>
                          ) : (
                            <button className="block w-full px-3 py-3 text-left hover:bg-black/5 dark:hover:bg-white/5">
                              <p className="text-sm font-medium">{item.title}</p>
                              <p className="text-xs text-muted">{item.message}</p>
                              <p className="mt-1 text-[11px] text-muted">{formatDate(item.createdAt)}</p>
                            </button>
                          )}
                        </form>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted">
                {user.hrmsRole ? HRMS_ROLE_LABEL[user.hrmsRole] : ROLE_LABEL[user.role]}
              </p>
            </div>
          </div>
        </header>
        <div className="flex gap-2 overflow-x-auto border-b border-line px-4 py-2 lg:hidden">
          {flatItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1 text-sm",
                navActive(pathname, item.href) ? "bg-navy text-white" : "bg-black/5 dark:bg-white/5",
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
