"use client";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "@/components/ui/Toast";

/**
 * Drag-and-drop uploader for the public provider-intake page — the same
 * clearly-bordered design as the dashboard uploader. Uploads go to the
 * token-gated endpoint (no session); view/delete are managed from the dashboard.
 */
export default function IntakeDocUpload({
  token,
  credential,
  label,
  category,
  providerName,
  files = [],
  onUploaded,
}) {
  const inputRef = useRef(null);
  const toast = useToast();
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const has = files.length > 0;

  async function upload(list) {
    const arr = Array.from(list || []);
    if (!arr.length) return;
    setBusy(true);
    try {
      for (const file of arr) {
        // 1) presigned URL
        const presign = await fetch(`/api/provider-intake/${token}/documents/presign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            credential,
            doc_type: label,
            category,
            provider_name: providerName || undefined,
            filename: file.name,
            content_type: file.type,
            size: file.size,
          }),
        });
        const p = await presign.json().catch(() => null);
        if (!presign.ok) throw new Error(p?.error || "Upload failed.");

        // 2) upload straight to S3
        const put = await fetch(p.url, { method: "PUT", headers: p.headers, body: file });
        if (!put.ok) throw new Error("Upload to storage failed.");

        // 3) confirm
        const confirm = await fetch(`/api/provider-intake/${token}/documents/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            credential,
            key: p.key,
            doc_type: label,
            category,
            filename: file.name,
            content_type: file.type,
          }),
        });
        const c = await confirm.json().catch(() => null);
        if (!confirm.ok) throw new Error(c?.error || "Could not record the upload.");
        onUploaded?.(c.document);
      }
      toast.success(`${label} uploaded.`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div
      className={`flex flex-col rounded-2xl border-2 bg-white p-3.5 transition-all duration-200 ${
        dragging ? "border-copper shadow-[0_0_0_4px_rgba(207,148,85,0.15)]" : has ? "border-emerald-300" : "border-slate-200 hover:border-copper/40"
      }`}
    >
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${has ? "bg-emerald-100 text-emerald-700" : "bg-navy/[0.06] text-copper-700"}`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 3v5h5M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="text-[12px] font-bold leading-snug text-navy">{label}</p>
        </div>
        {has && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {files.length}
          </span>
        )}
      </div>

      <AnimatePresence initial={false}>
        {files.map((f) => (
          <motion.div
            key={f.id}
            layout
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-2.5 py-2"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-emerald-600 ring-1 ring-emerald-200">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 3v5h5M6 3h8l5 5v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="min-w-0 truncate text-[12px] font-bold text-navy">{f.filename}</span>
          </motion.div>
        ))}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(e.dataTransfer.files);
        }}
        className={`group/zone relative mt-auto flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed px-4 py-5 text-center transition-all duration-200 ${
          dragging ? "scale-[1.01] border-copper bg-copper/10" : "border-slate-300 bg-slate-50/70 hover:border-copper/60 hover:bg-copper/5"
        }`}
      >
        {busy ? (
          <div className="w-full">
            <div className="flex items-center justify-center gap-2 text-[12px] font-bold text-copper-700">
              <Spinner /> Uploading…
            </div>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <motion.div
                className="h-full w-1/3 rounded-full bg-gradient-to-r from-copper to-navy"
                animate={{ x: ["-120%", "320%"] }}
                transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </div>
        ) : (
          <>
            <motion.span
              animate={dragging ? { y: [-3, 2, -3], scale: 1.08 } : { y: 0, scale: 1 }}
              transition={{ duration: 0.8, repeat: dragging ? Infinity : 0 }}
              className={`grid h-11 w-11 place-items-center rounded-full transition-colors ${
                dragging ? "bg-copper text-white shadow-copper" : "bg-white text-slate-400 shadow-sm ring-1 ring-slate-200 group-hover/zone:text-copper-700 group-hover/zone:ring-copper/30"
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 15V4M8 8l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.span>
            <span className="text-[12px] font-bold text-navy">
              {dragging ? "Release to upload" : has ? "Add another file" : "Drop file here"}
              {!dragging && <> or <span className="text-copper-700 underline decoration-copper/40">Browse</span></>}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              PDF, Word, Excel, CSV, PNG, JPG · any file, up to 25 MB
            </span>
          </>
        )}
      </button>

      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin text-current" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  );
}
