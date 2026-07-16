"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Panel, Icons } from "@/components/requests/ui";
import { fmtDateTime } from "@/lib/requestsDomain";

/**
 * Team Chat — a private message board shared only by users of THIS client. The
 * API is scoped to the caller's client_id, so messages can never cross to
 * another organization's users.
 */
export default function TeamChat() {
  const toast = useToast();
  const [messages, setMessages] = useState(null);
  const [me, setMe] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);
  const lastCount = useRef(0);

  async function load(quiet) {
    try {
      const d = await api("/api/client/messages");
      setMessages(d.messages);
      setMe(d.me);
    } catch (e) {
      if (!quiet) toast.error(e.message);
      setMessages([]);
    }
  }
  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the thread pinned to the newest message when it grows.
  useEffect(() => {
    if (messages && messages.length !== lastCount.current) {
      lastCount.current = messages.length;
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      await api("/api/client/messages", { method: "POST", body: { body } });
      setText("");
      await load(true);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel icon={Icons.chat} title="Team Chat" subtitle="Private to your organization's users">
      <div ref={scrollRef} className="mb-3 max-h-80 space-y-2.5 overflow-y-auto pr-1">
        {messages === null ? (
          <p className="py-8 text-center text-[13px] font-medium text-slate-400">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-[13px] font-medium text-slate-400">No messages yet. Start the conversation with your team.</p>
        ) : (
          messages.map((m) => {
            const mine = m.author_id === me;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${mine ? "bg-navy text-white" : "bg-mist text-navy ring-1 ring-inset ring-line"}`}>
                  {!mine && <p className="text-[10px] font-extrabold text-copper-700">{m.author_name || "Team member"}</p>}
                  <p className="whitespace-pre-wrap text-[13px] font-medium">{m.body}</p>
                  <p className={`mt-0.5 text-[9px] font-semibold ${mine ? "text-white/50" : "text-slate-400"}`}>{fmtDateTime(m.created_at)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Message your team…"
          className="flex-1 rounded-xl border border-line bg-white px-3.5 py-2.5 text-[13px] font-medium text-navy outline-none focus:border-copper/50"
        />
        <button onClick={send} disabled={busy || !text.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-copper px-4 py-2.5 text-[13px] font-extrabold text-white shadow-copper transition-transform hover:scale-[1.02] disabled:opacity-50">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Send
        </button>
      </div>
    </Panel>
  );
}
