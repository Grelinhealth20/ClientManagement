"use client";
import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";

/**
 * Generates a secure external link + security key for a provider slot, so the
 * facility can invite the provider to complete their own section. The token and
 * key are shown once; only their hashes are stored server-side.
 */
export default function ProviderLinkModal({ open, provider, onClose }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function generate() {
    setLoading(true);
    setResult(null);
    try {
      const res = await api("/api/onboarding/provider-links", {
        method: "POST",
        body: {
          provider_key: provider?.key,
          label: provider?.personal?.fullLegalName || "Provider",
        },
      });
      const url = `${window.location.origin}${res.path}`;
      setResult({ url, key: res.security_key, expires: res.expires_at });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  function copy(text, what) {
    navigator.clipboard?.writeText(text).then(
      () => toast.success(`${what} copied.`),
      () => toast.error("Copy failed — select and copy manually.")
    );
  }

  function close() {
    setResult(null);
    onClose?.();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Invite provider externally"
      subtitle="Share a secure link so the provider can complete their own section."
      maxWidth="max-w-lg"
    >
      {!result ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            This creates a one-off secure link and a security key for{" "}
            <span className="font-bold text-navy">
              {provider?.personal?.fullLegalName || "this provider"}
            </span>
            . Their submission is tagged to this facility and Client ID automatically.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close} type="button">
              Cancel
            </Button>
            <Button onClick={generate} loading={loading}>
              Generate secure link
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            Link created. Share both the link and the security key with the provider — the
            key is shown only once.
          </div>

          <Field label="Secure link">
            <div className="flex gap-2">
              <input readOnly value={result.url} className="input-base font-mono text-[12px]" />
              <Button type="button" onClick={() => copy(result.url, "Link")}>
                Copy
              </Button>
            </div>
          </Field>

          <Field label="Security key">
            <div className="flex gap-2">
              <input
                readOnly
                value={result.key}
                className="input-base font-mono text-base font-bold tracking-widest"
              />
              <Button type="button" onClick={() => copy(result.key, "Security key")}>
                Copy
              </Button>
            </div>
          </Field>

          <p className="text-[12px] font-medium text-slate-400">
            Expires {new Date(result.expires).toLocaleDateString()}. The provider must enter the
            security key to open the form.
          </p>

          <div className="flex justify-end">
            <Button onClick={close}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}
