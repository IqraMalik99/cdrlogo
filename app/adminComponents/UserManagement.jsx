"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const PER_PAGE = 10;

const ROLE_CFG = {
  admin: { bg: "rgba(139,92,246,0.15)", border: "rgba(139,92,246,0.4)", color: "#a78bfa" },
  user:  { bg: "rgba(100,116,139,0.15)", border: "rgba(100,116,139,0.3)", color: "#94a3b8" },
};

function RoleBadge({ role }) {
  const c = ROLE_CFG[role] ?? ROLE_CFG.user;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 100,
      background: c.bg, border: `1px solid ${c.border}`,
      color: c.color, fontSize: 11, fontWeight: 700,
      letterSpacing: 0.3, whiteSpace: "nowrap", textTransform: "capitalize",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.color, display: "inline-block" }} />
      {role}
    </span>
  );
}

function UserAvatar({ name = "", email = "" }) {
  const initials = (name || email).slice(0, 2).toUpperCase();
  const colors = [
    ["#818cf8","rgba(99,102,241,0.2)"],
    ["#34d399","rgba(52,211,153,0.2)"],
    ["#f472b6","rgba(244,114,182,0.2)"],
    ["#fb923c","rgba(251,146,60,0.2)"],
    ["#38bdf8","rgba(56,189,248,0.2)"],
    ["#a78bfa","rgba(167,139,250,0.2)"],
  ];
  const [clr, bg] = colors[(name || email).charCodeAt(0) % colors.length];
  return (
    <div style={{
      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
      background: bg, border: `1px solid ${clr}33`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 12, fontWeight: 800, color: clr, letterSpacing: -0.5,
    }}>{initials}</div>
  );
}

function DeleteConfirm({ user, dark, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState(null);

  const bg     = dark ? "#0f1117" : "#ffffff";
  const border = dark ? "#1e2535" : "#e2e8f0";
  const text   = dark ? "#e2e8f0" : "#1e293b";
  const muted  = dark ? "#64748b" : "#94a3b8";

  const handleDelete = async () => {
    setDeleting(true); setErr(null);
    try {
      const res = await fetch("/api/user/admin", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onDeleted(user.id);
    } catch (e) {
      setErr(e.message);
      setDeleting(false);
    }
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
        width: "100%", maxWidth: 380, padding: "20px 20px",
        boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, marginBottom: 14,
        }}>🗑️</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: text, marginBottom: 6 }}>Delete User</div>
        <div style={{ fontSize: 13, color: muted, lineHeight: 1.65, marginBottom: 6 }}>
          Are you sure you want to delete{" "}
          <strong style={{ color: text }}>{user.name || user.email}</strong>?
          This action cannot be undone.
        </div>
        {user.email && (
          <div style={{
            fontSize: 12, color: muted, marginBottom: 20,
            padding: "6px 10px", borderRadius: 7,
            background: dark ? "#1e2535" : "#f1f5f9",
            fontFamily: "monospace",
          }}>{user.email}</div>
        )}
        {err && (
          <div style={{
            marginBottom: 12, padding: "8px 12px", borderRadius: 7, fontSize: 12,
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171",
          }}>{err}</div>
        )}
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

export default function UserManagement({ dark = true }) {
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [search, setSearch]         = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);
  const [deleteUser, setDeleteUser] = useState(null);
  const debounceRef = useRef(null);

  // Theme tokens — mirrors the CMS pattern
  const bg         = dark ? "#0f1117" : "#f8fafc";
  const surface    = dark ? "#141924" : "#ffffff";
  const border     = dark ? "#1e2535" : "#e2e8f0";
  const text       = dark ? "#e2e8f0" : "#1e293b";
  const muted      = dark ? "#64748b" : "#94a3b8";
  const inputBg    = dark ? "#0f1117" : "#ffffff";
  const headClr    = dark ? "#475569" : "#94a3b8";
  const rowHoverBg = dark ? "#141924" : "#f8fafc";
  const skeletonBg = dark ? "#1e2535" : "#e2e8f0";

  const handleSearchChange = (v) => {
    setSearch(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setDebouncedQ(v); setPage(1); }, 400);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/user/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page, limit: PER_PAGE,
          ...(debouncedQ && { search: debouncedQ }),
          ...(roleFilter && { role: roleFilter }),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setUsers(json.data ?? []);
      setTotal(json.totalUsers ?? 0);
      setTotalPages(json.totalPages ?? 1);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [page, debouncedQ, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { setPage(1); }, [debouncedQ, roleFilter]);

  function buildPages(tot, cur) {
    if (tot <= 7) return Array.from({ length: tot }, (_, i) => i + 1);
    const p = [1];
    if (cur > 3) p.push("…");
    for (let i = Math.max(2, cur - 1); i <= Math.min(tot - 1, cur + 1); i++) p.push(i);
    if (cur < tot - 2) p.push("…");
    p.push(tot);
    return p;
  }
  const pageNums = buildPages(totalPages, page);
  const showFrom = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const showTo   = Math.min(page * PER_PAGE, total);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        .um-wrap { padding: 16px; font-family: 'DM Sans', sans-serif; min-height: 100%; background: ${bg}; }
        @media (min-width: 640px) { .um-wrap { padding: 24px; } }

        /* Filter bar */
        .um-filters {
          background: ${surface};
          border: 1px solid ${border};
          border-radius: 12px;
          padding: 10px 12px;
          margin-bottom: 14px;
          display: flex;
          gap: 8px;
          flex-direction: column;
        }
        @media (min-width: 480px) {
          .um-filters { flex-direction: row; flex-wrap: wrap; align-items: center; }
        }

        /* Table grid — columns collapse on small screens */
        .um-table {
          display: grid;
          grid-template-columns: 44px 1fr 60px;
          padding: 10px 12px;
          align-items: center;
          gap: 0;
        }
        @media (min-width: 500px) {
          .um-table { grid-template-columns: 44px 1fr 110px 60px; }
          .um-col-role { display: flex !important; }
        }
        @media (min-width: 760px) {
          .um-table { grid-template-columns: 44px minmax(160px,1fr) 110px 110px 110px 60px; padding: 10px 16px; }
          .um-col-dl { display: flex !important; }
          .um-col-joined { display: flex !important; }
        }

        .um-col-role   { display: none; }
        .um-col-dl     { display: none; }
        .um-col-joined { display: none; }

        /* Row hover */
        .um-row { transition: background .15s; }
        .um-row:hover { background: ${rowHoverBg} !important; }

        /* Pagination button hover */
        .um-pg:hover:not(:disabled) {
          border-color: rgba(34,197,94,0.5) !important;
          color: #4ade80 !important;
          background: rgba(34,197,94,0.08) !important;
        }

        /* Input focus */
        .um-ctrl:focus {
          border-color: rgba(34,197,94,0.7) !important;
          box-shadow: 0 0 0 3px rgba(34,197,94,0.12) !important;
          outline: none;
        }

        /* Delete button hover */
        .um-del:hover {
          background: rgba(239,68,68,0.12) !important;
          color: #f87171 !important;
        }

        @keyframes um-pulse { from { opacity:.4; } to { opacity:1; } }

        /* Pagination wrap */
        .um-page-wrap {
          margin-top: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
        }
        .um-page-btns {
          display: flex;
          gap: 4px;
          align-items: center;
          flex-wrap: wrap;
        }
        /* Hide «/» first/last buttons on very small screens */
        .um-pg-edge { display: none; }
        @media (min-width: 420px) { .um-pg-edge { display: inline-flex; } }
      `}</style>

      <div className="um-wrap">

        {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: text, letterSpacing: -0.5 }}>
            Users
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: muted }}>
            {loading ? "Loading…" : `${total} users total`}
          </p>
        </div>

        {/* Filter bar */}
        <div className="um-filters">
          {/* Search */}
          <div style={{ flex: 1, minWidth: 160, position: "relative" }}>
            <svg style={{
              position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
              color: muted, pointerEvents: "none", flexShrink: 0,
            }} width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="um-ctrl"
              type="text" placeholder="Search name or email…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{
                width: "100%", paddingLeft: 30, paddingRight: 10,
                paddingTop: 8, paddingBottom: 8,
                background: inputBg, border: `1px solid ${border}`, borderRadius: 8,
                color: text, fontSize: 13,
                fontFamily: "'DM Sans', sans-serif", transition: "border-color .2s, box-shadow .2s",
              }}
            />
          </div>

          

          {(debouncedQ || roleFilter) && (
            <button
              onClick={() => { setSearch(""); setDebouncedQ(""); setRoleFilter(""); setPage(1); }}
              style={{
                padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: "none", border: `1px solid ${border}`, color: muted,
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
              }}
            >Clear</button>
          )}
        </div>

        {/* Table */}
        <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden" }}>

          {/* Header row */}
          <div className="um-table" style={{
            borderBottom: `1px solid ${border}`,
            background: dark ? "#0d1018" : "#f1f5f9",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: headClr, letterSpacing: 0.5 }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: headClr, letterSpacing: 0.5 }}>User</div>
            <div className="um-col-role" style={{ fontSize: 11, fontWeight: 700, color: headClr, letterSpacing: 0.5 }}>Role</div>
            <div className="um-col-dl" style={{ fontSize: 11, fontWeight: 700, color: headClr, letterSpacing: 0.5 }}>Downloads</div>
            <div className="um-col-joined" style={{ fontSize: 11, fontWeight: 700, color: headClr, letterSpacing: 0.5 }}>Joined</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: headClr, letterSpacing: 0.5, textAlign: "right" }} />
          </div>

          {/* Skeletons */}
          {loading && Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="um-table" style={{
              borderBottom: `1px solid ${border}`,
              animation: "um-pulse 1.4s ease-in-out infinite alternate",
            }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: skeletonBg }} />
              <div>
                <div style={{ width: "60%", height: 11, borderRadius: 5, background: skeletonBg, marginBottom: 6 }} />
                <div style={{ width: "40%", height: 9, borderRadius: 5, background: skeletonBg }} />
              </div>
              <div className="um-col-role" style={{ width: 70, height: 20, borderRadius: 100, background: skeletonBg }} />
              <div className="um-col-dl" style={{ width: 40, height: 11, borderRadius: 5, background: skeletonBg }} />
              <div className="um-col-joined" style={{ width: 60, height: 11, borderRadius: 5, background: skeletonBg }} />
              <div style={{ width: 30, height: 30, borderRadius: 7, background: skeletonBg, marginLeft: "auto" }} />
            </div>
          ))}

          {/* Error */}
          {!loading && error && (
            <div style={{ padding: 48, textAlign: "center", color: "#f87171", fontSize: 13 }}>
              <div style={{ marginBottom: 12 }}>{error}</div>
              <button onClick={fetchUsers} style={{
                padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
                color: "#f87171", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}>Retry</button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && users.length === 0 && (
            <div style={{ padding: 60, textAlign: "center", color: muted, fontSize: 13 }}>
              No users found.
            </div>
          )}

          {/* User rows */}
          {!loading && !error && users.map((user, idx) => (
            <div
              key={user.id ?? idx}
              className="um-row um-table"
              style={{
                borderBottom: idx < users.length - 1 ? `1px solid ${border}` : "none",
                background: "transparent",
              }}
            >
              {/* Avatar */}
              <div><UserAvatar name={user.name} email={user.email} /></div>

              {/* Name + email */}
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: text,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{user.name || "—"}</div>
                <div style={{
                  fontSize: 11, color: muted, marginTop: 1,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{user.email || "—"}</div>
              </div>

              {/* Role */}
              <div className="um-col-role"><RoleBadge role={user.role} /></div>

              {/* Downloads */}
              <div className="um-col-dl" style={{
                fontSize: 13, fontWeight: 600, color: text, fontVariantNumeric: "tabular-nums",
              }}>
                {(user.downloadCountUsed ?? 0).toLocaleString()}
              </div>

              {/* Joined */}
              <div className="um-col-joined" style={{ fontSize: 12, color: muted }}>
                {new Date(user.createdAt).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })}
              </div>

              {/* Delete */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  className="um-del"
                  title="Delete user"
                  onClick={() => setDeleteUser(user)}
                  style={{
                    width: 30, height: 30, borderRadius: 7, border: "none",
                    background: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: muted, transition: "background .15s, color .15s",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" /><path d="M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {!loading && !error && (
          <div className="um-page-wrap">
            <span style={{ fontSize: 12, color: muted }}>
              Showing {showFrom}–{showTo} of {total}
            </span>
            {totalPages > 1 && (
              <div className="um-page-btns">
                <button className="um-pg um-pg-edge" onClick={() => setPage(1)} disabled={page === 1} style={{
                  padding: "6px 10px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${border}`, background: surface, color: muted,
                  cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.35 : 1,
                  fontFamily: "'DM Sans', sans-serif",
                }}>«</button>
                <button className="um-pg" onClick={() => setPage((p) => p - 1)} disabled={page === 1} style={{
                  padding: "6px 10px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${border}`, background: surface, color: muted,
                  cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.35 : 1,
                  fontFamily: "'DM Sans', sans-serif",
                }}>Prev</button>

                {pageNums.map((p, i) =>
                  p === "…" ? (
                    <span key={`e${i}`} style={{ color: muted, fontSize: 12, padding: "0 2px" }}>…</span>
                  ) : (
                    <button key={p} className="um-pg" onClick={() => setPage(p)} style={{
                      minWidth: 34, height: 34, borderRadius: 7, fontSize: 12, fontWeight: 700,
                      border: `1px solid ${p === page ? "rgba(34,197,94,0.5)" : border}`,
                      background: p === page ? "rgba(34,197,94,0.15)" : surface,
                      color: p === page ? "#4ade80" : muted,
                      cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                    }}>{p}</button>
                  )
                )}

                <button className="um-pg" onClick={() => setPage((p) => p + 1)} disabled={page === totalPages} style={{
                  padding: "6px 10px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${border}`, background: surface, color: muted,
                  cursor: page === totalPages ? "default" : "pointer",
                  opacity: page === totalPages ? 0.35 : 1, fontFamily: "'DM Sans', sans-serif",
                }}>Next</button>
                <button className="um-pg um-pg-edge" onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{
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

      {deleteUser && (
        <DeleteConfirm
          user={deleteUser}
          dark={dark}
          onClose={() => setDeleteUser(null)}
          onDeleted={(id) => {
            setUsers((prev) => prev.filter((u) => u.id !== id));
            setDeleteUser(null);
            setTotal((t) => t - 1);
          }}
        />
      )}
    </>
  );
}