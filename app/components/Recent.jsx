"use client";

import { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { useRouter } from "next/navigation";

function gradientFromColors(colors, dark) {
  if (dark) {
    // Always neutral dark gray/black in dark mode, ignore brand colors
    return { bgFrom: "#1a1a1f", bgTo: "#0a0a0d" };
  }

  if (colors?.length >= 2) {
    return {
      bgFrom: `${colors[0]}22`,
      bgTo: `${colors[1]}22`,
    };
  }
  if (colors?.length === 1) {
    return {
      bgFrom: `${colors[0]}22`,
      bgTo: "#f8fafc",
    };
  }
  return { bgFrom: "#f1f5f9", bgTo: "#e2e8f0" };
}

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins   = Math.floor(diffMs / 60000);
  const hours  = Math.floor(mins / 60);
  const days   = Math.floor(hours / 24);

  if (mins   < 1)  return "just now";
  if (mins   < 60) return `${mins}m ago`;
  if (hours  < 24) return `${hours}h ago`;
  if (days   < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function SkeletonCard() {
  return (
    <div className="rl-card">
      <div className="rl-preview rl-skeleton-preview" />
      <div className="rl-body">
        <div className="rl-sk rl-sk-name" />
        <div className="rl-sk rl-sk-cat" />
      </div>
    </div>
  );
}

function RecentCard({ logo, dark }) {
  const [hovered, setHovered] = useState(false);
  const [imgErr, setImgErr]   = useState(false);
  const { bgFrom, bgTo } = gradientFromColors(logo.brandColors, dark);
  const router = useRouter();

  return (
    <div
      className={`rl-card${hovered ? " rl-card--hovered" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        e.preventDefault();
        router.push(`/logo/${logo.slug}`);
      }}
    >
      <div
        className="rl-preview"
        style={{ background: `linear-gradient(145deg, ${bgFrom}, ${bgTo})` }}
      >
        <div className="rl-badge">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          NEW
        </div>

        {!imgErr && logo.webpUrl
          ? <img
              src={logo.webpUrl}
              alt={logo.logoName}
              onError={() => setImgErr(true)}
              className="rl-logo-img"
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
            />
          : <span className="rl-brand-name">{logo.logoName}</span>
        }
      </div>

      <div className="rl-body">
        <div className="rl-title-row">
          <span className="rl-name">{logo.logoName}</span>
        </div>
        <div className="rl-meta-row">
          <span className="rl-category">{logo.category?.[0]}</span>
          <span className="rl-time">{timeAgo(logo.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

export default function RecentLogos() {
  const { dark } = useTheme();
  const [logos,   setLogos]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    fetch("/api/logo/fetch/recent")
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => { setLogos(data.logos ?? []); setLoading(false); })
      .catch(err => { setError(String(err)); setLoading(false); });
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&family=DM+Sans:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

        [data-theme="dark"]{
          --rl-bg:#09090f;--rl-surface:#111118;
          --rl-border:rgba(255,255,255,0.07);--rl-border-h:rgba(255,255,255,0.14);
          --rl-title:#ffffff;--rl-subtitle:rgba(255,255,255,0.38);
          --rl-name:#e8e8f0;--rl-category:rgba(255,255,255,0.35);--rl-time:rgba(255,255,255,0.3);
          --rl-sk:rgba(255,255,255,0.07);
        }
        [data-theme="light"]{
          --rl-bg:#f4f4f8;--rl-surface:#ffffff;
          --rl-border:rgba(0,0,0,0.07);--rl-border-h:rgba(0,0,0,0.14);
          --rl-title:#0a0a14;--rl-subtitle:rgba(0,0,0,0.42);
          --rl-name:#111120;--rl-category:rgba(0,0,0,0.42);--rl-time:rgba(0,0,0,0.35);
          --rl-sk:rgba(0,0,0,0.07);
        }

        .rl-section{background:var(--rl-bg);font-family:'Sora',sans-serif;padding:48px 0 56px;transition:background .35s}
        .rl-container{max-width:1260px;margin:0 auto;padding:0 28px}

        .rl-header{margin-bottom:24px}
        .rl-title{font-size:24px;font-weight:800;color:var(--rl-title);letter-spacing:-.4px;line-height:1;transition:color .3s}
        .rl-subtitle{font-family:'DM Sans',sans-serif;font-size:13px;color:var(--rl-subtitle);margin-top:5px;transition:color .3s}

        .rl-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:14px}

        .rl-card{background:var(--rl-surface);border:1px solid var(--rl-border);border-radius:16px;overflow:hidden;cursor:pointer;transition:border-color .22s,transform .22s,box-shadow .22s}
        .rl-card--hovered{border-color:var(--rl-border-h);transform:translateY(-4px);box-shadow:0 16px 40px rgba(0,0,0,.25)}
        [data-theme="dark"] .rl-card--hovered{box-shadow:0 16px 40px rgba(0,0,0,.55)}

        .rl-preview{position:relative;height:160px;display:flex;align-items:center;justify-content:center;overflow:hidden}
        .rl-logo-img{width:100%;height:100%;object-fit:contain;padding:20px}

        .rl-badge{position:absolute;top:10px;left:10px;display:inline-flex;align-items:center;gap:4px;padding:3px 8px;background:rgba(59,130,246,0.85);border-radius:100px;font-size:8.5px;font-weight:700;letter-spacing:.6px;color:#fff}

        .rl-brand-name{font-size:clamp(18px,2.5vw,26px);font-weight:900;color:rgba(255,255,255,.82);letter-spacing:-1px;text-align:center;padding:0 12px;line-height:1.1;text-shadow:0 2px 16px rgba(0,0,0,.4);user-select:none}

        .rl-body{padding:10px 12px 12px}
        .rl-title-row{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px}
        .rl-name{font-size:13px;font-weight:800;color:var(--rl-name);letter-spacing:-.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .3s}
        .rl-meta-row{display:flex;align-items:center;justify-content:space-between}
        .rl-category{font-family:'DM Sans',sans-serif;font-size:10.5px;color:var(--rl-category);transition:color .3s}
        .rl-time{font-family:'DM Sans',sans-serif;font-size:10px;color:var(--rl-time);transition:color .3s}

        @keyframes shimmer{0%{opacity:1}50%{opacity:.4}100%{opacity:1}}
        .rl-skeleton-preview{background:var(--rl-sk);animation:shimmer 1.6s infinite linear}
        .rl-sk{background:var(--rl-sk);border-radius:5px;animation:shimmer 1.6s infinite linear}
        .rl-sk-name{height:10px;width:65%;margin-bottom:8px}
        .rl-sk-cat{height:8px;width:40%}

        .rl-error{text-align:center;padding:40px;color:#f87171;font-size:13px}

        @media(max-width:1100px){.rl-grid{grid-template-columns:repeat(4,1fr)}}
        @media(max-width:820px){.rl-grid{grid-template-columns:repeat(3,1fr);gap:10px}.rl-preview{height:130px}}
        @media(max-width:560px){.rl-grid{grid-template-columns:repeat(2,1fr);gap:8px}.rl-container{padding:0 14px}.rl-title{font-size:20px}.rl-preview{height:115px}}
      `}</style>

      <section className="rl-section">
        <div className="rl-container">
          <div className="rl-header">
            <h2 className="rl-title">Recent Logos</h2>
            <p className="rl-subtitle">Freshly uploaded to the library</p>
          </div>

          {error ? (
            <div className="rl-error">Failed to load recent logos.</div>
          ) : (
            <div className="rl-grid">
              {loading
                ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
                : logos.map(logo => <RecentCard key={logo.id} logo={logo} dark={dark} />)
              }
            </div>
          )}
        </div>
      </section>
    </>
  );
}