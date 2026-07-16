"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Section, Spinner } from "@/components/ui/Misc";
import ChecklistBuilder from "./ChecklistBuilder";
import EnrollmentUpdater from "./EnrollmentUpdater";
import TicketsPanel from "./TicketsPanel";

const POLL_MS = 15000;

const SECTIONS = [
  {
    key: "checklists",
    label: "Checklists",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /><rect x="4" y="4" width="16" height="16" rx="2.5" /></svg>,
  },
  {
    key: "facility",
    label: "Enrollment — Facility",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M6 21V5l6-2 6 2v16M10 9h.01M14 9h.01M10 13h.01M14 13h.01" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  },
  {
    key: "provider",
    label: "Enrollment — Individual Providers",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="3.5" /><path d="M5 21a7 7 0 0 1 14 0" strokeLinecap="round" /></svg>,
  },
  {
    key: "tickets",
    label: "Request from Client",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z" strokeLinejoin="round" /></svg>,
  },
];

/**
 * The Client Requests workspace: pick a client, then switch between the
 * Checklist builder, the Facility and Individual-Provider enrollment updaters,
 * and the request-from-client inbox via a centered top nav. Near-real-time.
 */
export default function ClientRequestsWorkspace() {
  const toast = useToast();
  const [clients, setClients] = useState(null);
  const [clientId, setClientId] = useState(null);
  const [query, setQuery] = useState("");
  const [data, setData] = useState(null); // { checklists, facility, provider, tickets }
  const [loading, setLoading] = useState(false);
  const [section, setSection] = useState("checklists");
  const reqSeq = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const d = await api("/api/admin/clients");
        setClients(d.clients);
        if (d.clients.length) setClientId(d.clients[0].id);
      } catch (e) {
        toast.error(e.message);
        setClients([]);
      }
    })();
  }, [toast]);

  const load = useCallback(
    async (id, { quiet } = {}) => {
      if (!id) return;
      const seq = ++reqSeq.current;
      if (!quiet) setLoading(true);
      try {
        const [checklists, enrollment, tickets] = await Promise.all([
          api(`/api/admin/clients/${id}/checklists`),
          api(`/api/admin/clients/${id}/enrollment`),
          api(`/api/admin/clients/${id}/tickets`),
        ]);
        if (seq !== reqSeq.current) return; // a newer request superseded this one
        setData({
          checklists: checklists.checklists || [],
          facility: (enrollment.payers || []).filter((p) => p.scope === "facility"),
          provider: (enrollment.payers || []).filter((p) => p.scope === "provider"),
          tickets: tickets.tickets || [],
        });
      } catch (e) {
        if (!quiet) toast.error(e.message);
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    if (!clientId) return;
    setData(null);
    load(clientId);
  }, [clientId, load]);

  // Near-real-time refresh of the selected client's workspace.
  useEffect(() => {
    if (!clientId) return;
    const t = setInterval(() => load(clientId, { quiet: true }), POLL_MS);
    return () => clearInterval(t);
  }, [clientId, load]);

  const refresh = useCallback(() => load(clientId, { quiet: true }), [clientId, load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return clients || [];
    return (clients || []).filter(
      (c) => c.name?.toLowerCase().includes(term) || c.client_code?.toLowerCase().includes(term)
    );
  }, [clients, query]);

  const current = (clients || []).find((c) => c.id === clientId);

  if (clients === null) return <Spinner label="Loading clients" />;
  if (clients.length === 0)
    return <div className="card p-8 text-center text-sm font-semibold text-slate-500">No clients yet. Create a client to manage their requests.</div>;

  return (
    <div className="space-y-5">
      {/* Client picker */}
      <Section>
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <label className="field-label">Select Client</label>
              <div className="flex flex-wrap gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or Client ID…"
                  className="w-56 rounded-xl border border-line bg-white px-3.5 py-2 text-[13px] font-medium text-navy outline-none focus:border-copper/50"
                />
                <select
                  value={clientId ?? ""}
                  onChange={(e) => setClientId(Number(e.target.value))}
                  className="min-w-[220px] flex-1 rounded-xl border border-line bg-white px-3.5 py-2 text-[13px] font-bold text-navy outline-none focus:border-copper/50"
                >
                  {filtered.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} · {c.client_code}</option>
                  ))}
                </select>
              </div>
            </div>
            {current && (
              <div className="rounded-xl bg-mist px-3.5 py-2 text-right">
                <p className="text-[11px] font-semibold text-slate-400">Managing requests for</p>
                <p className="text-[13px] font-extrabold text-navy">{current.name}</p>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* Centered section nav */}
      <Section delay={0.02}>
        <div className="flex justify-center">
          <nav className="inline-flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-line bg-white p-2 shadow-crisp">
            {SECTIONS.map((s) => {
              const active = section === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setSection(s.key)}
                  className={`relative inline-flex items-center gap-2.5 rounded-xl px-5 py-3 text-[13.5px] font-extrabold tracking-tight transition-colors ${active ? "text-white" : "text-navy/70 hover:text-navy"}`}
                >
                  {active && (
                    <motion.span layoutId="admin-req-section-pill" className="absolute inset-0 rounded-xl bg-gradient-to-b from-navy-700 to-navy-900 shadow-elev ring-1 ring-inset ring-copper/25" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                  )}
                  <span className={`relative z-10 ${active ? "text-copper" : "text-slate-400"}`}>{s.icon}</span>
                  <span className="relative z-10 whitespace-nowrap">{s.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </Section>

      {loading || !data ? (
        <Spinner label="Loading workspace" />
      ) : section === "checklists" ? (
        <Section delay={0.03}><ChecklistBuilder clientId={clientId} checklists={data.checklists} onChanged={refresh} /></Section>
      ) : section === "facility" ? (
        <Section delay={0.03}><EnrollmentUpdater clientId={clientId} scope="facility" payers={data.facility} onChanged={refresh} /></Section>
      ) : section === "provider" ? (
        <Section delay={0.03}><EnrollmentUpdater clientId={clientId} scope="provider" payers={data.provider} onChanged={refresh} /></Section>
      ) : (
        <Section delay={0.03}><TicketsPanel tickets={data.tickets} onChanged={refresh} /></Section>
      )}
    </div>
  );
}
