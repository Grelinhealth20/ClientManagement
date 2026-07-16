"use client";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { LayersIcon, TrailIcon, LogoutIcon } from "@/components/icons";

// Icon per client-dashboard section, keyed by permission key (see SECTIONS).
const NAV_ICON = {
  dashboard: LayersIcon,
  onboarding: TrailIcon,
};

export default function ClientTopNav({ user, nav }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-xl">
      {/* Brand-gradient hairline — the signature navy→copper accent. */}
      <div className="h-0.5 w-full bg-gradient-to-r from-navy-700 via-copper to-navy-700" />

      {/* Row 1 — brand identity + secure-session indicator + account. */}
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-3">
          <Image
            src="/grelin-logo.png"
            alt="Grelin Health"
            width={317}
            height={112}
            priority
            className="h-9 w-auto sm:h-10"
          />
          <span className="hidden h-6 w-px bg-line sm:block" />
          <span className="hidden rounded-md bg-mist px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-copper-700 sm:inline">
            Client Workspace
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-3">
          {/* Live secure-session pill — AI/enterprise cue. */}
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 md:inline-flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Secure Session
          </span>

          <div className="mx-1 hidden h-8 w-px bg-line sm:block" />

          <div className="hidden min-w-0 text-right sm:block">
            <p className="truncate text-[13px] font-bold leading-tight text-navy">{user.name}</p>
            <p className="truncate text-[11px] font-medium leading-tight text-slate-400">
              {user.email}
            </p>
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

      {/* Row 2 — futuristic, centered segmented top nav. Clear spacing from the
          identity row above. Only shown when the user has sections. */}
      {nav?.length > 0 && (
        <div className="border-t border-line/70 bg-gradient-to-b from-mist/40 to-white/0">
          <div className="mx-auto flex max-w-7xl justify-center px-4 py-4 sm:px-6 lg:px-8">
            {/* Animated flowing navy↔copper gradient border. The gradient wrapper
                is the visible border; the inner nav sits on top, inset by the
                wrapper's padding. */}
            <div className="animate-border-flow w-full max-w-lg rounded-2xl bg-[linear-gradient(90deg,#0B1F3A,#CF9455,#0B1F3A,#CF9455,#0B1F3A)] bg-[length:200%_100%] p-[2px] shadow-elev sm:w-auto">
              <nav className="flex w-full items-center justify-center gap-1.5 overflow-x-auto rounded-[14px] bg-white/95 p-1.5 backdrop-blur-sm">
                {nav.map((item) => {
                const active =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                const Icon = NAV_ICON[item.key];
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className="group relative flex flex-1 shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-extrabold tracking-tight outline-none sm:flex-none sm:px-7 sm:py-3"
                  >
                    {/* Animated active pill — navy fill with a soft lift; glides
                        between tabs. */}
                    {active && (
                      <motion.span
                        layoutId="client-nav-pill"
                        className="absolute inset-0 rounded-xl bg-gradient-to-b from-navy-700 to-navy-900 shadow-elev ring-1 ring-inset ring-copper/25"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      />
                    )}
                    {Icon && (
                      <Icon
                        size={18}
                        className={`relative z-10 transition-colors ${
                          active ? "text-copper" : "text-slate-400 group-hover:text-navy"
                        }`}
                      />
                    )}
                    <span
                      className={`relative z-10 whitespace-nowrap transition-colors ${
                        active ? "text-white" : "text-navy/70 group-hover:text-navy"
                      }`}
                    >
                      {item.label}
                    </span>
                  </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function initials(name = "") {
  return (
    name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U"
  );
}
