"use client";

import { useState, useEffect } from "react";

const FILTERS = ["all", "pending", "replied"];

const STATUS_CFG = {
  pending: { label: "Pending", color: "#f59e0b", bg: "rgba(245,158,11,.12)", border: "rgba(245,158,11,.25)" },
  replied: { label: "Replied", color: "#22c55e", bg: "rgba(34,197,94,.1)",   border: "rgba(34,197,94,.22)"  },
};

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function ContactMessages({ dark }) {
  const surface  = dark ? "#131720" : "#ffffff";
  const surface2 = dark ? "#1a2030" : "#f1f5f9";
  const border   = dark ? "#1e2535" : "#e2e8f0";
  const text     = dark ? "#e2e8f0" : "#1e293b";
  const muted    = dark ? "#64748b" : "#94a3b8";
  const muted2   = dark ? "#94a3b8" : "#64748b";
  const bg       = dark ? "#0f1117" : "#f8fafc";

  const [messages, setMessages]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState("all");
  const [selected, setSelected]   = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending]     = useState(false);
  const [search, setSearch]       = useState("");
  const [toast, setToast]         = useState(null); // { msg, ok }

  // ── fetch all once ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res  = await fetch("/api/admin/contact-messages");
        const json = await res.json();
        setMessages(json.data || []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  // ── client-side filter ────────────────────────────────────────────────────
  const visible = messages.filter(m => {
    const matchFilter = filter === "all" || m.status === filter;
    const matchSearch = !search ||
      m.name?.toLowerCase().includes(search.toLowerCase()) ||
      m.email?.toLowerCase().includes(search.toLowerCase()) ||
      m.subject?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const counts = {
    all:     messages.length,
    pending: messages.filter(m => m.status === "pending").length,
    replied: messages.filter(m => m.status === "replied").length,
  };

  // ── open message ──────────────────────────────────────────────────────────
  const openMessage = (msg) => {
    setSelected(msg);
    setReplyText(msg.adminReply || "");
  };

  // ── send reply ────────────────────────────────────────────────────────────
  const sendReply = async () => {
    if (!selected || !replyText.trim()) return;
    setSending(true);
    try {
      const res  = await fetch("/api/admin/contact-messages", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id: selected.id, adminReply: replyText }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setMessages(prev => prev.map(m => m.id === json.data.id ? json.data : m));
      setSelected(json.data);
      showToast("Reply sent successfully!", true);
    } catch (e) {
      showToast(e.message || "Failed to send reply", false);
    }
    setSending(false);
  };

  const showToast = (msg, ok) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const StatusBadge = ({ status }) => {
    const cfg = STATUS_CFG[status] || STATUS_CFG.pending;
    return (
      <span style={{
        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
        background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color,
        letterSpacing: ".4px", textTransform: "capitalize", whiteSpace: "nowrap",
      }}>{cfg.label}</span>
    );
  };

  return (
    <div style={{ padding: 24, background: bg, minHeight: "100%", fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 100,
          padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: toast.ok ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.15)",
          border: `1px solid ${toast.ok ? "rgba(34,197,94,.35)" : "rgba(239,68,68,.35)"}`,
          color: toast.ok ? "#22c55e" : "#ef4444",
          boxShadow: "0 4px 20px rgba(0,0,0,.2)",
          animation: "fadeIn .2s ease",
        }}>{toast.msg}</div>
      )}

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "rgba(34,197,94,.12)", border: "1px solid rgba(34,197,94,.22)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: text }}>Contact Messages</h2>
            <p style={{ margin: 0, fontSize: 11, color: muted }}>
              {counts.all} total · {counts.pending} pending
            </p>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: muted }}
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, subject…"
            style={{
              padding: "7px 12px 7px 30px", borderRadius: 8, fontSize: 12,
              background: surface2, border: `1px solid ${border}`,
              color: text, outline: "none", width: 220,
            }}
          />
        </div>
      </div>

      {/* ── Filter tabs ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {FILTERS.map(f => {
          const active = filter === f;
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "5px 14px", borderRadius: 7, fontSize: 11, fontWeight: 600,
              cursor: "pointer", border: "1px solid", transition: "all .15s",
              background: active ? "rgba(34,197,94,.12)" : surface2,
              borderColor: active ? "rgba(34,197,94,.35)" : border,
              color: active ? "#22c55e" : muted2,
              textTransform: "capitalize",
            }}>
              {f} <span style={{ opacity: .65 }}>({counts[f] ?? 0})</span>
            </button>
          );
        })}
      </div>

      {/* ── Layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1.2fr" : "1fr", gap: 16, alignItems: "start" }}>

        {/* ── List ── */}
        <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: muted, fontSize: 13 }}>Loading…</div>
          ) : visible.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: muted, fontSize: 13 }}>No messages found.</div>
          ) : visible.map((msg, i) => {
            const isOpen = selected?.id === msg.id;
            return (
              <div key={msg.id} onClick={() => openMessage(msg)} style={{
                padding: "14px 16px",
                borderBottom: i < visible.length - 1 ? `1px solid ${border}` : "none",
                cursor: "pointer", transition: "background .15s",
                background: isOpen ? (dark ? "rgba(34,197,94,.06)" : "rgba(34,197,94,.04)") : "transparent",
                borderLeft: `3px solid ${isOpen ? "#22c55e" : "transparent"}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: msg.status === "pending" ? 700 : 600, color: text }}>
                        {msg.name}
                      </span>
                      <StatusBadge status={msg.status} />
                    </div>
                    <div style={{ fontSize: 11, color: muted, marginBottom: 3 }}>{msg.email}</div>
                    {msg.subject && (
                      <div style={{ fontSize: 12, fontWeight: 600, color: muted2, marginBottom: 3 }}>{msg.subject}</div>
                    )}
                    <div style={{
                      fontSize: 11, color: muted,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 300,
                    }}>{msg.message}</div>
                  </div>
                  <div style={{ fontSize: 10, color: muted, whiteSpace: "nowrap", flexShrink: 0 }}>
                    {fmtDate(msg.createdAt)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Detail / Reply panel ── */}
        {selected && (
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: 20, position: "sticky", top: 80 }}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: text }}>Reply</div>
              <button onClick={() => setSelected(null)} style={{
                width: 28, height: 28, borderRadius: 7,
                border: `1px solid ${border}`, background: surface2,
                color: muted, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>✕</button>
            </div>

            {/* Sender */}
            <div style={{ background: surface2, border: `1px solid ${border}`, borderRadius: 9, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: text }}>{selected.name}</div>
                  <div style={{ fontSize: 12, color: "#22c55e", marginTop: 2 }}>{selected.email}</div>
                  {selected.subject && (
                    <div style={{ fontSize: 11, color: muted2, marginTop: 4 }}>Subject: {selected.subject}</div>
                  )}
                </div>
                <div>
                  <StatusBadge status={selected.status} />
                  <div style={{ fontSize: 10, color: muted, marginTop: 4, textAlign: "right" }}>{fmtDate(selected.createdAt)}</div>
                </div>
              </div>
            </div>

            {/* Original message */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>
                Message
              </div>
              <div style={{
                fontSize: 12, color: text, lineHeight: 1.7,
                padding: "10px 12px", background: surface2,
                borderRadius: 8, border: `1px solid ${border}`,
              }}>{selected.message}</div>
            </div>

            {/* Previous reply if any */}
            {selected.adminReply && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>
                  Previous Reply
                </div>
                <div style={{
                  fontSize: 12, color: text, lineHeight: 1.7,
                  padding: "10px 12px",
                  background: "rgba(34,197,94,.06)",
                  border: "1px solid rgba(34,197,94,.2)",
                  borderRadius: 8,
                }}>{selected.adminReply}</div>
              </div>
            )}

            {/* Reply textarea */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>
                Your Reply
              </div>
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                rows={5}
                placeholder={`Write your reply to ${selected.name}…`}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 12,
                  background: dark ? "rgba(255,255,255,.04)" : "#f8fafc",
                  border: `1px solid ${border}`, color: text, outline: "none",
                  resize: "vertical", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6,
                }}
              />
            </div>

            {/* Send button */}
            <button
              onClick={sendReply}
              disabled={sending || !replyText.trim()}
              style={{
                width: "100%", padding: "10px", borderRadius: 8,
                fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer",
                background: sending || !replyText.trim()
                  ? surface2
                  : "linear-gradient(135deg,#22c55e,#16a34a)",
                color: sending || !replyText.trim() ? muted : "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                transition: "all .2s",
              }}
            >
              {sending ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ animation: "spin 1s linear infinite" }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Sending…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                  Send Reply to {selected.email}
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}