"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import { Section, StatusPill, Spinner, EmptyState } from "@/components/ui/Misc";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { SECTIONS } from "@/lib/permissions";

const EMPTY = { client_id: "", name: "", email: "", password: "", permissions: ["dashboard"] };

export default function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState(null);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const [confirmDel, setConfirmDel] = useState(null);
  const [resetFor, setResetFor] = useState(null);
  const [resetPwd, setResetPwd] = useState("");
  const [tempPwd, setTempPwd] = useState(null);

  async function load() {
    try {
      const [u, c] = await Promise.all([api("/api/admin/users"), api("/api/admin/clients")]);
      setUsers(u.users);
      setClients(c.clients);
    } catch (e) {
      toast.error(e.message);
      setUsers([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY, client_id: clients[0]?.id ? String(clients[0].id) : "" });
    setModalOpen(true);
  }
  function openEdit(u) {
    setEditing(u);
    setForm({
      client_id: String(u.client_id),
      name: u.name,
      email: u.email,
      password: "",
      permissions: u.permissions?.length ? u.permissions : [],
    });
    setModalOpen(true);
  }

  function togglePerm(key) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter((k) => k !== key)
        : [...f.permissions, key],
    }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/admin/users/${editing.id}`, {
          method: "PUT",
          body: { name: form.name, email: form.email, permissions: form.permissions },
        });
        toast.success("User updated.");
      } else {
        await api("/api/admin/users", {
          method: "POST",
          body: {
            client_id: Number(form.client_id),
            name: form.name,
            email: form.email,
            password: form.password,
            permissions: form.permissions,
          },
        });
        toast.success("User created.");
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await api(`/api/admin/users/${confirmDel.id}`, { method: "DELETE" });
      toast.success("User deleted.");
      setConfirmDel(null);
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function toggleRestrict(u) {
    try {
      await api(`/api/admin/users/${u.id}/restrict`, {
        method: "POST",
        body: { restricted: !u.is_restricted },
      });
      toast.success(u.is_restricted ? "Login restored." : "Login restricted.");
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function doReset(generate) {
    try {
      const data = await api(`/api/admin/users/${resetFor.id}/reset-password`, {
        method: "POST",
        body: generate ? {} : { password: resetPwd },
      });
      if (data.temp_password) {
        setTempPwd(data.temp_password);
      } else {
        toast.success("Password reset.");
        setResetFor(null);
        setResetPwd("");
      }
    } catch (e) {
      toast.error(e.message);
    }
  }

  const filtered = useMemo(() => {
    return (users || []).filter((u) => {
      const q = search.toLowerCase();
      const matchesSearch =
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.client_name || "").toLowerCase().includes(q);
      const matchesClient = !clientFilter || String(u.client_id) === clientFilter;
      return matchesSearch && matchesClient;
    });
  }, [users, search, clientFilter]);

  const noClients = clients.length === 0;

  return (
    <div className="space-y-6">
      <Section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-copper-700">Client Access</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-navy">Client Users</h1>
          <p className="mt-1 text-slate-500">
            Provision users, reset passwords, restrict logins, and grant dashboard access.
          </p>
        </div>
        <Button onClick={openCreate} disabled={noClients}>
          <PlusIcon /> Add User
        </Button>
      </Section>

      {noClients && (
        <Section delay={0.03}>
          <div className="card border-copper/30 bg-copper/5 p-4 text-sm font-semibold text-copper-700">
            Create a client first — users must belong to a client.
          </div>
        </Section>
      )}

      <Section delay={0.05}>
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
            <div className="relative w-full max-w-xs">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <SearchIcon />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users…"
                className="input-base pl-9"
              />
            </div>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="input-base w-auto min-w-[180px]"
            >
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
            <span className="ml-auto text-sm font-semibold text-slate-400">
              {filtered.length} {filtered.length === 1 ? "user" : "users"}
            </span>
          </div>

          {users === null ? (
            <Spinner label="Loading users" />
          ) : filtered.length === 0 ? (
            <EmptyState title="No users found" hint="Provision a user to grant dashboard access." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-copper/60 bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 text-xs uppercase tracking-wider text-white">
                    <Th>User</Th>
                    <Th>Client</Th>
                    <Th>Access</Th>
                    <Th>Status</Th>
                    <Th>Last login</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((u, i) => (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="transition-colors hover:bg-mist"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-full bg-mist text-sm font-bold text-navy">
                            {(u.name[0] || "?").toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-navy">{u.name}</p>
                            <p className="text-xs text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{u.client_name || "—"}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {u.permissions?.length ? (
                            u.permissions.map((p) => (
                              <span key={p} className="rounded-md bg-copper/10 px-2 py-0.5 text-[11px] font-bold text-copper-700">
                                {SECTIONS.find((s) => s.key === p)?.label || p}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">No access</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col items-start gap-1.5">
                          <StatusPill status={u.is_restricted ? "restricted" : "active"} />
                          {u.must_reset_password && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                                <circle cx="12" cy="12" r="9" />
                                <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
                              </svg>
                              Reset pending
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500">
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "Never"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <IconBtn title="Edit" onClick={() => openEdit(u)}>
                            <EditIcon />
                          </IconBtn>
                          <IconBtn
                            title="Reset password"
                            onClick={() => {
                              setResetFor(u);
                              setResetPwd("");
                              setTempPwd(null);
                            }}
                          >
                            <KeyIcon />
                          </IconBtn>
                          <IconBtn
                            title={u.is_restricted ? "Restore login" : "Restrict login"}
                            onClick={() => toggleRestrict(u)}
                          >
                            {u.is_restricted ? <UnlockIcon /> : <LockIcon />}
                          </IconBtn>
                          <IconBtn title="Delete" danger onClick={() => setConfirmDel(u)}>
                            <TrashIcon />
                          </IconBtn>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>

      {/* Create / edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit User" : "Add User"}
        subtitle={editing ? "Update user details and access." : "Provision a new client dashboard user."}
      >
        <form onSubmit={save} className="space-y-4">
          {!editing && (
            <Select
              label="Client"
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
              required
            >
              <option value="" disabled>
                Select a client…
              </option>
              {clients.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Jane Doe"
              required
            />
            <Input
              label="Username"
              type="text"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jsmith"
              hint="Used with the Client ID to sign in. Unique within the client."
              required
            />
          </div>
          {!editing && (
            <Input
              label="Temporary password"
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="At least 8 characters"
              hint="One-time credential — the user must set their own password on first login."
              required
            />
          )}

          <div>
            <p className="field-label">Dashboard access</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SECTIONS.map((s) => {
                const on = form.permissions.includes(s.key);
                return (
                  <button
                    type="button"
                    key={s.key}
                    onClick={() => togglePerm(s.key)}
                    className={`flex items-center justify-between rounded-xl border px-3.5 py-3 text-left transition-all ${
                      on
                        ? "border-copper bg-copper/5 shadow-sm"
                        : "border-line bg-white hover:border-copper/40"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-bold text-navy">{s.label}</p>
                      <p className="text-xs text-slate-400">{s.description}</p>
                    </div>
                    <span
                      className={`grid h-5 w-5 place-items-center rounded-md border ${
                        on ? "border-copper bg-copper text-white" : "border-line text-transparent"
                      }`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Save changes" : "Create user"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reset password modal */}
      <Modal
        open={!!resetFor}
        onClose={() => {
          setResetFor(null);
          setTempPwd(null);
        }}
        title="Reset password"
        subtitle={resetFor ? `For ${resetFor.name} (${resetFor.email})` : ""}
        maxWidth="max-w-md"
      >
        {tempPwd ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              A new password has been generated. Share it securely — it won't be shown again.
            </p>
            <div className="flex items-center justify-between gap-2 rounded-xl border border-copper/30 bg-copper/5 px-4 py-3">
              <code className="font-mono text-sm font-bold text-navy">{tempPwd}</code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(tempPwd);
                  toast.success("Copied to clipboard.");
                }}
                className="rounded-lg bg-navy px-2.5 py-1 text-xs font-bold text-white"
              >
                Copy
              </button>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setResetFor(null);
                  setTempPwd(null);
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Set a new password"
              type="text"
              value={resetPwd}
              onChange={(e) => setResetPwd(e.target.value)}
              placeholder="At least 8 characters"
            />
            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" type="button" onClick={() => doReset(true)}>
                Generate strong password
              </Button>
              <Button type="button" onClick={() => doReset(false)} disabled={resetPwd.length < 8}>
                Set password
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title="Delete user?"
        subtitle="This permanently removes the user account."
        maxWidth="max-w-md"
      >
        <p className="text-sm text-slate-600">
          Delete <span className="font-bold text-navy">{confirmDel?.name}</span>?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDel(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={remove}>
            Delete permanently
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`px-5 py-3 font-bold ${className}`}>{children}</th>;
}
function IconBtn({ children, danger, ...props }) {
  return (
    <button
      {...props}
      className={`grid h-8 w-8 place-items-center rounded-lg border transition-colors ${
        danger
          ? "border-line text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
          : "border-line text-slate-500 hover:border-copper/40 hover:bg-mist hover:text-copper-700"
      }`}
    >
      {children}
    </button>
  );
}
function PlusIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>; }
function SearchIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" strokeLinecap="round" /></svg>; }
function EditIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20h4L20 8l-4-4L4 16v4z" strokeLinejoin="round" /></svg>; }
function TrashIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function KeyIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="8" r="4" /><path d="M11 11l7 7M16 16l2-2M14 18l2-2" strokeLinecap="round" /></svg>; }
function LockIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>; }
function UnlockIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 7.5-1.9" /></svg>; }
