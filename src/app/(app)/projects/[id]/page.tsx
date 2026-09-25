import Link from "next/link";
import { format } from "date-fns";
import { addProjectNote } from "@/actions/misc";
import { closeProject, deleteProject, reopenProject } from "@/actions/projects";
import { HourEntryEditor } from "@/components/hour-entry-editor";
import { productivityHours, sumProductivity } from "@/lib/hour-approval";
import { createTask } from "@/actions/tasks";
import { ProjectForm } from "@/components/project-form";
import { ProjectStatusForm } from "@/components/project-status-form";
import { AddHoursForm } from "@/components/hours-form";
import { BillingHoursForm } from "@/components/billing-hours-form";
import { AlertPills, BillingBadge, HoursBar, TaskBadge } from "@/components/status";
import { ConfirmForm } from "@/components/confirm-form";
import { ExportApprovalButton } from "@/components/export-approval-button";
import { Button, Card, EmptyState, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { PROJECT_STATUS_LABEL, ROLE_LABEL, TASK_STATUS_LABEL, workTypeLabel } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getSettings, hoursByWorkType } from "@/lib/data";
import { billingStatusForProject } from "@/lib/finance";
import { getActiveCurrencies } from "@/lib/currency";
import { getActiveClients, getActiveWorkTypes } from "@/lib/catalog";
import { formatDate, formatHours, formatMoney, getActiveTimeZone } from "@/lib/format";
import { formatDateTimeInZone } from "@hrms/lib/timezone-utils";
import { STAFF_ROLES, TASK_ASSIGNEE_ROLES, canSeeFinance, isAdminLike, requireRole } from "@/lib/permissions";
import { asFormAction } from "@/lib/utils";
import { listDirectReportUsers, managerCanAccessProject } from "@/lib/direct-reports";
import { listAssignablePeople } from "@/lib/people-sync";
import { isProjectStatus } from "@/lib/project-status";
import { notFound } from "next/navigation";

function iso(value?: Date | null) {
  return value ? format(value, "yyyy-MM-dd") : "";
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireRole(...STAFF_ROLES);
  const { id } = await params;
  const { tab = "overview" } = await searchParams;
  const finance = canSeeFinance(user.role);
  const settings = await getSettings();
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      manager: true,
      statusChangedBy: true,
      assignments: { include: { employee: true, assignedBy: true } },
      tasks: { include: { assignedEmployee: true, assignedBy: true, timeEntries: true } },
      timeEntries: { include: { employee: true, task: true }, orderBy: { date: "desc" } },
      notes: { include: { author: true }, orderBy: { createdAt: "desc" } },
      invoices: true,
      currency: true,
      exports: { include: { exportedBy: true }, orderBy: { exportedAt: "desc" }, take: 5 },
      statusChanges: { include: { changedBy: true }, orderBy: { changedAt: "desc" }, take: 8 },
      activities: {
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        include: { actor: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!project) notFound();
  if (user.role === "MANAGER" && !(await managerCanAccessProject(user.id, project.id))) notFound();

  const actual = sumProductivity(project.timeEntries);
  const breakdown = hoursByWorkType(
    project.timeEntries.map((entry) => ({ ...entry, hours: productivityHours(entry) })),
  );
  const heldFrom = project.statusChanges.find((change) => change.toStatus === "HOLD")?.fromStatus;
  const resumeFrom = project.status === "HOLD" && heldFrom && isProjectStatus(heldFrom) && heldFrom !== "HOLD" ? heldFrom : null;
  const people = await listAssignablePeople();
  const currencies = finance ? await getActiveCurrencies() : [];
  const [clients, workTypes] = await Promise.all([getActiveClients(), getActiveWorkTypes()]);
  const employees =
    user.role === "MANAGER"
      ? await listDirectReportUsers(user.id)
      : people.filter((person) => TASK_ASSIGNEE_ROLES.includes(person.role));
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "team", label: "Team" },
    { id: "tasks", label: "Tasks" },
    { id: "time", label: "Time tracking" },
    { id: "notes", label: "Notes" },
    { id: "edit", label: "Edit" },
  ];

  return (
    <div>
      <PageHeader
        title={project.name}
        description={`${project.dxlCode || "No DXL ID"} · ${project.code} · ${project.clientName}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {project.status !== "CLOSE" && project.status !== "CANCEL" ? (
              <ConfirmForm message="Close this project? It will move to Closed Projects and become eligible for billing." action={closeProject.bind(null, project.id)}>
                <Button variant="outline">Mark closed</Button>
              </ConfirmForm>
            ) : isAdminLike(user.role) && project.status === "CLOSE" ? (
              <>
                <ExportApprovalButton projectId={project.id} />
                <ConfirmForm message="Reopen this project?" action={reopenProject.bind(null, project.id)}>
                  <Button variant="outline">Reopen</Button>
                </ConfirmForm>
              </>
            ) : isAdminLike(user.role) && project.status === "CANCEL" ? (
              <ConfirmForm message="Reopen this project?" action={reopenProject.bind(null, project.id)}>
                <Button variant="outline">Reopen</Button>
              </ConfirmForm>
            ) : null}
            {isAdminLike(user.role) ? (
              <ConfirmForm
                message="Remove this project permanently? Hours, tasks, and invoices on it will also be deleted."
                action={deleteProject.bind(null, project.id)}
              >
                <Button variant="danger">Remove project</Button>
              </ConfirmForm>
            ) : null}
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap items-start gap-4">
        <ProjectStatusForm
          unrestricted={user.role === "ADMIN"}
          projectId={project.id}
          status={project.status}
          changedByName={project.statusChangedBy?.name}
          changedAt={project.statusChangedAt}
          resumeFrom={resumeFrom}
        />
        <AlertPills
          eta={project.eta}
          status={project.status}
          actual={actual}
          estimated={project.estimatedHours}
          warningDays={settings.etaWarningDays}
        />
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={`/projects/${project.id}?tab=${item.id}`}
            className={`rounded-full px-3 py-1.5 text-sm ${tab === item.id ? "bg-navy text-white" : "bg-black/5 dark:bg-white/5"}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2">
            <dl className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-muted">DXL Project ID</dt>
                <dd className="mt-1 font-medium">{project.dxlCode || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Project ID</dt>
                <dd className="mt-1 font-medium">{project.code}</dd>
              </div>
              <div>
                <dt className="text-muted">Manager</dt>
                <dd className="mt-1 font-medium">{project.manager.name}</dd>
              </div>
              <div>
                <dt className="text-muted">ETA</dt>
                <dd className="mt-1 font-medium">{formatDate(project.eta)}</dd>
              </div>
              <div>
                <dt className="text-muted">Remaining hours</dt>
                <dd className="mt-1 font-medium">{formatHours(project.estimatedHours - actual)}</dd>
              </div>
                  {finance ? (
                <>
                  <div>
                    <dt className="text-muted">Project value</dt>
                    <dd className="mt-1 font-medium">
                      {formatMoney(project.sellValue, project.currency?.code)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Currency</dt>
                    <dd className="mt-1 font-medium">
                      {project.currency
                        ? `${project.currency.name} (${project.currency.code})`
                        : "Not set"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Programmer / QA / margin</dt>
                    <dd className="mt-1 font-medium">
                      {formatHours(project.programmerHours)} / {formatHours(project.qaHours)} /{" "}
                      {formatHours(project.marginHours)} hrs
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Billing status</dt>
                    <dd className="mt-1">
                      <BillingBadge
                        status={billingStatusForProject(
                          project.status,
                          project.invoices,
                          project.billingStage,
                        )}
                      />
                    </dd>
                  </div>
                </>
              ) : null}
            </dl>
            <p className="mt-6 text-sm text-muted">{project.description || "No description."}</p>
          </Card>
          <Card className="p-6">
            <HoursBar actual={actual} estimated={project.estimatedHours} />
            <div className="mt-4 space-y-2 text-sm">
              <p className="text-xs uppercase tracking-wide text-muted">Productivity</p>
              <p>Initial: {formatHours(breakdown.initial)}</p>
              <p>Changes: {formatHours(breakdown.changes)}</p>
              <p>Live / PM: {formatHours(breakdown.live)}</p>
              {breakdown.other > 0 ? <p>Other: {formatHours(breakdown.other)}</p> : null}
              <p className="font-medium">Total: {formatHours(actual)}</p>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "overview" && finance && user.role === "ADMIN" ? (
        <Card className="mt-6 p-6">
          <h2 className="font-display text-xl">Billing hours</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            These hours are used for billing and reports. Employee time entries stay on productivity.
          </p>
          <BillingHoursForm
            projectId={project.id}
            initialHours={project.billingInitialHours}
            changesHours={project.billingChangesHours}
            liveHours={project.billingLiveHours}
          />
        </Card>
      ) : null}

      {tab === "overview" && project.statusChanges.length > 0 ? (
        <Card className="mt-6 overflow-x-auto">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-xl">Status history</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
              <tr>
                <th className="px-5 py-3">From</th>
                <th className="px-5 py-3">To</th>
                <th className="px-5 py-3">Changed by</th>
                <th className="px-5 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {project.statusChanges.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-5 py-3">{PROJECT_STATUS_LABEL[row.fromStatus as keyof typeof PROJECT_STATUS_LABEL] ?? row.fromStatus}</td>
                  <td className="px-5 py-3">{PROJECT_STATUS_LABEL[row.toStatus as keyof typeof PROJECT_STATUS_LABEL] ?? row.toStatus}</td>
                  <td className="px-5 py-3">{row.changedBy.name}</td>
                  <td className="px-5 py-3">{row.changedAt.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {tab === "overview" && finance && project.exports.length > 0 ? (
        <Card className="mt-6 overflow-x-auto">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-xl">Excel export history</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
              <tr>
                <th className="px-5 py-3">Exported by</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Billing month</th>
                <th className="px-5 py-3">Type</th>
              </tr>
            </thead>
            <tbody>
              {project.exports.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-5 py-3">{row.exportedBy.name}</td>
                  <td className="px-5 py-3">{row.exportedAt.toLocaleString("en-IN")}</td>
                  <td className="px-5 py-3">{format(new Date(row.billingYear, row.billingMonth - 1, 1), "MMMM yyyy")}</td>
                  <td className="px-5 py-3">{row.exportType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {tab === "team" ? (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
              <tr>
                <th className="px-5 py-3">Person</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Assigned by</th>
                <th className="px-5 py-3">Assigned date</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line">
                <td className="px-5 py-3">{project.manager.name}</td>
                <td className="px-5 py-3">Project manager</td>
                <td className="px-5 py-3">—</td>
                <td className="px-5 py-3">{formatDate(project.createdAt)}</td>
              </tr>
              {project.assignments.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-5 py-3">{row.employee.name}</td>
                  <td className="px-5 py-3">Employee</td>
                  <td className="px-5 py-3">{row.assignedBy.name}</td>
                  <td className="px-5 py-3">{formatDate(row.assignedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {tab === "tasks" ? (
        <div className="grid gap-6">
          <Card className="p-6">
            <h2 className="mb-4 font-display text-xl">Add task</h2>
            <form action={asFormAction(createTask.bind(null, project.id))} className="grid gap-4 md:grid-cols-3">
              <Field label="Work type">
                <Select name="workType" required defaultValue={workTypes[0]?.code}>
                  {workTypes.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Assign to">
                <Select name="assignedEmployeeId" defaultValue="">
                  <option value="">Unassigned</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.role === "EMPLOYEE" ? employee.name : `${employee.name} · ${ROLE_LABEL[employee.role]}`}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Hours">
                <Input name="hours" type="number" min="0.5" max="24" step="0.5" placeholder="Optional" />
              </Field>
              <Field label="Estimated hours">
                <Input name="estimatedHours" type="number" step="0.5" defaultValue="8" />
              </Field>
              <Field label="Start date">
                <Input name="startDate" type="date" />
              </Field>
              <Field label="Due date">
                <Input name="dueDate" type="date" />
              </Field>
              <Field label="Status">
                <Select name="status" defaultValue="NOT_STARTED">
                  {Object.entries(TASK_STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Description" className="md:col-span-3">
                <Textarea name="description" />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="selfAssignEnabled" defaultChecked />
                Self-assign enabled
              </label>
              <div>
                <Button type="submit">Add task</Button>
              </div>
            </form>
          </Card>
          <Card className="overflow-x-auto">
            {project.tasks.length === 0 ? (
              <EmptyState title="No tasks yet" description="Add the first task for this project." />
            ) : (
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
                  <tr>
                    <th className="px-5 py-3">Task</th>
                    <th className="px-5 py-3">Assigned</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Est.</th>
                    <th className="px-5 py-3 text-right">Actual</th>
                    <th className="px-5 py-3">Due</th>
                    <th className="px-5 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {project.tasks.map((task) => (
                    <tr key={task.id} className="border-t border-line align-top">
                      <td className="px-5 py-3">
                        <p className="font-medium">{task.name}</p>
                        <p className="text-xs text-muted">{task.description}</p>
                      </td>
                      <td className="px-5 py-3">{task.assignedEmployee?.name ?? "Unassigned"}</td>
                      <td className="px-5 py-3">
                        <TaskBadge status={task.status} />
                      </td>
                      <td className="px-5 py-3 text-right">{formatHours(task.estimatedHours)}</td>
                      <td className="px-5 py-3 text-right">{formatHours(sumHours(task.timeEntries))}</td>
                      <td className="px-5 py-3">{formatDate(task.dueDate)}</td>
                      <td className="px-5 py-3 text-muted">{task.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      ) : null}

      {tab === "time" ? (
        <div className="grid gap-6">
          <Card className="p-6">
            <h2 className="mb-4 font-display text-xl">Add hours</h2>
            <AddHoursForm
              projects={[{ id: project.id, name: project.name, code: project.code }]}
              tasks={project.tasks.map((t) => ({ id: t.id, name: t.name, projectId: project.id }))}
              workTypes={workTypes}
              defaultProjectId={project.id}
              employees={employees}
              canChooseEmployee={user.role !== "EMPLOYEE"}
            />
          </Card>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-5 py-3">Work type</th>
                  <th className="px-5 py-3 text-right">Original</th>
                  <th className="px-5 py-3 text-right">Billable</th>
                  <th className="px-5 py-3">Notes</th>
                  <th className="px-5 py-3">Update</th>
                </tr>
              </thead>
              <tbody>
                {project.timeEntries.map((entry) => (
                  <tr key={entry.id} className="border-t border-line">
                    <td className="px-5 py-3">{formatDate(entry.date)}</td>
                    <td className="px-5 py-3">{entry.employee.name}</td>
                    <td className="px-5 py-3">{workTypeLabel(entry.workType)}</td>
                    <td className="px-5 py-3 text-right">{formatHours(productivityHours(entry))}</td>
                    <td className="px-5 py-3 text-right">{formatHours(entry.hours)}</td>
                    <td className="px-5 py-3">{entry.notes || "—"}</td>
                    <td className="px-5 py-3">
                      <HourEntryEditor
                        entryId={entry.id}
                        hours={entry.hours}
                        notes={entry.notes}
                        canEdit={user.role === "ADMIN" || isAdminLike(user.role) || (entry.projectId === project.id && project.managerId === user.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card className="overflow-x-auto">
            <div className="border-b border-line px-5 py-4">
              <h2 className="font-display text-xl">Last 7 days</h2>
            </div>
            {project.activities.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">No status, hours, or billing changes in the last 7 days.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-black/5 text-left text-xs uppercase text-muted dark:bg-white/5">
                  <tr>
                    <th className="px-5 py-3">When</th>
                    <th className="px-5 py-3">Who</th>
                    <th className="px-5 py-3">Change</th>
                    <th className="px-5 py-3">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {project.activities.map((row) => (
                    <tr key={row.id} className="border-t border-line">
                      <td className="px-5 py-3">{formatDateTimeInZone(row.createdAt, getActiveTimeZone())}</td>
                      <td className="px-5 py-3">{row.actor.name}</td>
                      <td className="px-5 py-3">{row.action}</td>
                      <td className="px-5 py-3">{row.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      ) : null}

      {tab === "notes" ? (
        <div className="grid gap-6">
          <Card className="p-6">
            <form action={asFormAction(addProjectNote.bind(null, project.id))} className="grid gap-3">
              <Field label="Add a note">
                <Textarea name="content" required />
              </Field>
              <div>
                <Button type="submit">Post note</Button>
              </div>
            </form>
          </Card>
          <div className="space-y-3">
            {project.notes.map((note) => (
              <Card key={note.id} className="p-4">
                <p className="text-sm">{note.content}</p>
                <p className="mt-2 text-xs text-muted">
                  {note.author.name} · {formatDate(note.createdAt)}
                </p>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "edit" ? (
        <ProjectForm
          mode="edit"
          projectId={project.id}
          people={people}
          currencies={currencies}
          clients={clients}
          canEditFinance={finance}
          unrestricted={user.role === "ADMIN"}
          resumeFrom={resumeFrom}
          defaults={{
            name: project.name,
            code: project.code,
            clientName: project.clientName,
            description: project.description,
            managerId: project.managerId,
            status: project.status,
            sellValue: finance ? project.sellValue : undefined,
            currencyId: project.currencyId ?? undefined,
            estimatedHours: project.estimatedHours,
            programmerHours: project.programmerHours,
            qaHours: project.qaHours,
            marginHours: project.marginHours,
            startDate: iso(project.startDate),
            eta: iso(project.eta),
            actualStartDate: iso(project.actualStartDate),
            actualCompletionDate: iso(project.actualCompletionDate),
            selfAssignEnabled: project.selfAssignEnabled,
            employeeIds: project.assignments.map((row) => row.employeeId),
          }}
        />
      ) : null}
    </div>
  );
}
