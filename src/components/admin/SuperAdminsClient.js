"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input } from "@/components/ui/Field";
import { Section, StatusPill, Spinner, EmptyState } from "@/components/ui/Misc";
import { useToast } from "@/components/ui/Toast";
import { PlusIcon, CloseIcon } from "@/components/icons";
import { api } from "@/lib/api";

const HEADERS = ["Administrator", "Email", "Status", "Last Login", "Actions"];
const emptyForm = () => ({ name: "", email: "", password: "" });

export default function SuperAdminsClient() {
  const toast = useToast();
  const [admins, setAdmins] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [resetFor, setResetFor] = useState(null);
  const [resetPwd, setResetPwd] = useState("");
  const [editFor, setEditFor] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "" });

  async function load() {
    try {
      const data = await api("/api/admin/super-admins");
      setAdmins(data.superAdmins);
    } catch (e) {
      toast.error(e.message);
      setAdmins([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/api/admin/super-admins", { method: "POST", body: form });
      toast.success(`Super admin ${form.email.trim().toLowerCase()} created.`);
      setForm(emptyForm());
      setCreateOpen(false);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setBusyId(confirmDel.id);
    try {
      await api(`/api/admin/super-admins/${confirmDel.id}`, { method: "DELETE" });
      toast.success("Super admin removed.");
      setConfirmDel(null);
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleRestrict(a) {
    setBusyId(a.id);
    try {
      await api(`/api/admin/super-admins/${a.id}`, { method: "PATCH", body: { restricted: !a.is_restricted } });
      toast.success(a.is_restricted ? "Access restored." : "Access restricted.");
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  function openEdit(a) {
    setEditFor(a);
    setEditForm({ name: a.name || "", email: a.email || "" });
  }
  async function doEdit(e) {
    e.preventDefault();
    setBusyId(editFor.id);
    try {
      await api(`/api/admin/super-admins/${editFor.id}`, { method: "PATCH", body: { name: editForm.name, email: editForm.email } });
      toast.success("Super admin updated.");
      setEditFor(null);
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function doReset() {
    setBusyId(resetFor.id);
    try {
      await api(`/api/admin/super-admins/${resetFor.id}`, { method: "PATCH", body: { password: resetPwd } });
      toast.success(`Password reset for ${resetFor.email}.`);
      setResetFor(null);
      setResetPwd("");
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-copper-700">Master Admin</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-navy">Super Administrators</h1>
          <p className="mt-1 text-slate-500">Create and manage full-access super admin accounts.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon size={14} /> Create Super Admin
        </Button>
      </Section>

      <Section delay={0.05}>
        <div className="card overflow-hidden">
          {admins === null ? (
            <Spinner label="Loading super admins" />
          ) : admins.length === 0 ? (
            <EmptyState title="No super admins" hint="Create the first super admin account." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b-2 border-copper/60 bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 text-xs uppercase tracking-wider text-white">
                    {HEADERS.map((h) => (
                      <th key={h} className="px-5 py-4 font-extrabold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {admins.map((a, i) => (
                    <motion.tr key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="transition-colors hover:bg-mist">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-full bg-navy text-[12px] font-extrabold text-copper ring-2 ring-copper/20">
                            {(a.name?.[0] || "?").toUpperCase()}
                          </div>
                          <div>
                            <p className="flex items-center gap-1.5 font-bold text-navy">
                              {a.name}
                              {a.is_master && (
                                <span className="rounded bg-copper/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-copper-700">Master</span>
                              )}
                            </p>
                            {a.must_reset_password && !a.is_master && (
                              <p className="text-[11px] font-semibold text-amber-600">Pending first-login reset</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-[13px] text-slate-600">{a.email}</td>
                      <td className="px-5 py-4"><StatusPill status={a.is_restricted ? "restricted" : "active"} /></td>
                      <td className="px-5 py-4 text-xs text-slate-500">{a.last_login_at ? new Date(a.last_login_at).toLocaleString() : "Never"}</td>
                      <td className="px-5 py-4">
                        {a.is_master ? (
                          <span className="text-[11px] font-semibold text-slate-400">Protected</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            <ActBtn onClick={() => openEdit(a)} disabled={busyId === a.id}>Edit</ActBtn>
                            <ActBtn onClick={() => { setResetFor(a); setResetPwd(""); }} disabled={busyId === a.id}>Reset password</ActBtn>
                            <ActBtn onClick={() => toggleRestrict(a)} disabled={busyId === a.id}>{a.is_restricted ? "Restore" : "Restrict"}</ActBtn>
                            <ActBtn danger onClick={() => setConfirmDel(a)} disabled={busyId === a.id}>Delete</ActBtn>
                          </div>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>

      {/* Create */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Super Admin" subtitle="Full-access administrator. Signs in with a blank Client ID + their email.">
        <form onSubmit={create} className="space-y-4">
          <Input label="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jordan Smith" required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jordan@grelinhealth.com" required />
          <Input label="Temporary Password" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" hint="One-time credential — they must set their own password at first login." required />
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create Super Admin</Button>
          </div>
        </form>
      </Modal>

      {/* Edit */}
      <Modal open={!!editFor} onClose={() => setEditFor(null)} title="Edit Super Admin" subtitle="Update the administrator's name and email." maxWidth="max-w-md">
        <form onSubmit={doEdit} className="space-y-4">
          <Input label="Full Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
          <Input label="Email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required hint="They sign in with this email and a blank Client ID." />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setEditFor(null)}>Cancel</Button>
            <Button type="submit" loading={busyId === editFor?.id}>Save changes</Button>
          </div>
        </form>
      </Modal>

      {/* Reset password */}
      <Modal open={!!resetFor} onClose={() => setResetFor(null)} title="Reset password" subtitle={resetFor ? `For ${resetFor.email}` : ""} maxWidth="max-w-md">
        <div className="space-y-4">
          <Input label="New temporary password" type="text" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} placeholder="At least 8 characters" hint="They must set their own password at next login." />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setResetFor(null)}>Cancel</Button>
            <Button onClick={doReset} loading={busyId === resetFor?.id} disabled={resetPwd.length < 8}>Reset password</Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Remove super admin?" subtitle="They will immediately lose all admin access." maxWidth="max-w-md">
        <p className="text-sm text-slate-600">
          Remove <span className="font-bold text-navy">{confirmDel?.name}</span> ({confirmDel?.email})?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDel(null)}>Cancel</Button>
          <Button variant="danger" onClick={remove} loading={busyId === confirmDel?.id}>Remove</Button>
        </div>
      </Modal>
    </div>
  );
}

function ActBtn({ children, danger, ...props }) {
  return (
    <button
      {...props}
      className={`rounded-lg border px-2.5 py-1 text-[11px] font-extrabold transition-colors disabled:opacity-50 ${
        danger
          ? "border-line text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
          : "border-line text-slate-500 hover:border-copper/40 hover:bg-mist hover:text-copper-700"
      }`}
    >
      {children}
    </button>
  );
}
