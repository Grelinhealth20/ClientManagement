"use client";
import { motion } from "framer-motion";

/**
 * Labelled input with a leading icon and an optional trailing control.
 * The icon picks up the copper accent while the field has focus.
 */
export default function Field({
  id,
  label,
  icon,
  trailing,
  hint,
  className = "",
  variants,
  ...inputProps
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <motion.div variants={variants}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="group relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors duration-200 group-focus-within:text-copper-700">
          {icon}
        </span>
        <input
          id={id}
          aria-describedby={hintId}
          className={`input-base pl-10 ${className}`}
          {...inputProps}
        />
        {trailing}
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 text-[11px] font-medium text-slate-400">
          {hint}
        </p>
      )}
    </motion.div>
  );
}
