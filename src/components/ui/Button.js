"use client";
import { motion } from "framer-motion";

/**
 * Futuristic copper CTA button with press/hover motion.
 * variants: primary (copper) | ghost | danger | subtle
 */
export default function Button({
  children,
  variant = "primary",
  type = "button",
  loading = false,
  disabled = false,
  className = "",
  ...props
}) {
  const base =
    "relative inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold tracking-wide transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed select-none";

  const variants = {
    primary:
      "text-white bg-gradient-to-b from-copper to-copper-600 shadow-copper hover:shadow-[0_10px_30px_-6px_rgba(207,148,85,0.65)] hover:brightness-[1.03]",
    danger:
      "text-white bg-gradient-to-b from-rose-500 to-rose-600 shadow-[0_8px_24px_-8px_rgba(244,63,94,0.55)] hover:brightness-[1.03]",
    ghost:
      "text-navy bg-white border border-line hover:border-copper/50 hover:bg-mist shadow-sm",
    subtle: "text-navy bg-mist hover:bg-line/70",
  };

  return (
    <motion.button
      whileHover={{ y: disabled || loading ? 0 : -1 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      type={type}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      )}
      {children}
    </motion.button>
  );
}
