"use client";

import { useState, useEffect } from "react";

const FILTERS = ["all", "pending", "replied"];

const STATUS_CFG = {
  pending: { label: "Pending", color: "#f59e0b", bg: "rgba(245,158,11,.12)", border: "rgba(245,158,11,.25)" },
  replied: { label: "Replied", color: "#22c55e", bg: "rgba(34,197,94,.1)",   border: "rgba(34,197,94,.22)"  },
};

const FORMAT_COLORS = {
  AI:  { color: "#f59e0b", bg: "rgba(245,158,11,.12)", border: "rgba(245,158,11,.25)" },
  CDR: { color: "#ef4444", bg: "rgba(239,68,68,.1)",   border: "rgba(239,68,68,.22)"  },
  SVG: { color: "#22c55e", bg: "rgba(34,197,94,.1)",   border: "rgba(34,197,94,.22)"  },
  PNG: { color: "#3b82f6", bg: "rgba(59,130,246,.1)",  border: "rgba(59,130,246,.25)" },
};

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function parseFormats(raw) {
  try { return Array.isArray(raw) ? raw : JSON.parse(raw || "[]"); }
  catch { return []; }
}

export default function LogoRequests({ dark }) {
  const surface  = dark ? "#131720" : "#ffffff";
  const surface2 = dark ? "#1a2030" : "#f1f5f9";
  const border   = dark ? "#1e2535" : "#e2e8f0";
  const text     = dark ? "#e2e8f0" : "#1e293b";
  const muted    = dark ? "#64748b" : "#94a3b8";
  const muted2   = dark ? "#94a3b8" : "#64748b";
  const bg       = dark ? "#0f1117" : "#f8fafc";

  const [requests, setRequests]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState("all");
  const [selected, setSelected]     = useState(null);
  const [replyText, setReplyText]   = useState("");
  const [sending, setSending]       = useState(false);
  const [search, setSearch]         = useState("");
  const [toast, setToast]           = useState(null);

  // ── fetch all once ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res  = await fetch("/api/admin/logo-requests");
        const json = await res.json();
        setRequests(json.data || []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  // ── client-side filter ────────────────────────────────────────────────────
  const visible = requests.filter(r => {
    const matchFilter = filter === "all" || r.status === filter;
    const matchSearch = !search ||
      r.brandName?.toLowerCase().includes(search.toLowerCase()) ||
      r.requesterEmail?.toLowerCase().includes(search.toLowerCase()) ||
      r.category?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const counts = {
    all:     requests.length,
    pending: requests.filter(r => r.status === "pending").length,
    replied: requests.filter(r => r.status === "replied").length,
  };

  // ── open request ──────────────────────────────────────────────────────────
  const openRequest = (req) => {
    setSelected(req);
    setReplyText(req.adminNotes || "");
  };

  // ── send reply ────────────────────────────────────────────────────────────
  const sendReply = async () => {
    if (!selected || !replyText.trim()) return;
    setSending(true);
    try {
      const res  = await fetch("/api/admin/logo-requests", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id: selected.id, adminNotes: replyText }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setRequests(prev => prev.map(r => r.id === json.data.id ? json.data : r));
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

  const FormatBadges = ({ formats }) => (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {formats.map(f => {
        const cfg = FORMAT_COLORS[f] || FORMAT_COLORS.PNG;
        return (
          <span key={f} style={{
            fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 5,
            background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color,
            letterSpacing: ".4px",
          }}>{f}</span>
        );
      })}
    </div>
  );

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
            background: "rgba(59,130,246,.12)", border: "1px solid rgba(59,130,246,.22)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: text }}>Logo Requests</h2>
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
            placeholder="Search brand, email, category…"
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
              background: active ? "rgba(59,130,246,.12)" : surface2,
              borderColor: active ? "rgba(59,130,246,.35)" : border,
              color: active ? "#3b82f6" : muted2,
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
            <div style={{ padding: 40, textAlign: "center", color: muted, fontSize: 13 }}>No requests found.</div>
          ) : visible.map((req, i) => {
            const isOpen   = selected?.id === req.id;
            const formats  = parseFormats(req.formats);
            return (
              <div key={req.id} onClick={() => openRequest(req)} style={{
                padding: "14px 16px",
                borderBottom: i < visible.length - 1 ? `1px solid ${border}` : "none",
                cursor: "pointer", transition: "background .15s",
                background: isOpen ? (dark ? "rgba(59,130,246,.06)" : "rgba(59,130,246,.04)") : "transparent",
                borderLeft: `3px solid ${isOpen ? "#3b82f6" : "transparent"}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: req.status === "pending" ? 700 : 600, color: text }}>
                        {req.brandName}
                      </span>
                      <StatusBadge status={req.status} />
                    </div>
                    {req.requesterEmail && (
                      <div style={{ fontSize: 11, color: muted, marginBottom: 4 }}>{req.requesterEmail}</div>
                    )}
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                      {req.category && (
                        <span style={{
                          fontSize: 10, color: muted2, background: surface2,
                          border: `1px solid ${border}`, padding: "1px 7px", borderRadius: 5,
                        }}>{req.category}</span>
                      )}
                      {req.websiteUrl && (
                        <a href={req.websiteUrl} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ fontSize: 10, color: "#3b82f6", textDecoration: "none" }}>
                          {req.websiteUrl.replace(/^https?:\/\//, "").split("/")[0]}
                        </a>
                      )}
                    </div>
                    {formats.length > 0 && <FormatBadges formats={formats} />}
                  </div>
                  <div style={{ fontSize: 10, color: muted, whiteSpace: "nowrap", flexShrink: 0 }}>
                    {fmtDate(req.createdAt)}
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

            {/* Request info */}
            <div style={{ background: surface2, border: `1px solid ${border}`, borderRadius: 9, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: text }}>{selected.brandName}</div>
                  {selected.requesterEmail && (
                    <div style={{ fontSize: 12, color: "#3b82f6", marginTop: 2 }}>{selected.requesterEmail}</div>
                  )}
                </div>
                <div>
                  <StatusBadge status={selected.status} />
                  <div style={{ fontSize: 10, color: muted, marginTop: 4, textAlign: "right" }}>{fmtDate(selected.createdAt)}</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
                {selected.category && (
                  <div style={{ fontSize: 11, color: muted2 }}>
                    <span style={{ color: muted, fontWeight: 600 }}>Category: </span>{selected.category}
                  </div>
                )}
                {selected.websiteUrl && (
                  <div style={{ fontSize: 11 }}>
                    <span style={{ color: muted, fontWeight: 600 }}>Website: </span>
                    <a href={selected.websiteUrl} target="_blank" rel="noopener noreferrer"
                      style={{ color: "#3b82f6", textDecoration: "none" }}>
                      {selected.websiteUrl}
                    </a>
                  </div>
                )}
              </div>

              {parseFormats(selected.formats).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>
                    Requested Formats
                  </div>
                  <FormatBadges formats={parseFormats(selected.formats)} />
                </div>
              )}
            </div>

            {/* User notes */}
            {selected.notes && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>
                  User Notes
                </div>
                <div style={{
                  fontSize: 12, color: text, lineHeight: 1.7,
                  padding: "10px 12px", background: surface2,
                  borderRadius: 8, border: `1px solid ${border}`,
                }}>{selected.notes}</div>
              </div>
            )}

            {/* Previous reply */}
            {selected.adminNotes && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>
                  Previous Reply
                </div>
                <div style={{
                  fontSize: 12, color: text, lineHeight: 1.7,
                  padding: "10px 12px",
                  background: "rgba(59,130,246,.06)",
                  border: "1px solid rgba(59,130,246,.2)",
                  borderRadius: 8,
                }}>{selected.adminNotes}</div>
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
                placeholder={`Write your reply about ${selected.brandName} logo request…`}
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
              disabled={sending || !replyText.trim() || !selected.requesterEmail}
              style={{
                width: "100%", padding: "10px", borderRadius: 8,
                fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer",
                background: sending || !replyText.trim() || !selected.requesterEmail
                  ? surface2
                  : "linear-gradient(135deg,#3b82f6,#2563eb)",
                color: sending || !replyText.trim() || !selected.requesterEmail ? muted : "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                transition: "all .2s",
              }}
            >
              {sending ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Sending…
                </>
              ) : !selected.requesterEmail ? (
                "No email address on this request"
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                  Send Reply to {selected.requesterEmail}
                </>
              )}
            </button>

            {!selected.requesterEmail && (
              <p style={{ fontSize: 10, color: muted, textAlign: "center", marginTop: 8 }}>
                This request was submitted without an email address.
              </p>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}