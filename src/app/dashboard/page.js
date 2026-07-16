import { requireSection } from "@/lib/clientAccess.js";
import NoAccess from "@/components/NoAccess";
import ClientDashboard from "@/components/dashboard/requests/ClientDashboard";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const { denied } = await requireSection("dashboard");
  if (denied) return <NoAccess />;

  return <ClientDashboard />;
}
