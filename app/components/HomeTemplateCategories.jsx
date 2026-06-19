"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "../context/ThemeContext";

// Deterministic accent color per first letter — purely visual, no hardcoding
const ACCENTS = [
  { accent: "#07A626", rgb: "7,166,38" },
  { accent: "#22d3ee", rgb: "34,211,238" },
  { accent: "#f97316", rgb: "249,115,22" },
  { accent: "#a78bfa", rgb: "167,139,250" },
  { accent: "#f472b6", rgb: "244,114,182" },
  { accent: "#fbbf24", rgb: "251,191,36" },
  { accent: "#34d399", rgb: "52,211,153" },
  { accent: "#fb7185", rgb: "251,113,133" },
  { accent: "#e879f9", rgb: "232,121,249" },
  { accent: "#67e8f9", rgb: "103,232,249" },
];

function getAccent(index) {
  return ACCENTS[index % ACCENTS.length];
}

function TemplateCard({ cat, index, dark }) {
  const router = useRouter();
  const [hov, setHov] = useState(false);
  const { accent, rgb } = getAccent(index);

  const hoverBg = dark ? `rgba(${rgb},0.14)` : `rgba(${rgb},0.08)`;
  const hoverBorder = dark ? `rgba(${rgb},0.45)` : `rgba(${rgb},0.32)`;
  const hoverShadow = dark ? `0 16px 40px rgba(${rgb},0.18)` : `0 10px 28px rgba(${rgb},0.13)`;
  const iconBg = dark ? `rgba(${rgb},0.14)` : `rgba(${rgb},0.1)`;
  const iconBorder = dark ? `rgba(${rgb},0.35)` : `rgba(${rgb},0.25)`;

  const displayName = cat.category.charAt(0).toUpperCase() + cat.category.slice(1).replace(/-/g, " ");

  return (
    <div
      className="tc-card"
      style={{
        animationDelay: `${index * 55}ms`,
        ...(hov ? { background: hoverBg, borderColor: hoverBorder, transform: "translateY(-4px)", boxShadow: hoverShadow } : {}),
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={
        () => {
          let query = cat.category.toLowerCase();
          router.push(`/search/${query}`)
        }
      }
    >
      <div
        className="tc-icon"
        style={hov ? { background: iconBg, borderColor: iconBorder } : {}}
      >
        <span className="tc-letter" style={{ color: hov ? accent : undefined }}>
          {cat.category.charAt(0).toUpperCase()}
        </span>
      </div>

      <div className="tc-info">
        <span className="tc-name" style={hov ? { color: accent } : {}}>
          {displayName}
        </span>
        <span className="tc-count">{cat.count.toLocaleString()} logos</span>
      </div>

      {hov && <div className="tc-glow" style={{ background: accent }} />}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="tc-card tc-skeleton">
      <div className="sk sk-icon" />
      <div className="tc-info">
        <div className="sk sk-name" />
        <div className="sk sk-count" />
      </div>
    </div>
  );
}

export default function TemplateCategories() {
  const { dark } = useTheme();
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/catageory/template")
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        // sort alphabetically — different order from BrandCategories
        const formatted = (data.categories ?? []).map(obj => {
          const [category, count] = Object.entries(obj)[0];
          return { category, count };
        });

        const sorted = formatted.sort((a, b) =>
          a.category.localeCompare(b.category)
        );
        setCats(sorted);
        setLoading(false);
      })
      .catch(err => { setError(String(err)); setLoading(false); });
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

        [data-theme="dark"]{
          --tc-bg:#09090f;--tc-surface:#111118;
          --tc-border:rgba(255,255,255,0.07);
          --tc-title:#ffffff;--tc-sub:rgba(255,255,255,0.38);
          --tc-name:#e8e8f0;--tc-count:rgba(255,255,255,0.35);
          --tc-icon-bg:rgba(255,255,255,0.05);--tc-icon-border:rgba(255,255,255,0.08);
          --tc-sk:rgba(255,255,255,0.07);
        }
        [data-theme="light"]{
          --tc-bg:#f4f4f8;--tc-surface:#ffffff;
          --tc-border:rgba(0,0,0,0.07);
          --tc-title:#0a0a14;--tc-sub:rgba(0,0,0,0.42);
          --tc-name:#111120;--tc-count:rgba(0,0,0,0.4);
          --tc-icon-bg:rgba(0,0,0,0.05);--tc-icon-border:rgba(0,0,0,0.09);
          --tc-sk:rgba(0,0,0,0.07);
        }

        .tc-section{background:var(--tc-bg);font-family:'Sora',sans-serif;padding:48px 0 56px;transition:background .35s}
        .tc-container{max-width:1260px;margin:0 auto;padding:0 28px}
        .tc-header{margin-bottom:28px}
        .tc-title{font-size:24px;font-weight:800;color:var(--tc-title);letter-spacing:-.4px;line-height:1;transition:color .3s}
        .tc-subtitle{font-family:'DM Sans',sans-serif;font-size:13px;color:var(--tc-sub);margin-top:6px;transition:color .3s}

        .tc-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}

        .tc-card{
          position:relative;overflow:hidden;
          background:var(--tc-surface);border:1px solid var(--tc-border);
          border-radius:16px;padding:24px 20px 22px;cursor:pointer;
          transition:background .22s,border-color .22s,transform .22s,box-shadow .22s;
          animation:fadeSlideUp .45s ease both;
        }
        @keyframes fadeSlideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}

        .tc-icon{
          width:48px;height:48px;border-radius:12px;
          background:var(--tc-icon-bg);border:1px solid var(--tc-icon-border);
          display:flex;align-items:center;justify-content:center;
          margin-bottom:18px;
          transition:background .22s,border-color .22s;
        }
        .tc-letter{font-size:20px;font-weight:800;line-height:1;color:var(--tc-name);transition:color .22s}

        .tc-info{display:flex;flex-direction:column;gap:4px}
        .tc-name{font-size:14px;font-weight:700;color:var(--tc-name);letter-spacing:-.2px;line-height:1.3;transition:color .22s}
        .tc-count{font-family:'DM Sans',sans-serif;font-size:12px;color:var(--tc-count);transition:color .3s}

        .tc-glow{
          position:absolute;top:-30px;right:-30px;
          width:100px;height:100px;border-radius:50%;
          opacity:.13;filter:blur(28px);pointer-events:none;
          animation:glowIn .3s ease both;
        }
        @keyframes glowIn{from{opacity:0;transform:scale(.6)}to{opacity:.13;transform:scale(1)}}

        @keyframes shimmer{0%{opacity:1}50%{opacity:.4}100%{opacity:1}}
        .tc-skeleton{pointer-events:none}
        .sk{background:var(--tc-sk);border-radius:5px;animation:shimmer 1.6s infinite linear}
        .sk-icon{width:48px;height:48px;border-radius:12px;margin-bottom:18px}
        .sk-name{height:11px;width:68%;margin-bottom:7px}
        .sk-count{height:9px;width:38%}

        .tc-error{text-align:center;padding:40px;color:#f87171;font-size:13px}

        @media(max-width:1024px){.tc-grid{grid-template-columns:repeat(4,1fr)}}
        @media(max-width:768px){.tc-grid{grid-template-columns:repeat(3,1fr);gap:10px}.tc-card{padding:18px 16px}.tc-icon{width:40px;height:40px;margin-bottom:14px}.tc-name{font-size:13px}}
        @media(max-width:500px){.tc-grid{grid-template-columns:repeat(2,1fr);gap:8px}.tc-container{padding:0 14px}.tc-title{font-size:20px}}
      `}</style>

      <section className="tc-section">
        <div className="tc-container">
          <div className="tc-header">
            <h2 className="tc-title">Template Categories</h2>
            <p className="tc-subtitle">Ready-made logo templates for your projects</p>
          </div>
          {error ? (
            <div className="tc-error">Failed to load categories.</div>
          ) : (
            <div className="tc-grid">
              {loading
                ? Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)
                : cats.map((cat, i) => <TemplateCard key={cat.category} cat={cat} index={i} dark={dark} />)
              }
            </div>
          )}
        </div>
      </section>
    </>
  );
}