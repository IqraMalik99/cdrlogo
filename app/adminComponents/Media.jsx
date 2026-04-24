"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search, Upload, ChevronDown, ChevronUp,
  Layers, AlertCircle, Loader2,
  RefreshCw, Trash2, ExternalLink, Check, X,
} from "lucide-react";

// ─── Format config ────────────────────────────────────────────────────────
const FORMAT_META = {
  ai:  { label: "AI",  color: "#f97316", bg: "#f9731615" },
  cdr: { label: "CDR", color: "#22c55e", bg: "#22c55e15" },
  svg: { label: "SVG", color: "#818cf8", bg: "#818cf815" },
  png: { label: "PNG", color: "#ec4899", bg: "#ec489915" },
};

const FILTER_TABS = [
  { key: "",    label: "All"  },
  { key: "ai",  label: "AI"   },
  { key: "cdr", label: "CDR"  },
  { key: "svg", label: "SVG"  },
  { key: "png", label: "PNG"  },
];

// ─── API helpers — POST & PATCH only ─────────────────────────────────────
const apiLoad = async ({ search, format, page, limit }) => {
  const r = await fetch("/api/admin/media", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ search, format, page, limit }),
  });
  if (!r.ok) throw new Error("Failed to load");
  return r.json();
};

const apiDelete = async (id) => {
  const r = await fetch("/api/admin/media-library", {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ op: "delete", id }),
  });
  if (!r.ok) throw new Error("Delete failed");
  return r.json();
};

// ─── Stat card ────────────────────────────────────────────────────────────
function StatCard({ label, value, dark }) {
  const surface = dark ? "#111827" : "#ffffff";
  const border  = dark ? "#1f2d3d" : "#e2e8f0";
  const text    = dark ? "#f1f5f9" : "#0f172a";
  const muted   = dark ? "#475569" : "#94a3b8";
  return (
    <div style={{
      background: surface, border: `1px solid ${border}`,
      borderRadius: 14, padding: "18px 22px",
      boxShadow: dark ? "0 4px 20px #00000022" : "0 2px 12px #0000000a",
      minWidth: 0,
    }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: text, letterSpacing: "-0.04em", lineHeight: 1 }}>
        {value ?? "—"}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: muted, marginTop: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {label}
      </div>
    </div>
  );
}

// ─── Format pill ──────────────────────────────────────────────────────────
function FormatPill({ fmt, filesize }) {
  const meta = FORMAT_META[fmt];
  if (!meta) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "5px 10px",
      background: meta.bg,
      border: `1px solid ${meta.color}30`,
      borderRadius: 8, gap: 10,
    }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: meta.color, letterSpacing: "0.05em" }}>
        {meta.label}
      </span>
      <span style={{ fontSize: 11, color: meta.color, opacity: 0.8, fontFamily: "monospace" }}>
        {filesize || "—"}
      </span>
    </div>
  );
}

// ─── Logo card ────────────────────────────────────────────────────────────
function LogoCard({ logo, dark, onDelete }) {
  const [expanded,   setExpanded]   = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const surface = dark ? "#111827" : "#ffffff";
  const border  = dark ? "#1f2d3d" : "#e2e8f0";
  const text    = dark ? "#f1f5f9" : "#0f172a";
  const muted   = dark ? "#475569" : "#94a3b8";
  const subBg   = dark ? "#0b0f17" : "#f8fafc";

  const formats = [
    logo.aiUrl  && { fmt: "ai",  size: logo.aifilesize  },
    logo.cdrUrl && { fmt: "cdr", size: logo.cdrfilesize },
    logo.svgUrl && { fmt: "svg", size: logo.svgfilesize },
    logo.pngUrl && { fmt: "png", size: logo.pngfilesize },
  ].filter(Boolean);

  const primary     = formats[0];
  const isPublished = logo.publishStatus?.toLowerCase() === "published";

  const handleDelete = async () => {
    if (!confirmDel) { setConfirmDel(true); return; }
    setDeleting(true);
    try {
      await apiDelete(logo.id);
      onDelete(logo.id);
    } catch {
      setDeleting(false);
      setConfirmDel(false);
    }
  };

  return (
    <div style={{
      background: surface,
      border: `1px solid ${expanded ? "#22c55e55" : border}`,
      borderRadius: 14, overflow: "hidden",
      transition: "border-color 0.2s, box-shadow 0.2s",
      boxShadow: expanded
        ? "0 0 0 1px #22c55e22, 0 8px 32px #00000033"
        : dark ? "0 2px 12px #00000022" : "0 2px 8px #0000000a",
      animation: "fadeUp 0.35s ease both",
    }}>

      {/* Thumbnail */}
      <div style={{
        height: 130, position: "relative",
        background: dark ? "#0b0f17" : "#f1f5f9",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {logo.webpUrl ? (
          <img
            src={logo.webpUrl}
            alt={logo.logoName}
            style={{ maxWidth: "75%", maxHeight: "75%", objectFit: "contain" }}
            onError={e => { e.target.style.display = "none"; }}
          />
        ) : primary ? (
          <span style={{
            fontSize: 36, fontWeight: 900, letterSpacing: "-0.04em",
            color: FORMAT_META[primary.fmt]?.color ?? "#475569",
            opacity: 0.85, fontFamily: "'DM Mono', monospace",
          }}>
            {FORMAT_META[primary.fmt]?.label}
          </span>
        ) : (
          <Layers size={32} style={{ color: muted, opacity: 0.4 }} />
        )}

        {/* Format badges — top right */}
        {formats.length > 0 && (
          <div style={{
            position: "absolute", top: 9, right: 9,
            background: dark ? "#0b0f17bb" : "#ffffffcc",
            backdropFilter: "blur(6px)",
            border: `1px solid ${border}`,
            borderRadius: 20, padding: "3px 8px",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            {formats.map(({ fmt }) => (
              <span key={fmt} style={{
                fontSize: 9, fontWeight: 800,
                color: FORMAT_META[fmt]?.color,
                letterSpacing: "0.04em",
              }}>
                {FORMAT_META[fmt]?.label}
              </span>
            ))}
          </div>
        )}

        {/* Publish badge — top left */}
        <div style={{
          position: "absolute", top: 9, left: 9,
          fontSize: 9, fontWeight: 700,
          color: isPublished ? "#22c55e" : "#f59e0b",
          background: (isPublished ? "#22c55e" : "#f59e0b") + "20",
          border: `1px solid ${(isPublished ? "#22c55e" : "#f59e0b")}44`,
          borderRadius: 20, padding: "2px 7px",
          textTransform: "uppercase", letterSpacing: "0.07em",
        }}>
          {logo.publishStatus}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: "12px 14px 12px" }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          marginBottom: 2,
        }}>
          {logo.logoName}
        </div>
        <div style={{ fontSize: 11, color: muted, fontFamily: "monospace", marginBottom: 9 }}>
          /{logo.slug}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            background: expanded ? "#22c55e15" : subBg,
            border: `1px solid ${expanded ? "#22c55e44" : border}`,
            borderRadius: 9, padding: "7px 11px",
            cursor: "pointer", transition: "all 0.18s",
            color: expanded ? "#22c55e" : muted,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em" }}>
            {formats.length} FORMAT{formats.length !== 1 ? "S" : ""}
          </span>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {/* Expanded content */}
        {expanded && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5, animation: "fadeUp 0.2s ease both" }}>
            {formats.map(({ fmt, size }) => (
              <FormatPill key={fmt} fmt={fmt} filesize={size} />
            ))}

            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <a
                href={`/logo/${logo.slug}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  background: "#22c55e15", border: "1px solid #22c55e44",
                  borderRadius: 8, padding: "7px 10px",
                  fontSize: 11, fontWeight: 700, color: "#22c55e",
                  textDecoration: "none",
                }}
              >
                <ExternalLink size={11} /> View
              </a>
              {/* <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  background: confirmDel ? "#ef444420" : "#ef444410",
                  border: `1px solid ${confirmDel ? "#ef4444aa" : "#ef444430"}`,
                  borderRadius: 8, padding: "7px 10px",
                  fontSize: 11, fontWeight: 700,
                  color: confirmDel ? "#ef4444" : "#ef4444aa",
                  cursor: deleting ? "not-allowed" : "pointer",
                  transition: "all 0.15s",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {deleting
                  ? <Loader2 size={11} style={{ animation: "spin 0.8s linear infinite" }} />
                  : confirmDel
                    ? <><Check size={11} /> Confirm</>
                    : <><Trash2 size={11} /> Delete</>
                }
              </button> */}
            </div>

            {confirmDel && !deleting && (
              <button
                onClick={() => setConfirmDel(false)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  background: "transparent", border: `1px solid ${border}`,
                  borderRadius: 8, padding: "5px 10px",
                  fontSize: 11, color: muted, cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <X size={11} /> Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────
export default function MediaLibrary({ dark = true }) {
  const [logos,      setLogos]      = useState([]);
  const [stats,      setStats]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [search,     setSearch]     = useState("");
  const [format,     setFormat]     = useState("");
  const [page,       setPage]       = useState(1);
  const [pagination, setPagination] = useState(null);

  const LIMIT      = 48;
  const searchTimer = useRef(null);

  // Core load — always POST
  const load = async ({ s = search, f = format, p = page } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiLoad({ search: s, format: f, page: p, limit: LIMIT });
      setLogos(data.logos ?? []);
      setPagination(data.pagination ?? null);
      if (data.stats) setStats(data.stats);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const applyFormat = (f) => {
    setFormat(f);
    setPage(1);
    load({ f, p: 1 });
  };

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      load({ s: val, p: 1 });
    }, 380);
  };

  const handlePage = (p) => {
    setPage(p);
    load({ p });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = (id) => {
    setLogos(l => l.filter(logo => logo.id !== id));
    if (stats) setStats(s => ({ ...s, totalLogos: Math.max(0, s.totalLogos - 1) }));
  };

  // ── theme ──────────────────────────────────────────────────────────────────
  const bg      = dark ? "#0b0f17" : "#f0f4f8";
  const border  = dark ? "#1f2d3d" : "#e2e8f0";
  const text    = dark ? "#f1f5f9" : "#0f172a";
  const muted   = dark ? "#475569" : "#94a3b8";
  const surface = dark ? "#111827" : "#ffffff";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
        input:focus,select:focus {
          border-color:#22c55e!important;
          box-shadow:0 0 0 3px rgba(34,197,94,.10)!important;
          outline:none!important;
        }
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#22c55e44;border-radius:99px}
      `}</style>

      <div style={{
        background: bg, minHeight: "100vh",
        fontFamily: "'DM Sans', sans-serif",
        padding: "28px 28px 60px",
      }}>

        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 24, gap: 12,
          animation: "fadeUp 0.3s ease both",
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: text, letterSpacing: "-0.04em" }}>
              Media Library
            </h1>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: muted }}>
              All uploaded logo files across formats
            </p>
          </div>

          <div style={{ display: "flex", gap: 9 }}>
            <button
              onClick={() => load()}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                background: surface, border: `1px solid ${border}`,
                borderRadius: 10, padding: "9px 14px",
                cursor: "pointer", color: muted, fontSize: 12, fontWeight: 600,
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              <RefreshCw size={13} style={loading ? { animation: "spin 0.8s linear infinite" } : {}} />
              Refresh
            </button>

          
          </div>
        </div>

        {/* ── Stat cards ── */}
        {stats && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 12, marginBottom: 24,
            animation: "fadeUp 0.35s ease 40ms both",
          }}>
            <StatCard label="Total Logos" value={stats.totalLogos?.toLocaleString()} dark={dark} />
             <StatCard label="Total Files" value={Number(stats.totalLogos)*4} dark={dark} />
            <StatCard label="AI Files"    value={stats.aiFiles?.toLocaleString()}    dark={dark} />
            <StatCard label="CDR Files"   value={stats.cdrFiles?.toLocaleString()}   dark={dark} />
            <StatCard label="SVG Files"   value={stats.svgFiles?.toLocaleString()}   dark={dark} />
            <StatCard label="PNG Files"   value={stats.pngFiles?.toLocaleString()}   dark={dark} />
          </div>
        )}

        {/* ── Search + Format filter ── */}
        <div style={{
          display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap",
          animation: "fadeUp 0.35s ease 60ms both",
        }}>
          {/* Search */}
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <Search size={13} style={{
              position: "absolute", left: 11, top: "50%",
              transform: "translateY(-50%)", color: muted, pointerEvents: "none",
            }} />
            <input
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search logos, brands, slugs…"
              style={{
                width: "100%", boxSizing: "border-box",
                background: surface, border: `1px solid ${border}`,
                borderRadius: 10, padding: "9px 32px 9px 32px",
                fontSize: 13, color: text, fontFamily: "'DM Sans',sans-serif",
              }}
            />
            {search && (
              <button
                onClick={() => handleSearch("")}
                style={{
                  position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: muted,
                  display: "flex", padding: 2,
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Format tabs */}
          <div style={{
            display: "flex", gap: 4,
            background: surface, border: `1px solid ${border}`,
            borderRadius: 10, padding: 4,
          }}>
            {FILTER_TABS.map(tab => {
              const active = format === tab.key;
              const meta   = FORMAT_META[tab.key];
              return (
                <button
                  key={tab.key}
                  onClick={() => applyFormat(tab.key)}
                  style={{
                    padding: "5px 13px", borderRadius: 7,
                    background: active ? (meta ? meta.bg : "#22c55e18") : "transparent",
                    border: active ? `1px solid ${meta ? meta.color + "44" : "#22c55e44"}` : "1px solid transparent",
                    color: active ? (meta ? meta.color : "#22c55e") : muted,
                    fontSize: 11, fontWeight: 700, cursor: "pointer",
                    fontFamily: "'DM Sans',sans-serif",
                    transition: "all 0.15s", letterSpacing: "0.04em",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results count */}
        {pagination && !loading && (
          <div style={{ fontSize: 11, color: muted, marginBottom: 14 }}>
            Showing <strong style={{ color: text }}>{logos.length}</strong> of{" "}
            <strong style={{ color: text }}>{pagination.total}</strong> logos
            {search && <> · "<span style={{ color: "#22c55e" }}>{search}</span>"</>}
            {format && <> · <span style={{ color: FORMAT_META[format]?.color }}>{format.toUpperCase()}</span> only</>}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            display: "flex", alignItems: "center", gap: 9,
            background: "#ef444415", border: "1px solid #ef444433",
            borderRadius: 12, padding: "14px 18px", marginBottom: 20,
            color: "#ef4444", fontSize: 13,
          }}>
            <AlertCircle size={15} />
            {error}
            <button
              onClick={() => load()}
              style={{ marginLeft: "auto", background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
            gap: 14,
          }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{
                background: surface, border: `1px solid ${border}`,
                borderRadius: 14, overflow: "hidden",
                animation: "pulse 1.4s ease infinite",
                animationDelay: `${i * 60}ms`,
              }}>
                <div style={{ height: 130, background: dark ? "#1f2d3d" : "#e2e8f0" }} />
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ height: 13, background: dark ? "#1f2d3d" : "#e2e8f0", borderRadius: 6, marginBottom: 8, width: "70%" }} />
                  <div style={{ height: 10, background: dark ? "#1f2d3d" : "#e2e8f0", borderRadius: 6, width: "40%" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && logos.length === 0 && (
          <div style={{
            textAlign: "center", padding: "64px 20px", color: muted,
            animation: "fadeUp 0.3s ease both",
          }}>
            <Layers size={40} style={{ opacity: 0.3, margin: "0 auto 12px", display: "block" }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: text, marginBottom: 6 }}>No logos found</div>
            <div style={{ fontSize: 12 }}>
              {search ? `No results for "${search}"` : "Upload some logos to get started"}
            </div>
            {search && (
              <button
                onClick={() => handleSearch("")}
                style={{
                  marginTop: 14, background: "#22c55e18", border: "1px solid #22c55e44",
                  borderRadius: 8, padding: "7px 14px", color: "#22c55e",
                  fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                }}
              >
                Clear search
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        {!loading && logos.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
            gap: 14,
          }}>
            {logos.map((logo, i) => (
              <div key={logo.id} style={{ animationDelay: `${Math.min(i * 25, 300)}ms` }}>
                <LogoCard logo={logo} dark={dark} onDelete={handleDelete} />
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && pagination && pagination.totalPages > 1 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 6, marginTop: 36,
            animation: "fadeUp 0.3s ease both",
          }}>
            <button
              onClick={() => handlePage(page - 1)}
              disabled={page <= 1}
              style={{
                padding: "7px 14px", borderRadius: 9,
                background: surface, border: `1px solid ${border}`,
                color: page <= 1 ? muted : text,
                fontSize: 12, fontWeight: 700,
                cursor: page <= 1 ? "not-allowed" : "pointer",
                opacity: page <= 1 ? 0.4 : 1,
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              ← Prev
            </button>

            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === pagination.totalPages || Math.abs(p - page) <= 2)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "…" ? (
                  <span key={`e-${i}`} style={{ color: muted, fontSize: 12, padding: "0 4px" }}>…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => handlePage(p)}
                    style={{
                      width: 34, height: 34, borderRadius: 9,
                      background: p === page ? "linear-gradient(135deg,#22c55e,#16a34a)" : surface,
                      border: p === page ? "none" : `1px solid ${border}`,
                      color: p === page ? "#fff" : text,
                      fontSize: 12, fontWeight: 700, cursor: "pointer",
                      fontFamily: "'DM Sans',sans-serif",
                      boxShadow: p === page ? "0 4px 12px #22c55e33" : "none",
                    }}
                  >
                    {p}
                  </button>
                )
              )
            }

            <button
              onClick={() => handlePage(page + 1)}
              disabled={page >= pagination.totalPages}
              style={{
                padding: "7px 14px", borderRadius: 9,
                background: surface, border: `1px solid ${border}`,
                color: page >= pagination.totalPages ? muted : text,
                fontSize: 12, fontWeight: 700,
                cursor: page >= pagination.totalPages ? "not-allowed" : "pointer",
                opacity: page >= pagination.totalPages ? 0.4 : 1,
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              Next →
            </button>
          </div>
        )}

      </div>
    </>
  );
}