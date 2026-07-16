"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Panel, StatusBadge, Icons } from "@/components/requests/ui";
import { ENROLLMENT_STATUS, fmtDate, fmtDateTime } from "@/lib/requestsDomain";

/**
 * Enrollment Status — a single large table combining facility and provider
 * payers. The Notes column shows the latest follow-up note; View opens a detail
 * dialog with the full status notes and the complete follow-up history, kept in
 * sync with the live (polled) data.
 */
export default function EnrollmentTables({ facility, provider }) {
  // Combine into one dataset, tagging each row with its scope display.
  const rows = useMemo(() => {
    const f = (facility || []).map((p) => ({ ...p, scopeKey: "facility", scopeLabel: "Facility" }));
    const pr = (provider || []).map((p) => ({
      ...p,
      scopeKey: `prov:${p.provider_key || p.provider_name || p.id}`,
      scopeLabel: p.provider_name || "Provider",
    }));
    return [...f, ...pr];
  }, [facility, provider]);

  const [detailId, setDetailId] = useState(null);
  const detail = rows.find((r) => r.id === detailId) || null; // live lookup → real-time

  // Filter option lists, derived from the live data.
  const scopeOptions = [
    { value: "facility", label: "Facility" },
    { value: "provider", label: "Individual Providers" },
  ];
  const providerOptions = useMemo(() => {
    const seen = new Map();
    for (const r of rows) if (r.scopeKey !== "facility" && !seen.has(r.scopeKey)) seen.set(r.scopeKey, r.scopeLabel);
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [rows]);
  const payerOptions = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const r of rows) if (!seen.has(r.payer_name)) { seen.add(r.payer_name); out.push({ value: r.payer_name, label: r.payer_name }); }
    return out;
  }, [rows]);

  // null → "all selected"; keeps working as new rows arrive via polling.
  const [scopeSel, setScopeSel] = useState(null);
  const [providerSel, setProviderSel] = useState(null);
  const [payerSel, setPayerSel] = useState(null);
  const scopeActive = scopeSel ?? scopeOptions.map((o) => o.value);
  const providerActive = providerSel ?? providerOptions.map((o) => o.value);
  const payerActive = payerSel ?? payerOptions.map((o) => o.value);

  const filtered = rows.filter((r) => {
    const isFac = r.scopeKey === "facility";
    if (!scopeActive.includes(isFac ? "facility" : "provider")) return false;
    if (!isFac && !providerActive.includes(r.scopeKey)) return false;
    if (!payerActive.includes(r.payer_name)) return false;
    return true;
  });

  return (
    <Panel
      icon={Icons.enrollment}
      title="Enrollment Status"
      subtitle="Facility & individual provider payer enrollments"
    >
      {/* Three checkbox multiselects: Scope · Providers · Payer */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <CheckDropdown
          label="Scope"
          options={scopeOptions}
          active={scopeActive}
          onChange={(vals) => setScopeSel(vals.length === scopeOptions.length ? null : vals)}
        />
        <CheckDropdown
          label="Facility / Providers"
          options={providerOptions}
          active={providerActive}
          onChange={(vals) => setProviderSel(vals.length === providerOptions.length ? null : vals)}
          emptyText="No providers"
        />
        <CheckDropdown
          label="Payer"
          options={payerOptions}
          active={payerActive}
          onChange={(vals) => setPayerSel(vals.length === payerOptions.length ? null : vals)}
          emptyText="No payers"
        />
        <p className="ml-auto self-center text-[12px] font-semibold text-slate-400">
          Showing <span className="font-extrabold text-navy">{filtered.length}</span> payer{filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="rounded-lg bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 text-[10px] uppercase tracking-wider text-white">
              <th className="rounded-l-lg px-4 py-3.5 font-extrabold">Payer Name</th>
              <th className="px-4 py-3.5 font-extrabold">Current Status</th>
              <th className="px-4 py-3.5 font-extrabold">Start Date</th>
              <th className="px-4 py-3.5 font-extrabold">Notes</th>
              <th className="rounded-r-lg px-4 py-3.5 text-right font-extrabold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[13px] font-medium text-slate-400">
                  No payer enrollments match the selected filters.
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const latest = p.followups?.[0]?.note || p.notes || "";
              return (
                <tr key={p.id} className="align-middle transition-colors hover:bg-mist/60">
                  <td className="px-4 py-3.5">
                    <p className="text-[13.5px] font-bold text-navy">{p.payer_name}</p>
                    <span className={`mt-0.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${p.scopeKey === "facility" ? "bg-navy/[0.06] text-navy" : "bg-copper/10 text-copper-700"}`}>
                      {p.scopeLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3.5"><StatusBadge options={ENROLLMENT_STATUS} value={p.status} /></td>
                  <td className="px-4 py-3.5 text-[12.5px] font-semibold text-slate-500">{p.start_date ? fmtDate(p.start_date) : "—"}</td>
                  <td className="px-4 py-3.5">
                    <p className="max-w-md truncate text-[13px] font-bold text-navy">{latest || "—"}</p>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button onClick={() => setDetailId(p.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-[12px] font-bold text-navy transition-colors hover:border-copper/40 hover:text-copper-700">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" strokeLinejoin="round" /><circle cx="12" cy="12" r="2.5" /></svg>
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DetailModal payer={detail} onClose={() => setDetailId(null)} />
    </Panel>
  );
}

/** A labelled dropdown with a checkbox list — multiselect with Select all / Clear. */
function CheckDropdown({ label, options, active, onChange, emptyText }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const disabled = options.length === 0;

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const isAll = active.length === options.length && options.length > 0;
  const summary = disabled ? emptyText || "None" : isAll ? "All" : active.length === 0 ? "None" : `${active.length} selected`;

  function toggle(v) {
    onChange(active.includes(v) ? active.filter((x) => x !== v) : [...active, v]);
  }

  return (
    <div ref={ref} className="relative">
      <span className="pointer-events-none absolute -top-2 left-3 z-10 bg-white px-1 text-[9px] font-extrabold uppercase tracking-wide text-copper-700">{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-w-[170px] items-center justify-between gap-2 rounded-xl border-2 border-line bg-white px-4 py-2.5 text-[13px] font-extrabold text-navy outline-none transition-colors hover:border-copper/40 focus:border-copper/60 disabled:opacity-50"
      >
        <span className="truncate">{summary}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <AnimatePresence>
        {open && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute left-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-white p-1.5 shadow-elev"
          >
            <div className="flex items-center justify-between px-2 py-1.5">
              <button onClick={() => onChange(options.map((o) => o.value))} className="text-[11px] font-extrabold text-copper-700 hover:underline">Select all</button>
              <button onClick={() => onChange([])} className="text-[11px] font-extrabold text-slate-400 hover:text-navy hover:underline">Clear</button>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {options.map((o) => {
                const on = active.includes(o.value);
                return (
                  <button key={o.value} onClick={() => toggle(o.value)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-mist">
                    <span className={`grid shrink-0 place-items-center rounded-md border-2 ${on ? "border-copper bg-copper text-white" : "border-slate-300"}`} style={{ height: 18, width: 18 }}>
                      {on && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-navy">{o.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailModal({ payer, onClose }) {
  return (
    <AnimatePresence>
      {payer && (
        <motion.div className="fixed inset-0 z-[80] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl2 border border-navy/20 bg-white shadow-elev"
          >
            <div className="bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 px-5 py-4">
              <span className="mb-2 block h-0.5 w-full bg-gradient-to-r from-copper/70 via-copper to-copper/70" />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[16px] font-extrabold tracking-tight text-white">{payer.payer_name}</h3>
                  <p className="text-[11px] font-semibold text-white/55">{payer.scopeLabel}{payer.scopeKey !== "facility" ? " · Individual Provider" : ""}</p>
                </div>
                <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white/70 hover:bg-white/20 hover:text-white">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
                </button>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Current Status"><StatusBadge options={ENROLLMENT_STATUS} value={payer.status} /></Field>
                <Field label="Start Date"><span className="text-[13px] font-bold text-navy">{payer.start_date ? fmtDate(payer.start_date) : "—"}</span></Field>
              </div>
              <Field label="Status Notes">
                <p className="whitespace-pre-wrap rounded-lg bg-mist px-3 py-2 text-[13px] font-bold text-navy ring-1 ring-inset ring-line">{payer.notes || "—"}</p>
              </Field>
              <div>
                <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-copper-700">Follow-up Notes ({payer.followups?.length || 0})</p>
                {payer.followups?.length ? (
                  <ul className="max-h-60 space-y-2 overflow-y-auto pr-1">
                    {payer.followups.map((f) => (
                      <li key={f.id} className="rounded-lg border border-line bg-white px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{fmtDateTime(f.created_at)}</span>
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap text-[13px] font-bold text-navy">{f.note}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-lg bg-mist px-3 py-2 text-[12px] font-medium text-slate-400">No follow-up notes yet.</p>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{label}</p>
      {children}
    </div>
  );
}
