"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "../context/ThemeContext";

function BrandCard({ cat, index, dark }) {
  const router  = useRouter();
  const [hov, setHov] = useState(false);

  const hoverStyle = dark
    ? { background: "rgba(7,166,38,0.1)", borderColor: "rgba(7,166,38,0.35)" }
    : { background: "rgba(7,166,38,0.06)", borderColor: "rgba(7,166,38,0.28)", boxShadow: "0 8px 28px rgba(7,166,38,0.1)" };

  return (
    <div
      className="bc-card"
      style={{ animationDelay: `${index * 50}ms`, ...(hov ? { ...hoverStyle, transform: "translateY(-3px)" } : {}) }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
     
      onClick={
        () => {
           let query=cat.category.toLowerCase();
          router.push(`/search/${query}`)
        }
    }
    >
      <div className={`bc-icon${hov ? " bc-icon--hov" : ""}`}>
        <span className="bc-letter">{cat.category.charAt(0).toUpperCase()}</span>
      </div>
      <div className="bc-info">
        <span className={`bc-name${hov ? " bc-name--hov" : ""}`}>
          {cat.category.charAt(0).toUpperCase() + cat.category.slice(1).replace(/-/g, " ")}
        </span>
        <span className="bc-count">{cat.count.toLocaleString()} logos</span>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bc-card bc-skeleton">
      <div className="sk sk-icon" />
      <div className="bc-info">
        <div className="sk sk-name" />
        <div className="sk sk-count" />
      </div>
    </div>
  );
}

export default function BrandCategories() {
  const { dark } = useTheme();
  const [cats,    setCats]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    fetch("/api/catageory/brand")
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        // sort by count descending
        console.log("Fetched categories:", data.categories);
      const formatted = (data.categories ?? []).map(obj => {
  const [category, count] = Object.entries(obj)[0];
  return { category, count };
});

const sorted = formatted.sort((a, b) => b.count - a.count);
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
          --bc-bg:#09090f;--bc-surface:#111118;
          --bc-border:rgba(255,255,255,0.07);
          --bc-title:#ffffff;--bc-sub:rgba(255,255,255,0.38);
          --bc-name:#e0e0f0;--bc-count:rgba(255,255,255,0.35);
          --bc-icon-bg:rgba(7,166,38,0.12);--bc-icon-border:rgba(7,166,38,0.22);--bc-icon-color:#4ade80;
          --bc-sk:rgba(255,255,255,0.07);
        }
        [data-theme="light"]{
          --bc-bg:#f4f4f8;--bc-surface:#ffffff;
          --bc-border:rgba(0,0,0,0.07);
          --bc-title:#0a0a14;--bc-sub:rgba(0,0,0,0.42);
          --bc-name:#111120;--bc-count:rgba(0,0,0,0.42);
          --bc-icon-bg:rgba(7,166,38,0.08);--bc-icon-border:rgba(7,166,38,0.18);--bc-icon-color:#07A626;
          --bc-sk:rgba(0,0,0,0.07);
        }

        .bc-section{background:var(--bc-bg);font-family:'Sora',sans-serif;padding:48px 0 56px;transition:background .35s}
        .bc-container{max-width:1260px;margin:0 auto;padding:0 28px}
        .bc-header{margin-bottom:28px}
        .bc-title{font-size:24px;font-weight:800;color:var(--bc-title);letter-spacing:-.4px;line-height:1;transition:color .3s}
        .bc-subtitle{font-family:'DM Sans',sans-serif;font-size:13px;color:var(--bc-sub);margin-top:6px;transition:color .3s}

        .bc-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}

        .bc-card{
          position:relative;background:var(--bc-surface);border:1px solid var(--bc-border);
          border-radius:14px;padding:20px 18px 18px;cursor:pointer;
          transition:background .22s,border-color .22s,transform .22s,box-shadow .22s;
          animation:bcFadeUp .4s ease both;
        }
        @keyframes bcFadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}

        .bc-icon{
          width:46px;height:46px;border-radius:10px;
          background:var(--bc-icon-bg);border:1px solid var(--bc-icon-border);
          color:var(--bc-icon-color);
          display:flex;align-items:center;justify-content:center;
          margin-bottom:28px;
          transition:background .22s,border-color .22s;
        }
        .bc-icon--hov{background:rgba(7,166,38,0.2)!important;border-color:rgba(7,166,38,0.42)!important}
        [data-theme="light"] .bc-icon--hov{background:rgba(7,166,38,0.12)!important;border-color:rgba(7,166,38,0.32)!important}

        .bc-letter{font-size:20px;font-weight:800;line-height:1}

        .bc-info{display:flex;flex-direction:column;gap:4px}
        .bc-name{font-size:14px;font-weight:700;color:var(--bc-name);letter-spacing:-.2px;line-height:1.3;transition:color .22s}
        .bc-name--hov{color:#4ade80}
        [data-theme="light"] .bc-name--hov{color:#07A626}
        .bc-count{font-family:'DM Sans',sans-serif;font-size:12px;color:var(--bc-count);transition:color .3s}

        @keyframes shimmer{0%{opacity:1}50%{opacity:.4}100%{opacity:1}}
        .bc-skeleton{pointer-events:none}
        .sk{background:var(--bc-sk);border-radius:5px;animation:shimmer 1.6s infinite linear}
        .sk-icon{width:46px;height:46px;border-radius:10px;margin-bottom:28px}
        .sk-name{height:11px;width:70%;margin-bottom:7px}
        .sk-count{height:9px;width:40%}

        .bc-error{text-align:center;padding:40px;color:#f87171;font-size:13px}

        @media(max-width:1100px){.bc-grid{grid-template-columns:repeat(4,1fr)}}
        @media(max-width:820px){.bc-grid{grid-template-columns:repeat(3,1fr);gap:10px}.bc-card{padding:16px 14px}.bc-icon{width:40px;height:40px;margin-bottom:20px}.bc-name{font-size:13px}}
        @media(max-width:520px){.bc-grid{grid-template-columns:repeat(2,1fr);gap:8px}.bc-container{padding:0 14px}.bc-title{font-size:20px}}
      `}</style>

      <section className="bc-section">
        <div className="bc-container">
          <div className="bc-header">
            <h2 className="bc-title">Brand Categories</h2>
            <p className="bc-subtitle">Explore logos by brand industry</p>
          </div>
          {error ? (
            <div className="bc-error">Failed to load categories.</div>
          ) : (
            <div className="bc-grid">
              {loading
                ? Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)
                : cats.map((cat, i) => <BrandCard key={cat.category} cat={cat} index={i} dark={dark} />)
              }
            </div>
          )}
        </div>
      </section>
    </>
  );
}