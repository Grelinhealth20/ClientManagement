"use client";
import Image from "next/image";
import { motion } from "framer-motion";
import { KeyIcon, LayersIcon, ShieldCheckIcon, TrailIcon } from "@/components/icons";

// Written from the provider's perspective — the practice signing in. Every claim
// maps to a real capability in this repo: real-time enrollment tracking
// (requests module), document checklists (checklist_* tables), AES-256-GCM in
// src/lib/crypto.js, RBAC + audit_log in src/lib/db.js. Do NOT add a capability
// or compliance badge (SOC 2, ISO, PCI…) the system does not implement — this is
// the first screen an auditor sees.
const CAPABILITIES = [
  {
    icon: TrailIcon,
    title: "Real-time enrollment visibility",
    body: "See exactly where every payer enrollment stands — across your facility and each provider.",
  },
  {
    icon: LayersIcon,
    title: "Requests handled in one place",
    body: "Complete document checklists and raise requests without the email back-and-forth.",
  },
  {
    icon: KeyIcon,
    title: "Encrypted end to end",
    body: "Your credentials and PHI are AES-256 encrypted at rest and in transit.",
  },
  {
    icon: ShieldCheckIcon,
    title: "A private, governed workspace",
    body: "Your team collaborates inside a HIPAA-secured space, scoped only to your organization.",
  },
];

const TRUST = ["AES-256 encryption", "Real-time tracking", "Audit-logged access"];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

/**
 * Left half of the login screen — the provider's story: what your practice gets.
 * Hidden below `lg`, where the form takes the full width (a marketing column
 * stacked above a login form on a phone just pushes the fields off-screen).
 */
export default function BrandPanel() {
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="hidden max-w-2xl lg:block">
      <motion.div variants={item} className="flex items-center gap-3">
        <Image src="/grelin-logo.png" alt="Grelin" width={317} height={112} priority className="h-9 w-auto" />
        <span className="h-5 w-px bg-line" />
        <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-copper-700">
          Provider Portal
        </span>
      </motion.div>

      <motion.h2
        variants={item}
        className="mt-8 text-[40px] font-extrabold leading-[1.08] tracking-tight text-navy"
      >
        Your practice&apos;s onboarding,
        <span className="relative ml-2.5 inline-block">
          <span className="relative z-10 bg-gradient-to-r from-navy-700 via-copper-700 to-navy-700 bg-clip-text text-transparent">
            in real time
          </span>
          <motion.span
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.7, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 bottom-1 z-0 h-2.5 origin-left rounded-sm bg-copper/25"
          />
        </span>
      </motion.h2>

      <motion.p variants={item} className="mt-5 max-w-xl text-[15px] font-semibold leading-relaxed text-slate-700">
        Track credentialing and payer enrollment, respond to what we need from you, and keep
        your whole team moving — from one secure console built around your practice.
      </motion.p>

      <motion.ul variants={container} className="mt-9 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        {CAPABILITIES.map(({ icon: Icon, title, body }) => (
          <motion.li
            key={title}
            variants={item}
            className="group flex items-start gap-3.5 rounded-2xl border border-line/70 bg-white/50 p-3.5 backdrop-blur-sm transition-colors hover:border-copper/30 hover:bg-white"
          >
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-navy-800 to-navy-900 text-copper-400 shadow-crisp ring-1 ring-inset ring-white/10">
              <Icon size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-extrabold leading-tight text-navy">{title}</p>
              <p className="mt-1 text-[12px] font-semibold leading-relaxed text-slate-700">{body}</p>
            </div>
          </motion.li>
        ))}
      </motion.ul>

      <motion.div variants={item} className="mt-8 flex flex-wrap items-center gap-2.5 border-t border-line pt-5">
        <div className="flex items-center gap-2 pr-1">
          <StatusDot />
          <span className="text-[11px] font-extrabold text-navy">Encrypted session</span>
        </div>
        {TRUST.map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/70 px-2.5 py-1 text-[10.5px] font-extrabold text-navy">
            <span className="h-1 w-1 rounded-full bg-copper" />
            {t}
          </span>
        ))}
      </motion.div>
    </motion.div>
  );
}

/** Slow pulse — signals a live system without implying a status feed we don't have. */
function StatusDot() {
  return (
    <span className="relative grid h-2 w-2 place-items-center">
      <motion.span
        animate={{ scale: [1, 2.4, 1], opacity: [0.5, 0, 0.5] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute h-2 w-2 rounded-full bg-emerald-500"
      />
      <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
    </span>
  );
}
