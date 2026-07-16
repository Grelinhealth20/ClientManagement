import { redirect } from "next/navigation";
import { getSession } from "./auth.js";
import { query } from "./db.js";

/**
 * Server-side gate for a client-dashboard section. Reads live permissions
 * from the DB. Redirects unauthenticated/super-admin/restricted users, and
 * sends users without the given section to their first allowed section.
 * Returns { user, permissions }.
 */
export async function requireSection(sectionKey) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "super_admin") redirect("/admin");

  const rows = await query(
    `SELECT u.name, u.email, u.permissions, u.is_restricted, c.status AS client_status
       FROM users u LEFT JOIN clients c ON c.id = u.client_id
      WHERE u.id = :id LIMIT 1`,
    { id: session.sub }
  );
  const me = rows[0];
  // Restricted user, or a user whose organization has been suspended → out.
  if (!me || me.is_restricted || me.client_status === "inactive") redirect("/login");

  let permissions = [];
  try {
    permissions = typeof me.permissions === "object" && me.permissions !== null
      ? me.permissions
      : JSON.parse(me.permissions || "[]");
  } catch {
    permissions = [];
  }

  if (!permissions.includes(sectionKey)) {
    // Route to the first section they can access, else a no-access screen.
    if (permissions.includes("dashboard") && sectionKey !== "dashboard") redirect("/dashboard");
    if (permissions.includes("onboarding") && sectionKey !== "onboarding") redirect("/dashboard/onboarding");
    return { user: { name: me.name, email: me.email }, permissions, denied: true };
  }

  return { user: { name: me.name, email: me.email }, permissions, denied: false };
}
