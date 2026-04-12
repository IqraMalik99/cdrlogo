"use client";

import { useState } from "react";
import { useTheme } from "../context/ThemeContext";

const TRENDING_LOGOS = [
  {
    id: 1,
    name: "TechNova",
    category: "Technology",
    colors: ["#3b82f6", "#94a3b8", "#1e293b"],
    formats: ["AI", "SVG", "PNG"],
    bgFrom: "#1a1f3a",
    bgTo: "#0f1221",
  },
  {
    id: 2,
    name: "VeloCity",
    category: "Automotive",
    colors: ["#ef4444", "#ffffff"],
    formats: ["AI", "SVG", "PNG"],
    bgFrom: "#1e1a2e",
    bgTo: "#110f1e",
  },
  {
    id: 3,
    name: "AuraBank",
    category: "Finance",
    colors: ["#07A626", "#34d058", "#05891e"],
    formats: ["AI", "SVG", "PNG"],
    bgFrom: "#0f1e12",
    bgTo: "#080f0a",
  },
  {
    id: 4,
    name: "CrownRoyal",
    category: "Fashion",
    colors: ["#f59e0b", "#ffffff"],
    formats: ["AI", "SVG", "PNG"],
    bgFrom: "#1e1a10",
    bgTo: "#110f08",
  },
  {
    id: 5,
    name: "PixelForge",
    category: "Gaming",
    colors: ["#ec4899", "#f472b6"],
    formats: ["AI", "SVG", "PNG"],
    bgFrom: "#221535",
    bgTo: "#120b1e",
  },
];

const FORMAT_COLORS = {
  AI:  { bg: "rgba(234,179,8,.12)",  border: "rgba(234,179,8,.3)",  color: "#fde68a", colorLight: "#92400e" },
  SVG: { bg: "rgba(34,197,94,.12)",  border: "rgba(34,197,94,.3)",  color: "#86efac", colorLight: "#166534" },
  PNG: { bg: "rgba(59,130,246,.12)", border: "rgba(59,130,246,.3)", color: "#93c5fd", colorLight: "#1e40af" },
};

function TrendingCard({ logo, dark }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`tl-card${hovered ? " tl-card--hovered" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="tl-preview"
        style={{ background: `linear-gradient(145deg, ${logo.bgFrom}, ${logo.bgTo})` }}
      >
        <div className="tl-badge">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
            <polyline points="17 6 23 6 23 12"/>
          </svg>
          TRENDING
        </div>
        <span className="tl-brand-name">{logo.name}</span>
      </div>

      <div className="tl-body">
        <div className="tl-title-row">
          <span className="tl-name">{logo.name}</span>
        </div>

        <div className="tl-meta-row">
          <span className="tl-category">{logo.category}</span>
          <div className="tl-colors">
            {logo.colors.map((c, i) => (
              <span key={i} className="tl-dot" style={{ background: c }} />
            ))}
          </div>
        </div>

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

export default function TrendingLogos() {
  const { dark } = useTheme();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&family=DM+Sans:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        [data-theme="dark"] {
          --tl-bg:          #09090f;
          --tl-surface:     #111118;
          --tl-border:      rgba(255,255,255,0.07);
          --tl-border-h:    rgba(255,255,255,0.14);
          --tl-title:       #ffffff;
          --tl-subtitle:    rgba(255,255,255,0.38);
          --tl-name:        #e8e8f0;
          --tl-category:    rgba(255,255,255,0.35);
          --tl-dot-border:  rgba(255,255,255,0.15);
          --tl-view-color:  #4ade80;
          --tl-view-hover:  #86efac;
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
          --tl-dot-border:  rgba(0,0,0,0.12);
          --tl-view-color:  #07A626;
          --tl-view-hover:  #05891e;
        }

        .tl-section {
          background: var(--tl-bg);
          font-family: 'Sora', sans-serif;
          padding: 48px 0 56px;
          transition: background 0.35s;
        }
        .tl-container { max-width: 1260px; margin: 0 auto; padding: 0 28px; }

        .tl-header {
          display: flex; align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        .tl-title    { font-size: 24px; font-weight: 800; color: var(--tl-title); letter-spacing: -0.4px; line-height: 1; transition: color 0.3s; }
        .tl-subtitle { font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--tl-subtitle); margin-top: 5px; transition: color 0.3s; }
        .tl-viewall  {
          display: flex; align-items: center; gap: 5px;
          font-size: 13px; font-weight: 600;
          color: var(--tl-view-color);
          cursor: pointer; border: none; background: none;
          font-family: 'Sora', sans-serif;
          transition: color 0.2s;
          white-space: nowrap; padding-top: 2px;
        }
        .tl-viewall:hover { color: var(--tl-view-hover); }
        .tl-viewall svg { transition: transform 0.2s; }
        .tl-viewall:hover svg { transform: translateX(3px); }

        .tl-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 14px;
        }

        .tl-card {
          background: var(--tl-surface);
          border: 1px solid var(--tl-border);
          border-radius: 16px; overflow: hidden; cursor: pointer;
          transition: border-color 0.22s, transform 0.22s, box-shadow 0.22s;
        }
        .tl-card--hovered {
          border-color: var(--tl-border-h);
          transform: translateY(-4px);
          box-shadow: 0 16px 40px rgba(0,0,0,0.25);
        }
        [data-theme="dark"] .tl-card--hovered { box-shadow: 0 16px 40px rgba(0,0,0,0.55); }

        .tl-preview {
          position: relative; height: 180px;
          display: flex; align-items: center; justify-content: center; overflow: hidden;
        }

        .tl-badge {
          position: absolute; top: 12px; left: 12px;
          display: inline-flex; align-items: center; gap: 4px;
          padding: 4px 10px;
          background: rgba(7,166,38,0.85);
          border-radius: 100px;
          font-size: 9px; font-weight: 700; letter-spacing: 0.6px; color: #fff;
        }

        .tl-brand-name {
          font-size: clamp(22px, 3.5vw, 30px); font-weight: 900;
          color: rgba(255,255,255,0.82); letter-spacing: -1px;
          text-align: center; padding: 0 12px; line-height: 1.1;
          text-shadow: 0 2px 16px rgba(0,0,0,0.4); user-select: none;
        }

        .tl-body { padding: 12px 14px 14px; }

        .tl-title-row {
          display: flex; align-items: center;
          justify-content: space-between; gap: 6px;
          margin-bottom: 4px;
        }
        .tl-name {
          font-size: 15px; font-weight: 800;
          color: var(--tl-name); letter-spacing: -0.3px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          transition: color 0.3s;
        }

        .tl-meta-row {
          display: flex; align-items: center;
          justify-content: space-between; margin-bottom: 10px;
        }
        .tl-category {
          font-family: 'DM Sans', sans-serif;
          font-size: 11.5px; color: var(--tl-category); transition: color 0.3s;
        }
        .tl-colors { display: flex; gap: 5px; }
        .tl-dot { width: 11px; height: 11px; border-radius: 50%; border: 1.5px solid var(--tl-dot-border); flex-shrink: 0; }

        .tl-formats { display: flex; flex-wrap: wrap; gap: 4px; }
        .tl-fmt {
          padding: 2px 7px; border-radius: 4px;
          font-size: 9.5px; font-weight: 700; letter-spacing: 0.3px;
          border: 1px solid; transition: color 0.3s;
        }

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
          <div className="tl-header">
            <div>
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