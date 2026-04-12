"use client";

import { useState } from "react";
import { useTheme } from "../context/ThemeContext";

const CATEGORIES = [
  { id: 1,  name: "Business & Corporate",      count: 3200, icon: "💼", accent: "#07A626", rgb: "7,166,38"     },
  { id: 2,  name: "Technology & Digital",       count: 2750, icon: "🖥️", accent: "#22d3ee", rgb: "34,211,238"  },
  { id: 3,  name: "Food & Restaurant",          count: 1980, icon: "🍴", accent: "#f97316", rgb: "249,115,22"  },
  { id: 4,  name: "E-commerce & Retail",        count: 1650, icon: "🛒", accent: "#34d399", rgb: "52,211,153"  },
  { id: 5,  name: "Health & Wellness",          count: 1420, icon: "💗", accent: "#f472b6", rgb: "244,114,182" },
  { id: 6,  name: "Real Estate & Construction", count: 1890, icon: "🏗️", accent: "#fbbf24", rgb: "251,191,36"  },
  { id: 7,  name: "Education & Learning",       count: 1100, icon: "🎓", accent: "#07A626", rgb: "7,166,38"    },
  { id: 8,  name: "Sports & Fitness",           count: 950,  icon: "⚡", accent: "#fb7185", rgb: "251,113,133" },
  { id: 9,  name: "Luxury & Lifestyle",         count: 1340, icon: "💎", accent: "#e879f9", rgb: "232,121,249" },
  { id: 10, name: "Abstract & Geometric",       count: 2100, icon: "⬡", accent: "#67e8f9", rgb: "103,232,249" },
];

function CategoryCard({ cat, index, dark }) {
  const [hovered, setHovered] = useState(false);

  const hoverBg     = dark ? `rgba(${cat.rgb},0.14)` : `rgba(${cat.rgb},0.08)`;
  const hoverBorder = dark ? `rgba(${cat.rgb},0.45)` : `rgba(${cat.rgb},0.32)`;
  const hoverShadow = dark
    ? `0 16px 40px rgba(${cat.rgb},0.18)`
    : `0 10px 28px rgba(${cat.rgb},0.13)`;
  const iconBg     = dark ? `rgba(${cat.rgb},0.14)` : `rgba(${cat.rgb},0.1)`;
  const iconBorder = dark ? `rgba(${cat.rgb},0.35)` : `rgba(${cat.rgb},0.25)`;

  const cardStyle = hovered
    ? { background: hoverBg, borderColor: hoverBorder, transform: "translateY(-4px)", boxShadow: hoverShadow }
    : {};

  const iconStyle = hovered ? { background: iconBg, borderColor: iconBorder } : {};

  return (
    <div
      className="cat-card"
      style={{ ...cardStyle, animationDelay: `${index * 55}ms` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="cat-icon" style={iconStyle}>
        <span className="cat-emoji">{cat.icon}</span>
      </div>

      <div className="cat-info">
        <span className="cat-name" style={hovered ? { color: cat.accent } : {}}>
          {cat.name}
        </span>
        <span className="cat-count">{cat.count.toLocaleString()} templates</span>
      </div>

      {hovered && <div className="cat-glow" style={{ background: cat.accent }} />}
    </div>
  );
}

export default function TemplateCategories() {
  const { dark } = useTheme();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        [data-theme="dark"] {
          --tc-bg:          #09090f;
          --tc-surface:     #111118;
          --tc-border:      rgba(255,255,255,0.07);
          --tc-title:       #ffffff;
          --tc-subtitle:    rgba(255,255,255,0.38);
          --tc-name:        #e8e8f0;
          --tc-count:       rgba(255,255,255,0.35);
          --tc-icon-bg:     rgba(255,255,255,0.05);
          --tc-icon-border: rgba(255,255,255,0.08);
        }
        [data-theme="light"] {
          --tc-bg:          #f4f4f8;
          --tc-surface:     #ffffff;
          --tc-border:      rgba(0,0,0,0.07);
          --tc-title:       #0a0a14;
          --tc-subtitle:    rgba(0,0,0,0.42);
          --tc-name:        #111120;
          --tc-count:       rgba(0,0,0,0.4);
          --tc-icon-bg:     rgba(0,0,0,0.05);
          --tc-icon-border: rgba(0,0,0,0.09);
        }

        .tc-section {
          background: var(--tc-bg);
          font-family: 'Sora', sans-serif;
          padding: 48px 0 56px;
          transition: background 0.35s;
        }
        .tc-container { max-width: 1260px; margin: 0 auto; padding: 0 28px; }

        .tc-header { margin-bottom: 28px; }
        .tc-title   { font-size: 24px; font-weight: 800; color: var(--tc-title); letter-spacing: -0.4px; line-height: 1; transition: color 0.3s; }
        .tc-subtitle { font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--tc-subtitle); margin-top: 6px; transition: color 0.3s; }

        .tc-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; }

        .cat-card {
          position: relative; overflow: hidden;
          background: var(--tc-surface);
          border: 1px solid var(--tc-border);
          border-radius: 16px; padding: 24px 20px 22px; cursor: pointer;
          transition: background 0.22s ease, border-color 0.22s ease, transform 0.22s ease, box-shadow 0.22s ease;
          animation: fadeSlideUp 0.45s ease both;
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .cat-icon {
          width: 48px; height: 48px; border-radius: 12px;
          background: var(--tc-icon-bg); border: 1px solid var(--tc-icon-border);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 18px;
          transition: background 0.22s, border-color 0.22s;
        }
        .cat-emoji { font-size: 20px; line-height: 1; display: block; }

        .cat-info { display: flex; flex-direction: column; gap: 4px; }
        .cat-name  { font-size: 14px; font-weight: 700; color: var(--tc-name); letter-spacing: -0.2px; line-height: 1.3; transition: color 0.22s; }
        .cat-count { font-family: 'DM Sans', sans-serif; font-size: 12px; color: var(--tc-count); transition: color 0.3s; }

        .cat-glow {
          position: absolute; top: -30px; right: -30px;
          width: 100px; height: 100px; border-radius: 50%;
          opacity: 0.13; filter: blur(28px); pointer-events: none;
          animation: glowIn 0.3s ease both;
        }
        @keyframes glowIn {
          from { opacity: 0; transform: scale(0.6); }
          to   { opacity: 0.13; transform: scale(1); }
        }

        @media (max-width: 1024px) { .tc-grid { grid-template-columns: repeat(4, 1fr); } }
        @media (max-width: 768px)  {
          .tc-grid { grid-template-columns: repeat(3, 1fr); gap: 10px; }
          .cat-card { padding: 18px 16px; }
          .cat-icon { width: 40px; height: 40px; margin-bottom: 14px; }
          .cat-emoji { font-size: 18px; }
          .cat-name { font-size: 13px; }
        }
        @media (max-width: 500px)  {
          .tc-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .tc-container { padding: 0 14px; }
          .tc-title { font-size: 20px; }
        }
      `}</style>

      <section className="tc-section">
        <div className="tc-container">
          <div className="tc-header">
            <h2 className="tc-title">Template Categories</h2>
            <p className="tc-subtitle">Ready-made logo templates for your projects</p>
          </div>
          <div className="tc-grid">
            {CATEGORIES.map((cat, i) => (
              <CategoryCard key={cat.id} cat={cat} index={i} dark={dark} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}