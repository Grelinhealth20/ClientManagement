"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { SOW_OPTIONS, SAAS_SOW_VALUE, isSaasClient } from "@/lib/domain";
import { SECTIONS } from "@/lib/permissions";
import { api } from "@/lib/api";
import { CloseIcon, PlusIcon } from "@/components/icons";
import { Fieldset, CheckCard, SystemAccessPopup } from "./clientFormBits";

// Full-fidelity edit of an already-created client. Unlike creation, this never
// touches the client's users — those are managed on the Users page — so it edits
// exactly the profile fields the Create Client form captured, pre-filled from
// the existing record.

/** A stored ISO datetime → the YYYY-MM-DD a <input type="date"> expects. */
function toDateInput(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function formFromClient(c) {
  return {
    client_code: c?.client_code || "",
    name: c?.name || "",
    company: c?.company || "",
    specialty: c?.specialty || "",
    email: c?.email || "",
    contact_person: c?.contact_person || "",
    phone: c?.phone || "",
    start_date: toDateInput(c?.start_date),
    status: c?.status === "inactive" ? "inactive" : "active",
    notes: c?.notes || "",
    scope_of_work: Array.isArray(c?.scope_of_work) ? [...c.scope_of_work] : [],
    system_access: Array.isArray(c?.system_access) ? [...c.system_access] : [],
  };
}

const emptyDraft = () => ({
  username: "",
  name: "",
  password: "",
  permissions: ["dashboard", "onboarding"],
});

export default function EditClientModal({ open, client, onClose, onSaved, onUsersChanged, isMaster, onDeleted }) {
  const [form, setForm] = useState(() => formFromClient(client));
  const [saasOpen, setSaasOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();

  // Master-admin permanent delete.
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);

  async function permanentDelete() {
    if (!client || confirmText.trim() !== client.client_code) return;
    setDeleting(true);
    try {
      await api(`/api/admin/clients/${client.id}`, { method: "DELETE" });
      toast.success(`Client ${client.client_code} permanently deleted.`);
      onDeleted?.(client.id);
      onClose?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
    }
  }

  // Users provisioned for this client. `null` while the first load is in flight.
  const [users, setUsers] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState("");
  const [addingUser, setAddingUser] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);

  async function loadUsers(clientId) {
    setUsers(null);
    try {
      const data = await api(`/api/admin/clients/${clientId}/users`);
      setUsers(data.users);
    } catch (e) {
      toast.error(e.message);
      setUsers([]);
    }
  }

  // Re-seed whenever a different client is opened for editing.
  useEffect(() => {
    if (open && client) {
      setForm(formFromClient(client));
      setError("");
      setSaasOpen(false);
      setDraft(emptyDraft());
      setAddOpen(false);
      setAddError("");
      setConfirmRemove(null);
      setDangerOpen(false);
      setConfirmText("");
      loadUsers(client.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client]);

  const saas = useMemo(() => isSaasClient(form.scope_of_work), [form.scope_of_work]);

  function set(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function toggleSow(value) {
    setForm((f) => {
      const on = f.scope_of_work.includes(value);
      const scope_of_work = on
        ? f.scope_of_work.filter((v) => v !== value)
        : [...f.scope_of_work, value];
      // Deselecting SaaS must clear the access it unlocked.
      const system_access = scope_of_work.includes(SAAS_SOW_VALUE) ? f.system_access : [];
      return { ...f, scope_of_work, system_access };
    });
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

  function toggleDraftPerm(section) {
    setDraft((d) => ({
      ...d,
      permissions: d.permissions.includes(section)
        ? d.permissions.filter((p) => p !== section)
        : [...d.permissions, section],
    }));
  }

  async function addUser(e) {
    e?.preventDefault();
    if (!client) return;
    setAddError("");
    setAddingUser(true);
    try {
      await api(`/api/admin/clients/${client.id}/users`, {
        method: "POST",
        body: {
          username: draft.username,
          name: draft.name,
          password: draft.password,
          permissions: draft.permissions,
        },
      });
      toast.success(`User ${draft.username.trim().toLowerCase()} added.`);
      setDraft(emptyDraft());
      setAddOpen(false);
      await loadUsers(client.id);
      // Keep the tables/counts behind the modal in sync without closing it.
      onUsersChanged?.();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddingUser(false);
    }
  }

  async function removeUser(u) {
    setRemovingId(u.id);
    try {
      await api(`/api/admin/users/${u.id}`, { method: "DELETE" });
      toast.success(`User ${u.username} removed.`);
      setConfirmRemove(null);
      if (client) await loadUsers(client.id);
      onUsersChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRemovingId(null);
    }
  }

  function close() {
    if (saving) return;
    setError("");
    setSaasOpen(false);
    onClose?.();
  }

  async function submit(e) {
    e.preventDefault();
    if (!client) return;
    setError("");
    setSaving(true);
    try {
      const res = await api(`/api/admin/clients/${client.id}`, { method: "PUT", body: form });
      toast.success(`Client ${form.client_code} updated.`);
      onSaved?.(res.client);
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
        title="Edit client"
        subtitle="Update this organization's profile. Users are managed separately."
        maxWidth="max-w-3xl"
      >
        <form onSubmit={submit} className="space-y-5">
          <div className="max-h-modal-body space-y-5 overflow-y-auto overscroll-contain pr-1">
            <Fieldset legend="Client profile">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  id="edit_client_code"
                  label="Client ID"
                  placeholder="ACME-MED-01"
                  hint="Used by this client's users to sign in. Must be unique."
                  value={form.client_code}
                  onChange={(e) => set({ client_code: e.target.value })}
                  required
                />
                <Input
                  id="edit_name"
                  label="Client Name"
                  placeholder="Acme Medical Group"
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  required
                />
                <Input
                  id="edit_company"
                  label="Company"
                  placeholder="Acme Inc."
                  value={form.company}
                  onChange={(e) => set({ company: e.target.value })}
                />
                <Input
                  id="edit_specialty"
                  label="Specialty"
                  placeholder="Anesthesiology"
                  value={form.specialty}
                  onChange={(e) => set({ specialty: e.target.value })}
                />
                <Input
                  id="edit_start_date"
                  label="Client Start Date"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => set({ start_date: e.target.value })}
                />
                <Select
                  id="edit_status"
                  label="Account Status"
                  value={form.status}
                  onChange={(e) => set({ status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
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
                  id="edit_email"
                  label="Email ID"
                  type="email"
                  placeholder="billing@acmemed.com"
                  value={form.email}
                  onChange={(e) => set({ email: e.target.value })}
                  required
                />
                <Input
                  id="edit_contact_person"
                  label="Contact Person Name"
                  placeholder="Dana Whitfield"
                  value={form.contact_person}
                  onChange={(e) => set({ contact_person: e.target.value })}
                />
                <Input
                  id="edit_phone"
                  label="Phone Number"
                  placeholder="+1 555 0100"
                  hint="Stored encrypted (AES-256)."
                  value={form.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                />
              </div>
            </Fieldset>

            <Fieldset legend="Notes">
              <Textarea
                id="edit_notes"
                value={form.notes}
                onChange={(e) => set({ notes: e.target.value })}
                placeholder="Internal notes…"
              />
            </Fieldset>

            <Fieldset
              legend="Users"
              hint="Provisioned logins for this client. Add or remove them here — changes apply immediately."
            >
              <div className="space-y-2">
                {users === null ? (
                  <div className="rounded-xl border border-line bg-mist/40 px-3 py-4 text-center text-[12px] font-semibold text-slate-400">
                    Loading users…
                  </div>
                ) : users.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-line bg-mist/40 px-3 py-4 text-center text-[12px] font-medium text-slate-400">
                    No users yet. Add the first login below.
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {users.map((u) => (
                      <motion.div
                        key={u.id}
                        layout
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        transition={{ duration: 0.16 }}
                        className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate font-mono text-[12px] font-bold text-navy">
                              {u.username}
                            </span>
                            {u.is_restricted && (
                              <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-rose-700">
                                Restricted
                              </span>
                            )}
                            {u.must_reset_password && (
                              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-amber-700">
                                Pending reset
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400">
                            {u.name || "—"}
                            {u.permissions?.length
                              ? ` · ${u.permissions
                                  .map((p) => SECTIONS.find((s) => s.key === p)?.label || p)
                                  .join(", ")}`
                              : ""}
                          </p>
                        </div>
                        {confirmRemove === u.id ? (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => removeUser(u)}
                              disabled={removingId === u.id}
                              className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-extrabold text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
                            >
                              {removingId === u.id ? "Removing…" : "Confirm"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRemove(null)}
                              disabled={removingId === u.id}
                              className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-extrabold text-slate-500 transition-colors hover:bg-mist"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRemove(u.id)}
                            className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[11px] font-extrabold text-slate-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                          >
                            Remove
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>

              {addOpen ? (
                <div className="mt-2.5 rounded-xl border border-navy/20 bg-navy/[0.03] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      New user
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setAddOpen(false);
                        setAddError("");
                        setDraft(emptyDraft());
                      }}
                      aria-label="Cancel add user"
                      className="grid h-6 w-6 place-items-center rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    >
                      <CloseIcon size={13} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <Input
                      id="add_username"
                      label="Username"
                      placeholder="jsmith"
                      value={draft.username}
                      onChange={(e) => setDraft((d) => ({ ...d, username: e.target.value }))}
                    />
                    <Input
                      id="add_user_name"
                      label="Full Name"
                      placeholder="Jordan Smith"
                      value={draft.name}
                      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    />
                    <Input
                      id="add_user_password"
                      label="Temp Password"
                      placeholder="min. 8 characters"
                      value={draft.password}
                      onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
                    />
                  </div>

                  <p className="mt-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Access controls
                  </p>
                  <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {SECTIONS.map((s) => (
                      <CheckCard
                        key={s.key}
                        checked={draft.permissions.includes(s.key)}
                        onChange={() => toggleDraftPerm(s.key)}
                        label={s.label}
                        sub={s.description}
                      />
                    ))}
                  </div>

                  {addError && (
                    <p
                      role="alert"
                      className="mt-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700"
                    >
                      {addError}
                    </p>
                  )}

                  <div className="mt-3 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setAddOpen(false);
                        setAddError("");
                        setDraft(emptyDraft());
                      }}
                      disabled={addingUser}
                    >
                      Cancel
                    </Button>
                    {/* Not type="submit": this must not submit the profile form. */}
                    <Button type="button" onClick={addUser} loading={addingUser}>
                      Add user
                    </Button>
                  </div>

                  <p className="mt-2 text-[11px] font-medium text-slate-400">
                    The user signs in with this client&apos;s Client ID and their username, and must
                    change this temp password at first login.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-2 text-[12px] font-extrabold text-slate-500 transition-colors hover:border-copper/50 hover:bg-copper/5 hover:text-copper-700"
                >
                  <PlusIcon size={13} />
                  Add another user
                </button>
              )}
            </Fieldset>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700"
            >
              {error}
            </p>
          )}

          {/* Danger zone — permanent delete, master admin only */}
          {isMaster && (
            <div className="rounded-xl border-2 border-rose-200 bg-rose-50/50 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[12px] font-extrabold uppercase tracking-wider text-rose-700">Danger zone</p>
                  <p className="text-[11px] font-medium text-slate-500">
                    Permanently delete this client — every user, onboarding record, and document (DB + S3). Cannot be undone.
                  </p>
                </div>
                {!dangerOpen && (
                  <button
                    type="button"
                    onClick={() => setDangerOpen(true)}
                    className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-[12px] font-extrabold text-rose-700 transition-colors hover:bg-rose-600 hover:text-white"
                  >
                    Permanently delete
                  </button>
                )}
              </div>
              {dangerOpen && (
                <div className="mt-3 space-y-2.5">
                  <Input
                    label={`Type the Client ID “${client?.client_code}” to confirm`}
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={client?.client_code}
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => { setDangerOpen(false); setConfirmText(""); }} disabled={deleting}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={permanentDelete}
                      loading={deleting}
                      disabled={confirmText.trim() !== client?.client_code}
                    >
                      Delete everything
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700"
            >
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button type="button" variant="ghost" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save changes
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
