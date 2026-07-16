"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/lib/api";
import { BellIcon } from "@/components/icons";

const POLL_MS = 15000;
// How long a notification stays in the panel, and how many are kept at most.
// This prunes the VIEW only — audit_log itself is the immutable compliance
// trail and is never deleted from here.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_ITEMS = 50;
// Items age out on a timer as well as on poll, so a quiet portal still drops
// stale entries instead of showing week-old activity until something happens.
const PRUNE_MS = 60000;

function prune(items) {
  const cutoff = Date.now() - MAX_AGE_MS;
  const kept = items
    .filter((n) => {
      const t = new Date(n.created_at).getTime();
      // Keep anything whose timestamp we can't read rather than silently
      // dropping it.
      return Number.isNaN(t) || t >= cutoff;
    })
    .slice(0, MAX_ITEMS);
  // Return the original array when nothing was dropped: the prune timer runs
  // every minute, and a fresh array each time would re-render the panel for no
  // reason.
  return kept.length === items.length ? items : kept;
}

/**
 * Header bell backed by the live audit trail.
 *
 * Polls rather than holding a socket: the app is deployed to serverless
 * functions, which cannot hold a long-lived connection per client. The cursor
 * is the newest audit_log id already seen, so a steady-state poll transfers an
 * empty array rather than re-sending the list.
 */
export default function NotificationBell({ initial = [] }) {
  const [items, setItems] = useState(() => prune(initial));
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const cursor = useRef(initial[0]?.id ?? null);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);
  // Read inside poll() without making poll depend on it: a changing dependency
  // would tear down and restart the interval every time the panel is toggled,
  // resetting the countdown to the next refresh.
  const openRef = useRef(open);
  openRef.current = open;

  const poll = useCallback(async () => {
    try {
      const qs = cursor.current ? `?after=${encodeURIComponent(cursor.current)}` : "";
      const data = await api(`/api/admin/notifications${qs}`);
      const fresh = data.notifications ?? [];
      cursor.current = data.cursor ?? cursor.current;
      // Prune even when nothing arrived, so an idle portal still ages entries
      // out instead of waiting for the next event.
      setItems((prev) => prune(fresh.length ? [...fresh, ...prev] : prev));
      if (fresh.length && !openRef.current) setUnread((n) => n + fresh.length);
    } catch {
      // A failed poll is not worth surfacing — the next one is 15s away.
    }
  }, []);

  useEffect(() => {
    // Don't poll a backgrounded tab: it burns a DB round trip per interval for
    // a panel nobody is looking at. Poll immediately on becoming visible so a
    // returning tab isn't stale for up to POLL_MS.
    const tick = () => {
      if (document.visibilityState === "visible") poll();
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [poll]);

  // Age items out on their own timer. Without this, a portal with no new
  // activity would keep showing entries indefinitely, because pruning would
  // only ever run on a poll that returned something.
  useEffect(() => {
    const id = setInterval(() => setItems((prev) => prune(prev)), PRUNE_MS);
    return () => clearInterval(id);
  }, []);

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (panelRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    setOpen((o) => {
      if (!o) setUnread(0);
      return !o;
    });
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={toggle}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-mist hover:text-navy"
      >
        <BellIcon />
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-copper px-1 text-[10px] font-extrabold text-white ring-2 ring-white"
          >
            {unread > 9 ? "9+" : unread}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            // w-80 is 320px — the full width of the smallest phones, so it
            // would run off the left edge. Cap it to the viewport minus the
            // header's own padding.
            className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-white shadow-panel"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-navy">
                Notifications
              </p>
              <span className="text-[11px] font-semibold text-slate-400">Audit trail</span>
            </div>

            <div className="max-h-80 divide-y divide-line overflow-y-auto">
              {items.length === 0 && (
                <p className="px-4 py-10 text-center text-xs font-medium text-slate-400">
                  No activity recorded yet.
                </p>
              )}
              {items.map((n) => (
                <div key={n.id} className="flex items-start gap-2.5 px-4 py-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-copper" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold leading-snug text-navy">
                      {prettyAction(n.action)}
                    </p>
                    <p className="truncate text-[11px] font-medium text-slate-400">{n.actor}</p>
                  </div>
                  <time className="shrink-0 text-[10px] font-semibold text-slate-400">
                    {relativeTime(n.created_at)}
                  </time>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function prettyAction(a = "") {
  return a.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function relativeTime(value) {
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return "";
  const secs = Math.round((Date.now() - t) / 1000);
  if (secs < 60) return "now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}
