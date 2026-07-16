"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Button from "@/components/ui/Button";
import { PlusIcon } from "@/components/icons";
import CreateClientModal from "./CreateClientModal";
import ClientsTable from "./ClientsTable";

/**
 * Interactive half of the Control Center. The page itself stays a server
 * component so the stats and client list are fetched on the server; this owns
 * only the create-modal state and the refresh after a create.
 */
export default function OverviewClient({ cards, clients }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map((c, i) => (
          <StatCard key={c.label} {...c} index={i} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold tracking-tight text-navy">Clients</h2>
          <p className="text-[11px] font-medium text-slate-400">
            {clients.length} {clients.length === 1 ? "organization" : "organizations"} registered
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-1.5">
          <PlusIcon size={14} />
          Create Client
        </Button>
      </div>

      <ClientsTable clients={clients} />

      <CreateClientModal
        open={open}
        onClose={() => setOpen(false)}
        // Re-fetch the server component so the new row appears with the same
        // shape the server renders, rather than a client-side guess at it.
        onCreated={() => router.refresh()}
      />
    </div>
  );
}

function StatCard({ label, value, hint, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="group relative overflow-hidden rounded-xl2 border border-navy/10 bg-white p-5 shadow-crisp ring-1 ring-inset ring-line transition-all duration-300 hover:-translate-y-0.5 hover:border-copper/40 hover:shadow-elev"
    >
      {/* Signature navy→copper accent bar, matching the detail panel header. */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-navy-700 via-copper to-navy-700 opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-copper/5 transition-transform duration-500 group-hover:scale-150" />
      <p className="relative text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="relative mt-2 text-3xl font-extrabold tracking-tight text-navy">{value}</p>
      <p className="relative mt-1 text-[12px] font-medium text-slate-400">{hint}</p>
    </motion.div>
  );
}
