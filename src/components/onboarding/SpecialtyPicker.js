"use client";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TAXONOMY, TAXONOMY_GROUPS } from "@/lib/taxonomy";
import { CloseIcon, PlusIcon } from "@/components/icons";

/**
 * Enterprise specialty picker.
 *
 * - A trigger field opens a searchable, grouped, multi-select popup over the
 *   full NUCC taxonomy (with a manual-entry fallback).
 * - Selected specialties appear below as editable text boxes — the label of any
 *   selection can be edited in place, and each can be removed.
 *
 * value: array of { code, label, manual? }
 */
export default function SpecialtyPicker({ value = [], onChange }) {
  const [open, setOpen] = useState(false);

  function setLabel(i, label) {
    onChange(value.map((v, idx) => (idx === i ? { ...v, label } : v)));
  }
  function remove(i) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-left shadow-[0_0_0_1px_rgba(11,31,58,0.02),0_1px_2px_rgba(11,31,58,0.05)] transition-colors hover:border-copper/60"
      >
        <span className="flex items-center gap-2 text-[14px] font-semibold text-slate-500">
          <SearchIcon />
          {value.length ? (
            <span className="text-navy">
              {value.length} {value.length === 1 ? "specialty" : "specialties"} selected
            </span>
          ) : (
            "Search & select specialties…"
          )}
        </span>
        <span className="inline-flex items-center gap-1 rounded-lg bg-navy px-2.5 py-1 text-[11px] font-extrabold text-white">
          <PlusIcon size={12} /> Browse
        </span>
      </button>

      {/* Selected — editable text boxes */}
      {value.length > 0 && (
        <div className="mt-2.5 space-y-2">
          {value.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  className="input-base pr-24"
                  value={v.label}
                  onChange={(e) => setLabel(i, e.target.value)}
                  placeholder="Specialty name"
                  aria-label={`Specialty ${i + 1}`}
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                  {v.code ? (
                    <span className="rounded-md bg-navy/[0.06] px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-500">
                      {v.code}
                    </span>
                  ) : (
                    <span className="rounded-md bg-copper/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-copper-700">
                      Custom
                    </span>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remove specialty"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line text-slate-400 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              >
                <CloseIcon size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="mt-1.5 text-[11px] font-medium text-slate-400">
        Multi-select supported. Pick from the taxonomy or add a custom specialty — labels are editable.
      </p>

      <SpecialtyPopup open={open} value={value} onChange={onChange} onClose={() => setOpen(false)} />
    </div>
  );
}

function SpecialtyPopup({ open, value, onChange, onClose }) {
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    setQ("");
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const selectedCodes = new Set(value.map((v) => v.code).filter(Boolean));
  const selectedLabels = new Set(value.map((v) => v.label.trim().toLowerCase()));

  const grouped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? TAXONOMY.filter(
          (t) => t.label.toLowerCase().includes(needle) || t.code.toLowerCase().includes(needle)
        )
      : TAXONOMY;
    const by = {};
    for (const t of list) (by[t.group] ||= []).push(t);
    return by;
  }, [q]);

  const resultCount = Object.values(grouped).reduce((n, arr) => n + arr.length, 0);
  const exactExists = q.trim() && TAXONOMY.some((t) => t.label.toLowerCase() === q.trim().toLowerCase());
  const alreadyCustom = q.trim() && selectedLabels.has(q.trim().toLowerCase());

  function toggle(item) {
    if (selectedCodes.has(item.code)) {
      onChange(value.filter((v) => v.code !== item.code));
    } else {
      onChange([...value, { code: item.code, label: item.label }]);
    }
  }
  function addCustom() {
    const label = q.trim();
    if (!label || alreadyCustom) return;
    onChange([...value, { code: "", label, manual: true }]);
    setQ("");
  }
  function removeSelected(v) {
    onChange(value.filter((x) => (v.code ? x.code !== v.code : x.label !== v.label)));
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Select specialty"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="relative z-10 flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl2 border border-navy/20 bg-white shadow-elev"
          >
            {/* Header — dark command bar */}
            <div className="relative bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 px-5 py-3.5">
              <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-copper/70 via-copper to-copper/70" />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-extrabold tracking-tight text-white">Select Specialty</h3>
                  <p className="text-[11px] font-semibold text-white/55">
                    NUCC taxonomy · search, multi-select, or add a custom specialty
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="grid h-8 w-8 place-items-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <CloseIcon size={18} />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="border-b border-line px-5 py-3">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <SearchIcon />
                </span>
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search specialty or taxonomy code…"
                  className="input-base pl-10"
                />
              </div>
            </div>

            {/* Selected chips */}
            {value.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-b border-line bg-mist/40 px-5 py-2.5">
                <span className="mr-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Selected ({value.length})
                </span>
                {value.map((v, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-2 py-1 text-[11px] font-bold text-white"
                  >
                    {v.label}
                    <button type="button" onClick={() => removeSelected(v)} aria-label={`Remove ${v.label}`} className="text-white/60 hover:text-white">
                      <CloseIcon size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* List */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {q.trim() && !exactExists && (
                <button
                  type="button"
                  onClick={addCustom}
                  disabled={alreadyCustom}
                  className="flex w-full items-center gap-2 border-b border-line bg-copper/5 px-5 py-3 text-left text-[13px] font-extrabold text-copper-700 transition-colors hover:bg-copper/10 disabled:opacity-50"
                >
                  <PlusIcon size={14} />
                  Add “{q.trim()}” as a custom specialty
                </button>
              )}

              {TAXONOMY_GROUPS.filter((g) => grouped[g]?.length).map((g) => (
                <div key={g}>
                  <p className="sticky top-0 z-10 border-b border-line bg-mist/90 px-5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-copper-700 backdrop-blur">
                    {g}
                  </p>
                  {grouped[g].map((t) => {
                    const on = selectedCodes.has(t.code);
                    return (
                      <button
                        key={t.code}
                        type="button"
                        onClick={() => toggle(t)}
                        className={`flex w-full items-center justify-between gap-3 border-b border-line/60 px-5 py-2.5 text-left transition-colors ${
                          on ? "bg-navy/[0.05]" : "hover:bg-mist/60"
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span
                            className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 ${
                              on ? "border-copper bg-copper text-white" : "border-slate-300"
                            }`}
                          >
                            {on && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                          <span className="truncate text-[13px] font-bold text-navy">{t.label}</span>
                        </span>
                        <span className="shrink-0 rounded-md bg-navy/[0.06] px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-500">
                          {t.code}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}

              {resultCount === 0 && !q.trim() && (
                <p className="px-5 py-6 text-center text-[12px] text-slate-400">Start typing to search.</p>
              )}
              {resultCount === 0 && q.trim() && (
                <p className="px-5 py-6 text-center text-[12px] text-slate-400">
                  No taxonomy match — use the “Add custom specialty” option above.
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-line bg-white px-5 py-3">
              <span className="text-[11px] font-semibold text-slate-400">
                {value.length} selected · {resultCount} shown
              </span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-gradient-to-b from-copper to-copper-600 px-5 py-2 text-[13px] font-extrabold text-white shadow-copper transition-all hover:brightness-[1.03]"
              >
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4-4" strokeLinecap="round" />
    </svg>
  );
}
