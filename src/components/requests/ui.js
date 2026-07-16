"use client";
import { TONE_CLASS, metaFor } from "@/lib/requestsDomain";

/** A status pill for any of the module's status vocabularies. */
export function StatusBadge({ options, value }) {
  const m = metaFor(options, value);
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${TONE_CLASS[m.tone] || TONE_CLASS.slate}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {m.label}
    </span>
  );
}

/** A titled card section used to stack the module's panels within a dashboard. */
export function Panel({ icon, title, subtitle, right, children, className = "" }) {
  return (
    <section className={`overflow-hidden rounded-xl2 border border-line bg-white shadow-crisp ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          {icon && (
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-copper-400 ring-1 ring-inset ring-white/15">
              {icon}
            </span>
          )}
          <div>
            <h3 className="text-[15px] font-extrabold tracking-tight text-white">{title}</h3>
            {subtitle && <p className="text-[11px] font-semibold text-white/50">{subtitle}</p>}
          </div>
        </div>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

/** A right-aligned copper counter chip for panel headers. */
export function CountChip({ n, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white ring-1 ring-inset ring-white/15">
      <span className="text-copper-400">{n}</span>
      {label}
    </span>
  );
}

export const Icons = {
  checklist: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
    </svg>
  ),
  enrollment: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
    </svg>
  ),
  ticket: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z" strokeLinejoin="round" />
    </svg>
  ),
  chat: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.5A8 8 0 1 1 21 12z" strokeLinejoin="round" />
    </svg>
  ),
  building: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 21h18M6 21V5l6-2 6 2v16M10 9h.01M14 9h.01M10 13h.01M14 13h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  provider: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 21a7 7 0 0 1 14 0" strokeLinecap="round" />
    </svg>
  ),
};
