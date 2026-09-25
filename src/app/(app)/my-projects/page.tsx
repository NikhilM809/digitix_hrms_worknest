import { ProjectTrackingList } from "@/components/project-tracking-list";
import { requireRole } from "@/lib/permissions";

export default async function MyProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ tracking?: string; sort?: string; dir?: string; page?: string }>;
}) {
  const user = await requireRole("EMPLOYEE");
  const params = await searchParams;
  return (
    <ProjectTrackingList
      user={user}
      basePath="/my-projects"
      tracking={String(params.tracking || "")}
      sort={String(params.sort || "")}
      dir={params.dir === "desc" ? "desc" : "asc"}
      page={Math.max(1, Number(params.page || 1))}
      title="Projects"
      description="Update status and log hours. Hours you enter are used for productivity."
    />
  );
}
