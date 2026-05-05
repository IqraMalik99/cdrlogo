"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Tag, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TagManager Admin Component
// Props: dark (boolean) — passed down from AdminPage
// ─────────────────────────────────────────────────────────────────────────────
export default function TagManager({ dark = true }) {
  const [tags, setTags] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingTag, setDeletingTag] = useState(null); // which tag is being deleted
  const [toast, setToast] = useState(null); // { type: "success"|"error", msg }
  const inputRef = useRef(null);

  // ── Design tokens (mirror AdminPage) ───────────────────────────────────────
  const bg        = dark ? "#0f1117" : "#f8fafc";
  const card      = dark ? "#151b27" : "#ffffff";
  const border    = dark ? "#1e2535" : "#e2e8f0";
  const text      = dark ? "#e2e8f0" : "#1e293b";
  const muted     = dark ? "#64748b" : "#94a3b8";
  const inputBg   = dark ? "#0f1117" : "#f8fafc";
  const tagBg     = dark ? "#1a2235" : "#f1f5f9";
  const tagBorder = dark ? "#263047" : "#e2e8f0";
  const green     = "#22c55e";
  const greenDim  = dark ? "rgba(34,197,94,0.12)" : "rgba(34,197,94,0.10)";
  const greenHov  = dark ? "rgba(34,197,94,0.20)" : "rgba(34,197,94,0.18)";
  const redDim    = dark ? "rgba(239,68,68,0.12)"  : "rgba(239,68,68,0.10)";

  // ── Fetch tags on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    fetchTags();
  }, []);

  async function fetchTags() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tags");
      const data = await res.json();
      setTags(data.tags ?? []);
    } catch {
      showToast("error", "Failed to load tags.");
    } finally {
      setLoading(false);
    }
  }

  // ── Toast helper ────────────────────────────────────────────────────────────
  function showToast(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Add tag ─────────────────────────────────────────────────────────────────
  async function handleAdd() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setTags(data.tags);
      setInput("");
      showToast("success", `"${trimmed}" added.`);
      inputRef.current?.focus();
    } catch (err) {
      showToast("error", err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Delete tag ──────────────────────────────────────────────────────────────
  async function handleDelete(tag) {
    setDeletingTag(tag);
    try {
      const res = await fetch("/api/admin/tags", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setTags(data.tags);
      showToast("success", `"${tag}" removed.`);
    } catch (err) {
      showToast("error", err.message);
    } finally {
      setDeletingTag(null);
    }
  }

  // ── Enter key support ───────────────────────────────────────────────────────
  function handleKeyDown(e) {
    if (e.key === "Enter") handleAdd();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        .tag-pill {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 10px 5px 12px; border-radius: 999px;
          font-size: 13px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          transition: background 0.18s, border-color 0.18s, transform 0.15s;
          cursor: default; user-select: none;
          border: 1px solid;
        }
        .tag-pill:hover { transform: translateY(-1px); }
        .tag-delete-btn {
          display: flex; align-items: center; justify-content: center;
          width: 16px; height: 16px; border-radius: 50%;
          border: none; cursor: pointer; padding: 0;
          transition: background 0.15s, color 0.15s, transform 0.15s;
          flex-shrink: 0;
        }
        .tag-delete-btn:hover { transform: scale(1.2); }
        .tag-delete-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
        .add-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 0 16px; height: 38px; border-radius: 8px;
          border: none; cursor: pointer; font-size: 13px;
          font-weight: 600; font-family: 'DM Sans', sans-serif;
          background: #22c55e; color: #fff;
          transition: background 0.18s, transform 0.15s, box-shadow 0.18s;
          white-space: nowrap; flex-shrink: 0;
        }
        .add-btn:hover:not(:disabled) { background: #16a34a; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(34,197,94,0.3); }
        .add-btn:active:not(:disabled) { transform: translateY(0); }
        .add-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .tag-input {
          flex: 1; height: 38px; border-radius: 8px; outline: none;
          font-size: 13px; font-family: 'DM Sans', sans-serif;
          transition: border-color 0.18s, box-shadow 0.18s;
          padding: 0 12px;
        }
        .tag-input:focus { border-color: #22c55e !important; box-shadow: 0 0 0 3px rgba(34,197,94,0.12) !important; }
        .toast-bar {
          position: fixed; bottom: 28px; right: 28px;
          display: flex; align-items: center; gap: 8px;
          padding: 10px 16px; border-radius: 10px; z-index: 9999;
          font-size: 13px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          animation: slideUp 0.22s ease;
          box-shadow: 0 8px 24px rgba(0,0,0,0.25);
          max-width: 320px;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .skeleton-tag {
          display: inline-block; height: 30px; border-radius: 999px;
          animation: shimmer 1.4s ease-in-out infinite;
        }
        @keyframes shimmer {
          0%, 100% { opacity: 0.4; } 50% { opacity: 0.9; }
        }
      `}</style>

      <div style={{
        padding: "28px 32px", minHeight: "100%",
        background: bg, fontFamily: "'DM Sans', sans-serif",
      }}>

        {/* ── Card ── */}
        <div style={{
          background: card, border: `1px solid ${border}`,
          borderRadius: 16, padding: "28px 28px 32px",
          maxWidth: 860,
        }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: greenDim, border: `1px solid ${tagBorder}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Tag size={16} color={green} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: text }}>
                Tag Manager
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: muted, marginTop: 1 }}>
                {tags.length} tag{tags.length !== 1 ? "s" : ""} — used for logo taxonomy &amp; filtering
              </p>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: border, margin: "20px 0" }} />

          {/* ── Input row ── */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24, alignItems: "center" }}>
            <input
              ref={inputRef}
              className="tag-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="New tag name..."
              maxLength={40}
              disabled={saving}
              style={{
                background: inputBg,
                border: `1px solid ${border}`,
                color: text,
              }}
            />
            <button
              className="add-btn"
              onClick={handleAdd}
              disabled={saving || !input.trim()}
            >
              {saving
                ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} />
                : <Plus size={14} />}
              Add
            </button>
          </div>

          {/* ── Tags area ── */}
          {loading ? (
            // Skeleton
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="skeleton-tag"
                  style={{
                    width: 60 + (i % 4) * 20,
                    background: dark ? "#1e2535" : "#e2e8f0",
                  }}
                />
              ))}
            </div>
          ) : tags.length === 0 ? (
            // Empty state
            <div style={{
              textAlign: "center", padding: "40px 0",
              color: muted, fontSize: 13,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: dark ? "#1e2535" : "#f1f5f9",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 12px",
              }}>
                <Tag size={20} color={muted} />
              </div>
              <p style={{ margin: 0, fontWeight: 600, color: text, fontSize: 14 }}>No tags yet</p>
              <p style={{ margin: "4px 0 0", fontSize: 12 }}>Add your first tag above to get started.</p>
            </div>
          ) : (
            // Tag pills
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {tags.map((tag) => {
                const isDeleting = deletingTag === tag;
                return (
                  <span
                    key={tag}
                    className="tag-pill"
                    style={{
                      background: isDeleting ? redDim : tagBg,
                      borderColor: isDeleting ? "rgba(239,68,68,0.35)" : tagBorder,
                      color: isDeleting ? "#ef4444" : text,
                      opacity: isDeleting ? 0.7 : 1,
                    }}
                  >
                    {tag}
                    <button
                      className="tag-delete-btn"
                      onClick={() => handleDelete(tag)}
                      disabled={isDeleting}
                      title={`Remove "${tag}"`}
                      style={{
                        background: isDeleting
                          ? "rgba(239,68,68,0.2)"
                          : dark ? "#263047" : "#e2e8f0",
                        color: isDeleting ? "#ef4444" : muted,
                      }}
                    >
                      {isDeleting
                        ? <Loader2 size={9} style={{ animation: "spin 0.8s linear infinite" }} />
                        : <X size={9} />}
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Footer count */}
          {!loading && tags.length > 0 && (
            <p style={{
              margin: "20px 0 0", fontSize: 11, color: muted,
              borderTop: `1px solid ${border}`, paddingTop: 16,
            }}>
              {tags.length} tag{tags.length !== 1 ? "s" : ""} total · Click × to remove a tag
            </p>
          )}
        </div>
      </div>

      {/* ── Toast notification ── */}
      {toast && (
        <div
          className="toast-bar"
          style={{
            background: toast.type === "success"
              ? (dark ? "#0d2318" : "#f0fdf4")
              : (dark ? "#2d0f0f" : "#fef2f2"),
            border: `1px solid ${toast.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: toast.type === "success" ? green : "#ef4444",
          }}
        >
          {toast.type === "success"
            ? <CheckCircle2 size={14} />
            : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* Spin keyframe */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}