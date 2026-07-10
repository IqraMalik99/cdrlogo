"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const PER_PAGE = 10;

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_CFG = {
  Published: { bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.35)", color: "#4ade80" },
  Draft: { bg: "rgba(100,116,139,0.15)", border: "rgba(100,116,139,0.3)", color: "#94a3b8" },
};

function StatusBadge({ status }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.Draft;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 100,
      background: c.bg, border: `1px solid ${c.border}`,
      color: c.color, fontSize: 11, fontWeight: 700, letterSpacing: 0.3, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.color, display: "inline-block" }} />
      {status}
    </span>
  );
}

// ── Logo avatar ───────────────────────────────────────────────────────────────
function LogoAvatar({ name = "", webpUrl, dark }) {
  const [err, setErr] = useState(false);
  const placeholderBg = dark ? "#1e2535" : "#e2e8f0";
  const placeholderClr = dark ? "#64748b" : "#94a3b8";
  const initials = name.slice(0, 2).toUpperCase();

  if (webpUrl && !err) {
    return (
      <img
        src={webpUrl} alt={name} onError={() => setErr(true)}
        style={{
          width: 36, height: 36, borderRadius: 9, objectFit: "contain",
          background: placeholderBg, flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 9, flexShrink: 0,
      background: placeholderBg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 12, fontWeight: 800, color: placeholderClr, letterSpacing: -0.5,
    }}>{initials}</div>
  );
}

// ── Modal sub-components — OUTSIDE EditModal so identity is stable across renders ──
const SectionLabel = ({ label, border, muted }) => (
  <div style={{
    fontSize: 10, fontWeight: 700, color: muted, letterSpacing: 1,
    textTransform: "uppercase", marginBottom: 10,
    paddingBottom: 6, borderBottom: `1px solid ${border}`,
  }}>{label}</div>
);

const TwoCol = ({ children }) => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{children}</div>
);

const Field = ({ label, k, type = "text", options, form, setForm, inputStyle, muted }) => {
  const set = (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: muted, letterSpacing: 0.4 }}>{label}</label>
      {options ? (
        <select value={form[k]} onChange={set} style={inputStyle}>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === "textarea" ? (
        <textarea value={form[k]} onChange={set} rows={3}
          style={{ ...inputStyle, resize: "vertical" }} />
      ) : (
        <input type={type} value={form[k]} onChange={set} style={inputStyle} />
      )}
    </div>
  );
};

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ logo, dark, onClose, onSave, categories = [] }) {
  const [form, setForm] = useState({
    logoName:        logo.logoName        ?? "",
    brand:           logo.brand           ?? "",
    category:        logo.category        ?? "",
    industry:        logo.industry        ?? "",
    country:         logo.country         ?? "",
    website:         logo.website         ?? "",
    description:     logo.description     ?? "",
    publishStatus:   logo.publishStatus   ?? "Draft",
    downloadCount:   logo.downloadCount   ?? "",
    metaTitle:       logo.metaTitle       ?? "",
    metaDescription: logo.metaDescription ?? "",
    altText:         logo.altText         ?? "",
    focusKeywords:   logo.focusKeywords   ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState(null);

  const bg      = dark ? "#0f1117" : "#ffffff";
  const border  = dark ? "#1e2535" : "#e2e8f0";
  const text    = dark ? "#e2e8f0" : "#1e293b";
  const muted   = dark ? "#64748b" : "#94a3b8";
  const inputBg = dark ? "#0f1117" : "#ffffff";

  const inputStyle = {
    width: "100%", background: inputBg, border: `1px solid ${border}`,
    borderRadius: 8, color: text, fontSize: 13,
    padding: "8px 10px", outline: "none",
    fontFamily: "'DM Sans', sans-serif",
    transition: "border-color .2s",
  };

  const fieldProps = { form, setForm, inputStyle, muted };

  const handleSave = async () => {
    setSaving(true); setSaveErr(null);
    try {
      const res = await fetch(`/api/logo/admin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: logo._id, ...form }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json();
      onSave(updated);
    } catch (e) { setSaveErr(e.message); }
    finally { setSaving(false); }
  };

  // Category options — blank "select" option first, then API list
  const categoryOptions = ["", ...categories];

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: bg, border: `1px solid ${border}`, borderRadius: 16,
        width: "100%", maxWidth: 640, maxHeight: "92vh", overflow: "hidden",
        display: "flex", flexDirection: "column",
        boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: `1px solid ${border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <LogoAvatar name={logo.logoName} webpUrl={logo.webpUrl} dark={dark} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: text }}>{logo.logoName}</div>
              <div style={{ fontSize: 11, color: muted }}>{logo.category}</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: muted, fontSize: 22, lineHeight: 1, padding: "0 4px",
          }}>×</button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 22 }}>

          {/* Core Info */}
          <div>
            <SectionLabel label="Core Info" border={border} muted={muted} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <TwoCol>
                <Field label="LOGO NAME" k="logoName" {...fieldProps} />
                <Field label="BRAND"     k="brand"    {...fieldProps} />
                <Field label="CATEGORY"  k="category" {...fieldProps} options={categoryOptions} />
                <Field label="INDUSTRY"  k="industry" {...fieldProps} />
                <Field label="COUNTRY"   k="country"  {...fieldProps} />
                <Field label="WEBSITE"   k="website"  {...fieldProps} type="url" />
              </TwoCol>
            </div>
          </div>

          {/* Publishing */}
          <div>
            <SectionLabel label="Publishing" border={border} muted={muted} />
            <TwoCol>
              <Field label="STATUS"         k="publishStatus" {...fieldProps} options={["Published", "Draft"]} />
              <Field label="DOWNLOAD LIMIT" k="downloadCount" {...fieldProps} />
            </TwoCol>
          </div>

          {/* Content */}
          <div>
            <SectionLabel label="Content" border={border} muted={muted} />
            <Field label="DESCRIPTION" k="description" type="textarea" {...fieldProps} />
          </div>

          {/* SEO */}
          <div>
            <SectionLabel label="SEO" border={border} muted={muted} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Field label="META TITLE"       k="metaTitle"       {...fieldProps} />
              <Field label="META DESCRIPTION" k="metaDescription" type="textarea" {...fieldProps} />
            </div>
          </div>

          {saveErr && (
            <div style={{
              padding: "10px 14px", borderRadius: 8, fontSize: 12,
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171",
            }}>{saveErr}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 20px", borderTop: `1px solid ${border}`,
          display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: "none", border: `1px solid ${border}`, color: muted,
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: "8px 22px", borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: saving ? "rgba(34,197,94,0.35)" : "rgba(34,197,94,0.18)",
            border: "1px solid rgba(34,197,94,0.5)", color: "#4ade80",
            cursor: saving ? "default" : "pointer",
            fontFamily: "'DM Sans', sans-serif", transition: "all .18s",
          }}>{saving ? "Saving…" : "Save Changes"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────
function DeleteConfirm({ logo, dark, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const bg     = dark ? "#0f1117" : "#ffffff";
  const border = dark ? "#1e2535" : "#e2e8f0";
  const text   = dark ? "#e2e8f0" : "#1e293b";
  const muted  = dark ? "#64748b" : "#94a3b8";

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/logo/admin`, {
        method: "DELETE",
        body: JSON.stringify({ id: logo.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onDeleted(logo.id);
    } catch (e) { console.error(e.message); setDeleting(false); }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: bg, border: `1px solid ${border}`, borderRadius: 16,
        width: "100%", maxWidth: 380, padding: 24,
        boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, marginBottom: 14,
        }}>🗑️</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: text, marginBottom: 6 }}>Delete Logo</div>
        <div style={{ fontSize: 13, color: muted, lineHeight: 1.65, marginBottom: 20 }}>
          Are you sure you want to delete{" "}
          <strong style={{ color: text }}>{logo.logoName}</strong>?
          This action cannot be undone.
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: "none", border: `1px solid ${border}`, color: muted,
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          }}>Cancel</button>
          <button onClick={handleDelete} disabled={deleting} style={{
            padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)",
            color: "#f87171", cursor: deleting ? "default" : "pointer",
            fontFamily: "'DM Sans', sans-serif",
          }}>{deleting ? "Deleting…" : "Delete"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Shared icon button ────────────────────────────────────────────────────────
function IconBtn({ title, onClick, danger, dark, muted, text, children }) {
  return (
    <button
      title={title} onClick={onClick}
      style={{
        width: 30, height: 30, borderRadius: 7, border: "none",
        background: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: danger ? "#f87171" : muted,
        transition: "background .15s, color .15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? "rgba(239,68,68,0.12)" : (dark ? "#1e2535" : "#f1f5f9");
        e.currentTarget.style.color = danger ? "#f87171" : text;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "none";
        e.currentTarget.style.color = danger ? "#f87171" : muted;
      }}
    >{children}</button>
  );
}

function buildPages(tot, cur) {
  if (tot <= 7) return Array.from({ length: tot }, (_, i) => i + 1);
  const p = [1];
  if (cur > 3) p.push("…");
  for (let i = Math.max(2, cur - 1); i <= Math.min(tot - 1, cur + 1); i++) p.push(i);
  if (cur < tot - 2) p.push("…");
  p.push(tot);
  return p;
}

const COLS = "52px 1fr 130px 100px 100px 130px 90px";

// ── One status section (Published or Draft) — owns its own fetch/pagination ──
function LogoSection({
  title, status, dark, search, categoryFilter, refreshSignal,
  onCategoriesLoaded, onEdit, onDelete, onStatusToggled,
}) {
  const [logos, setLogos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const surface    = dark ? "#141924" : "#ffffff";
  const border     = dark ? "#1e2535" : "#e2e8f0";
  const text       = dark ? "#e2e8f0" : "#1e293b";
  const muted      = dark ? "#64748b" : "#94a3b8";
  const headClr    = dark ? "#475569" : "#94a3b8";
  const rowHoverBg = dark ? "#141924" : "#FFFFFF";
  const badgeBg    = status === "Published" ? "rgba(34,197,94,0.1)" : "rgba(100,116,139,0.12)";
  const badgeBorder = status === "Published" ? "rgba(34,197,94,0.25)" : "rgba(100,116,139,0.25)";
  const badgeColor  = status === "Published" ? "#4ade80" : "#94a3b8";

  const fetchLogos = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/logo/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page, limit: PER_PAGE, status,
          ...(search         && { search:   search         }),
          ...(categoryFilter && { category: categoryFilter }),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setLogos(json.data ?? []);
      setTotal(json.totalLogos ?? 0);
      setTotalPages(json.totalPages ?? 1);
      if (Array.isArray(json.categories) && json.categories.length > 0) {
        onCategoriesLoaded(json.categories);
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [page, search, categoryFilter, status, onCategoriesLoaded]);

  useEffect(() => { fetchLogos(); }, [fetchLogos, refreshSignal]);
  useEffect(() => { setPage(1); }, [search, categoryFilter]);

  const pageNums = buildPages(totalPages, page);
  const showFrom = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const showTo   = Math.min(page * PER_PAGE, total);

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: text, letterSpacing: -0.2 }}>
          {title}
        </h2>
        <span style={{
          padding: "2px 9px", borderRadius: 100, fontSize: 11, fontWeight: 700,
          background: badgeBg, border: `1px solid ${badgeBorder}`, color: badgeColor,
        }}>{loading ? "…" : total}</span>
      </div>

      <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden" }}>

        {/* Header */}
        <div style={{
          display: "grid", gridTemplateColumns: COLS,
          padding: "0 16px", borderBottom: `1px solid ${border}`,
          background: dark ? "#0d1018" : "#f1f5f9",
        }}>
          {["", "Logo Name", "Category", "Downloads", "Status", "Updated", "Actions"].map((h, i) => (
            <div key={i} style={{
              padding: "11px 0", fontSize: 11, fontWeight: 700, color: headClr, letterSpacing: 0.5,
              display: "flex", alignItems: "center",
              justifyContent: i === 6 ? "flex-end" : "flex-start",
            }}>{h}</div>
          ))}
        </div>

        {/* Skeletons */}
        {loading && Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: COLS,
            padding: "12px 16px", borderBottom: `1px solid ${border}`,
            alignItems: "center",
            animation: "lm-pulse 1.4s ease-in-out infinite alternate",
          }}>
            {[36, 120, 80, 50, 70, 80, 70].map((w, j) => (
              <div key={j} style={{
                height: j === 0 ? 36 : 12, width: j === 0 ? 36 : w,
                borderRadius: j === 0 ? 9 : 5,
                background: dark ? "#1e2535" : "#e2e8f0",
              }} />
            ))}
          </div>
        ))}

        {/* Error */}
        {!loading && error && (
          <div style={{ padding: 48, textAlign: "center", color: "#f87171", fontSize: 13 }}>
            <div style={{ marginBottom: 12 }}>{error}</div>
            <button onClick={fetchLogos} style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
              color: "#f87171", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            }}>Retry</button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && logos.length === 0 && (
          <div style={{ padding: 48, textAlign: "center", color: muted, fontSize: 13 }}>
            No {status.toLowerCase()} logos found.
          </div>
        )}

        {/* Rows */}
        {!loading && !error && logos.map((logo, idx) => (
          <div
            key={logo.id ?? idx}
            className="lm-row"
            style={{
              display: "grid", gridTemplateColumns: COLS,
              padding: "10px 16px",
              borderBottom: idx < logos.length - 1 ? `1px solid ${border}` : "none",
              alignItems: "center", background: "transparent",
            }}
          >
            <div><LogoAvatar name={logo.logoName} webpUrl={logo.webpUrl} dark={dark} /></div>

            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: text,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{logo.logoName}</div>
              {logo.slug && (
                <div style={{
                  fontSize: 11, color: muted, marginTop: 1,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{logo.slug}</div>
              )}
            </div>

            <div style={{ fontSize: 12, color: muted }}>{logo.category}</div>

            <div style={{ fontSize: 13, fontWeight: 600, color: text, fontVariantNumeric: "tabular-nums" }}>
              {(logo.downloadedNumberByPeople ?? 0).toLocaleString()}
            </div>

            <div>
              <button onClick={() => onStatusToggled(logo)} title="Click to toggle status"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <StatusBadge status={logo.publishStatus} />
              </button>
            </div>

            <div style={{ fontSize: 12, color: muted }}>
              {new Date(logo.updatedAt).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <IconBtn title="View" dark={dark} muted={muted} text={text}
                onClick={() => logo.slug && window.open(`/logo/${logo.slug}`, "_blank")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </IconBtn>
              <IconBtn title="Edit" dark={dark} muted={muted} text={text} onClick={() => onEdit(logo)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </IconBtn>
              <IconBtn title="Delete" danger dark={dark} muted={muted} text={text} onClick={() => onDelete(logo)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" /><path d="M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
              </IconBtn>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {!loading && !error && (
        <div style={{
          marginTop: 10, display: "flex", alignItems: "center",
          justifyContent: "space-between", flexWrap: "wrap", gap: 10,
        }}>
          <span style={{ fontSize: 12, color: muted }}>
            Showing {showFrom}–{showTo} of {total}
          </span>
          {totalPages > 1 && (
            <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
              <button className="lm-pg" onClick={() => setPage(1)} disabled={page === 1} style={{
                padding: "6px 10px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                border: `1px solid ${border}`, background: surface, color: muted,
                cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.35 : 1,
                fontFamily: "'DM Sans', sans-serif",
              }}>«</button>
              <button className="lm-pg" onClick={() => setPage((p) => p - 1)} disabled={page === 1} style={{
                padding: "6px 10px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                border: `1px solid ${border}`, background: surface, color: muted,
                cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.35 : 1,
                fontFamily: "'DM Sans', sans-serif",
              }}>Prev</button>

              {pageNums.map((p, i) =>
                p === "…" ? (
                  <span key={`e${i}`} style={{ color: muted, fontSize: 12, padding: "0 4px" }}>…</span>
                ) : (
                  <button key={p} className="lm-pg" onClick={() => setPage(p)} style={{
                    minWidth: 34, height: 34, borderRadius: 7, fontSize: 12, fontWeight: 700,
                    border: `1px solid ${p === page ? "rgba(34,197,94,0.5)" : border}`,
                    background: p === page ? "rgba(34,197,94,0.15)" : surface,
                    color: p === page ? "#4ade80" : muted,
                    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  }}>{p}</button>
                )
              )}

              <button className="lm-pg" onClick={() => setPage((p) => p + 1)} disabled={page === totalPages} style={{
                padding: "6px 10px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                border: `1px solid ${border}`, background: surface, color: muted,
                cursor: page === totalPages ? "default" : "pointer",
                opacity: page === totalPages ? 0.35 : 1, fontFamily: "'DM Sans', sans-serif",
              }}>Next</button>
              <button className="lm-pg" onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{
                padding: "6px 10px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                border: `1px solid ${border}`, background: surface, color: muted,
                cursor: page === totalPages ? "default" : "pointer",
                opacity: page === totalPages ? 0.35 : 1, fontFamily: "'DM Sans', sans-serif",
              }}>»</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function LogoManagement({ dark = true }) {
  const [search, setSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [categories, setCategories] = useState([]);
  const [editLogo, setEditLogo] = useState(null);
  const [deleteLogo, setDeleteLogo] = useState(null);
  // Bumped whenever data changes in a way that could move a logo between
  // sections (status toggle, edit, delete) so both sections refetch.
  const [refreshSignal, setRefreshSignal] = useState(0);
  const debounceRef = useRef(null);

  const bg      = dark ? "#0f1117" : "#FFFFFF";
  const surface = dark ? "#141924" : "#ffffff";
  const border  = dark ? "#1e2535" : "#e2e8f0";
  const text    = dark ? "#e2e8f0" : "#1e293b";
  const muted   = dark ? "#64748b" : "#94a3b8";
  const inputBg = dark ? "#0f1117" : "#ffffff";

  const handleSearchChange = (v) => {
    setSearch(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQ(v), 400);
  };

  const handleCategoriesLoaded = useCallback((cats) => {
    setCategories((prev) => (prev.length > 0 ? prev : cats));
  }, []);

  const handleStatusToggle = async (logo) => {
    const next = logo.publishStatus === "Published" ? "Draft" : "Published";
    try {
      const res = await fetch(`/api/logo/admin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: logo.id, publishStatus: next }),
      });
      if (!res.ok) throw new Error();
      setRefreshSignal((s) => s + 1);
    } catch (e) { console.error(e.message); }
  };

  const ctrlStyle = {
    padding: "8px 10px", background: inputBg,
    border: `1px solid ${border}`, borderRadius: 8,
    fontSize: 13, cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif", outline: "none",
    transition: "border-color .2s",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        .lm-row { transition: background .15s; }
        .lm-row:hover { background: ${dark ? "#141924" : "#FFFFFF"} !important; }
        .lm-pg:hover:not(:disabled) {
          border-color: rgba(34,197,94,0.5) !important;
          color: #4ade80 !important;
          background: rgba(34,197,94,0.08) !important;
        }
        .lm-ctrl:focus {
          border-color: rgba(34,197,94,0.7) !important;
          box-shadow: 0 0 0 3px rgba(34,197,94,0.12) !important;
        }
        @keyframes lm-pulse { from { opacity:.55; } to { opacity:1; } }
      `}</style>

      <div style={{ padding: 24, fontFamily: "'DM Sans', sans-serif", minHeight: "100%", background: bg }}>

        {/* Page header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: text, letterSpacing: -0.5 }}>
              Logo Management
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: muted }}>
              Published and draft logos, split by status
            </p>
          </div>
        </div>

        {/* Filter bar (applies to both sections) */}
        <div style={{
          background: surface, border: `1px solid ${border}`, borderRadius: 12,
          padding: "12px 14px", marginBottom: 20,
          display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
        }}>
          <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
            <svg style={{
              position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
              color: muted, pointerEvents: "none",
            }} width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="lm-ctrl"
              type="text" placeholder="Search logos…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{
                width: "100%", paddingLeft: 34, paddingRight: 10,
                paddingTop: 8, paddingBottom: 8,
                background: inputBg, border: `1px solid ${border}`, borderRadius: 8,
                color: text, fontSize: 13, outline: "none",
                fontFamily: "'DM Sans', sans-serif", transition: "border-color .2s, box-shadow .2s",
              }}
            />
          </div>

          <select className="lm-ctrl" value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ ...ctrlStyle, color: categoryFilter ? text : muted }}>
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          {(debouncedQ || categoryFilter) && (
            <button
              onClick={() => { setSearch(""); setDebouncedQ(""); setCategoryFilter(""); }}
              style={{
                padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: "none", border: `1px solid ${border}`, color: muted,
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
              }}
            >Clear</button>
          )}
        </div>

        <LogoSection
          title="Published"
          status="Published"
          dark={dark}
          search={debouncedQ}
          categoryFilter={categoryFilter}
          refreshSignal={refreshSignal}
          onCategoriesLoaded={handleCategoriesLoaded}
          onEdit={setEditLogo}
          onDelete={setDeleteLogo}
          onStatusToggled={handleStatusToggle}
        />

        <LogoSection
          title="Draft"
          status="Draft"
          dark={dark}
          search={debouncedQ}
          categoryFilter={categoryFilter}
          refreshSignal={refreshSignal}
          onCategoriesLoaded={handleCategoriesLoaded}
          onEdit={setEditLogo}
          onDelete={setDeleteLogo}
          onStatusToggled={handleStatusToggle}
        />
      </div>

      {/* Modals */}
      {editLogo && (
        <EditModal
          logo={editLogo}
          dark={dark}
          categories={categories}
          onClose={() => setEditLogo(null)}
          onSave={() => {
            setEditLogo(null);
            setRefreshSignal((s) => s + 1);
          }}
        />
      )}
      {deleteLogo && (
        <DeleteConfirm
          logo={deleteLogo}
          dark={dark}
          onClose={() => setDeleteLogo(null)}
          onDeleted={() => {
            setDeleteLogo(null);
            setRefreshSignal((s) => s + 1);
          }}
        />
      )}
    </>
  );
}