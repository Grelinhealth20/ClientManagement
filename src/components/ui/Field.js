"use client";

export function Input({ label, id, hint, error, className = "", ...props }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
        </label>
      )}
      <input id={id} className="input-base" {...props} />
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs font-semibold text-rose-600">{error}</p>}
    </div>
  );
}

export function Textarea({ label, id, rows = 3, className = "", ...props }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
        </label>
      )}
      <textarea id={id} rows={rows} className="input-base resize-y" {...props} />
    </div>
  );
}

export function Select({ label, id, children, className = "", ...props }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
        </label>
      )}
      <select id={id} className="input-base appearance-none bg-white" {...props}>
        {children}
      </select>
    </div>
  );
}
