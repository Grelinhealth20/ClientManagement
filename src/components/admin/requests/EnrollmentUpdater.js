"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Field";
import { Panel, CountChip, StatusBadge, Icons } from "@/components/requests/ui";
import { ENROLLMENT_STATUS, fmtDate, fmtDateTime } from "@/lib/requestsDomain";

/**
 * Enrollment Updater — one instance for the facility, one for individual
 * providers. The team adds payers, tracks enrollment status + start date +
 * notes, and appends time-stamped follow-up notes. Fully dynamic.
 */
export default function EnrollmentUpdater({ clientId, scope, payers, onChanged }) {
  const toast = useToast();
  const isProvider = scope === "provider";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);

  function blank() {
    return { payer_name: "", provider_name: "", status: "not_started", start_date: "", notes: "" };
  }

  async function add() {
    if (!form.payer_name.trim()) return toast.error("Payer name is required.");
    if (isProvider && !form.provider_name.trim()) return toast.error("Provider name is required.");
    setSaving(true);
    try {
      await api(`/api/admin/clients/${clientId}/enrollment`, {
        method: "POST",
        body: { scope, ...form },
      });
      toast.success("Payer added.");
      setForm(blank());
      setOpen(false);
      onChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel
      icon={isProvider ? Icons.provider : Icons.building}
      title={isProvider ? "Enrollment Updater — Individual Providers" : "Enrollment Updater — Facility"}
      subtitle="Track payer enrollment status, start date and notes in real time"
      right={
        <div className="flex items-center gap-2">
          <CountChip n={payers.length} label="payers" />
          <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 rounded-lg bg-copper px-3 py-1.5 text-[12px] font-extrabold text-white shadow-copper transition-transform hover:scale-[1.02]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
            Add Payer
          </button>
        </div>
      }
    >
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden">
            <div className="grid gap-3 rounded-xl border-2 border-copper/30 bg-gradient-to-br from-copper/5 to-white p-4 sm:grid-cols-2">
              {isProvider && (
                <Input label="Provider Name" value={form.provider_name} onChange={(e) => setForm((f) => ({ ...f, provider_name: e.target.value }))} placeholder="Dr. Jane Smith" />
              )}
              <Input label="Payer Name" value={form.payer_name} onChange={(e) => setForm((f) => ({ ...f, payer_name: e.target.value }))} placeholder="e.g. Aetna" />
              <Select label="Status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {ENROLLMENT_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
              <Input label="Start Date" type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
              <Textarea label="Status Notes" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Details about this enrollment…" className="sm:col-span-2" />
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button variant="subtle" onClick={() => { setForm(blank()); setOpen(false); }}>Cancel</Button>
                <Button onClick={add} loading={saving}>Add Payer</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {payers.length === 0 && !open ? (
        <p className="py-6 text-center text-[13px] font-medium text-slate-400">No payers yet. Add one to begin tracking enrollment.</p>
      ) : (
        <div className="space-y-3">
          {payers.map((p) => (
            <PayerRow key={p.id} payer={p} isProvider={isProvider} onChanged={onChanged} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function PayerRow({ payer, isProvider, onChanged }) {
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    payer_name: payer.payer_name,
    provider_name: payer.provider_name || "",
    status: payer.status,
    start_date: payer.start_date || "",
    notes: payer.notes || "",
  });
  const [followup, setFollowup] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api(`/api/admin/enrollment/${payer.id}`, { method: "PATCH", body: form });
      toast.success("Enrollment updated.");
      setEdit(false);
      onChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirm("Remove this payer?")) return;
    setBusy(true);
    try {
      await api(`/api/admin/enrollment/${payer.id}`, { method: "DELETE" });
      onChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function addFollowup() {
    if (!followup.trim()) return;
    setBusy(true);
    try {
      await api(`/api/admin/enrollment/${payer.id}/followups`, { method: "POST", body: { note: followup } });
      setFollowup("");
      onChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-mist/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-extrabold text-navy">{payer.payer_name}</p>
            <StatusBadge options={ENROLLMENT_STATUS} value={payer.status} />
          </div>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
            {isProvider && payer.provider_name ? `${payer.provider_name} · ` : ""}
            Start {payer.start_date ? fmtDate(payer.start_date) : "—"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setEdit((e) => !e)} className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11px] font-bold text-navy hover:border-copper/40 hover:text-copper-700">{edit ? "Close" : "Update"}</button>
          <button onClick={remove} disabled={busy} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50" title="Remove payer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>

      {payer.notes && !edit && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-white px-3 py-2 text-[13px] font-bold text-navy ring-1 ring-inset ring-line">{payer.notes}</p>}

      {edit && (
        <div className="mt-3 grid gap-3 rounded-xl border border-copper/30 bg-white p-3 sm:grid-cols-2">
          {isProvider && <Input label="Provider Name" value={form.provider_name} onChange={(e) => setForm((f) => ({ ...f, provider_name: e.target.value }))} />}
          <Input label="Payer Name" value={form.payer_name} onChange={(e) => setForm((f) => ({ ...f, payer_name: e.target.value }))} />
          <Select label="Status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            {ENROLLMENT_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
          <Input label="Start Date" type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
          <Textarea label="Status Notes" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="sm:col-span-2" />
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button variant="subtle" onClick={() => setEdit(false)}>Cancel</Button>
            <Button onClick={save} loading={busy}>Save</Button>
          </div>
        </div>
      )}

      {/* Follow-up notes */}
      <div className="mt-3">
        <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-copper-700">Follow-up Notes</p>
        {payer.followups.length > 0 && (
          <ul className="mb-2 space-y-1.5">
            {payer.followups.map((f) => (
              <li key={f.id} className="rounded-lg bg-white px-3 py-2 ring-1 ring-inset ring-line">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wide text-copper-700">{fmtDateTime(f.created_at)}</span>
                  {f.created_email && <span className="text-[10px] font-semibold text-slate-400">· {f.created_email}</span>}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-[13px] font-bold text-navy">{f.note}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            value={followup}
            onChange={(e) => setFollowup(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addFollowup()}
            placeholder="Add a follow-up note (auto-dated)…"
            className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-[12px] font-medium text-navy outline-none focus:border-copper/50"
          />
          <Button onClick={addFollowup} loading={busy} disabled={!followup.trim()}>Add</Button>
        </div>
      </div>
    </div>
  );
}
