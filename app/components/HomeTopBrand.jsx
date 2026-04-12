"use client";

import { useState } from "react";
import { useTheme } from "../context/ThemeContext";

// ── Static mock data ──────────────────────────────────────────────────────────
// 🔁 API swap-in: replace TOP_BRANDS with a fetch call when backend is ready.
// const res = await fetch('/api/brands?sort=popular&limit=12');
// const { brands } = await res.json();

const TOP_BRANDS = [
  { id: 1,  name: "Google"    },
  { id: 2,  name: "Apple"     },
  { id: 3,  name: "Microsoft" },
  { id: 4,  name: "Amazon"    },
  { id: 5,  name: "Meta"      },
  { id: 6,  name: "Tesla"     },
  { id: 7,  name: "Nike"      },
  { id: 8,  name: "Samsung"   },
  { id: 9,  name: "Toyota"    },
  { id: 10, name: "Coca-Cola" },
  { id: 11, name: "Adobe"     },
  { id: 12, name: "Netflix"   },
];

// ── Brand pill ────────────────────────────────────────────────────────────────
function BrandPill({ brand }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`tb-pill${hovered ? " tb-pill--hovered" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {brand.name}
    </div>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────
export default function TopBrands() {
  const { dark } = useTheme();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── Theme tokens ── */
        [data-theme="dark"] {
          --tb-bg:            #09090f;
          --tb-title:         #ffffff;
          --tb-subtitle:      rgba(255,255,255,0.38);
          --tb-pill-bg:       #111118;
          --tb-pill-border:   rgba(255,255,255,0.08);
          --tb-pill-color:    rgba(255,255,255,0.7);
          --tb-pill-bg-h:     #17171f;
          --tb-pill-border-h: rgba(255,255,255,0.18);
          --tb-pill-color-h:  #ffffff;
          --tb-pill-shadow-h: 0 6px 20px rgba(0,0,0,0.4);
        }
        [data-theme="light"] {
          --tb-bg:            #f4f4f8;
          --tb-title:         #0a0a14;
          --tb-subtitle:      rgba(0,0,0,0.42);
          --tb-pill-bg:       #ffffff;
          --tb-pill-border:   rgba(0,0,0,0.08);
          --tb-pill-color:    rgba(0,0,0,0.65);
          --tb-pill-bg-h:     #ffffff;
          --tb-pill-border-h: rgba(99,102,241,0.35);
          --tb-pill-color-h:  #4f46e5;
          --tb-pill-shadow-h: 0 6px 20px rgba(99,102,241,0.1);
        }

        /* ── Section ── */
        .tb-section {
          background: var(--tb-bg);
          font-family: 'Sora', sans-serif;
          padding: 52px 0 60px;
          transition: background 0.35s;
        }
        .tb-container {
          max-width: 1260px;
          margin: 0 auto;
          padding: 0 28px;
        }

        /* ── Header (centered) ── */
        .tb-header {
          text-align: center;
          margin-bottom: 32px;
        }
        .tb-title {
          font-size: 24px;
          font-weight: 800;
          color: var(--tb-title);
          letter-spacing: -0.4px;
          line-height: 1;
          transition: color 0.3s;
        }
        .tb-subtitle {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          color: var(--tb-subtitle);
          margin-top: 7px;
          transition: color 0.3s;
        }

        /* ── Grid ── */
        .tb-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 10px;
        }

        /* ── Pill ── */
        .tb-pill {
          background: var(--tb-pill-bg);
          border: 1px solid var(--tb-pill-border);
          border-radius: 12px;
          padding: 18px 12px;
          text-align: center;
          font-size: 14px;
          font-weight: 600;
          color: var(--tb-pill-color);
          cursor: pointer;
          transition:
            background 0.2s ease,
            border-color 0.2s ease,
            color 0.2s ease,
            transform 0.2s ease,
            box-shadow 0.2s ease;
          user-select: none;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .tb-pill--hovered {
          background: var(--tb-pill-bg-h);
          border-color: var(--tb-pill-border-h);
          color: var(--tb-pill-color-h);
          transform: translateY(-2px);
          box-shadow: var(--tb-pill-shadow-h);
        }

        /* ── Responsive ── */
        @media (max-width: 1024px) { .tb-grid { grid-template-columns: repeat(4, 1fr); } }
        @media (max-width: 640px)  {
          .tb-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; }
          .tb-container { padding: 0 14px; }
          .tb-title { font-size: 20px; }
          .tb-pill { font-size: 13px; padding: 14px 10px; }
        }
        @media (max-width: 400px)  {
          .tb-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

      <section className="tb-section">
        <div className="tb-container">

          <div className="tb-header">
            <h2 className="tb-title">Top Brands</h2>
            <p className="tb-subtitle">Popular brand logos available for download</p>
          </div>

          <div className="tb-grid">
            {TOP_BRANDS.map(brand => (
              <BrandPill key={brand.id} brand={brand} />
            ))}
          </div>

        </div>
      </section>
    </>
  );
}

/* ── API swap-in (uncomment when backend ready) ────────────────────────────────
import { useEffect } from "react";

// Inside TopBrands component:
const [brands, setBrands] = useState([]);

useEffect(() => {
  fetch("/api/brands?sort=popular&limit=12")
    .then(r => r.json())
    .then(data => setBrands(data.brands ?? []))
    .catch(console.error);
}, []);

// Replace TOP_BRANDS with `brands` in the render
─────────────────────────────────────────────────────────────────────────────── */