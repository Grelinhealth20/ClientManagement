"use client";
import { motion } from "framer-motion";

export function Section({ children, delay = 0, className = "" }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

export function StatusPill({ status }) {
  const map = {
    active: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    inactive: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    restricted: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  };
  const dot = {
    active: "bg-emerald-500",
    inactive: "bg-slate-400",
    restricted: "bg-rose-500",
  };
  return (
    <span className={`status-pill ${map[status] || map.inactive}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot[status] || dot.inactive}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function Spinner({ label = "Loading" }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-copper/30 border-t-copper" />
      <span className="text-sm font-semibold">{label}…</span>
    </div>
  );
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="mb-1 grid h-12 w-12 place-items-center rounded-xl2 bg-mist text-copper">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-base font-bold text-navy">{title}</p>
      {hint && <p className="max-w-sm text-sm text-slate-500">{hint}</p>}
      {action}
    </div>
  );
}
