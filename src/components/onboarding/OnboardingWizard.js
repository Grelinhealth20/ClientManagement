"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import StepFacility from "./StepFacility";
import StepProviders from "./StepProviders";
import StepSystemAccess from "./StepSystemAccess";
import StepReview from "./StepReview";
import StepProgress from "./StepProgress";
import StorageStatus from "./StorageStatus";

const STEPS = [
  { n: 1, title: "Facility Information", short: "Facility" },
  { n: 2, title: "Provider Information", short: "Providers" },
  { n: 3, title: "System & Payer Access", short: "Access" },
  { n: 4, title: "Review & Approve", short: "Review" },
];

const AUTOSAVE_MS = 900;

export default function OnboardingWizard({ user, clientCode, clientName }) {
  const toast = useToast();
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState({});
  const [documents, setDocuments] = useState([]);
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState("in_progress");
  const [reference, setReference] = useState(null);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [lastSaved, setLastSaved] = useState(null);
  // Set when the session ends mid-flow — stops the autosave loop from retrying
  // (and toast-spamming) and shows a clear recovery banner instead.
  const [sessionEnded, setSessionEnded] = useState(false);

  const timerRef = useRef(null);
  const skipNextSave = useRef(true);

  // ── Load existing draft (resume across logout) ──
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api("/api/onboarding");
        if (!alive) return;
        setData(res.draft?.data || {});
        setDocuments(res.documents || []);
        setStep(res.draft?.current_step || 1);
        setStatus(res.draft?.status || "in_progress");
        setReference(res.draft?.reference_code || null);
        setLastSaved(res.draft?.updated_at || null);
      } catch (e) {
        toast.error(e.message || "Could not load your onboarding.");
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The top-level sections edited since the last successful save. Only these are
  // sent (as a patch) so a concurrent editor of another section isn't clobbered.
  const dirtyRef = useRef(new Set());

  const persist = useCallback(
    async (dataSnapshot, nextStep) => {
      const sections = Array.from(dirtyRef.current);
      const patch = {};
      for (const s of sections) patch[s] = dataSnapshot[s];
      // Optimistically clear; restore on failure so the next tick retries.
      dirtyRef.current = new Set();
      setSaveState("saving");
      try {
        const res = await api("/api/onboarding", {
          method: "PUT",
          body: { patch, current_step: nextStep },
        });
        setSaveState("saved");
        setLastSaved(res.updated_at || new Date().toISOString());
      } catch (e) {
        for (const s of sections) dirtyRef.current.add(s);
        setSaveState("error");
        // Session expired / access revoked mid-flow: stop retrying and surface
        // a recovery banner rather than repeating a toast on every keystroke.
        if (e?.status === 401 || e?.status === 403) {
          setSessionEnded(true);
        } else {
          toast.error(e.message || "Autosave failed.");
        }
      }
    },
    [toast]
  );

  // Holds the latest state so the tab-hide flush can persist it mid-debounce.
  const latestRef = useRef({ data, step });

  // ── Debounced autosave whenever the form or step changes ──
  useEffect(() => {
    latestRef.current = { data, step };
    if (!loaded || sessionEnded) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveState("saving");
    timerRef.current = setTimeout(() => persist(data, step), AUTOSAVE_MS);
    return () => timerRef.current && clearTimeout(timerRef.current);
  }, [data, step, loaded, persist, sessionEnded]);

  // Real-time safety net: if the tab is hidden or closed (e.g. the user logs
  // out or closes the browser) before the debounce fires, flush the unsaved
  // sections immediately with a keepalive request so nothing is ever lost.
  useEffect(() => {
    function flush() {
      if (dirtyRef.current.size === 0 || document.visibilityState !== "hidden") return;
      const sections = Array.from(dirtyRef.current);
      const patch = {};
      for (const s of sections) patch[s] = latestRef.current.data[s];
      try {
        fetch("/api/onboarding", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patch, current_step: latestRef.current.step }),
          credentials: "same-origin",
          keepalive: true,
        });
        dirtyRef.current = new Set();
      } catch {
        /* best-effort */
      }
    }
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  const setFacility = useCallback((patch) => {
    dirtyRef.current.add("facility");
    setData((d) => ({ ...d, facility: { ...(d.facility || {}), ...patch } }));
  }, []);
  const setProviders = useCallback((providers) => {
    dirtyRef.current.add("providers");
    setData((d) => ({ ...d, providers }));
  }, []);
  const setSystemAccess = useCallback((systemAccess) => {
    dirtyRef.current.add("systemAccess");
    setData((d) => ({ ...d, systemAccess }));
  }, []);

  const onUploaded = useCallback((doc) => setDocuments((p) => [...p, doc]), []);
  const onRemoved = useCallback(
    (id) => setDocuments((p) => p.filter((d) => d.id !== id)),
    []
  );

  const [approving, setApproving] = useState(false);
  const [approvedOpen, setApprovedOpen] = useState(false);

  async function approve() {
    setApproving(true);
    try {
      // Flush the latest edits before snapshotting the submission.
      if (timerRef.current) clearTimeout(timerRef.current);
      await persist(data, step);
      const res = await api("/api/onboarding/submit", { method: "POST" });
      setReference(res.reference_code);
      setStatus("approved");
      setApprovedOpen(true);
      toast.success("Onboarding approved.");
    } catch (e) {
      toast.error(e.message || "Approval failed.");
    } finally {
      setApproving(false);
    }
  }

  function copyReference() {
    navigator.clipboard?.writeText(reference || "").then(
      () => toast.success("Reference copied."),
      () => toast.error("Copy failed.")
    );
  }

  async function goTo(n) {
    if (n < 1 || n > STEPS.length) return;
    // Flush any pending autosave before moving, so navigation never loses input.
    if (timerRef.current) clearTimeout(timerRef.current);
    setStep(n);
    await persist(data, n);
  }

  if (!loaded) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="flex items-center gap-3 text-sm font-bold text-slate-400">
          <Spinner /> Loading your onboarding…
        </div>
      </div>
    );
  }

  const current = STEPS[step - 1];

  return (
    <div className="space-y-4">
      {sessionEnded && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl2 border-2 border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-[13px] font-bold text-rose-700">
            Your session has ended. Recent changes may not have been saved — sign in again to continue safely.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-rose-600 px-4 py-2 text-[13px] font-extrabold text-white transition-colors hover:bg-rose-700"
          >
            Reload &amp; sign in
          </button>
        </div>
      )}

      {/* ── Header panel — dark command hero, strong presence ── */}
      <section className="relative overflow-hidden rounded-xl2 border border-navy/20 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 shadow-elev">
        {/* faint tech grid + copper glow */}
        <div className="tech-grid pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.05) 1px,transparent 1px)" }} />
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-copper/15 blur-2xl" />
        <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-navy-700 via-copper to-navy-700" />
        <div className="relative flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3.5">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 text-copper shadow-copper ring-1 ring-inset ring-white/20 backdrop-blur">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3l7 4v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V7l7-4z" strokeLinejoin="round" />
                <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-copper">
                Facility Onboarding
              </p>
              <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                {current.title}
              </h1>
              <p className="mt-0.5 text-[12px] font-semibold text-white/60">
                {clientName} · Client ID{" "}
                <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono font-bold text-copper">
                  {clientCode}
                </span>
              </p>
            </div>
          </div>
          <SaveIndicator state={saveState} lastSaved={lastSaved} />
        </div>
      </section>

      {/* ── Processing / step panel (broken out, full-width, animated) ── */}
      <StepProgress steps={STEPS} step={step} onJump={goTo} />

      {/* Background worker: auto-creates facility + provider S3 folders and
          shows only a transient processing pill (no panel). */}
      {(step === 1 || step === 2) && (
        <StorageStatus facilityName={data.facility?.facilityName} providers={data.providers} />
      )}

      {/* ── Content panel (full-width section per step) ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          {step === 1 && (
            <StepFacility
              facility={data.facility}
              setFacility={setFacility}
              documents={documents}
              onUploaded={onUploaded}
              onRemoved={onRemoved}
            />
          )}
          {step === 2 && (
            <StepProviders
              providers={data.providers}
              setProviders={setProviders}
              documents={documents}
              onUploaded={onUploaded}
              onRemoved={onRemoved}
            />
          )}
          {step === 3 && (
            <StepSystemAccess systemAccess={data.systemAccess} setSystemAccess={setSystemAccess} />
          )}
          {step === 4 && (
            <StepReview
              data={data}
              documents={documents}
              onJump={goTo}
              onApprove={approve}
              approving={approving}
              status={status}
              reference={reference}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Footer nav (sleek, bordered panel) ── */}
      <section className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl2 border border-line bg-white/90 px-4 py-3 shadow-elev backdrop-blur-md sm:px-5">
        <Button variant="ghost" onClick={() => goTo(step - 1)} disabled={step === 1}>
          ← Back
        </Button>
        <p className="hidden text-[11px] font-semibold text-slate-400 md:block">
          Progress saves automatically — log out and resume anytime.
        </p>
        <Button onClick={() => goTo(step + 1)} disabled={step === STEPS.length}>
          Save &amp; Continue →
        </Button>
      </section>

      {/* Approval success */}
      <Modal
        open={approvedOpen}
        onClose={() => setApprovedOpen(false)}
        title="Onboarding approved"
        subtitle="Your submission has been recorded."
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-500">Your unique reference number is</p>
          <div className="rounded-xl border border-copper/30 bg-copper/5 px-4 py-3">
            <p className="font-mono text-xl font-extrabold tracking-[0.15em] text-navy">{reference}</p>
          </div>
          <p className="text-[12px] font-medium text-slate-400">
            Keep this 16-digit reference for your records. It uniquely identifies this submission.
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="ghost" onClick={copyReference} type="button">
              Copy reference
            </Button>
            <Button onClick={() => setApprovedOpen(false)}>Done</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SaveIndicator({ state, lastSaved }) {
  const map = {
    idle: { dot: "bg-slate-300", text: "All changes saved", tone: "text-slate-400" },
    saving: { dot: "bg-amber-400", text: "Saving…", tone: "text-amber-600" },
    saved: { dot: "bg-emerald-500", text: "All changes saved", tone: "text-emerald-600" },
    error: { dot: "bg-rose-500", text: "Save failed — retrying", tone: "text-rose-600" },
  };
  const m = map[state] || map.idle;
  return (
    <div className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5">
      <span className={`h-2 w-2 rounded-full ${m.dot} ${state === "saving" ? "animate-pulse" : ""}`} />
      <span className={`text-[11px] font-bold ${m.tone}`}>{m.text}</span>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-current" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  );
}
