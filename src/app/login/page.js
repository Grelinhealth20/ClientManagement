"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import { api } from "@/lib/api";
import LoginBackdrop from "@/components/login/LoginBackdrop";
import BrandPanel from "@/components/login/BrandPanel";
import CornerTicks from "@/components/login/CornerTicks";
import Field from "@/components/login/Field";
import {
  ArrowRightIcon,
  BoltIcon,
  EyeIcon,
  EyeOffIcon,
  IdIcon,
  LockIcon,
  UserIcon,
} from "@/components/icons";

// Entrance: the panel lifts in first, then its contents stagger behind it.
const EASE = [0.22, 1, 0.36, 1];
const panelIn = {
  hidden: { opacity: 0, y: 24, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.7, ease: EASE, staggerChildren: 0.07, delayChildren: 0.18 },
  },
};
const itemIn = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

export default function LoginPage() {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Client users are identified by Client ID + Username. Super admins have
      // no client, so they leave Client ID blank.
      const data = await api("/api/auth/login", {
        method: "POST",
        body: { client_id: clientId, username, password },
      });
      router.replace(data.redirect || "/");
      router.refresh();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-white">
      <LoginBackdrop />

      {/* Split screen: platform story on the left, sign-in on the right. Below
          `lg` the brand column is dropped and the form centres on its own —
          stacking it above the form would push the fields off a phone screen. */}
      <div className="relative z-10 mx-auto grid min-h-dvh max-w-7xl items-center gap-12 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[1.05fr_auto] lg:gap-16 lg:px-8">
        <BrandPanel />

        <motion.div
          variants={panelIn}
          initial="hidden"
          animate="show"
          className="relative z-10 w-full max-w-[33rem] justify-self-center"
        >
          <PanelHalo />

        <section className="relative overflow-hidden rounded-[1.4rem] border border-line bg-white/95 shadow-panel ring-1 ring-white/60 backdrop-blur-xl">
          <AccentBar />
          <PanelSheen />
          <CornerTicks />

          <div className="relative px-9 pt-9 pb-7 sm:px-11">
            <motion.header variants={itemIn} className="flex flex-col items-center text-center">
              <Image
                src="/grelin-logo.png"
                alt="Grelin"
                width={317}
                height={112}
                priority
                className="h-12 w-auto"
              />
              <h1 className="mt-5 text-[25px] font-extrabold leading-tight tracking-tight text-navy">
                Sign in to your Command Center
              </h1>
              <p className="mt-1.5 text-[13px] font-medium text-slate-500">
                Secure access to your onboarding &amp; enrollment workspace.
              </p>
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-copper/25 bg-copper/[0.06] px-3 py-1 text-[11px] font-extrabold text-copper-700">
                <BoltIcon />
                HIPAA Secured &amp; Compliant
              </p>
            </motion.header>

            <motion.hr
              variants={itemIn}
              className="mt-5 h-px w-full border-0 bg-gradient-to-r from-transparent via-line to-transparent"
            />

            <form onSubmit={onSubmit} className="mt-5 space-y-3.5">
              <Field
                variants={itemIn}
                id="client_id"
                label="Client ID"
                icon={<IdIcon />}
                type="text"
                autoComplete="organization"
                placeholder="Provided by your administrator"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                hint="Leave blank if you are a Grelin administrator."
              />

              <Field
                variants={itemIn}
                id="username"
                label="Username"
                icon={<UserIcon />}
                type="text"
                autoComplete="username"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />

              <Field
                variants={itemIn}
                id="password"
                label="Password"
                icon={<LockIcon />}
                className="pr-11"
                type={showPwd ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    aria-label={showPwd ? "Hide password" : "Show password"}
                    className="absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-mist hover:text-copper-700"
                  >
                    {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                }
              />

              {error && <ErrorNote>{error}</ErrorNote>}

              <motion.div variants={itemIn}>
                <SubmitButton loading={loading} />
              </motion.div>
            </form>
          </div>

            <footer className="relative border-t border-line bg-mist/50 px-9 py-4 sm:px-11">
              <div className="flex items-center justify-center gap-2.5">
                {["Encrypted", "Role-based access", "Audit-logged"].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold text-navy/60">
                    <span className="h-1 w-1 rounded-full bg-emerald-500" />
                    {t}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-center text-[11px] font-medium text-slate-400">
                © 2026 Grelin Health Technologies, Inc. All rights reserved.
              </p>
            </footer>
          </section>
        </motion.div>
      </div>
    </main>
  );
}

/* Soft brand halo behind the panel — lifts it off the light backdrop. */
function PanelHalo() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-b from-navy/[0.07] via-copper/[0.05] to-transparent blur-2xl"
    />
  );
}

/* Brand-gradient top accent with a travelling light sweep. */
function AccentBar() {
  return (
    <div
      aria-hidden="true"
      className="relative h-1.5 w-full overflow-hidden bg-gradient-to-r from-navy-700 via-copper to-navy-700"
    >
      <div className="absolute inset-y-0 w-1/3 animate-accent-sweep bg-gradient-to-r from-transparent via-white/70 to-transparent" />
    </div>
  );
}

/* Faint copper sheen washing down from the top edge of the panel. */
function PanelSheen() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-panel-sheen" />
  );
}

function ErrorNote({ children }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      role="alert"
      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700"
    >
      {children}
    </motion.p>
  );
}

function SubmitButton({ loading }) {
  return (
    <motion.button
      type="submit"
      disabled={loading}
      whileHover={{ y: loading ? 0 : -1 }}
      whileTap={{ scale: loading ? 1 : 0.98 }}
      className="group relative mt-1.5 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-b from-navy-700 to-navy-900 px-5 py-3.5 text-[15px] font-bold tracking-wide text-white shadow-elev ring-1 ring-inset ring-white/10 transition-all duration-200 hover:shadow-panel-btn disabled:cursor-not-allowed disabled:opacity-70"
    >
      {/* sheen that sweeps across on hover */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
      />
      {loading ? (
        <>
          <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          Signing in
        </>
      ) : (
        <>
          Access Your System
          <ArrowRightIcon className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </>
      )}
    </motion.button>
  );
}
