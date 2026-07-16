import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth.js";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(session.role === "super_admin" ? "/admin" : "/dashboard");
}
