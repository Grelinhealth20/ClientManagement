"use client";
import { motion } from "framer-motion";

// Drifting brand auras. Each loops on its own long, prime-ish duration so the
// three never resynchronise into a visible pattern.
const AURAS = [
  {
    className: "-left-40 -top-40 h-[30rem] w-[30rem] bg-copper/20",
    animate: { x: [0, 40, -20, 0], y: [0, -30, 20, 0], scale: [1, 1.08, 0.96, 1] },
    duration: 26,
  },
  {
    className: "-bottom-48 -right-36 h-[34rem] w-[34rem] bg-navy/[0.09]",
    animate: { x: [0, -35, 25, 0], y: [0, 25, -20, 0], scale: [1, 0.94, 1.06, 1] },
    duration: 32,
  },
  {
    className: "left-1/2 top-1/3 h-[26rem] w-[26rem] -translate-x-1/2 bg-navy-600/[0.06]",
    animate: { x: [0, 30, -30, 0], y: [0, -20, 15, 0] },
    duration: 38,
  },
];

// Counter-rotating rings framing the panel, each carrying a single travelling node.
const RINGS = [
  { size: "h-[46rem] w-[46rem]", border: "border-navy/[0.06]", node: "bg-copper/40", to: 360, duration: 90 },
  { size: "h-[64rem] w-[64rem]", border: "border-navy/[0.05]", node: "bg-navy/25", to: -360, duration: 130 },
];

const loop = (duration, ease = "easeInOut") => ({ duration, repeat: Infinity, ease });

function Aura({ className, animate, duration }) {
  return (
    <motion.div
      animate={animate}
      transition={loop(duration)}
      className={`absolute rounded-full blur-3xl ${className}`}
    />
  );
}

function OrbitRing({ size, border, node, to, duration }) {
  return (
    <motion.div
      animate={{ rotate: to }}
      transition={loop(duration, "linear")}
      className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border ${size} ${border}`}
    >
      <span className={`absolute -top-[3px] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${node}`} />
    </motion.div>
  );
}

/**
 * Decorative backdrop for the login screen: drifting brand auras, orbit rings
 * and a slow scanline over a light wash. Everything is deliberately low
 * contrast so the white login panel keeps the focus.
 */
export default function LoginBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-gradient-to-b from-white via-mist to-white" />

      {AURAS.map((aura, i) => (
        <Aura key={i} {...aura} />
      ))}

      {RINGS.map((ring, i) => (
        <OrbitRing key={i} {...ring} />
      ))}

      <div className="absolute inset-x-0 top-0 h-px animate-scanline bg-gradient-to-r from-transparent via-copper/30 to-transparent" />

      <div className="absolute inset-0 bg-backdrop-vignette" />
    </div>
  );
}
