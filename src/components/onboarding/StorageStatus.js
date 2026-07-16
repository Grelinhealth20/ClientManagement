"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/lib/api";

/**
 * Headless background worker: as the facility is named and providers are added,
 * it automatically creates the matching S3 folders (facility folder + a
 * subfolder per provider). It renders NO panel — only a small, transient
 * processing pill while a folder is being created, then a brief "ready" flash.
 */
export default function StorageStatus({ facilityName, providers }) {
  const ensuredRef = useRef({}); // id -> the name last ensured (renames re-create)
  const [active, setActive] = useState(null); // { type: 'creating'|'ready', name } | null
  const clearRef = useRef(null);

  const folders = useMemo(() => {
    const out = [];
    const fn = (facilityName || "").trim();
    if (fn) out.push({ id: "facility", scope: "facility", name: fn });
    (providers || []).forEach((p) => {
      const nm = (p?.personal?.fullLegalName || "").trim();
      if (nm) out.push({ id: p.key, scope: "provider", name: nm });
    });
    return out;
  }, [facilityName, providers]);

  const depsKey = folders.map((f) => `${f.id}:${f.name}`).join("|");

  useEffect(() => {
    const t = setTimeout(() => {
      folders.forEach((f) => {
        if (ensuredRef.current[f.id] === f.name) return;
        ensureFolder(f);
      });
    }, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey]);

  function flashReady(name) {
    setActive({ type: "ready", name });
    if (clearRef.current) clearTimeout(clearRef.current);
    clearRef.current = setTimeout(() => setActive(null), 1600);
  }

  async function ensureFolder(f, isRetry = false) {
    ensuredRef.current[f.id] = f.name;
    if (clearRef.current) clearTimeout(clearRef.current);
    setActive({ type: "creating", name: f.name });
    try {
      await api("/api/onboarding/folders", {
        method: "POST",
        body: { scope: f.scope, provider_key: f.scope === "provider" ? f.id : undefined },
      });
      await new Promise((r) => setTimeout(r, 500)); // keep the animation perceptible
      flashReady(f.name);
    } catch {
      if (!isRetry) {
        setTimeout(() => {
          if (ensuredRef.current[f.id] === f.name) ensureFolder(f, true);
        }, 3000);
      } else {
        ensuredRef.current[f.id] = null;
        setActive(null);
      }
    }
  }

  useEffect(() => () => clearRef.current && clearTimeout(clearRef.current), []);

  const creating = active?.type === "creating";

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 340, damping: 26 }}
          className="pointer-events-none fixed bottom-6 left-6 z-[60] flex max-w-xs items-center gap-2.5 rounded-xl border border-line bg-white/95 px-3.5 py-2.5 shadow-elev backdrop-blur"
          role="status"
          aria-live="polite"
        >
          <motion.span
            animate={creating ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={{ duration: 0.9, repeat: creating ? Infinity : 0 }}
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
              creating ? "bg-copper/15 text-copper-700" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {creating ? (
              <FolderIcon />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </motion.span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[12px] font-extrabold text-navy">
              {creating ? (
                <>
                  <Spinner /> Creating secure folder
                </>
              ) : (
                <span className="text-emerald-700">Secure folder ready</span>
              )}
            </p>
            <p className="truncate text-[11px] font-semibold text-slate-400">{active.name}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FolderIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" strokeLinejoin="round" />
    </svg>
  );
}
function Spinner() {
  return (
    <svg className="h-3 w-3 animate-spin text-copper-700" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  );
}
