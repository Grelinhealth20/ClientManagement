"use client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { LogoutIcon } from "@/components/icons";
import NotificationBell from "./NotificationBell";

const NAV = [
  { href: "/admin", label: "Control Center" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/users", label: "Client Users" },
  { href: "/admin/access", label: "Access" },
  { href: "/admin/requests", label: "Client Requests" },
  { href: "/admin/super-admins", label: "Super Admins", master: true },
];

const svg = (paths) => (p) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
    {paths}
  </svg>
);
const NAV_ICONS = {
  "/admin": svg(<><path d="M3 12l9-8 9 8" strokeLinejoin="round" /><path d="M5 10v10h14V10" strokeLinecap="round" /></>),
  "/admin/clients": svg(<><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5" strokeLinejoin="round" /></>),
  "/admin/users": svg(<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.2a3.2 3.2 0 0 1 0 6M17.5 20a5.5 5.5 0 0 0-3-4.9" strokeLinecap="round" /></>),
  "/admin/access": svg(<><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>),
  "/admin/requests": svg(<><path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 8h4M9 12h6M9 16h3" strokeLinecap="round" /><path d="M15.5 4.5l3 3-4.5 1.5 1.5-4.5z" strokeLinejoin="round" /></>),
  "/admin/super-admins": svg(<><path d="M12 3l7 4v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V7l7-4z" strokeLinejoin="round" /><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></>),
};

/**
 * The single top header for the Super Admin portal. Replaces the old fixed
 * sidebar: identity, title, notifications and logout all live here.
 *
 * Deliberately has no section navigation — the logo is the only link, back to
 * the Control Center.
 */
export default function AdminHeader({ user, title, eyebrow, subtitle, actions, notifications, isMaster }) {
  const router = useRouter();
  const pathname = usePathname();

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-xl">
      {/* brand-gradient hairline */}
      <div className="h-0.5 w-full bg-gradient-to-r from-navy-700 via-copper to-navy-700" />

      {/* Row 1 — identity, session, notifications, account */}
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/admin" className="flex shrink-0 items-center gap-3.5">
          <Image src="/grelin-logo.png" alt="Grelin" width={317} height={112} priority className="h-9 w-auto sm:h-11" />
          <span className="hidden h-6 w-px bg-line sm:block" />
          <span
            className={`hidden rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] sm:inline ${
              isMaster ? "bg-copper/10 text-copper-700" : "bg-mist text-copper-700"
            }`}
          >
            {isMaster ? "Master Admin" : "Super Admin"}
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 md:inline-flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Secure Session
          </span>

          <NotificationBell initial={notifications} />
          <div className="mx-0.5 hidden h-8 w-px bg-line sm:block" />

          <div className="hidden min-w-0 text-right sm:block">
            <p className="truncate text-[13px] font-bold leading-tight text-navy">{user.name}</p>
            <p className="truncate text-[11px] font-medium leading-tight text-slate-400">{user.email}</p>
          </div>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy text-[12px] font-extrabold text-white ring-2 ring-copper/30">
            {initials(user.name)}
          </div>

          <button
            onClick={logout}
            className="ml-1 inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-[13px] font-bold text-navy transition-colors hover:border-copper/40 hover:bg-mist hover:text-copper-700"
          >
            <LogoutIcon size={15} />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </div>

      {/* Row 2 — centered, futuristic segmented nav with animated flowing border */}
      <div className="border-t border-line/70 bg-gradient-to-b from-mist/40 to-white/0">
        <div className="mx-auto flex max-w-7xl justify-center px-4 py-5 sm:px-6 lg:px-8">
          <div className="animate-border-flow w-full max-w-5xl rounded-2xl bg-[linear-gradient(90deg,#0B1F3A,#CF9455,#0B1F3A,#CF9455,#0B1F3A)] bg-[length:200%_100%] p-[2.5px] shadow-elev lg:w-auto">
            <nav className="flex w-full items-center justify-center gap-1 overflow-x-auto rounded-[14px] bg-white/95 p-2 backdrop-blur-sm">
              {NAV.filter((n) => !n.master || isMaster).map((n) => {
                const active = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
                const Icon = NAV_ICONS[n.href];
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    aria-current={active ? "page" : undefined}
                    className="group relative flex flex-1 shrink-0 items-center justify-center gap-2 rounded-xl px-3.5 py-3 text-[13.5px] font-extrabold tracking-tight outline-none lg:flex-none lg:px-5"
                  >
                    {active && (
                      <motion.span
                        layoutId="admin-nav-pill"
                        className="absolute inset-0 rounded-xl bg-gradient-to-b from-navy-700 to-navy-900 shadow-elev ring-1 ring-inset ring-copper/25"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      />
                    )}
                    {Icon && (
                      <Icon
                        className={`relative z-10 transition-colors ${active ? "text-copper" : "text-slate-400 group-hover:text-navy"}`}
                      />
                    )}
                    <span className={`relative z-10 whitespace-nowrap transition-colors ${active ? "text-white" : "text-navy/70 group-hover:text-navy"}`}>
                      {n.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Row 3 — page title + page-level actions */}
      <div className="border-t border-line/70 bg-mist/40">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-copper-700">
                {eyebrow}
              </p>
            )}
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1 text-[13px] font-medium text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>

    </header>
  );
}

function initials(name = "") {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "GH";
}
