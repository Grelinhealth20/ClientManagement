"use client";
import { motion } from "framer-motion";

/**
 * A bordered, full-width section panel with an icon'd header. The shared shell
 * for every onboarding section so they read as one enterprise system.
 */
export function SectionPanel({ title, icon: Icon, accent, right, className = "", children }) {
  return (
    <section
      className={`group/panel relative overflow-hidden rounded-xl2 border border-navy/10 bg-white shadow-elev ring-1 ring-inset ring-line ${className}`}
    >
      {/* Dark navy command-header — strong contrast against the light body. */}
      <header className="relative flex items-center justify-between gap-3 overflow-hidden bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 px-5 py-3">
        {/* Animated light sweep across the header — subtle AI-tech motion. */}
        <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/panel:opacity-100">
          <span className="absolute -inset-y-2 -left-1/3 w-1/3 skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-accent-sweep" />
        </span>
        <div className="relative flex items-center gap-3">
          {Icon && (
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                accent ? "bg-copper text-white shadow-copper" : "bg-white/10 text-copper ring-1 ring-inset ring-white/15"
              }`}
            >
              <Icon width="17" height="17" />
            </span>
          )}
          <h3 className="text-[13px] font-extrabold uppercase tracking-[0.12em] text-white">{title}</h3>
        </div>
        {right && <div className="relative">{right}</div>}
      </header>
      {/* copper hairline under the dark header */}
      <div className="h-0.5 w-full bg-gradient-to-r from-copper/70 via-copper to-copper/70" />
      <div className="p-5">{children}</div>
    </section>
  );
}

/**
 * Centered, futuristic segmented sub-navigation with an animated flowing border
 * and a gliding active pill — the same language as the top nav.
 */
export function SubNav({ tabs, value, onChange, layoutId = "onboarding-subnav-pill" }) {
  return (
    <div className="flex justify-center">
      <div className="animate-border-flow w-full max-w-md rounded-2xl bg-[linear-gradient(90deg,#0B1F3A,#CF9455,#0B1F3A,#CF9455,#0B1F3A)] bg-[length:200%_100%] p-[2px] shadow-elev sm:w-auto">
        <nav className="flex w-full items-center justify-center gap-1.5 rounded-[14px] bg-white/95 p-1.5 backdrop-blur-sm">
          {tabs.map((t) => {
            const active = t.value === value;
            const Icon = t.icon;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => onChange(t.value)}
                aria-pressed={active}
                className="group relative flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-extrabold tracking-tight outline-none sm:flex-none sm:px-8 sm:py-3"
              >
                {active && (
                  <motion.span
                    layoutId={layoutId}
                    className="absolute inset-0 rounded-xl bg-gradient-to-b from-navy-700 to-navy-900 shadow-elev ring-1 ring-inset ring-copper/25"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                {Icon && (
                  <Icon
                    width="17"
                    height="17"
                    className={`relative z-10 transition-colors ${active ? "text-copper" : "text-slate-400 group-hover:text-navy"}`}
                  />
                )}
                <span className={`relative z-10 whitespace-nowrap transition-colors ${active ? "text-white" : "text-navy/70 group-hover:text-navy"}`}>
                  {t.label}
                </span>
                {t.badge != null && (
                  <span
                    className={`relative z-10 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-extrabold ${
                      active ? "bg-copper text-white" : "bg-navy/10 text-navy"
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
