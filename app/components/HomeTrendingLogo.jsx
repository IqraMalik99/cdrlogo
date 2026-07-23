"use client";

import { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { useRouter } from "next/navigation";
import Image from "next/image";

const FORMAT_COLORS = {
  AI: { bg: "rgba(234,179,8,.12)", border: "rgba(234,179,8,.3)", color: "#fde68a", colorLight: "#92400e" },
  SVG: { bg: "rgba(34,197,94,.12)", border: "rgba(34,197,94,.3)", color: "#86efac", colorLight: "#166534" },
  PNG: { bg: "rgba(59,130,246,.12)", border: "rgba(59,130,246,.3)", color: "#93c5fd", colorLight: "#1e40af" },
  CDR: { bg: "rgba(234,179,8,.12)", border: "rgba(234,179,8,.3)", color: "#fde68a", colorLight: "#92400e" },
};

// Generate a gradient bg from brand colors, fallback to dark slate
function gradientFromColors(colors, dark) {
  if (colors?.length >= 2) {
    return {
      bgFrom: dark ? colors[0] : `${colors[0]}22`, // 👈 add opacity
      bgTo: dark ? colors[1] : `${colors[1]}22`,
    };
  }

  if (colors?.length === 1) {
    return {
      bgFrom: dark ? colors[0] : `${colors[0]}22`,
      bgTo: dark ? "#0f1221" : "#f8fafc",
    };
  }

  return dark
    ? { bgFrom: "#1a1f3a", bgTo: "#0f1221" }
    : { bgFrom: "#f1f5f9", bgTo: "#e2e8f0" };
}

function SkeletonCard() {
  return (
    <div className="tl-card">
      <div className="tl-preview tl-skeleton-preview" />
      <div className="tl-body">
        <div className="tl-sk tl-sk-name" />
        <div className="tl-sk tl-sk-cat" />
        <div className="tl-sk tl-sk-fmt" />
      </div>
    </div>
  );
}

function TrendingCard({ logo, dark }) {
  const [hovered, setHovered] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const { bgFrom, bgTo } = gradientFromColors(logo.brandColors, dark);
  const router = useRouter();

  return (
    <div
      className={`tl-card${hovered ? " tl-card--hovered" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={
        (e) => {
          e.preventDefault();
          router.push(`/logo/${logo.slug}`)
        }
      }
    >
      <div
        className="tl-preview"
        style={{ background: `linear-gradient(145deg, ${bgFrom}, ${bgTo})` }}
      >
        <div className="tl-badge">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
          TRENDING
        </div>

        {!imgErr && logo.webpUrl
          ? <Image
            src={logo.webpUrl}
            alt={logo.logoName}
            width={150}
            height={150}
            sizes="(max-width: 560px) 50vw, (max-width: 820px) 33vw, (max-width: 1100px) 25vw, 16vw"
            onError={() => setImgErr(true)}
            className="tl-logo-img"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
          />
          : <span className="tl-brand-name">{logo.logoName}</span>
        }
      </div>

      <div className="tl-body">
        <div className="tl-title-row">
          <span className="tl-name">{logo.logoName}</span>
        </div>

        <div className="tl-meta-row">
          <span className="tl-category">{logo.category[0]}</span>
          <div className="tl-colors">
            {(Array.isArray(logo.brandColors) ? logo.brandColors : []).slice(0, 4).map((c, i) => (
              <span key={i} className="tl-dot" style={{ background: c }} />
            ))}
          </div>
        </div>

        <div className="tl-formats">
          {["AI", "CDR", "SVG", "PNG"].map(f => {
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
  const [logos, setLogos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/logo/fetch/trending")
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => { setLogos(data.logos ?? []); setLoading(false); })
      .catch(err => { setError(String(err)); setLoading(false); });


  }, []);

  return (
    <>
      <style>{`
   
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

        [data-theme="dark"]{
          --tl-bg:#09090f;--tl-surface:#111118;
          --tl-border:rgba(255,255,255,0.07);--tl-border-h:rgba(255,255,255,0.14);
          --tl-title:#ffffff;--tl-subtitle:rgba(255,255,255,0.38);
          --tl-name:#e8e8f0;--tl-category:rgba(255,255,255,0.35);
          --tl-dot-border:rgba(255,255,255,0.15);
          --tl-sk:rgba(255,255,255,0.07);
        }
        [data-theme="light"]{
          --tl-bg: #f4f4f8;--tl-surface:#ffffff;
          --tl-border:rgba(0,0,0,0.07);--tl-border-h:rgba(0,0,0,0.14);
          --tl-title:#0a0a14;--tl-subtitle:rgba(0,0,0,0.42);
          --tl-name:#111120;--tl-category:rgba(0,0,0,0.42);
          --tl-dot-border:rgba(0,0,0,0.12);
          --tl-sk:rgba(0,0,0,0.07);
        }

        .tl-section{background:var(--tl-bg);font-family:var(--font-sora),sans-serif;padding:48px 0 56px;transition:background .35s}
        .tl-container{max-width:1260px;margin:0 auto;padding:0 28px}

        .tl-header{margin-bottom:24px}
        .tl-title{font-size:24px;font-weight:800;color:var(--tl-title);letter-spacing:-.4px;line-height:1;transition:color .3s}
        .tl-subtitle{font-family:var(--font-sora),sans-serif;font-size:13px;color:var(--tl-subtitle);margin-top:5px;transition:color .3s}

        .tl-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:14px}

        .tl-card{background:var(--tl-surface);border:1px solid var(--tl-border);border-radius:16px;overflow:hidden;cursor:pointer;transition:border-color .22s,transform .22s,box-shadow .22s}
        .tl-card--hovered{border-color:var(--tl-border-h);transform:translateY(-4px);box-shadow:0 16px 40px rgba(0,0,0,.25)}
        [data-theme="dark"] .tl-card--hovered{box-shadow:0 16px 40px rgba(0,0,0,.55)}

       .tl-preview{position:relative;height:160px;display:flex;align-items:center;justify-content:center;overflow:hidden}
       .tl-logo-img{object-fit:contain;padding:20px}

        .tl-badge{position:absolute;top:10px;left:10px;display:inline-flex;align-items:center;gap:4px;padding:3px 8px;background:rgba(7,166,38,0.85);border-radius:100px;font-size:8.5px;font-weight:700;letter-spacing:.6px;color:#fff}

        .tl-brand-name{font-size:clamp(18px,2.5vw,26px);font-weight:900;color:rgba(255,255,255,.82);letter-spacing:-1px;text-align:center;padding:0 12px;line-height:1.1;text-shadow:0 2px 16px rgba(0,0,0,.4);user-select:none}

        .tl-body{padding:10px 12px 12px}
        .tl-title-row{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px}
        .tl-name{font-size:13px;font-weight:800;color:var(--tl-name);letter-spacing:-.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .3s}
        .tl-meta-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
        .tl-category{font-family:var(--font-sora),sans-serif;font-size:10.5px;color:var(--tl-category);transition:color .3s}
        .tl-colors{display:flex;gap:4px}
        .tl-dot{width:9px;height:9px;border-radius:50%;border:1.5px solid var(--tl-dot-border);flex-shrink:0}
        .tl-formats{display:flex;flex-wrap:wrap;gap:4px}
        .tl-fmt{padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;letter-spacing:.3px;border:1px solid;transition:color .3s}

        /* skeleton */
        @keyframes shimmer{0%{opacity:1}50%{opacity:.4}100%{opacity:1}}
        .tl-skeleton-preview{background:var(--tl-sk);animation:shimmer 1.6s infinite linear}
        .tl-sk{background:var(--tl-sk);border-radius:5px;animation:shimmer 1.6s infinite linear}
        .tl-sk-name{height:10px;width:65%;margin-bottom:8px}
        .tl-sk-cat{height:8px;width:40%;margin-bottom:10px}
        .tl-sk-fmt{height:16px;width:80%;border-radius:4px}

        .tl-error{text-align:center;padding:40px;color:#f87171;font-size:13px}

        @media(max-width:1100px){.tl-grid{grid-template-columns:repeat(4,1fr)}}
        @media(max-width:820px){.tl-grid{grid-template-columns:repeat(3,1fr);gap:10px}.tl-preview{height:130px}}
        @media(max-width:560px){.tl-grid{grid-template-columns:repeat(2,1fr);gap:8px}.tl-container{padding:0 14px}.tl-title{font-size:20px}.tl-preview{height:115px}}
      `}</style>

      <section className="tl-section">
        <div className="tl-container">
          <div className="tl-header">
            <h2 className="tl-title">Trending Logos</h2>
            <p className="tl-subtitle">Recently updated vector assets</p>
          </div>

          {error ? (
            <div className="tl-error">Failed to load trending logos.</div>
          ) : (
            <div className="tl-grid">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
                : logos.map(logo => <TrendingCard key={logo.id} logo={logo} dark={dark} />)
              }
            </div>
          )}
        </div>
      </section>
    </>
  );
}