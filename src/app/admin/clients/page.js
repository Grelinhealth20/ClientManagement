"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Button from "@/components/ui/Button";
import { Section, StatusPill, Spinner, EmptyState } from "@/components/ui/Misc";
import { useToast } from "@/components/ui/Toast";
import CreateClientModal from "@/components/admin/CreateClientModal";
import EditClientModal from "@/components/admin/EditClientModal";
import ClientDetailView from "@/components/admin/ClientDetailView";
import { api } from "@/lib/api";

export default function ClientsPage() {
  const toast = useToast();
  const [clients, setClients] = useState(null);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null); // Edit modal (profile + users + delete)
  const [viewing, setViewing] = useState(null); // full-screen detail view
  const [isMaster, setIsMaster] = useState(false);

  async function load() {
    try {
      const data = await api("/api/admin/clients");
      setClients(data.clients);
    } catch (e) {
      toast.error(e.message);
      setClients([]);
    }
  }
  useEffect(() => {
    load();
    api("/api/auth/me")
      .then((me) => setIsMaster(!!me.user?.is_master))
      .catch(() => {});
  }, []);

  function openCreate() {
    setCreateOpen(true);
  }

  async function toggleStatus(c) {
    const next = c.status === "inactive" ? "active" : "inactive";
    try {
      await api(`/api/admin/clients/${c.id}`, { method: "PATCH", body: { status: next } });
      toast.success(next === "inactive" ? "Client access restricted." : "Client access restored.");
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const filtered = (clients || []).filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.company || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <Section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-copper-700">Clients</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-navy">Client Management</h1>
          <p className="mt-1 text-slate-500">Create, edit, and manage onboarded organizations.</p>
        </div>
        <Button onClick={openCreate}>
          <PlusIcon /> Add Client
        </Button>
      </Section>

      <Section delay={0.05}>
        <div className="card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line px-5 py-4">
            <div className="relative w-full max-w-sm">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <SearchIcon />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clients…"
                className="input-base pl-9"
              />
            </div>
            <span className="ml-auto text-sm font-semibold text-slate-400">
              {filtered.length} {filtered.length === 1 ? "client" : "clients"}
            </span>
          </div>

          {clients === null ? (
            <Spinner label="Loading clients" />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No clients yet"
              hint="Add your first client to begin onboarding."
              action={<Button className="mt-3" onClick={openCreate}>Add Client</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-copper/60 bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 text-xs uppercase tracking-wider text-white">
                    <Th>Client</Th>
                    <Th>Email</Th>
                    <Th>Users</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((c, i) => (
                    <motion.tr
                      key={c.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.025 }}
                      className="group transition-colors hover:bg-mist"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-xl bg-navy text-sm font-bold text-copper">
                            {(c.name[0] || "?").toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-navy">{c.name}</p>
                            <p className="text-xs text-slate-400">{c.company || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{c.email}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-lg bg-mist px-2.5 py-1 text-xs font-bold text-navy">
                          {c.user_count}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill status={c.status} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setViewing(c)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12px] font-extrabold text-slate-500 transition-colors hover:border-copper/40 hover:bg-copper hover:text-white"
                          >
                            <EyeIcon /> View Details
                          </button>
                          <button
                            onClick={() => setEditing(c)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12px] font-extrabold text-slate-500 transition-colors hover:border-navy/30 hover:bg-navy hover:text-white"
                          >
                            <EditIcon /> Edit
                          </button>
                          <button
                            onClick={() => toggleStatus(c)}
                            title={c.status === "inactive" ? "Restore access" : "Restrict access"}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-extrabold transition-colors ${
                              c.status === "inactive"
                                ? "border-emerald-200 text-emerald-700 hover:bg-emerald-600 hover:text-white"
                                : "border-line text-slate-500 hover:border-amber-300 hover:bg-amber-500 hover:text-white"
                            }`}
                          >
                            {c.status === "inactive" ? "Activate" : "Restrict"}
                          </button>
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

      {/* Full-screen detail view */}
      <ClientDetailView
        open={!!viewing}
        client={viewing}
        onClose={() => setViewing(null)}
      />

      {/* Edit: profile + users + (master) permanent delete */}
      <EditClientModal
        open={!!editing}
        client={editing}
        isMaster={isMaster}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
        onUsersChanged={load}
        onDeleted={() => {
          setEditing(null);
          load();
        }}
      />

      <CreateClientModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={load}
      />
    </div>
  );
}

function EyeIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>;
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
function PlusIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>;
}
function SearchIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" strokeLinecap="round" /></svg>;
}
function EditIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20h4L20 8l-4-4L4 16v4z" strokeLinejoin="round" /></svg>;
}
function TrashIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
