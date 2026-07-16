"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import { Panel, CountChip, StatusBadge, Icons } from "@/components/requests/ui";
import { TICKET_STATUS, TICKET_CATEGORY, labelFor, fmtDate, fmtDateTime } from "@/lib/requestsDomain";

/**
 * Ticket Tracker — tracks the client's requests to Grelin Health, their status
 * and the threaded responses. New requests are raised from the dashboard's
 * top-right button (see NewRequestModal).
 */
export default function TicketTracker({ tickets, onChanged }) {
  const open = tickets.filter((t) => t.status !== "closed" && t.status !== "resolved").length;

  return (
      <Panel
        icon={Icons.ticket}
        title="Ticket Tracker"
        subtitle="Your requests to Grelin Health and their responses"
        right={<CountChip n={open} label="open" />}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="rounded-lg bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 text-[10px] uppercase tracking-wider text-white">
                <th className="rounded-l-lg px-3 py-3 font-extrabold">Ticket ID</th>
                <th className="px-3 py-3 font-extrabold">Request Sent Date</th>
                <th className="px-3 py-3 font-extrabold">Current Status</th>
                <th className="px-3 py-3 font-extrabold">Notes</th>
                <th className="rounded-r-lg px-3 py-3 text-right font-extrabold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {tickets.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-[13px] font-medium text-slate-400">No requests yet. Raise one and we'll get back to you.</td>
                </tr>
              )}
              {tickets.map((t) => <TicketRow key={t.id} ticket={t} onChanged={onChanged} />)}
            </tbody>
          </table>
        </div>
      </Panel>
  );
}

function TicketRow({ ticket, onChanged }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const lastAdmin = [...ticket.responses].reverse().find((r) => r.author_type === "super_admin");

  async function respond() {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await api(`/api/client/tickets/${ticket.id}/responses`, { method: "POST", body: { message: reply.trim() } });
      setReply("");
      toast.success("Reply sent.");
      onChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <tr className="align-top transition-colors hover:bg-mist/60">
        <td className="px-3 py-3"><span className="rounded-md bg-navy/[0.06] px-2 py-1 font-mono text-[12px] font-bold text-navy">{ticket.ticket_code}</span></td>
        <td className="px-3 py-3 text-[12px] font-semibold text-slate-500">{fmtDate(ticket.created_at)}</td>
        <td className="px-3 py-3"><StatusBadge options={TICKET_STATUS} value={ticket.status} /></td>
        <td className="px-3 py-3">
          <p className="text-[13px] font-bold text-navy">{ticket.subject}</p>
          {lastAdmin ? (
            <p className="mt-0.5 max-w-sm text-[12px] font-medium text-slate-500"><span className="font-bold text-copper-700">Grelin Health:</span> {lastAdmin.message}</p>
          ) : (
            <p className="mt-0.5 text-[11px] font-medium text-slate-400">Awaiting response · {ticket.responses.length} comment{ticket.responses.length === 1 ? "" : "s"}</p>
          )}
        </td>
        <td className="px-3 py-3 text-right">
          <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11px] font-bold text-navy hover:border-copper/40 hover:text-copper-700">
            {open ? "Hide" : "View"}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform ${open ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </td>
      </tr>
      <AnimatePresence>
        {open && (
          <tr>
            <td colSpan={5} className="px-3 pb-4">
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl border border-line bg-mist/50 p-4">
                <div className="flex flex-wrap gap-1.5">
                  {ticket.categories.map((c) => <span key={c} className="rounded bg-copper/10 px-1.5 py-0.5 text-[10px] font-bold text-copper-700">{labelFor(TICKET_CATEGORY, c)}</span>)}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[13px] font-medium text-slate-700">{ticket.details || "—"}</p>
                <div className="mt-3 space-y-2">
                  {ticket.responses.map((r) => (
                    <div key={r.id} className={`rounded-lg px-3 py-2 ring-1 ring-inset ${r.author_type === "super_admin" ? "bg-navy/[0.04] ring-navy/15" : "bg-white ring-line"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-extrabold text-navy">{r.author_type === "super_admin" ? "Grelin Health" : r.author_name || "You"}</span>
                        <span className="text-[10px] font-semibold text-slate-400">{fmtDateTime(r.created_at)}</span>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-[12px] font-medium text-slate-600">{r.message}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder="Add a comment…" className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-[13px] font-medium text-navy outline-none focus:border-copper/50" />
                  <Button onClick={respond} loading={busy} disabled={!reply.trim()}>Send</Button>
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}
