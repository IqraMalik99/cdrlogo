"use client";

import { useState, useEffect } from "react";
import {
  ImageIcon, Download, Users, Eye,
  Upload, LayoutGrid, FileText, Droplets,
  ArrowUpRight, Clock, RefreshCw,
  TrendingUp, Zap, Shield, BarChart2,
  Search, PackagePlus, AlertTriangle,
} from "lucide-react";

// ─── helpers ───────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
};

const relTime = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr${h > 1 ? "s" : ""} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? "s" : ""} ago`;
};

// ── detect if log content contains error-related words ────────────────────
const isErrorLog = (content = "") => {
  const lower = content.toLowerCase();
  return (
    lower.includes("error") ||
    lower.includes("failed") ||
    lower.includes("dmca") ||
    lower.includes("report") ||
    lower.includes("rejected") ||
    lower.includes("denied")
  );
};

const iconFor = (type, isErr) => {
  if (isErr) return <AlertTriangle size={13} />;
  const map = {
    upload:   <Upload size={13} />,
    category: <BarChart2 size={13} />,
    seo:      <Search size={13} />,
    bulk:     <PackagePlus size={13} />,
    alert:    <Shield size={13} />,
    redirect: <ArrowUpRight size={13} />,
  };
  return map[type] ?? <Zap size={13} />;
};

// ─── StatCard ──────────────────────────────────────────────────────────────
function StatCard({ label, value, change, changeType = "pct", icon: Icon, accent, dark, loading, delay = 0 }) {
  const [hov, setHov] = useState(false);
  const cardBg = dark ? "#111827" : "#ffffff";
  const border = dark ? "#1f2d3d" : "#e2e8f0";
  const text   = dark ? "#f1f5f9" : "#0f172a";
  const muted  = dark ? "#475569" : "#94a3b8";
  const up     = change == null ? null : change >= 0;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: cardBg,
        border: `1px solid ${hov ? accent + "55" : border}`,
        borderRadius: 16,
        padding: "20px 22px",
        // responsive: shrinks on small screens but never below 140px
        flex: "1 1 160px", minWidth: 0,
        display: "flex", flexDirection: "column", gap: 10,
        boxShadow: hov
          ? (dark ? `0 8px 32px ${accent}1a` : `0 8px 32px ${accent}14`)
          : (dark ? "0 2px 8px #0000002a" : "0 2px 8px #0000000a"),
        transition: "all 0.22s cubic-bezier(.4,0,.2,1)",
        cursor: "default",
        animation: `fadeUp 0.45s ease both`,
        animationDelay: `${delay}ms`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          fontSize: 10, fontWeight: 700, color: muted,
          letterSpacing: "0.08em", textTransform: "uppercase",
        }}>
          {label}
        </span>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: accent + (hov ? "25" : "18"),
          display: "flex", alignItems: "center", justifyContent: "center",
          color: accent, transition: "background 0.2s", flexShrink: 0,
        }}>
          <Icon size={15} />
        </div>
      </div>

      {loading ? (
        <div style={{
          height: 32, width: "55%", borderRadius: 8,
          background: dark ? "#1f2d3d" : "#e2e8f0",
          animation: "shimmer 1.5s ease-in-out infinite",
        }} />
      ) : (
        <span style={{
          fontSize: 28, fontWeight: 700, color: text,
          letterSpacing: "-0.03em",
          fontFamily: "'DM Mono', monospace",
          lineHeight: 1,
        }}>
          {fmt(value)}
        </span>
      )}

      {!loading && change != null && (
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{
            display: "flex", alignItems: "center", gap: 3,
            background: (up ? "#22c55e" : "#ef4444") + "18",
            color: up ? "#22c55e" : "#ef4444",
            fontSize: 10, fontWeight: 700,
            padding: "2px 7px", borderRadius: 20,
          }}>
            <TrendingUp size={9} style={{ transform: up ? "none" : "scaleY(-1)" }} />
            {up ? "+" : ""}{changeType === "pct" ? `${change}%` : change}
          </span>
          <span style={{ fontSize: 10, color: muted }}>this week</span>
        </div>
      )}
    </div>
  );
}

// ─── QuickAction ───────────────────────────────────────────────────────────
function QuickAction({ label, icon: Icon, accent, dark, onClick, delay = 0 }) {
  const [hov, setHov] = useState(false);
  const cardBg = dark ? "#111827" : "#ffffff";
  const border = dark ? "#1f2d3d" : "#e2e8f0";
  const text   = dark ? "#cbd5e1" : "#334155";

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? accent + "1a" : cardBg,
        border: `1px solid ${hov ? accent + "55" : border}`,
        borderRadius: 13, padding: "14px 16px",
        display: "flex", alignItems: "center", gap: 10,
        cursor: "pointer",
        // responsive flex: fills row, min 130px, max 50% on wide screens
        flex: "1 1 130px", minWidth: 0,
        color: hov ? accent : text,
        fontFamily: "'DM Sans', sans-serif",
        boxShadow: hov
          ? (dark ? `0 6px 24px ${accent}1a` : `0 6px 24px ${accent}14`)
          : (dark ? "0 2px 6px #0000001a" : "0 2px 6px #00000008"),
        transition: "all 0.2s cubic-bezier(.4,0,.2,1)",
        animation: `fadeUp 0.45s ease both`,
        animationDelay: `${delay}ms`,
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        background: accent + (hov ? "25" : "15"),
        display: "flex", alignItems: "center", justifyContent: "center",
        color: accent, transition: "background 0.2s",
      }}>
        <Icon size={16} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
      <ArrowUpRight
        size={12}
        style={{ marginLeft: "auto", flexShrink: 0, opacity: hov ? 0.7 : 0, transition: "opacity 0.2s" }}
      />
    </button>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard({ dark = true, setActive }) {
  const [stats,       setStats]       = useState(null);
  const [logs,        setLogs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [logLoad,     setLogLoad]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = async () => {
    setRefreshing(true);
    try {
      const r    = await fetch("/api/admin/dashboard");
      const data = await r.json();
      setStats(data.stats);
      setLogs(data.logs ?? []);
    } catch {
      // ── Dev fallback — remove when DB is live ──
      setStats({
        totalLogos: 524,   totalLogosChange: 12,
        downloads: 23400,  downloadsChange: 6.3,
        activeUsers: 1234, activeUsersChange: 5.1,
        // pageViews: 89200, pageViewsChange: 12.7, // commented out — wire analytics later
      });
      setLogs([
        { id:"1", who:"system",  content:"New logo uploaded: TechNova",         createdAt: new Date(Date.now()-2*60000).toISOString(),    icon:"upload",   color:"#22c55e" },
        { id:"2", who:"admin",   content:"Category 'Fintech' created",           createdAt: new Date(Date.now()-60*60000).toISOString(),   icon:"category", color:"#3b82f6" },
        { id:"3", who:"seo-bot", content:"SEO meta updated for /automotive",     createdAt: new Date(Date.now()-3*3600000).toISOString(),  icon:"seo",      color:"#f59e0b" },
        { id:"4", who:"system",  content:"Bulk import: 15 logos processed",      createdAt: new Date(Date.now()-5*3600000).toISOString(),  icon:"bulk",     color:"#8b5cf6" },
        { id:"5", who:"system",  content:"DMCA report received for LogoXYZ",     createdAt: new Date(Date.now()-8*3600000).toISOString(),  icon:"alert",    color:"#ef4444" },
        { id:"6", who:"system",  content:"Upload error: file format rejected",   createdAt: new Date(Date.now()-9*3600000).toISOString(),  icon:"alert",    color:"#ef4444" },
        { id:"7", who:"admin",   content:"Redirect: /old-page → /new-page",      createdAt: new Date(Date.now()-26*3600000).toISOString(), icon:"redirect", color:"#64748b" },
      ]);
    }
    setLoading(false);
    setLogLoad(false);
    setLastRefresh(new Date());
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  // theme tokens
  const bg      = dark ? "#0b0f17" : "#FFFFFF";
  const surface = dark ? "#111827" : "#ffffff";
  const border  = dark ? "#1f2d3d" : "#e2e8f0";
  const text    = dark ? "#f1f5f9" : "#0f172a";
  const muted   = dark ? "#475569" : "#94a3b8";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500;600&display=swap');
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.7s linear infinite; }

        /* ── Error log row pulse ── */
        @keyframes errPulse {
          0%,100% { box-shadow: none; }
          50%     { box-shadow: inset 3px 0 0 #ef444488; }
        }
        .log-error-row { animation: errPulse 3s ease-in-out infinite; }

        /* ── Responsive grid breakpoints ── */
        .stat-grid   { display: flex; flex-wrap: wrap; gap: 14px; }
        .action-grid { display: flex; flex-wrap: wrap; gap: 12px; }

        @media (max-width: 480px) {
          .stat-grid   { gap: 10px; }
          .action-grid { gap: 8px; }
          .dash-pad    { padding: 16px 14px 40px !important; }
          .dash-title  { font-size: 19px !important; }
        }
      `}</style>

      <div
        className="dash-pad"
        style={{
          background: bg, minHeight: "100%",
          fontFamily: "'DM Sans', sans-serif",
          padding: "28px 28px 48px",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", marginBottom: 28,
          animation: "fadeUp 0.35s ease both", gap: 12,
        }}>
          <div>
            <h1 className="dash-title" style={{
              margin: 0, fontSize: 23, fontWeight: 700, color: text,
              letterSpacing: "-0.035em",
            }}>
              Dashboard
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: muted }}>
              Last refreshed · {relTime(lastRefresh.toISOString())}
            </p>
          </div>
          <button
            onClick={load}
            disabled={refreshing}
            style={{
              display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
              background: dark ? "#1a2535" : "#fff",
              border: `1px solid ${border}`, borderRadius: 10,
              padding: "8px 14px", cursor: refreshing ? "not-allowed" : "pointer",
              color: muted, fontSize: 12, fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              opacity: refreshing ? 0.55 : 1, transition: "opacity 0.2s",
            }}
          >
            <RefreshCw size={13} className={refreshing ? "spin" : ""} />
            <span style={{ display: "inline" }}>{refreshing ? "Loading…" : "Refresh"}</span>
          </button>
        </div>

        {/* ── Stat cards — Page Views commented out ── */}
        <div className="stat-grid" style={{ marginBottom: 16 }}>
          <StatCard
            label="Total Logos"
            value={stats?.totalLogos}
            change={stats?.totalLogosChange}
            changeType="abs"
            icon={ImageIcon}
            accent="#22c55e"
            dark={dark}
            loading={loading}
            delay={0}
          />
          <StatCard
            label="Total Downloads"
            value={stats?.downloads}
            change={stats?.downloadsChange}
            changeType="pct"
            icon={Download}
            accent="#3b82f6"
            dark={dark}
            loading={loading}
            delay={60}
          />
          <StatCard
            label="Registered Users"
            value={stats?.activeUsers}
            change={stats?.activeUsersChange}
            changeType="pct"
            icon={Users}
            accent="#f59e0b"
            dark={dark}
            loading={loading}
            delay={120}
          />
          {/* Page Views — commented out until analytics is wired up
          <StatCard
            label="Page Views"
            value={stats?.pageViews}
            change={stats?.pageViewsChange}
            changeType="pct"
            icon={Eye}
            accent="#a78bfa"
            dark={dark}
            loading={loading}
            delay={180}
          />
          */}
        </div>

        {/* ── Quick actions ── */}
        <div className="action-grid" style={{ marginBottom: 28 }}>
          {/*
            Clicking each button calls setActive() with the EXACT key string
            used in AdminPage's renderContent switch — make sure these match.
          */}
          <QuickAction
            label="Upload Logo"
            icon={Upload}
            accent="#22c55e"
            dark={dark}
            onClick={() => setActive?.("upload")}         // → case "upload"
            delay={180}
          />
          <QuickAction
            label="Logo Management"
            icon={LayoutGrid}
            accent="#3b82f6"
            dark={dark}
            onClick={() => setActive?.("LogoManagement")} // → case "LogoManagement"
            delay={220}
          />
          <QuickAction
            label="CMS / Pages"
            icon={FileText}
            accent="#f59e0b"
            dark={dark}
            onClick={() => setActive?.("Page/CMS")}       // → case "Page/CMS"
            delay={260}
          />
          <QuickAction
            label="Watermark"
            icon={Droplets}
            accent="#a78bfa"
            dark={dark}
            onClick={() => setActive?.("watermark")}      // → case "watermark"
            delay={300}
          />
        </div>

        {/* ── Recent Activity ── */}
        <div style={{
          background: surface, border: `1px solid ${border}`,
          borderRadius: 18, overflow: "hidden",
          boxShadow: dark ? "0 4px 32px #00000030" : "0 4px 24px #0000000c",
          animation: "fadeUp 0.45s ease both", animationDelay: "340ms",
        }}>
          {/* section header */}
          <div style={{
            padding: "14px 22px", borderBottom: `1px solid ${border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: "#22c55e18",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#22c55e",
              }}>
                <Clock size={13} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: text }}>Recent Activity</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", background: "#22c55e",
                boxShadow: "0 0 0 3px #22c55e33", display: "inline-block",
                animation: "shimmer 2s ease-in-out infinite",
              }} />
              <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>Live</span>
            </div>
          </div>

          {/* skeleton rows */}
          {logLoad && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
              padding: "14px 22px",
              borderBottom: i < 4 ? `1px solid ${border}` : "none",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: dark ? "#1f2d3d" : "#e2e8f0",
                animation: `shimmer 1.4s ease-in-out ${i * 0.1}s infinite`,
              }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
                <div style={{ height: 11, width: "50%", borderRadius: 6, background: dark ? "#1f2d3d" : "#e2e8f0", animation: `shimmer 1.4s ease-in-out ${i*0.1+0.05}s infinite` }} />
                <div style={{ height: 9, width: "22%", borderRadius: 6, background: dark ? "#1f2d3d" : "#e2e8f0", animation: `shimmer 1.4s ease-in-out ${i*0.1+0.1}s infinite` }} />
              </div>
            </div>
          ))}

          {/* empty state */}
          {!logLoad && logs.length === 0 && (
            <div style={{ padding: "40px 22px", textAlign: "center", color: muted, fontSize: 13 }}>
              No activity yet.
            </div>
          )}

          {/* log rows */}
          {!logLoad && logs.map((log, i) => {
            const isErr = isErrorLog(log.content);
            // error logs always get red regardless of their original color
            const rowColor = isErr ? "#ef4444" : log.color;

            return (
              <div
                key={log.id}
                className={isErr ? "log-error-row" : ""}
                style={{
                  padding: "13px 22px",
                  borderBottom: i < logs.length - 1 ? `1px solid ${border}` : "none",
                  display: "flex", alignItems: "center", gap: 12,
                  // error rows get a persistent left-border accent + faint red bg
                  background: isErr
                    ? (dark ? "#ef44440a" : "#fff5f5")
                    : "transparent",
                  borderLeft: isErr ? "3px solid #ef444455" : "3px solid transparent",
                  transition: "background 0.15s",
                  cursor: "default",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = isErr
                    ? (dark ? "#ef444415" : "#fee2e2")
                    : (dark ? "#151f2e" : "#FFFFFF");
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = isErr
                    ? (dark ? "#ef44440a" : "#fff5f5")
                    : "transparent";
                }}
              >
                {/* icon */}
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: rowColor + "20",
                  border: `1px solid ${rowColor}44`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: rowColor,
                }}>
                  {iconFor(log.icon, isErr)}
                </div>

                {/* text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: 0, fontSize: 13, fontWeight: isErr ? 600 : 500,
                    // error content is rendered in red
                    color: isErr ? (dark ? "#fca5a5" : "#dc2626") : text,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {/* highlight the specific error keyword in bold red */}
                    {log.content.split(/\b(error|failed|dmca|report|rejected|denied)\b/gi).map((part, pi) =>
                      /error|failed|dmca|report|rejected|denied/i.test(part)
                        ? <strong key={pi} style={{ color: "#ef4444" }}>{part}</strong>
                        : part
                    )}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: isErr ? "#ef444488" : muted }}>
                    {relTime(log.createdAt)}
                  </p>
                </div>

                {/* badge */}
                <span style={{
                  flexShrink: 0, fontSize: 10, fontWeight: 700,
                  color: rowColor,
                  background: rowColor + "18",
                  border: `1px solid ${rowColor}33`,
                  borderRadius: 20, padding: "2px 9px",
                  textTransform: "uppercase", letterSpacing: "0.07em",
                  whiteSpace: "nowrap",
                }}>
                  {log.who}
                </span>
              </div>
            );
          })}
        </div>

      </div>
    </>
  );
}