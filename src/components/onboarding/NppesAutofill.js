"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/lib/api";
import { TAXONOMY } from "@/lib/taxonomy";

/**
 * Automatic facility lookup against the national NPI registry. As the client
 * types the facility name, this searches the registry (debounced), shows a
 * friendly processing animation, and auto-fills empty fields from the best
 * match — while leaving everything editable and letting the user pick a
 * different match.
 *
 * Props: facility (current values), onApply(patch).
 */
export default function NppesAutofill({ facility, onApply }) {
  const name = (facility?.facilityName || "").trim();
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [matches, setMatches] = useState([]);
  const [note, setNote] = useState("");
  const lastQueryRef = useRef("");
  const appliedNpiRef = useRef(null);
  const facilityRef = useRef(facility);
  facilityRef.current = facility;

  useEffect(() => {
    if (name.length < 3) {
      setState("idle");
      setMatches([]);
      return;
    }
    const t = setTimeout(() => runLookup(name), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  async function runLookup(q) {
    if (q === lastQueryRef.current) return;
    lastQueryRef.current = q;
    setState("loading");
    setNote("");
    try {
      const res = await api(`/api/onboarding/nppes?name=${encodeURIComponent(q)}`);
      const list = res.matches || [];
      setMatches(list);
      setState("done");
      if (res.error) setNote(res.error);
      // Auto-apply the best match to EMPTY fields only, once per top match.
      const best = list[0];
      if (best && appliedNpiRef.current !== best.npi) {
        appliedNpiRef.current = best.npi;
        onApply(buildPatch(best, facilityRef.current, false));
      }
    } catch {
      setState("error");
    }
  }

  function useMatch(m) {
    appliedNpiRef.current = m.npi;
    onApply(buildPatch(m, facilityRef.current, true)); // explicit → overwrite
  }

  if (state === "idle") return null;

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-navy/10 bg-gradient-to-br from-mist/60 to-white ring-1 ring-inset ring-line">
      <AnimatePresence mode="wait">
        {state === "loading" ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-4 py-3"
          >
            <Radar />
            <div>
              <p className="text-[13px] font-extrabold text-navy">Looking up your facility…</p>
              <p className="text-[11px] font-semibold text-slate-400">
                Searching the national provider registry to fill in your details.
              </p>
            </div>
          </motion.div>
        ) : state === "error" || matches.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2.5 px-4 py-3"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400">
              <SearchIcon />
            </span>
            <p className="text-[12px] font-semibold text-slate-500">
              {note || "No registry match found — please enter the facility details manually."}
            </p>
          </motion.div>
        ) : (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center gap-2.5 border-b border-line bg-emerald-50/50 px-4 py-2.5">
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </motion.span>
              <div>
                <p className="text-[13px] font-extrabold text-navy">
                  Facility found — we filled in what we could
                </p>
                <p className="text-[11px] font-semibold text-slate-400">
                  Review and edit any field below. Pick another match if this isn’t the right one.
                </p>
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto">
              {matches.map((m) => {
                const applied = appliedNpiRef.current === m.npi;
                return (
                  <div
                    key={m.npi}
                    className={`flex items-center justify-between gap-3 border-b border-line/60 px-4 py-2.5 ${
                      applied ? "bg-navy/[0.04]" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-bold text-navy">
                        {m.name}
                        {applied && (
                          <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-emerald-700">
                            Auto-filled
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[11px] font-medium text-slate-400">
                        NPI {m.npi}
                        {m.city ? ` · ${m.city}, ${m.state}` : ""}
                        {m.taxonomies?.[0]?.desc ? ` · ${m.taxonomies[0].desc}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => useMatch(m)}
                      className="shrink-0 rounded-lg border border-copper/40 px-2.5 py-1 text-[11px] font-extrabold text-copper-700 transition-colors hover:bg-copper hover:text-white"
                    >
                      {applied ? "Re-apply" : "Use this"}
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Map a registry match → facility field patch. `overwrite` false = fill empties only. */
function buildPatch(m, facility, overwrite) {
  const mapped = {
    groupNPI: m.npi,
    facilityAddress: m.practiceAddress, // primary practice location
    mailingAddress: m.mailingAddress, // mailing address
    contactPhone: formatPhone(m.phone),
    contactName: m.official,
  };
  if (m.dba && m.dba.toLowerCase() !== (m.name || "").toLowerCase()) {
    mapped.dbaName = m.dba;
  }

  const patch = {};
  for (const [k, v] of Object.entries(mapped)) {
    if (v == null || v === "") continue;
    if (overwrite || !facility?.[k]) patch[k] = v;
  }

  // Specialties: union by code (never removes the user's own).
  const existing = facility?.specialties || [];
  const have = new Set(existing.map((s) => s.code).filter(Boolean));
  const add = (m.taxonomies || [])
    .filter((t) => t.code && !have.has(t.code))
    .map((t) => {
      const known = TAXONOMY.find((x) => x.code === t.code);
      return known ? { code: known.code, label: known.label } : { code: t.code, label: t.desc || t.code };
    });
  if (add.length) patch.specialties = [...existing, ...add];

  return patch;
}

function formatPhone(p) {
  const d = String(p || "").replace(/\D/g, "");
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return p || "";
}

function Radar() {
  return (
    <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-copper/15 text-copper-700">
      <motion.span
        className="absolute inset-0 rounded-lg ring-2 ring-copper/40"
        animate={{ opacity: [0.3, 0.9, 0.3], scale: [1, 1.08, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
      </svg>
    </span>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4-4" strokeLinecap="round" />
    </svg>
  );
}
