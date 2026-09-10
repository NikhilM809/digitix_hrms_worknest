import { auth } from "@/auth";

export default async function HrLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.hrmsUserId) {
    return (
      <div className="rounded-2xl border border-line bg-paper-card p-8">
        <p className="font-display text-2xl">HRMS is not linked to this login</p>
        <p className="mt-2 text-sm text-muted">
          Use the same email in Worknest and HRMS. Current login:{" "}
          <span className="font-medium text-ink">{session?.user?.email ?? "unknown"}</span>
        </p>
      </div>
    );
  }
  return children;
}
