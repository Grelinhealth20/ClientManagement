"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import ProviderFields from "./ProviderFields";
import IntakeDocUpload from "./IntakeDocUpload";

const AUTOSAVE_MS = 900;

export default function ProviderIntake({ token }) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-mist">
        <div className="h-1 w-full bg-gradient-to-r from-navy-700 via-copper to-navy-700" />
        <Inner token={token} />
      </div>
    </ToastProvider>
  );
}

function Inner({ token }) {
  const toast = useToast();
  const [phase, setPhase] = useState("gate"); // gate | form
  const [credential, setCredential] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [gateError, setGateError] = useState("");
  const [context, setContext] = useState(null);
  const [provider, setProvider] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [saveState, setSaveState] = useState("idle");
  const [setupOpen, setSetupOpen] = useState(false);
  const [gateStatus, setGateStatus] = useState(null); // { active, setupDone, authMethod }

  const timerRef = useRef(null);
  const skipNext = useRef(true);

  // Ask the link what it needs BEFORE the provider types anything: a first visit
  // wants only the invitation security key; a returning provider is prompted for
  // whatever they configured (their own key, or their NPI).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/provider-intake/${token}`, { method: "GET" });
        const data = await res.json().catch(() => null);
        if (alive) setGateStatus(data || { active: true, setupDone: false, authMethod: null });
      } catch {
        if (alive) setGateStatus({ active: true, setupDone: false, authMethod: null });
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  // What the gate asks for, derived from the link's configured return access.
  const returnsWithNpi = gateStatus?.setupDone && gateStatus?.authMethod === "npi";
  const gateCopy = !gateStatus?.setupDone
    ? {
        eyebrow: "Secure invitation",
        heading: "Open your onboarding form",
        blurb: "Enter the security key from your invitation to begin. You'll set up your own return access once inside.",
        label: "Security Key",
        placeholder: "XXXX-XXXX-XXXX",
        inputMode: undefined,
      }
    : returnsWithNpi
      ? {
          eyebrow: "Welcome back",
          heading: "Resume your onboarding",
          blurb: "Enter your security key or the individual NPI you set up to continue where you left off.",
          label: "Security Key or NPI",
          placeholder: "XXXX-XXXX-XXXX or 10-digit NPI",
          inputMode: undefined,
        }
      : {
          eyebrow: "Welcome back",
          heading: "Resume your onboarding",
          blurb: "Enter the security key you set up to continue where you left off.",
          label: "Security Key",
          placeholder: "XXXX-XXXX-XXXX",
          inputMode: undefined,
        };
  const linkDead = gateStatus && gateStatus.active === false;

  async function unlock(e) {
    e?.preventDefault();
    setVerifying(true);
    setGateError("");
    try {
      const res = await fetch(`/api/provider-intake/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Access denied.");
      setContext(data.context);
      setProvider(data.provider || { key: data.context.providerKey });
      const dres = await fetch(`/api/provider-intake/${token}/documents?credential=${encodeURIComponent(credential)}`);
      const ddata = await dres.json().catch(() => ({ documents: [] }));
      setDocuments(ddata.documents || []);
      setPhase("form");
      if (data.needsSetup) setSetupOpen(true); // first temp-key access → prompt setup
    } catch (err) {
      setGateError(err.message);
    } finally {
      setVerifying(false);
    }
  }

  const persist = useCallback(
    async (next) => {
      setSaveState("saving");
      try {
        const res = await fetch(`/api/provider-intake/${token}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential, provider: next }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Save failed.");
        setSaveState("saved");
      } catch (e) {
        setSaveState("error");
        toast.error(e.message);
      }
    },
    [token, credential, toast]
  );

  useEffect(() => {
    if (phase !== "form") return;
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveState("saving");
    timerRef.current = setTimeout(() => persist(provider), AUTOSAVE_MS);
    return () => timerRef.current && clearTimeout(timerRef.current);
  }, [provider, phase, persist]);

  if (phase === "gate") {
    return (
      <div className="relative flex min-h-[calc(100vh-4px)] items-center justify-center overflow-hidden bg-mist px-4 py-10">
        {/* Ambient enterprise backdrop */}
        <div className="pointer-events-none absolute inset-0 bg-backdrop-vignette" />
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-navy/[0.06] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-copper/[0.10] blur-3xl" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[120vh] w-px -translate-x-1/2 animate-scanline bg-gradient-to-b from-transparent via-copper/25 to-transparent" />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-4xl"
        >
          {/* Flowing gradient border frame */}
          <div className="rounded-[1.4rem] bg-[linear-gradient(110deg,#0B1F3A,#CF9455,#0B1F3A)] bg-[length:200%_100%] p-[1.5px] shadow-panel animate-border-flow">
            <div className="grid overflow-hidden rounded-[1.32rem] bg-white md:grid-cols-[1.05fr_1fr]">
              {/* ── Brand / assurance column ── */}
              <div className="relative hidden overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 p-8 md:flex md:flex-col md:justify-between">
                <div className="pointer-events-none absolute inset-0 bg-panel-sheen" />
                <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 -translate-y-1/3 translate-x-1/3 rounded-full bg-copper/20 blur-2xl" />
                <div className="relative">
                  <Image src="/grelin-logo.png" alt="Grelin Health" width={317} height={112} priority className="h-9 w-auto brightness-0 invert" />
                  <div className="mt-8">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-copper-400">
                      <ShieldIcon className="h-3 w-3" /> {gateCopy.eyebrow}
                    </span>
                    <h2 className="mt-4 text-[26px] font-extrabold leading-tight tracking-tight text-white">
                      Provider Onboarding
                    </h2>
                    <p className="mt-2 max-w-xs text-[13px] font-medium leading-relaxed text-white/60">
                      A secure, private space to complete your credentialing details — encrypted end to end and shared only with your facility.
                    </p>
                  </div>
                </div>
                <ul className="relative mt-10 space-y-3">
                  {[
                    ["Secure Encryption", "Your data is AES-256 encrypted at rest and in transit."],
                    ["Private to you", "No one else can open your form without your key."],
                    ["Save & resume anytime", "Come back with the access you set up on first visit."],
                  ].map(([t, d]) => (
                    <li key={t} className="flex gap-3">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-copper/20 text-copper-400">
                        <CheckIcon className="h-3 w-3" />
                      </span>
                      <span>
                        <span className="block text-[12.5px] font-bold text-white">{t}</span>
                        <span className="block text-[11px] font-medium text-white/45">{d}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* ── Form column ── */}
              <div className="relative bg-panel-sheen p-7 sm:p-9">
                {/* Mobile logo */}
                <Image src="/grelin-logo.png" alt="Grelin Health" width={317} height={112} priority className="mb-6 h-8 w-auto md:hidden" />

                {linkDead ? (
                  <div className="flex min-h-[18rem] flex-col items-center justify-center text-center">
                    <span className="grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-500">
                      <LockIcon className="h-6 w-6" />
                    </span>
                    <h1 className="mt-4 text-lg font-extrabold text-navy">This link is no longer active</h1>
                    <p className="mt-1.5 max-w-xs text-[13px] font-medium text-slate-500">
                      {gateStatus?.reason === "not_found"
                        ? "We couldn't find this invitation. Please check the link or ask your facility to resend it."
                        : "This invitation has expired or was revoked. Please ask your facility for a new link."}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={unlock} className="flex min-h-[18rem] flex-col justify-center">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={gateCopy.label + gateCopy.heading}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.25 }}
                      >
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-copper-700 md:hidden">
                          {gateCopy.eyebrow}
                        </p>
                        <h1 className="text-2xl font-extrabold tracking-tight text-navy">{gateCopy.heading}</h1>
                        <p className="mt-1.5 text-[13.5px] font-medium leading-relaxed text-slate-500">
                          {gateCopy.blurb}
                        </p>
                      </motion.div>
                    </AnimatePresence>

                    <div className="mt-6">
                      <Input
                        label={gateCopy.label}
                        value={credential}
                        onChange={(e) => setCredential(e.target.value)}
                        placeholder={gateCopy.placeholder}
                        inputMode={gateCopy.inputMode}
                        autoFocus
                        autoComplete="off"
                        className="[&_input]:h-12 [&_input]:font-mono [&_input]:text-[15px] [&_input]:tracking-[0.18em]"
                      />
                    </div>

                    {gateError && (
                      <motion.p
                        role="alert"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] font-semibold text-rose-700"
                      >
                        <LockIcon className="h-3.5 w-3.5 shrink-0" /> {gateError}
                      </motion.p>
                    )}

                    <Button type="submit" loading={verifying} className="mt-5 h-12 w-full justify-center text-[15px]">
                      Unlock my form
                    </Button>

                    <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-400">
                      <ShieldIcon className="h-3.5 w-3.5 text-copper" />
                      Protected by end-to-end encryption
                    </p>
                  </form>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Image src="/grelin-logo.png" alt="Grelin Health" width={317} height={112} className="mb-2 h-8 w-auto" />
          <h1 className="text-2xl font-extrabold tracking-tight text-navy">Provider Information</h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            {context.facilityName}
            {context.facilityNpi ? ` · Facility NPI ${context.facilityNpi}` : ""} · Client ID{" "}
            <span className="font-mono font-bold">{context.clientCode}</span>
          </p>
        </div>
        <SaveBadge state={saveState} />
      </div>

      <div className="rounded-xl2 border border-line bg-white p-5 shadow-crisp sm:p-6">
        <ProviderFields
          provider={provider}
          onChange={setProvider}
          renderDoc={(docType, category) => (
            <IntakeDocUpload
              key={docType}
              token={token}
              credential={credential}
              label={docType}
              category={category}
              providerName={provider?.personal?.fullLegalName || context.label}
              files={documents.filter((d) => d.doc_type === docType)}
              onUploaded={(doc) => setDocuments((p) => [...p, doc])}
            />
          )}
        />
      </div>

      <p className="mt-4 text-center text-[12px] font-medium text-slate-400">
        Your responses save automatically and are sent securely to {context.facilityName}.
      </p>

      <SetupModal
        open={setupOpen}
        token={token}
        credential={credential}
        onClose={() => setSetupOpen(false)}
        onDone={(msg) => {
          setSetupOpen(false);
          toast.success(msg);
        }}
      />
    </div>
  );
}

/** First-access popup: choose how to return to this form next time. */
function SetupModal({ open, token, credential, onClose, onDone }) {
  const [method, setMethod] = useState(null); // 'key' | 'npi'
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setMethod(null);
      setValue("");
      setError("");
    }
  }, [open]);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/provider-intake/${token}/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential, method, value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not set up return access.");
      onDone(
        method === "npi"
          ? `Return access set — sign back in with your NPI${data.providerName ? ` (${data.providerName})` : ""}.`
          : "Return access set — use your security key next time."
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-xl2 border border-navy/20 bg-white shadow-elev"
          >
            <div className="bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 px-5 py-3.5">
              <span className="mb-2 block h-0.5 w-full bg-gradient-to-r from-copper/70 via-copper to-copper/70" />
              <h3 className="text-[15px] font-extrabold tracking-tight text-white">Set up your return access</h3>
              <p className="text-[11px] font-semibold text-white/55">
                So you can close this and come back to finish anytime.
              </p>
            </div>

            <div className="space-y-3 p-5">
              <ChoiceCard
                active={method === "key"}
                onClick={() => setMethod("key")}
                title="Create my own security key"
                desc="Pick a private key only you know."
              />
              <ChoiceCard
                active={method === "npi"}
                onClick={() => setMethod("npi")}
                title="Use my individual NPI"
                desc="Verified against the national registry."
              />

              {method && (
                <div className="pt-1">
                  <Input
                    label={method === "npi" ? "Your individual (Type-1) NPI" : "Choose a security key"}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={method === "npi" ? "10-digit NPI" : "At least 6 characters"}
                    type={method === "key" ? "password" : "text"}
                    inputMode={method === "npi" ? "numeric" : undefined}
                    autoComplete="off"
                  />
                </div>
              )}

              {error && (
                <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] font-semibold text-rose-700">
                  {error}
                </p>
              )}

              <div className="flex justify-between gap-2 pt-1">
                <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-[13px] font-bold text-slate-500 hover:text-navy">
                  Skip for now
                </button>
                <Button onClick={submit} loading={busy} disabled={!method || !value.trim()}>
                  Save return access
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ChoiceCard({ active, onClick, title, desc }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl border-2 px-3.5 py-3 text-left transition-colors ${
        active ? "border-copper bg-copper/5" : "border-line hover:border-slate-300"
      }`}
    >
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${active ? "border-copper" : "border-slate-300"}`}>
        {active && <span className="h-2.5 w-2.5 rounded-full bg-copper" />}
      </span>
      <span>
        <span className="block text-[13px] font-extrabold text-navy">{title}</span>
        <span className="block text-[11px] font-medium text-slate-400">{desc}</span>
      </span>
    </button>
  );
}

function ShieldIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" strokeLinejoin="round" />
    </svg>
  );
}
function CheckIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function LockIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}

function SaveBadge({ state }) {
  const map = {
    idle: { dot: "bg-slate-300", text: "Saved", tone: "text-slate-400" },
    saving: { dot: "bg-amber-400", text: "Saving…", tone: "text-amber-600" },
    saved: { dot: "bg-emerald-500", text: "Saved", tone: "text-emerald-600" },
    error: { dot: "bg-rose-500", text: "Save failed", tone: "text-rose-600" },
  };
  const m = map[state] || map.idle;
  return (
    <div className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5">
      <span className={`h-2 w-2 rounded-full ${m.dot} ${state === "saving" ? "animate-pulse" : ""}`} />
      <span className={`text-[11px] font-bold ${m.tone}`}>{m.text}</span>
    </div>
  );
}
