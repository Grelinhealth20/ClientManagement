import { query } from "@/lib/db.js";
import { CLIENT_COLUMNS, toClient, serializeClient } from "@/lib/clients.js";
import OverviewClient from "@/components/admin/OverviewClient";

export const dynamic = "force-dynamic";

// The four counters are independent aggregates and the DB is remote, so they go
// in one statement — one round trip rather than four — issued alongside the
// client list.
async function getOverview() {
  const [stats, clientRows] = await Promise.all([
    query(`
      SELECT
        (SELECT COUNT(*) FROM clients)                          AS clients,
        (SELECT COUNT(*) FROM clients WHERE status = 'active')  AS active_clients,
        (SELECT COUNT(*) FROM users WHERE role = 'client_user') AS users,
        (SELECT COUNT(*) FROM users WHERE is_restricted = 1)    AS restricted
    `),
    query(`
      SELECT ${CLIENT_COLUMNS},
             (SELECT COUNT(*) FROM users u WHERE u.client_id = c.id) AS user_count
        FROM clients c
       ORDER BY c.created_at DESC
    `),
  ]);

  const s = stats[0];
  return {
    clients: clientRows.map((r) => serializeClient(toClient(r))),
    counts: {
      clients: Number(s.clients),
      activeClients: Number(s.active_clients),
      users: Number(s.users),
      restricted: Number(s.restricted),
    },
  };
}

export default async function AdminOverview() {
  const { clients, counts } = await getOverview();

  const cards = [
    { label: "Total Clients", value: counts.clients, hint: `${counts.activeClients} active` },
    { label: "Client Users", value: counts.users, hint: "across all clients" },
    { label: "Active Clients", value: counts.activeClients, hint: "currently onboarded" },
    { label: "Restricted Users", value: counts.restricted, hint: "login blocked" },
  ];

  return <OverviewClient cards={cards} clients={clients} />;
}
