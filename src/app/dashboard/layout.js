import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth.js";
import { query } from "@/lib/db.js";
import { SECTIONS } from "@/lib/permissions.js";
import { ToastProvider } from "@/components/ui/Toast";
import ClientTopNav from "@/components/ClientTopNav";
import ForcePasswordReset from "@/components/ForcePasswordReset";

export const dynamic = "force-dynamic";

const HREF = {
  dashboard: "/dashboard",
  onboarding: "/dashboard/onboarding",
};

export default async function DashboardLayout({ children }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "super_admin") redirect("/admin");

  // Always read fresh permissions + restriction from the DB so admin changes
  // take effect without forcing the user to sign in again.
  const rows = await query(
    "SELECT name, email, permissions, is_restricted, must_reset_password FROM users WHERE id = :id LIMIT 1",
    { id: session.sub }
  );
  const me = rows[0];
  if (!me || me.is_restricted) redirect("/login");

  // First-login (or post-reset) gate: block every dashboard section behind a
  // mandatory password reset until the user sets their own password.
  if (me.must_reset_password) {
    return (
      <div className="min-h-screen bg-mist">
        <ClientTopNav user={{ name: me.name, email: me.email }} nav={[]} />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="card p-8 text-center text-sm font-semibold text-slate-500">
            Complete your password setup to access your workspace.
          </div>
        </main>
        <ForcePasswordReset email={me.email} />
      </div>
    );
  }

  const permissions = safeJson(me.permissions, []);
  const nav = SECTIONS.filter((s) => permissions.includes(s.key)).map((s) => ({
    href: HREF[s.key],
    label: s.label,
    key: s.key,
  }));

  const user = { name: me.name, email: me.email };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-mist">
        <ClientTopNav user={user} nav={nav} />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </ToastProvider>
  );
}

function safeJson(v, fallback) {
  if (v == null) return fallback;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}
