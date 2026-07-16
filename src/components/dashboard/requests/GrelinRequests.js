"use client";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Panel, StatusBadge, Icons } from "@/components/requests/ui";
import { CHECKLIST_STATUS, fmtDateTime } from "@/lib/requestsDomain";

/**
 * Request From Grelin Health — checklist requests the client received. A compact
 * top-left Pending / Completed switcher sits above a fixed-height, scrollable
 * list (about 10 requests visible at once). Each item shows the super admin's
 * detailed note, any file to download, a drag & drop upload zone (when granted),
 * and a completion checkbox. Completing every item auto-closes the request into
 * the Completed queue.
 */
export default function GrelinRequests({ checklists, onChanged }) {
  const [tab, setTab] = useState("pending");
  const pending = checklists.filter((c) => c.status !== "completed");
  const completed = checklists.filter((c) => c.status === "completed");
  const list = tab === "pending" ? pending : completed;

  return (
    <Panel
      icon={Icons.checklist}
      title="Requests From Grelin Health"
      subtitle="Action items and document requests"
    >
      {/* Centered Pending / Completed switcher */}
      <div className="mb-5 flex justify-center">
        <div className="inline-flex items-center gap-1.5 rounded-2xl border border-line bg-mist p-1.5 shadow-crisp">
          <TabButton active={tab === "pending"} onClick={() => setTab("pending")} tone="amber" label="Pending" count={pending.length} />
          <TabButton active={tab === "completed"} onClick={() => setTab("completed")} tone="emerald" label="Completed" count={completed.length} />
        </div>
      </div>

      {/* Fixed-height scroll region: ~10 requests visible, scroll for the rest */}
      <div className="max-h-[calc(100vh-300px)] min-h-[440px] space-y-3 overflow-y-auto pr-1">
        {list.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center gap-2 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-mist text-copper">
              {Icons.checklist}
            </span>
            <p className="text-[13px] font-bold text-navy">
              {tab === "pending" ? "You're all caught up" : "No completed requests yet"}
            </p>
            <p className="max-w-xs text-[12px] font-medium text-slate-400">
              {tab === "pending" ? "New requests from Grelin Health will appear here." : "Completed requests will move here automatically."}
            </p>
          </div>
        ) : (
          list.map((c) => <RequestCard key={c.id} checklist={c} onChanged={onChanged} completedView={tab === "completed"} />)
        )}
      </div>
    </Panel>
  );
}

function TabButton({ active, onClick, label, count, tone }) {
  const dot = tone === "emerald" ? "bg-emerald-500" : "bg-amber-500";
  return (
    <button
      onClick={onClick}
      className={`relative inline-flex items-center gap-2.5 rounded-xl px-6 py-2.5 text-[14px] font-extrabold transition-colors ${active ? "text-white" : "text-navy/70 hover:text-navy"}`}
    >
      {active && (
        <motion.span layoutId="grelin-req-tab" className="absolute inset-0 rounded-xl bg-gradient-to-b from-navy-700 to-navy-900 shadow-elev ring-1 ring-inset ring-copper/25" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
      )}
      <span className={`relative z-10 h-2 w-2 rounded-full ${active ? "bg-copper" : dot}`} />
      <span className="relative z-10">{label}</span>
      <span className={`relative z-10 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${active ? "bg-white/20 text-white" : "bg-white text-slate-500"}`}>{count}</span>
    </button>
  );
}

function RequestCard({ checklist, onChanged, completedView }) {
  const done = checklist.items.filter((i) => i.is_completed).length;
  const pct = checklist.items.length ? Math.round((done / checklist.items.length) * 100) : 0;
  return (
    <div className={`rounded-xl border p-4 ${completedView ? "border-emerald-200 bg-emerald-50/40" : "border-line bg-mist/40"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-extrabold text-navy">{checklist.title}</p>
            <StatusBadge options={CHECKLIST_STATUS} value={checklist.status} />
          </div>
          {checklist.message && <p className="mt-0.5 text-[12px] font-medium text-slate-500">{checklist.message}</p>}
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold text-slate-400">{done}/{checklist.items.length} done</p>
          <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-gradient-to-r from-copper to-navy transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2.5">
        {checklist.items.map((it) => <ClientItem key={it.id} item={it} onChanged={onChanged} />)}
      </div>
    </div>
  );
}

function ClientItem({ item, onChanged }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const adminDocs = item.documents.filter((d) => d.source === "admin");
  const myDocs = item.documents.filter((d) => d.source === "client");

  async function toggle() {
    setBusy(true);
    try {
      const res = await api(`/api/client/checklist-items/${item.id}`, { method: "POST", body: { done: !item.is_completed } });
      if (res.completed) toast.success("Request complete — moved to your Completed queue.");
      onChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function download(doc) {
    try {
      const { url } = await api(`/api/client/checklist-docs/${doc.id}?download=1`);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-white p-3">
      <div className="flex items-start gap-3">
        <button
          onClick={toggle}
          disabled={busy}
          className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition-colors disabled:opacity-50 ${item.is_completed ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 hover:border-copper"}`}
          title={item.is_completed ? "Mark as not done" : "Mark as done"}
        >
          {item.is_completed && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-[13px] font-semibold ${item.is_completed ? "text-slate-400 line-through" : "text-navy"}`}>{item.content}</p>

          {/* Download grant */}
          {item.allow_download && adminDocs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {adminDocs.map((d) => (
                <button key={d.id} onClick={() => download(d)} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[11px] font-bold text-violet-700 hover:bg-violet-100">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 4v11m0 0l-4-4m4 4l4-4" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 19h16" strokeLinecap="round" /></svg>
                  Download {d.filename}
                </button>
              ))}
            </div>
          )}
          {item.allow_download && adminDocs.length === 0 && (
            <p className="mt-1.5 text-[11px] font-medium text-slate-400">A file will appear here to download.</p>
          )}

          {/* Upload grant */}
          {item.allow_upload && (
            <ClientUpload itemId={item.id} docs={myDocs} onChanged={onChanged} />
          )}
        </div>
      </div>
    </div>
  );
}

function ClientUpload({ itemId, docs, onChanged }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  async function upload(list) {
    const arr = Array.from(list || []);
    if (!arr.length) return;
    setBusy(true);
    try {
      for (const file of arr) {
        const p = await api(`/api/client/checklist-items/${itemId}/documents`, {
          method: "POST",
          body: { filename: file.name, content_type: file.type, size: file.size },
        });
        const put = await fetch(p.url, { method: "PUT", headers: p.headers, body: file });
        if (!put.ok) throw new Error("Upload to storage failed.");
        await api(`/api/client/checklist-items/${itemId}/documents`, {
          method: "PUT",
          body: { key: p.key, filename: file.name, content_type: file.type },
        });
      }
      toast.success("File uploaded.");
      onChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }
  async function remove(doc) {
    try {
      await api(`/api/client/checklist-docs/${doc.id}`, { method: "DELETE" });
      onChanged();
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="mt-2">
      {docs.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {docs.map((d) => (
            <span key={d.id} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 3v5h5M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" strokeLinejoin="round" /></svg>
              <span className="max-w-[160px] truncate">{d.filename}</span>
              <button onClick={() => remove(d)} className="text-emerald-500 hover:text-rose-600" title="Remove"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg></button>
            </span>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); }}
        className={`flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-3 text-center transition-all ${dragging ? "scale-[1.01] border-copper bg-copper/10" : "border-slate-300 bg-slate-50/70 hover:border-copper/50 hover:bg-copper/5"}`}
      >
        {busy ? (
          <span className="flex items-center gap-2 text-[12px] font-bold text-copper-700"><Spin /> Uploading…</span>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-copper-700"><path d="M12 15V4M8 8l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="text-[12px] font-bold text-navy">{dragging ? "Release to upload" : "Drag & drop a file, or "}<span className="text-copper-700 underline decoration-copper/40">browse</span></span>
          </>
        )}
      </button>
      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
    </div>
  );
}

function Spin() {
  return <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" /></svg>;
}
