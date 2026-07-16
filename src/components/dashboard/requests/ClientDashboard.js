"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Section, Spinner } from "@/components/ui/Misc";
import GrelinRequests from "./GrelinRequests";
import EnrollmentTables from "./EnrollmentTables";
import TicketTracker from "./TicketTracker";
import TeamChat from "./TeamChat";
import NewRequestModal from "./NewRequestModal";

const POLL_MS = 12000;

const VIEWS = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
    ),
  },
  {
    key: "tickets",
    label: "Ticket Tracker",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z" strokeLinejoin="round" /></svg>
    ),
  },
  {
    key: "chat",
    label: "Team Chat",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.5A8 8 0 1 1 21 12z" strokeLinejoin="round" /></svg>
    ),
  },
];

/**
 * The client dashboard workspace. A sleek top control bar switches between the
 * Dashboard (requests + enrollment), the Ticket Tracker and Team Chat, and hosts
 * the enterprise "Raise a New Request" action on the top right. Data refreshes
 * in near-real-time so admin-side changes appear promptly.
 */
export default function ClientDashboard() {
  const toast = useToast();
  const [view, setView] = useState("dashboard");
  const [modal, setModal] = useState(false);
  const [data, setData] = useState(null);
  const reqSeq = useRef(0);

  const load = useCallback(
    async ({ quiet } = {}) => {
      const seq = ++reqSeq.current;
      try {
        const [checklists, enrollment, tickets] = await Promise.all([
          api("/api/client/checklists"),
          api("/api/client/enrollment"),
          api("/api/client/tickets"),
        ]);
        if (seq !== reqSeq.current) return;
        setData({
          checklists: checklists.checklists || [],
          facility: enrollment.facility || [],
          provider: enrollment.provider || [],
          tickets: tickets.tickets || [],
        });
      } catch (e) {
        if (!quiet) toast.error(e.message);
        setData((d) => d || { checklists: [], facility: [], provider: [], tickets: [] });
      }
    },
    [toast]
  );

  useEffect(() => {
    load();
    const t = setInterval(() => load({ quiet: true }), POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(() => load({ quiet: true }), [load]);
  const openCount = (data?.tickets || []).filter((t) => t.status !== "closed" && t.status !== "resolved").length;

  return (
    <div className="space-y-5">
      {/* Top control bar: centered view nav · Raise New Request pinned far right */}
      <div className="relative flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <nav className="inline-flex items-center gap-1.5 rounded-2xl border border-line bg-white p-2 shadow-crisp">
          {VIEWS.map((v) => {
            const active = view === v.key;
            return (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className={`relative inline-flex items-center gap-2.5 rounded-xl px-5 py-3 text-[14px] font-extrabold tracking-tight transition-colors ${active ? "text-white" : "text-navy/70 hover:text-navy"}`}
              >
                {active && (
                  <motion.span layoutId="client-view-pill" className="absolute inset-0 rounded-xl bg-gradient-to-b from-navy-700 to-navy-900 shadow-elev ring-1 ring-inset ring-copper/25" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                )}
                <span className={`relative z-10 ${active ? "text-copper" : "text-slate-400"}`}>{v.icon}</span>
                <span className="relative z-10 whitespace-nowrap">{v.label}</span>
                {v.key === "tickets" && openCount > 0 && (
                  <span className={`relative z-10 rounded-full px-1.5 text-[10px] font-extrabold ${active ? "bg-white/20 text-white" : "bg-copper/10 text-copper-700"}`}>{openCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        <button
          onClick={() => setModal(true)}
          className="group inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-copper to-copper-600 px-6 py-3.5 text-[15px] font-extrabold text-white shadow-copper ring-1 ring-inset ring-white/25 transition-transform hover:scale-[1.02] sm:absolute sm:right-0"
        >
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-white/20">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
          </span>
          Raise a New Request
        </button>
      </div>

      {!data ? (
        <Spinner label="Loading your workspace" />
      ) : view === "dashboard" ? (
        <div className="space-y-5">
          {/* Requests From Grelin Health — large, full-width */}
          <Section delay={0.03}>
            <GrelinRequests checklists={data.checklists} onChanged={refresh} />
          </Section>
          {/* Combined enrollment table */}
          <Section delay={0.06}>
            <EnrollmentTables facility={data.facility} provider={data.provider} />
          </Section>
        </div>
      ) : view === "tickets" ? (
        <Section delay={0.03}><TicketTracker tickets={data.tickets} onChanged={refresh} /></Section>
      ) : (
        <Section delay={0.03}><TeamChat /></Section>
      )}

      <NewRequestModal open={modal} onClose={() => setModal(false)} onCreated={refresh} />
    </div>
  );
}
