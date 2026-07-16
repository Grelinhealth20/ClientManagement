"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Section, Spinner, EmptyState } from "@/components/ui/Misc";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { SECTIONS } from "@/lib/permissions";

export default function AccessPage() {
  const toast = useToast();
  const [users, setUsers] = useState(null);
  const [savingId, setSavingId] = useState(null);

  async function load() {
    try {
      const data = await api("/api/admin/users");
      setUsers(data.users);
    } catch (e) {
      toast.error(e.message);
      setUsers([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function toggle(user, key) {
    const has = user.permissions.includes(key);
    const next = has
      ? user.permissions.filter((k) => k !== key)
      : [...user.permissions, key];

    // optimistic update
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, permissions: next } : u)));
    setSavingId(user.id);
    try {
      await api(`/api/admin/users/${user.id}/access`, {
        method: "PUT",
        body: { permissions: next },
      });
      toast.success(`Access updated for ${user.name}.`);
    } catch (e) {
      toast.error(e.message);
      await load();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Section>
        <p className="text-sm font-bold uppercase tracking-widest text-copper-700">Governance</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-navy">
          Dashboard Access Controls
        </h1>
        <p className="mt-1 text-slate-500">
          Grant or revoke each user's access to specific client-dashboard sections.
        </p>
      </Section>

      <Section delay={0.05}>
        <div className="card overflow-hidden">
          {users === null ? (
            <Spinner label="Loading access matrix" />
          ) : users.length === 0 ? (
            <EmptyState title="No client users yet" hint="Provision users to manage their access." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-copper/60 bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 text-xs uppercase tracking-wider text-white">
                    <th className="px-5 py-4 font-bold">User</th>
                    {SECTIONS.map((s) => (
                      <th key={s.key} className="px-5 py-4 text-center font-bold">
                        {s.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {users.map((u, i) => (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className={`transition-colors hover:bg-mist ${
                        u.is_restricted ? "opacity-60" : ""
                      }`}
                    >
                      <td className="px-5 py-4">
                        <p className="font-bold text-navy">{u.name}</p>
                        <p className="text-xs text-slate-400">
                          {u.client_name} · {u.email}
                        </p>
                      </td>
                      {SECTIONS.map((s) => {
                        const on = u.permissions.includes(s.key);
                        return (
                          <td key={s.key} className="px-5 py-4 text-center">
                            <Toggle
                              on={on}
                              disabled={savingId === u.id}
                              onClick={() => toggle(u, s.key)}
                            />
                          </td>
                        );
                      })}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

function Toggle({ on, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
        on ? "bg-copper" : "bg-slate-200"
      }`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className={`inline-block h-4.5 w-4.5 rounded-full bg-white shadow-sm ${
          on ? "translate-x-6" : "translate-x-1"
        }`}
        style={{ height: 18, width: 18 }}
      />
    </button>
  );
}
