import { auth } from "@/auth";

export default async function HrLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.hrmsUserId) {
    return (
      <div className="rounded-2xl border border-line bg-paper-card p-8">
        <p className="font-display text-2xl">This login is not linked to a people profile</p>
        <p className="mt-2 text-sm text-muted">
          Use the same work email for people records and project access. Current login:{" "}
          <span className="font-medium text-ink">{session?.user?.email ?? "unknown"}</span>
        </p>
      </div>
    );
  }
  return children;
}
