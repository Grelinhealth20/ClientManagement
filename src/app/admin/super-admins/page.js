import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth.js";
import { isMasterAdmin } from "@/lib/env.js";
import SuperAdminsClient from "@/components/admin/SuperAdminsClient";

export const dynamic = "force-dynamic";

// Master-admin only — non-master super admins are sent back to the Control Center.
export default async function SuperAdminsPage() {
  const session = await getSession();
  if (!session || session.role !== "super_admin") redirect("/login");
  if (!isMasterAdmin(session)) redirect("/admin");
  return <SuperAdminsClient />;
}
