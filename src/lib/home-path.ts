export function appHomePath(role?: string | null, _hrmsRole?: string | null) {
  if (role === "EMPLOYEE") return "/my-projects";
  return "/dashboard";
}
