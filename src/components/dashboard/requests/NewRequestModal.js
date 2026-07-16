"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { TICKET_CATEGORY } from "@/lib/requestsDomain";

/**
 * Enterprise "Raise a New Request" dialog. On submit a unique ticket id is
 * created and the caller refreshes so the new ticket appears in the tracker.
 */
export default function NewRequestModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const [subject, setSubject] = useState("");
  const [cats, setCats] = useState([]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setSubject(""); setCats([]); setDetails(""); }
  }, [open]);

  function toggleCat(v) {
    setCats((c) => (c.includes(v) ? c.filter((x) => x !== v) : [...c, v]));
  }
  async function submit() {
    if (!subject.trim()) return toast.error("Please enter a subject.");
    setBusy(true);
    try {
      const res = await api("/api/client/tickets", { method: "POST", body: { subject, categories: cats, details } });
      toast.success(`Request submitted — ticket ${res.ticket_code}.`);
      onClose();
      onCreated?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
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
              <h3 className="text-[16px] font-extrabold tracking-tight text-white">Raise a New Request</h3>
              <p className="text-[11px] font-semibold text-white/55">Tell Grelin Health what you need — a unique ticket id is created on submit.</p>
            </div>
            <div className="space-y-4 p-5">
              <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary of your request" autoFocus />
              <div>
                <label className="field-label">Request Type</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TICKET_CATEGORY.map((c) => {
                    const on = cats.includes(c.value);
                    return (
                      <button key={c.value} type="button" onClick={() => toggleCat(c.value)} className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left transition-colors ${on ? "border-copper bg-copper/5" : "border-line hover:border-slate-300"}`}>
                        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 ${on ? "border-copper bg-copper text-white" : "border-slate-300"}`}>
                          {on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </span>
                        <span className="text-[13px] font-bold text-navy">{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <Textarea label="Details About the Request" rows={5} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Provide as much detail as possible…" />
              <div className="flex justify-end gap-2">
                <Button variant="subtle" onClick={onClose}>Cancel</Button>
                <Button onClick={submit} loading={busy}>Submit Request</Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
