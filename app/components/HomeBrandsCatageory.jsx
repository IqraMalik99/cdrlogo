"use client";

import { useState } from "react";
import { useTheme } from "../context/ThemeContext";

// ── Static data ───────────────────────────────────────────────────────────────
// 🔁 When backend is ready, replace BRAND_CATEGORIES with an API call:
// const [categories, setCategories] = useState([]);
// useEffect(() => { fetch('/api/brand-categories').then(r=>r.json()).then(setCategories); }, []);

const BRAND_CATEGORIES = [
  { id: 1,  name: "Technology & Digital",         count: 2840, icon: "monitor"     },
  { id: 2,  name: "Automotive & Transport",        count: 1560, icon: "car"         },
  { id: 3,  name: "Fashion & Lifestyle",           count: 2100, icon: "shirt"       },
  { id: 4,  name: "Food & Beverages",              count: 1890, icon: "coffee"      },
  { id: 5,  name: "Finance, Fintech & Insurance",  count: 1340, icon: "bank"        },
  { id: 6,  name: "Media & Entertainment",         count: 1720, icon: "film"        },
  { id: 7,  name: "E-commerce & Retail",           count: 2050, icon: "cart"        },
  { id: 8,  name: "Social Media & Networking",     count: 980,  icon: "share"       },
  { id: 9,  name: "Sports & Fitness",              count: 1150, icon: "fitness"     },
  { id: 10, name: "Travel & Hospitality",          count: 870,  icon: "plane"       },
];

// ── SVG Icons (matching the blue outlined style in the screenshot) ────────────
const ICONS = {
  monitor: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  ),
  car: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-4h10l2 4h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/>
      <circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/>
      <line x1="9" y1="17" x2="15" y2="17"/>
    </svg>
  ),
  shirt: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/>
    </svg>
  ),
  coffee: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
      <line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>
    </svg>
  ),
  bank: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/>
      <line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/>
      <polygon points="12 2 20 7 4 7"/>
    </svg>
  ),
  film: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/>
      <line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/>
      <line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/>
      <line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>
    </svg>
  ),
  cart: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  ),
  share: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  ),
  fitness: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4Z"/>
      <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
    </svg>
  ),
  plane: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
    </svg>
  ),
};

// ── Card ──────────────────────────────────────────────────────────────────────
function BrandCard({ cat, index, dark }) {
  const [hovered, setHovered] = useState(false);

  // Dark: keep the existing deep navy look + subtle blue tint on hover
  // Light: white card, blue accent tint on hover
  const cardHoverStyle = dark
    ? { background: "rgba(99,102,241,0.1)", borderColor: "rgba(99,102,241,0.35)" }
    : { background: "rgba(99,102,241,0.06)", borderColor: "rgba(99,102,241,0.28)", boxShadow: "0 8px 28px rgba(99,102,241,0.1)" };

  return (
    <div
      className="bc-card"
      style={{
        animationDelay: `${index * 50}ms`,
        ...(hovered ? cardHoverStyle : {}),
        ...(hovered ? { transform: "translateY(-3px)" } : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Icon box */}
      <div className={`bc-icon${hovered ? " bc-icon--hovered" : ""}`}>
        {ICONS[cat.icon]}
      </div>

      {/* Text */}
      <div className="bc-info">
        <span className={`bc-name${hovered ? " bc-name--hovered" : ""}`}>
          {cat.name}
        </span>
        <span className="bc-count">{cat.count.toLocaleString()} logos</span>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function BrandCategories() {
  const { dark } = useTheme();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── Theme tokens ── */
        [data-theme="dark"] {
          --bc-bg:           #09090f;
          --bc-surface:      #111118;
          --bc-border:       rgba(255,255,255,0.07);
          --bc-title:        #ffffff;
          --bc-subtitle:     rgba(255,255,255,0.38);
          --bc-name:         #e0e0f0;
          --bc-count:        rgba(255,255,255,0.35);
          --bc-icon-bg:      rgba(99,102,241,0.15);
          --bc-icon-border:  rgba(99,102,241,0.25);
          --bc-icon-color:   #818cf8;
        }
        [data-theme="light"] {
          --bc-bg:           #f4f4f8;
          --bc-surface:      #ffffff;
          --bc-border:       rgba(0,0,0,0.07);
          --bc-title:        #0a0a14;
          --bc-subtitle:     rgba(0,0,0,0.42);
          --bc-name:         #111120;
          --bc-count:        rgba(0,0,0,0.42);
          --bc-icon-bg:      rgba(99,102,241,0.1);
          --bc-icon-border:  rgba(99,102,241,0.18);
          --bc-icon-color:   #6366f1;
        }

        /* ── Layout ── */
        .bc-section {
          background: var(--bc-bg);
          font-family: 'Sora', sans-serif;
          padding: 48px 0 56px;
          transition: background 0.35s;
        }
        .bc-container { max-width: 1260px; margin: 0 auto; padding: 0 28px; }

        /* ── Header ── */
        .bc-header { margin-bottom: 28px; }
        .bc-title    { font-size: 24px; font-weight: 800; color: var(--bc-title); letter-spacing: -0.4px; line-height: 1; transition: color 0.3s; }
        .bc-subtitle { font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--bc-subtitle); margin-top: 6px; transition: color 0.3s; }

        /* ── Grid ── */
        .bc-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 14px;
        }

        /* ── Card ── */
        .bc-card {
          position: relative;
          background: var(--bc-surface);
          border: 1px solid var(--bc-border);
          border-radius: 14px;
          padding: 20px 18px 18px;
          cursor: pointer;
          transition: background 0.22s ease, border-color 0.22s ease, transform 0.22s ease, box-shadow 0.22s ease;
          animation: bcFadeUp 0.4s ease both;
        }
        @keyframes bcFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Icon box ── */
        .bc-icon {
          width: 46px; height: 46px;
          border-radius: 10px;
          background: var(--bc-icon-bg);
          border: 1px solid var(--bc-icon-border);
          color: var(--bc-icon-color);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 28px;
          transition: background 0.22s, border-color 0.22s, color 0.22s;
        }
        .bc-icon--hovered {
          background: rgba(99,102,241,0.22);
          border-color: rgba(99,102,241,0.45);
          color: #a5b4fc;
        }
        [data-theme="light"] .bc-icon--hovered {
          background: rgba(99,102,241,0.14);
          border-color: rgba(99,102,241,0.35);
          color: #4f46e5;
        }

        /* ── Text ── */
        .bc-info  { display: flex; flex-direction: column; gap: 4px; }
        .bc-name  {
          font-size: 14px; font-weight: 700;
          color: var(--bc-name);
          letter-spacing: -0.2px; line-height: 1.3;
          transition: color 0.22s;
        }
        .bc-name--hovered { color: #818cf8; }
        [data-theme="light"] .bc-name--hovered { color: #4f46e5; }

        .bc-count {
          font-family: 'DM Sans', sans-serif;
          font-size: 12px; color: var(--bc-count);
          transition: color 0.3s;
        }

        /* ── Responsive ── */
        @media (max-width: 1100px) { .bc-grid { grid-template-columns: repeat(4, 1fr); } }
        @media (max-width: 820px)  {
          .bc-grid { grid-template-columns: repeat(3, 1fr); gap: 10px; }
          .bc-card { padding: 16px 14px; }
          .bc-icon { width: 40px; height: 40px; margin-bottom: 20px; }
          .bc-name { font-size: 13px; }
        }
        @media (max-width: 520px)  {
          .bc-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .bc-container { padding: 0 14px; }
          .bc-title { font-size: 20px; }
        }
      `}</style>

      <section className="bc-section">
        <div className="bc-container">

          <div className="bc-header">
            <h2 className="bc-title">Brand Categories</h2>
            <p className="bc-subtitle">Explore logos by brand industry</p>
          </div>

          <div className="bc-grid">
            {BRAND_CATEGORIES.map((cat, i) => (
              <BrandCard key={cat.id} cat={cat} index={i} dark={dark} />
            ))}
          </div>

        </div>
      </section>
    </>
  );
}

/* ── API swap-in (uncomment when backend ready) ──────────────────────────────
import { useEffect } from "react";

export default function BrandCategories() {
  const { dark } = useTheme();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/brand-categories")
      .then(r => r.json())
      .then(data => { setCategories(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return null; // or a skeleton
  // replace BRAND_CATEGORIES with `categories` in the render
}
──────────────────────────────────────────────────────────────────────────── */