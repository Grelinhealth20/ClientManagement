"use client";
import { motion } from "framer-motion";

export default function NoAccess() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card flex min-h-[360px] flex-col items-center justify-center px-6 py-16 text-center"
    >
      <div className="grid h-14 w-14 place-items-center rounded-xl2 bg-mist text-copper">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="10" width="16" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      </div>
      <p className="mt-4 text-lg font-extrabold text-navy">No sections available</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Your account doesn't have access to any dashboard sections yet. Please contact your
        administrator.
      </p>
    </motion.div>
  );
}
