"use client";

import { useRouter, useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Navbar from "../../components/Navbar";

const PAGE_SIZE = 12;

function SkeletonCard() {
  return (
    <div className="logo-card skeleton-card">
      <div className="card-image skeleton-img" />
      <div className="card-body">
        <div className="skeleton-line w60" />
        <div className="skeleton-line w40 mt4" />
        <div className="card-formats" style={{ marginTop: 8 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton-badge" />)}
        </div>
      </div>
    </div>
  );
}

function LogoCard({ logo }) {
  const [imgErr, setImgErr] = useState(false);
  const router = useRouter();
  const colors = Array.isArray(logo.brandColors) ? logo.brandColors : [];
  const formats = ["SVG", "PNG", "AI", "CDR"];

  return (
    <div className="logo-card" onClick={(e) => {
      e.preventDefault();
      router.push(`/logo/${logo.slug}`);
    }}>
      {logo.trending && (
        <div className="trending-badge">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
          TRENDING
        </div>
      )}

      <div className="card-image">
        {!imgErr && logo.webpUrl ? (
          <img src={logo.webpUrl} alt={logo.logoName}
            onError={() => setImgErr(true)} className="card-img"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
          />
        ) : (
          <span className="card-initials">{logo.logoName?.slice(0, 2).toUpperCase()}</span>
        )}
      </div>

      <div className="card-body">
        <div className="card-name">{logo.logoName}</div>
        <span className="card-category">
          {logo.category?.[1] ? logo.category[1] : logo.category?.[0]}
        </span>

        <div className="card-colors">
          {colors.slice(0, 3).map((c, i) => (
            <span key={i} className="color-dot" style={{ background: c }} />
          ))}
        </div>

        <div className="card-formats">
          {formats.map(f => (
            <span key={f} className={`fmt-tag fmt-${f.toLowerCase()}`}>{f}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CategoryPage() {
  const params = useParams();
  const slug = params?.slug;

  const [logos, setLogos] = useState([]);
  const [categoryName, setCategoryName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogos = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/catageory/${encodeURIComponent(slug)}?page=${page}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setLogos(data.logos ?? []);
      setTotalPages(data.totalPages ?? 1);
      setCategoryName(data.categoryName ?? slug);
    } catch (err) {
      setError(err.message);
      setLogos([]);
    } finally {
      setLoading(false);
    }
  }, [slug, page]);

  useEffect(() => { fetchLogos(); }, [fetchLogos]);
  useEffect(() => { setPage(1); }, [slug]);

  return (<>
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        [data-theme="dark"] {
          --page-bg:        #09090f;
          --surface:        #111118;
          --surface-hover:  #17171f;
          --border:         rgba(255,255,255,0.07);
          --border-hover:   rgba(255,255,255,0.14);
          --text-primary:   #ffffff;
          --text-secondary: rgba(255,255,255,0.45);
          --text-muted:     rgba(255,255,255,0.25);
          --pill-bg:        rgba(255,255,255,0.06);
          --pill-border:    rgba(255,255,255,0.1);
          --pill-color:     rgba(255,255,255,0.6);
          --pill-active-bg:     rgba(7,166,38,0.18);
          --pill-active-border: rgba(7,166,38,0.45);
          --pill-active-color:  #4ade80;
          --card-img-bg:    #1a1a24;
          --skeleton:       rgba(255,255,255,0.06);
          --page-btn-bg:    rgba(255,255,255,0.06);
          --page-btn-color: rgba(255,255,255,0.5);
          --page-btn-hover: rgba(255,255,255,0.1);
          --page-active-bg: rgba(7,166,38,0.2);
          --page-active-color: #4ade80;
          --page-active-border: rgba(7,166,38,0.45);
          --error-color:    #f87171;
        }
        [data-theme="light"] {
          --page-bg:        #f4f4f8;
          --surface:        #ffffff;
          --surface-hover:  #fafafc;
          --border:         rgba(0,0,0,0.07);
          --border-hover:   rgba(0,0,0,0.14);
          --text-primary:   #0a0a14;
          --text-secondary: rgba(0,0,0,0.5);
          --text-muted:     rgba(0,0,0,0.3);
          --pill-bg:        rgba(0,0,0,0.05);
          --pill-border:    rgba(0,0,0,0.09);
          --pill-color:     rgba(0,0,0,0.6);
          --pill-active-bg:     rgba(7,166,38,0.1);
          --pill-active-border: rgba(7,166,38,0.35);
          --pill-active-color:  #15803d;
          --card-img-bg:    #f0f0f5;
          --skeleton:       rgba(0,0,0,0.06);
          --page-btn-bg:    rgba(0,0,0,0.05);
          --page-btn-color: rgba(0,0,0,0.5);
          --page-btn-hover: rgba(0,0,0,0.09);
          --page-active-bg: rgba(7,166,38,0.1);
          --page-active-color: #15803d;
          --page-active-border: rgba(7,166,38,0.35);
          --error-color:    #dc2626;
        }

        .logos-page { min-height: 100vh; background: var(--page-bg); font-family: 'Sora', sans-serif; padding: 0px 0 60px; transition: background 0.35s; }
        .logos-container { max-width: 1200px; margin: 0 auto; padding: 24px 24px 0; }

        .page-header { margin-bottom: 20px; }
        .back-link {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: 'DM Sans', sans-serif; font-size: 12.5px; font-weight: 600;
          color: var(--text-secondary); text-decoration: none; cursor: pointer;
          margin-bottom: 10px; border: none; background: none; padding: 0;
        }
        .back-link:hover { color: #4ade80; }
        .page-title { font-size: 24px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.5px; line-height: 1; text-transform: capitalize; }
        .page-subtitle { font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--text-secondary); margin-top: 4px; }

        .logos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; margin-bottom: 36px; }

        .logo-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; cursor: pointer; position: relative; transition: background 0.2s, border-color 0.2s, transform 0.2s, box-shadow 0.2s; }
        .logo-card:hover { background: var(--surface-hover); border-color: var(--border-hover); transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.15); }
        [data-theme="dark"] .logo-card:hover { box-shadow: 0 12px 32px rgba(0,0,0,0.5); }

        .trending-badge { position: absolute; top: 10px; left: 10px; z-index: 2; display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; background: rgba(7,166,38,0.85); border-radius: 6px; font-size: 9px; font-weight: 700; letter-spacing: 0.5px; color: #fff; backdrop-filter: blur(4px); }

        .card-image { width: 100%; height: 130px; background: var(--card-img-bg); display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .card-img { width: 100%; height: 100%; object-fit: contain; padding: 16px; }
        .card-initials { font-size: 30px; font-weight: 900; color: var(--text-secondary); letter-spacing: -1px; }

        .card-body { padding: 10px 12px 12px; }
        .card-name { font-size: 15px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.3px; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .card-category { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 8px; }
        .card-colors { display: flex; gap: 4px; margin-bottom: 8px; }
        .color-dot { width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.15); }
        [data-theme="light"] .color-dot { border-color: rgba(0,0,0,0.1); }

        .card-formats { display: flex; flex-wrap: wrap; gap: 4px; }
        .fmt-tag { padding: 2px 6px; border-radius: 4px; font-size: 9.5px; font-weight: 700; letter-spacing: 0.3px; border: 1px solid; }
        .fmt-ai  { background:rgba(234,179,8,.1);  border-color:rgba(234,179,8,.25);  color:#fde68a; }
        .fmt-svg { background:rgba(34,197,94,.1);  border-color:rgba(34,197,94,.25);  color:#86efac; }
        .fmt-png { background:rgba(59,130,246,.1); border-color:rgba(59,130,246,.25); color:#93c5fd; }
        [data-theme="light"] .fmt-ai  { color:#92400e; }
        [data-theme="light"] .fmt-svg { color:#166534; }
        [data-theme="light"] .fmt-png { color:#1e40af; }

        .skeleton-card { pointer-events: none; }
        .skeleton-img { width: 100%; height: 130px; background: var(--skeleton); animation: shimmer 1.6s infinite linear; }
        .skeleton-line { height: 10px; border-radius: 5px; background: var(--skeleton); animation: shimmer 1.6s infinite linear; }
        .w60{width:60%} .w40{width:40%} .mt4{margin-top:4px}
        .skeleton-badge { width:28px; height:16px; border-radius:4px; background:var(--skeleton); animation:shimmer 1.6s infinite linear; }
        @keyframes shimmer { 0%{opacity:1} 50%{opacity:0.4} 100%{opacity:1} }

        .error-state { text-align:center; padding:60px 24px; color:var(--error-color); font-size:14px; }
        .error-state button { margin-top:12px; padding:8px 20px; border-radius:8px; border:1px solid var(--error-color); background:transparent; color:var(--error-color); font-family:'Sora',sans-serif; font-size:13px; font-weight:600; cursor:pointer; }

        .empty-state { grid-column:1/-1; text-align:center; padding:60px 24px; color:var(--text-secondary); font-size:14px; }

        .pagination { display:flex; align-items:center; justify-content:center; gap:6px; }
        .page-btn { min-width:36px; height:36px; padding:0 10px; border-radius:9px; border:1px solid var(--pill-border); background:var(--page-btn-bg); font-family:'Sora',sans-serif; font-size:13px; font-weight:600; color:var(--page-btn-color); cursor:pointer; transition:background 0.15s,color 0.15s,border-color 0.15s; display:flex; align-items:center; justify-content:center; }
        .page-btn:hover:not(.active):not(:disabled) { background:var(--page-btn-hover); color:var(--text-primary); }
        .page-btn.active { background:var(--page-active-bg); border-color:var(--page-active-border); color:var(--page-active-color); }
        .page-btn:disabled { opacity:0.35; cursor:not-allowed; }
        .page-ellipsis { color:var(--text-muted); font-size:13px; padding:0 4px; }

        @media (max-width:640px) {
          .logos-page { padding: 12px 0 40px; }
          .logos-container { padding: 14px 12px 0; }
          .page-title { font-size: 20px; }
          .logos-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 24px; }
          .card-image { height: 105px; }
          .card-name { font-size: 13px; }
          .pagination { gap: 4px; }
          .page-btn { min-width: 32px; height: 32px; font-size: 12px; }
        }
      `}</style>

    

    <div className="logos-page">
      <div className="logos-container">

        <div className="page-header">
        <Navbar />
        <div className="h-20"></div>
          <button className="back-link" onClick={() => history.back()}>
            ← Back to categories
          </button>
          <h1 className="page-title">{categoryName || slug}</h1>
          <p className="page-subtitle">Browse logos in this category</p>
        </div>

        {error ? (
          <div className="error-state">
            <p>Failed to load logos: {error}</p>
            <button onClick={fetchLogos}>Try again</button>
          </div>
        ) : (
          <div className="logos-grid">
            {loading
              ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
              : logos.length === 0
                ? <div className="empty-state">No logos found in this category.</div>
                : logos.map(logo => <LogoCard key={logo.id} logo={logo} />)
            }
          </div>
        )}

        {!error && !loading && logos.length > 0 && (
          <div className="pagination">
            <button className="page-btn"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}>‹</button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
              .reduce((acc, n, idx, arr) => {
                if (idx > 0 && n - arr[idx - 1] > 1) acc.push("…");
                acc.push(n);
                return acc;
              }, [])
              .map((n, i) =>
                n === "…"
                  ? <span key={`e${i}`} className="page-ellipsis">…</span>
                  : <button key={n}
                    className={`page-btn${page === n ? " active" : ""}`}
                    onClick={() => setPage(n)}>{n}</button>
              )
            }

            <button className="page-btn"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}>›</button>
          </div>
        )}

      </div>
    </div>
  </>
  );
}