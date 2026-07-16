import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth.js";
import { query } from "@/lib/db.js";
import { isMasterAdmin } from "@/lib/env.js";
import { ToastProvider } from "@/components/ui/Toast";
import AdminShell from "@/components/AdminShell";
import ForcePasswordReset from "@/components/ForcePasswordReset";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "super_admin") redirect("/dashboard");

  // Read the live account so a first-login reset (or an admin-triggered reset)
  // is enforced on every request, not just at sign-in. Fetched alongside the
  // bell's first page of notifications — independent queries against a remote
  // DB, so one round trip rather than two.
  const [rows, notifications] = await Promise.all([
    query("SELECT name, email, must_reset_password FROM users WHERE id = :id LIMIT 1", {
      id: session.sub,
    }),
    query(
      `SELECT id, action, entity, entity_id, actor_email, created_at
         FROM audit_log ORDER BY id DESC LIMIT 20`
    ),
  ]);
  const me = rows[0];
  if (!me) redirect("/login");

  const user = { name: me.name, email: me.email };

  // First-login gate: block the entire Super Admin Portal behind a mandatory
  // password reset until the super admin replaces the bootstrap credential.
  if (me.must_reset_password) {
    return (
      <div className="min-h-screen bg-mist">
        <main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4">
          <div className="card p-8 text-center text-sm font-semibold text-slate-500">
            Complete your password setup to access the Super Admin Portal.
          </div>
        </main>
        <ForcePasswordReset email={me.email} redirectTo="/admin" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <AdminShell
        user={user}
        isMaster={isMasterAdmin(session)}
        notifications={notifications.map((n) => ({
          id: String(n.id),
          action: n.action,
          entity: n.entity,
          entity_id: n.entity_id,
          actor: n.actor_email || "system",
          created_at: n.created_at,
        }))}
      >
        {children}
      </AdminShell>
    </ToastProvider>
  );
}
