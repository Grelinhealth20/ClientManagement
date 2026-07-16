"use client";
import { motion } from "framer-motion";

// Icons per step — line-art, inherit currentColor.
function FacilityIcon(p) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M3 21h18M5 21V7l7-4 7 4v14" strokeLinejoin="round" />
      <path d="M9 21v-5h6v5M9 10h.01M15 10h.01M9 13h.01M15 13h.01" strokeLinecap="round" />
    </svg>
  );
}
function ProvidersIcon(p) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" strokeLinecap="round" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 6M17.5 20a5.5 5.5 0 0 0-3-4.9" strokeLinecap="round" />
    </svg>
  );
}
function AccessIcon(p) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <circle cx="8" cy="14" r="3.5" />
      <path d="M10.5 11.5L20 2M17 5l2.5 2.5M14.5 7.5L17 10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ReviewIcon(p) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M9 4h6a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2z" strokeLinejoin="round" />
      <path d="M9.5 3.5h5v3h-5zM9.5 12l2 2 3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const STEP_ICONS = {
  1: FacilityIcon,
  2: ProvidersIcon,
  3: AccessIcon,
  4: ReviewIcon,
};

/**
 * Separated, full-width horizontal progress panel. Each step is a bordered
 * segment with its own icon; the connector between segments fills as steps
 * complete. Active step glows; done steps show a check.
 */
export default function StepProgress({ steps, step, onJump }) {
  return (
    <section className="relative overflow-hidden rounded-xl2 border border-navy/10 bg-white shadow-elev ring-1 ring-inset ring-line">
      <div className="h-1 w-full bg-gradient-to-r from-navy-700 via-copper to-navy-700" />
      <div className="flex items-stretch gap-0 overflow-x-auto p-3 sm:p-4">
        {steps.map((s, i) => {
          const done = s.n < step;
          const active = s.n === step;
          const Icon = STEP_ICONS[s.n];
          return (
            <div key={s.n} className="flex min-w-[132px] flex-1 items-center">
              <button
                type="button"
                onClick={() => onJump(s.n)}
                aria-current={active ? "step" : undefined}
                className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 text-left outline-none transition-all duration-300 ${
                  active
                    ? "border-copper/50 bg-gradient-to-br from-copper/10 to-white shadow-[0_6px_20px_-8px_rgba(207,148,85,0.55)]"
                    : done
                    ? "border-navy/15 bg-navy/[0.03] hover:border-navy/30"
                    : "border-line bg-white hover:border-slate-300"
                }`}
              >
                {active && (
                  <span className="pointer-events-none absolute inset-0 overflow-hidden">
                    <span className="absolute -inset-y-2 -left-1/3 w-1/3 skew-x-12 bg-gradient-to-r from-transparent via-copper/20 to-transparent animate-accent-sweep" />
                  </span>
                )}
                <motion.span
                  initial={false}
                  animate={{ scale: active ? 1.06 : 1 }}
                  transition={{ type: "spring", stiffness: 320, damping: 20 }}
                  className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors duration-300 ${
                    active
                      ? "bg-gradient-to-b from-copper to-copper-700 text-white shadow-copper"
                      : done
                      ? "bg-navy text-white"
                      : "bg-mist text-slate-400 group-hover:text-navy"
                  }`}
                >
                  {done ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <Icon width="20" height="20" />
                  )}
                  {active && (
                    <motion.span
                      className="absolute inset-0 rounded-xl ring-2 ring-copper/40"
                      animate={{ opacity: [0.35, 0.9, 0.35] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                </motion.span>

                <span className="min-w-0">
                  <span className={`block text-[10px] font-extrabold uppercase tracking-[0.16em] ${active ? "text-copper-700" : "text-slate-400"}`}>
                    Step 0{s.n}
                  </span>
                  <span className={`block truncate text-[13px] font-extrabold leading-tight ${active || done ? "text-navy" : "text-slate-400"}`}>
                    {s.title}
                  </span>
                </span>
              </button>

              {/* Connector — animated fill when the step is complete. */}
              {i < steps.length - 1 && (
                <div className="relative mx-1 h-0.5 w-4 shrink-0 rounded-full bg-line sm:w-6">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-navy to-copper"
                    initial={false}
                    animate={{ width: done ? "100%" : "0%" }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
