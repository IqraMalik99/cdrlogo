"use client";

import { useState } from "react";
import { useTheme } from "../context/ThemeContext";

// ── Static mock data ──────────────────────────────────────────────────────────
// 🔁 API swap-in: replace TRENDING_LOGOS with a fetch call when backend is ready.
// const res = await fetch('/api/logos?sort=popular&trending=true&limit=5');
// const { logos } = await res.json();

const TRENDING_LOGOS = [
  {
    id: 1,
    name: "TechNova",
    category: "Technology",
    downloads: 12453,
    colors: ["#3b82f6", "#94a3b8", "#1e293b"],
    formats: ["AI", "CDR", "EPS", "SVG", "PNG"],
    bgFrom: "#1a1f3a",
    bgTo: "#0f1221",
  },
  {
    id: 2,
    name: "VeloCity",
    category: "Automotive",
    downloads: 8932,
    colors: ["#ef4444", "#ffffff"],
    formats: ["AI", "CDR", "EPS", "SVG", "PNG"],
    bgFrom: "#1e1a2e",
    bgTo: "#110f1e",
  },
  {
    id: 3,
    name: "AuraBank",
    category: "Finance",
    downloads: 15678,
    colors: ["#a855f7", "#8b5cf6", "#6d28d9"],
    formats: ["AI", "CDR", "EPS", "SVG", "PNG"],
    bgFrom: "#1a1535",
    bgTo: "#0d0b1e",
  },
  {
    id: 4,
    name: "CrownRoyal",
    category: "Fashion",
    downloads: 11234,
    colors: ["#f59e0b", "#ffffff"],
    formats: ["AI", "CDR", "EPS", "SVG", "PNG"],
    bgFrom: "#1e1a10",
    bgTo: "#110f08",
  },
  {
    id: 5,
    name: "PixelForge",
    category: "Gaming",
    downloads: 9876,
    colors: ["#ec4899", "#f472b6"],
    formats: ["AI", "CDR", "EPS", "SVG", "PNG"],
    bgFrom: "#221535",
    bgTo: "#120b1e",
  },
];

const FORMAT_COLORS = {
  AI:  { bg: "rgba(234,179,8,.12)",  border: "rgba(234,179,8,.3)",  color: "#fde68a", colorLight: "#92400e" },
  CDR: { bg: "rgba(239,68,68,.12)",  border: "rgba(239,68,68,.3)",  color: "#fca5a5", colorLight: "#991b1b" },
  EPS: { bg: "rgba(249,115,22,.12)", border: "rgba(249,115,22,.3)", color: "#fdba74", colorLight: "#9a3412" },
  SVG: { bg: "rgba(34,197,94,.12)",  border: "rgba(34,197,94,.3)",  color: "#86efac", colorLight: "#166534" },
  PNG: { bg: "rgba(59,130,246,.12)", border: "rgba(59,130,246,.3)", color: "#93c5fd", colorLight: "#1e40af" },
};

// ── Logo card ─────────────────────────────────────────────────────────────────
function TrendingCard({ logo, dark }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`tl-card${hovered ? " tl-card--hovered" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Gradient preview area */}
      <div
        className="tl-preview"
        style={{ background: `linear-gradient(145deg, ${logo.bgFrom}, ${logo.bgTo})` }}
      >
        {/* Trending badge */}
        <div className="tl-badge">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
            <polyline points="17 6 23 6 23 12"/>
          </svg>
          TRENDING
        </div>

        {/* Big brand name */}
        <span className="tl-brand-name">{logo.name}</span>
      </div>

      {/* Card body */}
      <div className="tl-body">
        {/* Title row */}
        <div className="tl-title-row">
          <span className="tl-name">{logo.name}</span>
          <span className="tl-downloads">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {Number(logo.downloads).toLocaleString()}
          </span>
        </div>

        {/* Category + colors */}
        <div className="tl-meta-row">
          <span className="tl-category">{logo.category}</span>
          <div className="tl-colors">
            {logo.colors.map((c, i) => (
              <span key={i} className="tl-dot" style={{ background: c }} />
            ))}
          </div>
        </div>

        {/* Format tags */}
        <div className="tl-formats">
          {logo.formats.map(f => {
            const fc = FORMAT_COLORS[f];
            return (
              <span
                key={f}
                className="tl-fmt"
                style={{
                  background: fc.bg,
                  borderColor: fc.border,
                  color: dark ? fc.color : fc.colorLight,
                }}
              >
                {f}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────
export default function TrendingLogos() {
  const { dark } = useTheme();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&family=DM+Sans:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── Theme tokens ── */
        [data-theme="dark"] {
          --tl-bg:          #09090f;
          --tl-surface:     #111118;
          --tl-border:      rgba(255,255,255,0.07);
          --tl-border-h:    rgba(255,255,255,0.14);
          --tl-title:       #ffffff;
          --tl-subtitle:    rgba(255,255,255,0.38);
          --tl-name:        #e8e8f0;
          --tl-category:    rgba(255,255,255,0.35);
          --tl-dl-color:    rgba(255,255,255,0.4);
          --tl-dot-border:  rgba(255,255,255,0.15);
          --tl-view-color:  #818cf8;
          --tl-view-hover:  #a5b4fc;
        }
        [data-theme="light"] {
          --tl-bg:          #f4f4f8;
          --tl-surface:     #ffffff;
          --tl-border:      rgba(0,0,0,0.07);
          --tl-border-h:    rgba(0,0,0,0.14);
          --tl-title:       #0a0a14;
          --tl-subtitle:    rgba(0,0,0,0.42);
          --tl-name:        #111120;
          --tl-category:    rgba(0,0,0,0.42);
          --tl-dl-color:    rgba(0,0,0,0.4);
          --tl-dot-border:  rgba(0,0,0,0.12);
          --tl-view-color:  #6366f1;
          --tl-view-hover:  #4f46e5;
        }

        /* ── Section ── */
        .tl-section {
          background: var(--tl-bg);
          font-family: 'Sora', sans-serif;
          padding: 48px 0 56px;
          transition: background 0.35s;
        }
        .tl-container { max-width: 1260px; margin: 0 auto; padding: 0 28px; }

        /* ── Header ── */
        .tl-header {
          display: flex; align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        .tl-header-left {}
        .tl-title    { font-size: 24px; font-weight: 800; color: var(--tl-title); letter-spacing: -0.4px; line-height: 1; transition: color 0.3s; }
        .tl-subtitle { font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--tl-subtitle); margin-top: 5px; transition: color 0.3s; }
        .tl-viewall  {
          display: flex; align-items: center; gap: 5px;
          font-size: 13px; font-weight: 600;
          color: var(--tl-view-color);
          cursor: pointer; border: none; background: none;
          font-family: 'Sora', sans-serif;
          transition: color 0.2s;
          white-space: nowrap;
          padding-top: 2px;
        }
        .tl-viewall:hover { color: var(--tl-view-hover); }
        .tl-viewall svg { transition: transform 0.2s; }
        .tl-viewall:hover svg { transform: translateX(3px); }

        /* ── Grid: 5 equal columns ── */
        .tl-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 14px;
        }

        /* ── Card ── */
        .tl-card {
          background: var(--tl-surface);
          border: 1px solid var(--tl-border);
          border-radius: 16px;
          overflow: hidden;
          cursor: pointer;
          transition: border-color 0.22s, transform 0.22s, box-shadow 0.22s;
        }
        .tl-card--hovered {
          border-color: var(--tl-border-h);
          transform: translateY(-4px);
          box-shadow: 0 16px 40px rgba(0,0,0,0.25);
        }
        [data-theme="dark"] .tl-card--hovered {
          box-shadow: 0 16px 40px rgba(0,0,0,0.55);
        }

        /* ── Preview area ── */
        .tl-preview {
          position: relative;
          height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        /* Trending badge */
        .tl-badge {
          position: absolute; top: 12px; left: 12px;
          display: inline-flex; align-items: center; gap: 4px;
          padding: 4px 10px;
          background: linear-gradient(135deg, #7c3aed, #9333ea);
          border-radius: 100px;
          font-size: 9px; font-weight: 700; letter-spacing: 0.6px;
          color: #fff;
        }

        /* Big brand name in preview */
        .tl-brand-name {
          font-size: clamp(22px, 3.5vw, 30px);
          font-weight: 900;
          color: rgba(255,255,255,0.82);
          letter-spacing: -1px;
          text-align: center;
          padding: 0 12px;
          line-height: 1.1;
          text-shadow: 0 2px 16px rgba(0,0,0,0.4);
          user-select: none;
        }

        /* ── Body ── */
        .tl-body { padding: 12px 14px 14px; }

        .tl-title-row {
          display: flex; align-items: center;
          justify-content: space-between; gap: 6px;
          margin-bottom: 4px;
        }
        .tl-name {
          font-size: 13.5px; font-weight: 700;
          color: var(--tl-name);
          letter-spacing: -0.2px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          transition: color 0.3s;
        }
        .tl-downloads {
          display: flex; align-items: center; gap: 3px;
          font-size: 11px; font-weight: 500;
          color: var(--tl-dl-color);
          white-space: nowrap; flex-shrink: 0;
          transition: color 0.3s;
        }

        .tl-meta-row {
          display: flex; align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .tl-category {
          font-family: 'DM Sans', sans-serif;
          font-size: 11.5px; color: var(--tl-category);
          transition: color 0.3s;
        }
        .tl-colors { display: flex; gap: 5px; }
        .tl-dot {
          width: 11px; height: 11px; border-radius: 50%;
          border: 1.5px solid var(--tl-dot-border);
          flex-shrink: 0;
        }

        /* Format tags */
        .tl-formats { display: flex; flex-wrap: wrap; gap: 4px; }
        .tl-fmt {
          padding: 2px 7px; border-radius: 4px;
          font-size: 9.5px; font-weight: 700; letter-spacing: 0.3px;
          border: 1px solid; transition: color 0.3s;
        }

        /* ── Responsive ── */
        @media (max-width: 1100px) { .tl-grid { grid-template-columns: repeat(4, 1fr); } }
        @media (max-width: 820px)  {
          .tl-grid { grid-template-columns: repeat(3, 1fr); gap: 10px; }
          .tl-preview { height: 150px; }
          .tl-brand-name { font-size: 22px; }
        }
        @media (max-width: 560px)  {
          .tl-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .tl-container { padding: 0 14px; }
          .tl-title { font-size: 20px; }
          .tl-preview { height: 130px; }
        }
      `}</style>

      <section className="tl-section">
        <div className="tl-container">

          {/* Header */}
          <div className="tl-header">
            <div className="tl-header-left">
              <h2 className="tl-title">Trending Logos</h2>
              <p className="tl-subtitle">Most downloaded this week</p>
            </div>
            <button className="tl-viewall">
              View All
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          </div>

          {/* Cards */}
          <div className="tl-grid">
            {TRENDING_LOGOS.map(logo => (
              <TrendingCard key={logo.id} logo={logo} dark={dark} />
            ))}
          </div>

        </div>
      </section>
    </>
  );
}

/* ── API swap-in (uncomment when backend ready) ────────────────────────────────
import { useEffect } from "react";

// Inside TrendingLogos component:
const [logos, setLogos] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetch("/api/logos?sort=popular&trending=true&limit=5")
    .then(r => r.json())
    .then(data => { setLogos(data.logos ?? []); setLoading(false); })
    .catch(() => setLoading(false));
}, []);

// Replace TRENDING_LOGOS with `logos` in the render
// Add a loading skeleton if desired
─────────────────────────────────────────────────────────────────────────────── */