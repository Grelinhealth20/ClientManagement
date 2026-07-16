"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { api } from "@/lib/api";

// Mandatory, non-dismissable password-reset dialog shown on first login (or
// after an admin reset). The user cannot reach any dashboard section until they
// set a new password — their only alternatives are to complete it or log out.
export default function ForcePasswordReset({ email, redirectTo = "/dashboard" }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (next === current) {
      setError("New password must be different from your current password.");
      return;
    }
    setLoading(true);
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: { current_password: current, new_password: next },
      });
      setDone(true);
      // Brief success beat, then reload into the now-unlocked workspace.
      setTimeout(() => {
        router.replace(redirectTo);
        router.refresh();
      }, 900);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-900/50 backdrop-blur-sm" />
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="card relative z-10 w-full max-w-md overflow-hidden"
      >
        <div className="bg-gradient-to-br from-navy-800 to-navy-900 px-6 py-6 text-white">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-copper text-navy-900 shadow-copper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-extrabold leading-tight">Set your password</h3>
              <p className="text-xs font-medium text-white/60">Required before you continue</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          {done ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-3 py-6 text-center"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <p className="text-sm font-bold text-navy">Password updated. Opening your dashboard…</p>
            </motion.div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <p className="text-sm text-slate-500">
                Welcome{email ? `, ${email}` : ""}. For your security, please replace the
                password you were given with one only you know.
              </p>

              <Input
                id="current-password"
                label="Current password"
                type="password"
                autoComplete="current-password"
                placeholder="The password you just signed in with"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
              />
              <Input
                id="new-password"
                label="New password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
              />
              <Input
                id="confirm-password"
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter your new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700"
                >
                  {error}
                </motion.div>
              )}

              <Button type="submit" loading={loading} className="w-full">
                {loading ? "Saving" : "Set password & continue"}
              </Button>

              <button
                type="button"
                onClick={logout}
                className="w-full pt-1 text-center text-xs font-semibold text-slate-400 transition-colors hover:text-navy"
              >
                Log out instead
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
