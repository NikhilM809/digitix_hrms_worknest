import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { appHomePath } from "@/lib/home-path";

export default async function Home() {
  const session = await auth();
  const user = session?.user;
  redirect(user?.role ? appHomePath(user.role, user.hrmsRole) : "/login");
}
