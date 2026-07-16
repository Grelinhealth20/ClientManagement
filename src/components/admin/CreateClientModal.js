"use client";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { SECTIONS } from "@/lib/permissions";
import { SOW_OPTIONS, SAAS_SOW_VALUE, isSaasClient } from "@/lib/domain";
import { api } from "@/lib/api";
import { CloseIcon, PlusIcon } from "@/components/icons";
import { Fieldset, CheckCard, SystemAccessPopup } from "./clientFormBits";

// Rows carry a client-side key so React can track them across add/remove —
// index keys would re-associate inputs with the wrong row on delete.
let rowSeq = 0;
const blankUser = () => ({
  key: `u${++rowSeq}`,
  username: "",
  name: "",
  password: "",
  permissions: ["dashboard", "onboarding"],
});

const emptyForm = () => ({
  client_code: "",
  name: "",
  specialty: "",
  email: "",
  contact_person: "",
  phone: "",
  start_date: "",
  scope_of_work: [],
  system_access: [],
  users: [blankUser()],
});

export default function CreateClientModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(emptyForm);
  const [saasOpen, setSaasOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();

  const saas = useMemo(() => isSaasClient(form.scope_of_work), [form.scope_of_work]);

  function set(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function setUser(key, patch) {
    setForm((f) => ({
      ...f,
      users: f.users.map((u) => (u.key === key ? { ...u, ...patch } : u)),
    }));
  }

  function addUser() {
    setForm((f) => ({ ...f, users: [...f.users, blankUser()] }));
  }

  function removeUser(key) {
    // Always leave one row so the section never renders empty.
    setForm((f) => ({
      ...f,
      users: f.users.length > 1 ? f.users.filter((u) => u.key !== key) : [blankUser()],
    }));
  }

  function togglePermission(key, section) {
    setForm((f) => ({
      ...f,
      users: f.users.map((u) =>
        u.key === key
          ? {
              ...u,
              permissions: u.permissions.includes(section)
                ? u.permissions.filter((p) => p !== section)
                : [...u.permissions, section],
            }
          : u
      ),
    }));
  }

  function toggleSow(value) {
    setForm((f) => {
      const on = f.scope_of_work.includes(value);
      const scope_of_work = on
        ? f.scope_of_work.filter((v) => v !== value)
        : [...f.scope_of_work, value];
      // Deselecting SaaS must clear the access it unlocked, or the client would
      // keep system access it is no longer entitled to.
      const system_access = scope_of_work.includes(SAAS_SOW_VALUE) ? f.system_access : [];
      return { ...f, scope_of_work, system_access };
    });
    // Selecting SaaS opens the System Access picker straight away.
    if (value === SAAS_SOW_VALUE && !form.scope_of_work.includes(value)) setSaasOpen(true);
  }

  function toggleAccess(value) {
    setForm((f) => ({
      ...f,
      system_access: f.system_access.includes(value)
        ? f.system_access.filter((v) => v !== value)
        : [...f.system_access, value],
    }));
  }

  function close() {
    if (saving) return;
    setForm(emptyForm());
    setError("");
    setSaasOpen(false);
    onClose?.();
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        ...form,
        // Drop untouched rows and the client-side row keys; the API only wants
        // rows the admin actually filled in.
        users: form.users
          .filter((u) => u.username.trim() || u.password.trim() || u.name.trim())
          .map(({ key, ...u }) => u),
      };
      const res = await api("/api/admin/clients", { method: "POST", body: payload });
      const n = res.user_ids?.length ?? 0;
      toast.success(
        n ? `Client ${form.client_code} created with ${n} user${n === 1 ? "" : "s"}.` : `Client ${form.client_code} created.`
      );
      setForm(emptyForm());
      setSaasOpen(false);
      onCreated?.(res);
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={close}
        title="Create client"
        subtitle="Register an organization and provision its first user."
        maxWidth="max-w-3xl"
      >
        <form onSubmit={submit} className="space-y-5">
          <div className="max-h-modal-body space-y-5 overflow-y-auto overscroll-contain pr-1">
            <Fieldset legend="Client profile">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  id="client_code"
                  label="Client ID"
                  placeholder="ACME-MED-01"
                  hint="Used by this client's users to sign in. Must be unique."
                  value={form.client_code}
                  onChange={(e) => set({ client_code: e.target.value })}
                  required
                />
                <Input
                  id="name"
                  label="Client Name"
                  placeholder="Acme Medical Group"
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  required
                />
                <Input
                  id="specialty"
                  label="Specialty"
                  placeholder="Anesthesiology"
                  value={form.specialty}
                  onChange={(e) => set({ specialty: e.target.value })}
                />
                <Input
                  id="start_date"
                  label="Client Start Date"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => set({ start_date: e.target.value })}
                />
              </div>
            </Fieldset>

            <Fieldset legend="Scope of Work" required>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SOW_OPTIONS.map((o) => (
                  <CheckCard
                    key={o.value}
                    checked={form.scope_of_work.includes(o.value)}
                    onChange={() => toggleSow(o.value)}
                    label={o.label}
                    accent={o.value === SAAS_SOW_VALUE}
                  />
                ))}
              </div>

              {saas && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-copper/30 bg-copper/5 px-3.5 py-2.5"
                >
                  <p className="text-xs font-semibold text-navy">
                    {form.system_access.length
                      ? `${form.system_access.length} system access selected`
                      : "No system access selected yet"}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSaasOpen(true)}
                    className="rounded-lg border border-copper/40 bg-white px-2.5 py-1 text-[11px] font-extrabold text-copper-700 transition-colors hover:bg-copper hover:text-white"
                  >
                    {form.system_access.length ? "Edit system access" : "Choose system access"}
                  </button>
                </motion.div>
              )}
            </Fieldset>

            <Fieldset legend="Contact">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  id="email"
                  label="Email ID"
                  type="email"
                  placeholder="billing@acmemed.com"
                  value={form.email}
                  onChange={(e) => set({ email: e.target.value })}
                  required
                />
                <Input
                  id="contact_person"
                  label="Contact Person Name"
                  placeholder="Dana Whitfield"
                  value={form.contact_person}
                  onChange={(e) => set({ contact_person: e.target.value })}
                />
                <Input
                  id="phone"
                  label="Phone Number"
                  placeholder="+1 555 0100"
                  value={form.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                />
              </div>
            </Fieldset>

            <Fieldset
              legend="Users"
              hint="Optional. Add as many users as this client needs, each with their own access."
            >
              <div className="space-y-2.5">
                <AnimatePresence initial={false}>
                  {form.users.map((u, i) => (
                    <motion.div
                      key={u.key}
                      layout
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.16 }}
                      className="rounded-xl border border-line bg-mist/40 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                          User {i + 1}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeUser(u.key)}
                          aria-label={`Remove user ${i + 1}`}
                          className="grid h-6 w-6 place-items-center rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                        >
                          <CloseIcon size={13} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                        <Input
                          id={`username-${u.key}`}
                          label="Username"
                          placeholder="jsmith"
                          value={u.username}
                          onChange={(e) => setUser(u.key, { username: e.target.value })}
                        />
                        <Input
                          id={`user_name-${u.key}`}
                          label="Full Name"
                          placeholder="Jordan Smith"
                          value={u.name}
                          onChange={(e) => setUser(u.key, { name: e.target.value })}
                        />
                        <Input
                          id={`temp_password-${u.key}`}
                          label="Temp Password"
                          placeholder="min. 8 characters"
                          value={u.password}
                          onChange={(e) => setUser(u.key, { password: e.target.value })}
                        />
                      </div>

                      <p className="mt-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Access controls
                      </p>
                      <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {SECTIONS.map((s) => (
                          <CheckCard
                            key={s.key}
                            checked={u.permissions.includes(s.key)}
                            onChange={() => togglePermission(u.key, s.key)}
                            label={s.label}
                            sub={s.description}
                          />
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <button
                type="button"
                onClick={addUser}
                className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-2 text-[12px] font-extrabold text-slate-500 transition-colors hover:border-copper/50 hover:bg-copper/5 hover:text-copper-700"
              >
                <PlusIcon size={13} />
                Add another user
              </button>

              <p className="mt-1.5 text-[11px] font-medium text-slate-400">
                Usernames must be unique within this client. Each user must change their temp
                password at first login.
              </p>
            </Fieldset>
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button type="button" variant="ghost" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Create client
            </Button>
          </div>
        </form>
      </Modal>

      <SystemAccessPopup
        open={saasOpen}
        selected={form.system_access}
        onToggle={toggleAccess}
        onClose={() => setSaasOpen(false)}
      />
    </>
  );
}
