"use client";
import { usePathname } from "next/navigation";
import AdminHeader from "./admin/AdminHeader";

// Page titles live in the header, but the header is rendered by the layout,
// which cannot see into the page. Deriving the title from the route keeps a
// single header instance — and so a single notification poller — for the whole
// portal, instead of every page rendering its own.
const PAGE_META = {
  "/admin": {
    eyebrow: "Super Admin",
    title: "Control Center",
    subtitle: "Manage clients, provision users, and govern dashboard access.",
  },
  "/admin/clients": {
    eyebrow: "Super Admin",
    title: "Clients",
    subtitle: "Onboarded organizations and their scope of work.",
  },
  "/admin/users": {
    eyebrow: "Super Admin",
    title: "Client Users",
    subtitle: "Provision and manage user accounts for each client.",
  },
  "/admin/access": {
    eyebrow: "Super Admin",
    title: "Access Controls",
    subtitle: "Govern which dashboards each user may reach.",
  },
  "/admin/requests": {
    eyebrow: "Super Admin",
    title: "Client Requests & Status Updater",
    subtitle: "Review incoming client onboarding requests and update their status in real time.",
  },
  "/admin/super-admins": {
    eyebrow: "Master Admin",
    title: "Super Admins",
    subtitle: "Create and manage super administrator accounts.",
  },
};

function metaFor(pathname) {
  if (PAGE_META[pathname]) return PAGE_META[pathname];
  // Nested routes (e.g. /admin/clients/12) inherit their section's heading.
  const section = Object.keys(PAGE_META)
    .filter((p) => p !== "/admin" && pathname.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];
  return PAGE_META[section] ?? PAGE_META["/admin"];
}

export default function AdminShell({ user, notifications, isMaster, children }) {
  const meta = metaFor(usePathname());

  return (
    <div className="min-h-screen bg-mist">
      <AdminHeader
        user={user}
        notifications={notifications}
        isMaster={isMaster}
        eyebrow={meta.eyebrow}
        title={meta.title}
        subtitle={meta.subtitle}
      />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
