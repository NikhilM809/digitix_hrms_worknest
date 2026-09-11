export function appHomePath(role?: string | null, hrmsRole?: string | null) {
  if (role === "EMPLOYEE") {
    return hrmsRole ? "/hr/attendance" : "/my-hours";
  }
  return "/dashboard";
}
