"use client";
import { motion } from "framer-motion";

// Clean, animated blank-section canvas. Content is intentionally empty for now.
export default function SectionPlaceholder({ eyebrow, title, description, icon }) {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-sm font-bold uppercase tracking-widest text-copper-700">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-navy">{title}</h1>
        <p className="mt-1 text-slate-500">{description}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        className="card relative overflow-hidden"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #0b1f3a10 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="relative flex min-h-[340px] flex-col items-center justify-center px-6 py-16 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-xl2 bg-gradient-to-br from-navy-800 to-navy-900 text-copper shadow-elev">
            {icon}
          </div>
          <p className="mt-5 text-lg font-extrabold text-navy">Ready for content</p>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            This section is set up and secured. Content will be added here.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
