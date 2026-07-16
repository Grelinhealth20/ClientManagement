import ClientRequestsWorkspace from "@/components/admin/requests/ClientRequestsWorkspace";

export const dynamic = "force-dynamic";

// Client Requests & Status Updater — checklist builder, facility & provider
// enrollment updaters, and the request-from-client inbox, per selected client.
export default function ClientRequestsPage() {
  return <ClientRequestsWorkspace />;
}
