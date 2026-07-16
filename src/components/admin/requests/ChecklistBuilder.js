"use client";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { Panel, CountChip, StatusBadge, Icons } from "@/components/requests/ui";
import { CHECKLIST_STATUS, fmtDateTime } from "@/lib/requestsDomain";

const blankItem = () => ({ content: "", allow_upload: true, allow_download: false, file: null });

/** Upload one File to a saved checklist item (presign → S3 PUT → confirm). */
async function uploadFileToItem(itemId, file) {
  const p = await api(`/api/admin/checklist-items/${itemId}/documents`, {
    method: "POST",
    body: { filename: file.name, content_type: file.type, size: file.size },
  });
  const put = await fetch(p.url, { method: "PUT", headers: p.headers, body: file });
  if (!put.ok) throw new Error("Upload to storage failed.");
  await api(`/api/admin/checklist-items/${itemId}/documents`, {
    method: "PUT",
    body: { key: p.key, filename: file.name, content_type: file.type },
  });
}

/**
 * Checklist Builder — a super admin composes a request (title + message + items)
 * and grants per-item upload/download access. Pending vs completed queues; a
 * completed checklist can be reopened and routed back to the client.
 */
export default function ChecklistBuilder({ clientId, checklists, onChanged }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [items, setItems] = useState([blankItem()]);
  const [saving, setSaving] = useState(false);

  const pending = checklists.filter((c) => c.status !== "completed");
  const completed = checklists.filter((c) => c.status === "completed");

  function reset() {
    setTitle("");
    setMessage("");
    setItems([blankItem()]);
    setOpen(false);
  }

  async function create() {
    const clean = items.filter((i) => i.content.trim());
    if (!clean.length) return toast.error("Add at least one checklist item.");
    setSaving(true);
    try {
      const res = await api(`/api/admin/clients/${clientId}/checklists`, {
        method: "POST",
        body: { title, message, items: clean.map(({ file, ...rest }) => rest) },
      });

      // Upload any download-grant files the admin attached in the builder. The
      // server inserts items in the same order we sent them, so we match the
      // saved item ids back to our list by position.
      const toUpload = clean.map((c, i) => ({ c, i })).filter(({ c }) => c.allow_download && c.file);
      if (toUpload.length && res?.id) {
        const list = await api(`/api/admin/clients/${clientId}/checklists`);
        const saved = (list.checklists || []).find((x) => x.id === res.id);
        const savedItems = saved?.items || [];
        for (const { c, i } of toUpload) {
          const itemId = savedItems[i]?.id;
          if (itemId) {
            try { await uploadFileToItem(itemId, c.file); }
            catch (e) { toast.error(`Attachment for item ${i + 1}: ${e.message}`); }
          }
        }
      }

      toast.success("Checklist request sent to the client.");
      reset();
      onChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel
      icon={Icons.checklist}
      title="Checklist Builder"
      subtitle="Request requirements from this client as a checklist"
      right={
        <div className="flex items-center gap-2">
          <CountChip n={pending.length} label="pending" />
          <button
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-copper px-3 py-1.5 text-[12px] font-extrabold text-white shadow-copper transition-transform hover:scale-[1.02]"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
            New Checklist
          </button>
        </div>
      }
    >
      {/* Builder form */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-5 overflow-hidden"
          >
            <div className="rounded-xl border-2 border-copper/30 bg-gradient-to-br from-copper/5 to-white p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Checklist Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Credentialing Documents" />
              </div>
              <Textarea label="Detailed Message" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Explain what you need from the client…" className="mt-3" />

              <p className="mb-2 mt-4 text-[11px] font-extrabold uppercase tracking-[0.14em] text-copper-700">Checklist Items</p>
              <div className="space-y-2.5">
                {items.map((it, i) => (
                  <div key={i} className="rounded-xl border border-line bg-white p-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-2 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-navy text-[11px] font-extrabold text-white">{i + 1}</span>
                      <div className="flex-1">
                        <Textarea
                          rows={2}
                          value={it.content}
                          onChange={(e) => setItems((arr) => arr.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)))}
                          placeholder="Describe this requirement in detail…"
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-4">
                          <GrantToggle
                            label="Allow client upload"
                            hint="Drag & drop appears on the client"
                            on={it.allow_upload}
                            onClick={() => setItems((arr) => arr.map((x, j) => (j === i ? { ...x, allow_upload: !x.allow_upload } : x)))}
                          />
                          <GrantToggle
                            label="Allow download"
                            hint="Attach a file for the client to download"
                            on={it.allow_download}
                            onClick={() => setItems((arr) => arr.map((x, j) => (j === i ? { ...x, allow_download: !x.allow_download, file: x.allow_download ? null : x.file } : x)))}
                          />
                        </div>

                        {/* Drag & drop the file the client will download */}
                        {it.allow_download && (
                          <BuilderDrop
                            file={it.file}
                            onFile={(f) => setItems((arr) => arr.map((x, j) => (j === i ? { ...x, file: f } : x)))}
                          />
                        )}
                      </div>
                      {items.length > 1 && (
                        <button onClick={() => setItems((arr) => arr.filter((_, j) => j !== i))} className="mt-1 rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Remove item">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setItems((arr) => [...arr, blankItem()])} className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-copper/40 px-3 py-1.5 text-[12px] font-bold text-copper-700 hover:bg-copper/5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
                Add item
              </button>

              <div className="mt-4 flex justify-end gap-2">
                <Button variant="subtle" onClick={reset}>Cancel</Button>
                <Button onClick={create} loading={saving}>Send to Client</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending queue */}
      {pending.length === 0 && !open ? (
        <p className="py-6 text-center text-[13px] font-medium text-slate-400">No checklist requests yet. Create one to request requirements from this client.</p>
      ) : (
        <div className="space-y-3">
          {pending.map((c) => (
            <ChecklistCard key={c.id} checklist={c} onChanged={onChanged} />
          ))}
        </div>
      )}

      {/* Completed queue */}
      {completed.length > 0 && (
        <div className="mt-6">
          <p className="mb-2.5 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-emerald-700">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Completed Queue ({completed.length})
          </p>
          <div className="space-y-3">
            {completed.map((c) => (
              <ChecklistCard key={c.id} checklist={c} onChanged={onChanged} completedView />
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

/** Builder-time drag & drop that holds the chosen file locally until the
 *  checklist is created, then it's uploaded and offered to the client. */
function BuilderDrop({ file, onFile }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  return (
    <div className="mt-2.5">
      {file ? (
        <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-violet-600"><path d="M14 3v5h5M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" strokeLinejoin="round" /></svg>
          <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-navy">{file.name}</span>
          <button type="button" onClick={() => onFile(null)} className="text-violet-400 hover:text-rose-600" title="Remove file">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.[0]) onFile(e.dataTransfer.files[0]); }}
          className={`flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-3 text-center transition-all ${dragging ? "scale-[1.01] border-violet-500 bg-violet-100" : "border-violet-300 bg-violet-50/60 hover:border-violet-400 hover:bg-violet-50"}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-600"><path d="M12 15V4M8 8l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span className="text-[12px] font-bold text-navy">{dragging ? "Release to attach" : "Drag & drop a file for the client to download, or "}<span className="text-violet-700 underline decoration-violet-400">browse</span></span>
        </button>
      )}
      <input ref={inputRef} type="file" className="hidden" onChange={(e) => { if (e.target.files?.[0]) onFile(e.target.files[0]); e.target.value = ""; }} />
    </div>
  );
}

function GrantToggle({ label, hint, on, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2 text-left">
      <span className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-copper" : "bg-slate-200"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${on ? "left-4" : "left-0.5"}`} />
      </span>
      <span>
        <span className="block text-[12px] font-bold text-navy">{label}</span>
        <span className="block text-[10px] font-medium text-slate-400">{hint}</span>
      </span>
    </button>
  );
}

function ChecklistCard({ checklist, onChanged, completedView }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const done = checklist.items.filter((i) => i.is_completed).length;

  async function reopen() {
    setBusy(true);
    try {
      await api(`/api/admin/checklists/${checklist.id}`, { method: "PATCH", body: { action: "reopen" } });
      toast.success("Checklist reopened and routed back to the client.");
      onChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirm("Delete this checklist request? This cannot be undone.")) return;
    setBusy(true);
    try {
      await api(`/api/admin/checklists/${checklist.id}`, { method: "DELETE" });
      toast.success("Checklist deleted.");
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
            <p className="text-[14px] font-extrabold text-navy">{checklist.title}</p>
            <StatusBadge options={CHECKLIST_STATUS} value={checklist.status} />
          </div>
          {checklist.message && <p className="mt-0.5 text-[12px] font-medium text-slate-500">{checklist.message}</p>}
          <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
            {done}/{checklist.items.length} items complete · sent {fmtDateTime(checklist.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {completedView && (
            <button onClick={reopen} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-copper/40 px-2.5 py-1.5 text-[11px] font-extrabold text-copper-700 transition-colors hover:bg-copper hover:text-white disabled:opacity-50">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 4v4h4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Reopen &amp; Route
            </button>
          )}
          <button onClick={remove} disabled={busy} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50" title="Delete checklist">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {checklist.items.map((it) => (
          <ItemRow key={it.id} item={it} onChanged={onChanged} />
        ))}
      </div>
    </div>
  );
}

function ItemRow({ item, onChanged }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const adminDocs = item.documents.filter((d) => d.source === "admin");
  const clientDocs = item.documents.filter((d) => d.source === "client");

  async function view(doc, download) {
    try {
      const { url } = await api(`/api/admin/checklist-docs/${doc.id}${download ? "?download=1" : ""}`);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e.message);
    }
  }
  async function uploadAdmin(fileList) {
    const file = fileList?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const p = await api(`/api/admin/checklist-items/${item.id}/documents`, {
        method: "POST",
        body: { filename: file.name, content_type: file.type, size: file.size },
      });
      const put = await fetch(p.url, { method: "PUT", headers: p.headers, body: file });
      if (!put.ok) throw new Error("Upload to storage failed.");
      await api(`/api/admin/checklist-items/${item.id}/documents`, {
        method: "PUT",
        body: { key: p.key, filename: file.name, content_type: file.type },
      });
      toast.success("Document attached for client download.");
      onChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }
  async function removeAdminDoc(doc) {
    setBusy(true);
    try {
      await api(`/api/admin/checklist-docs/${doc.id}`, { method: "DELETE" });
      onChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-white p-3">
      <div className="flex items-start gap-2.5">
        <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${item.is_completed ? "bg-emerald-500 text-white" : "border-2 border-slate-300"}`}>
          {item.is_completed && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[13px] font-semibold ${item.is_completed ? "text-slate-400 line-through" : "text-navy"}`}>{item.content}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {item.allow_upload && <Tag tone="sky">Client upload</Tag>}
            {item.allow_download && <Tag tone="violet">Download grant</Tag>}
          </div>

          {/* Admin download-grant: drag & drop a file for the client to download */}
          {item.allow_download && (
            <div className="mt-2">
              {adminDocs.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {adminDocs.map((d) => (
                    <span key={d.id} className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-bold text-violet-700">
                      <button onClick={() => view(d, true)} className="max-w-[160px] truncate hover:underline">{d.filename}</button>
                      <button onClick={() => removeAdminDoc(d)} className="text-violet-400 hover:text-rose-600" title="Remove"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg></button>
                    </span>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); uploadAdmin(e.dataTransfer.files); }}
                disabled={busy}
                className={`flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-3 text-center transition-all disabled:opacity-60 ${dragging ? "scale-[1.01] border-violet-500 bg-violet-100" : "border-violet-300 bg-violet-50/60 hover:border-violet-400 hover:bg-violet-50"}`}
              >
                {busy ? (
                  <span className="flex items-center gap-2 text-[12px] font-bold text-violet-700"><Spin /> Uploading…</span>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-600"><path d="M12 15V4M8 8l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span className="text-[12px] font-bold text-navy">{dragging ? "Release to attach" : "Drag & drop a file for the client to download, or "}<span className="text-violet-700 underline decoration-violet-400">browse</span></span>
                  </>
                )}
              </button>
              <input ref={inputRef} type="file" className="hidden" onChange={(e) => uploadAdmin(e.target.files)} />
            </div>
          )}

          {/* Client-submitted files */}
          {clientDocs.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Client uploaded:</span>
              {clientDocs.map((d) => (
                <button key={d.id} onClick={() => view(d, false)} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 3v5h5M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" strokeLinejoin="round" /></svg>
                  <span className="max-w-[160px] truncate">{d.filename}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Tag({ tone, children }) {
  const cls = tone === "sky" ? "bg-sky-100 text-sky-700" : "bg-violet-100 text-violet-700";
  return <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${cls}`}>{children}</span>;
}

function Spin() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  );
}
