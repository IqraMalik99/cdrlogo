"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "../context/ThemeContext";
import Image from "next/image";
import { useRouter } from "next/navigation";

const PER_PAGE = 10;

const FORMAT_CHIPS = [
  { label: "AI", cls: "fmt-ai" },
  { label: "CDR", cls: "fmt-cdr" },
  { label: "SVG", cls: "fmt-svg" },
  { label: "PNG", cls: "fmt-png" },
];

function getInitials(name = "") {
  return name.slice(0, 2).toUpperCase();
}

export default function TemplatesPage() {
  const { dark } = useTheme();

  const [logos, setLogos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState(["All"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  // Debounced search — waits 400ms after user stops typing
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef(null);
  const handleSearchChange = (val) => {
    setSearchQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(val), 400);
  };

  // ── Server-side fetch ────────────────────────────────────────────────────────
  const fetchLogos = useCallback(async (page, category, search) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/catageory/nav-temp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "template",
          page,
          limit: PER_PAGE,
          category,
          search,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setLogos(data.logos ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
      if (data.categories) setCategories(data.categories);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Trigger fetch when page, filter, or debounced search changes
  useEffect(() => {
    fetchLogos(currentPage, activeFilter, debouncedSearch);
  }, [currentPage, activeFilter, debouncedSearch, fetchLogos]);

  // Reset to page 1 when filter or search changes
  useEffect(() => { setCurrentPage(1); }, [activeFilter, debouncedSearch]);

  // ── Pagination helper ─────────────────────────────────────────────────────────
  function buildPages(total, current) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [1];
    if (current > 3) pages.push("…");
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push("…");
    pages.push(total);
    return pages;
  }

  const paginationItems = buildPages(totalPages, currentPage);
  const showingFrom = total === 0 ? 0 : (currentPage - 1) * PER_PAGE + 1;
  const showingTo = Math.min(currentPage * PER_PAGE, total);

  return (
    <>
      <style>{`
   

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        [data-theme="dark"] {
          --bg:                #09090f;
          --surface:           rgba(255,255,255,0.04);
          --surface-hover:     rgba(255,255,255,0.07);
          --border:            rgba(255,255,255,0.09);
          --border-hover:      rgba(7,166,38,0.4);
          --text-primary:      #ffffff;
          --text-secondary:    rgba(255,255,255,0.45);
          --text-muted:        rgba(255,255,255,0.25);
          --accent-glow:       rgba(7,166,38,0.15);
          --tag-bg:            rgba(255,255,255,0.06);
          --tag-clr:           rgba(255,255,255,0.5);
          --tag-bdr:           rgba(255,255,255,0.1);
          --badge-trend-bg:    rgba(7,166,38,0.12);
          --badge-trend-clr:   #4ade80;
          --badge-trend-bdr:   rgba(7,166,38,0.3);
          --pg-bg:             rgba(255,255,255,0.05);
          --pg-bdr:            rgba(255,255,255,0.1);
          --pg-clr:            rgba(255,255,255,0.6);
          --pg-active-bg:      rgba(7,166,38,0.18);
          --pg-active-bdr:     rgba(7,166,38,0.5);
          --pg-active-clr:     #4ade80;
          --skeleton-bg:       rgba(255,255,255,0.06);
          --search-bg:         rgba(255,255,255,0.04);
          --search-bdr:        rgba(255,255,255,0.1);
          --search-clr:        #ffffff;
          --search-ph:         rgba(255,255,255,0.3);
          --dot:               rgba(255,255,255,0.04);
          --divider:           rgba(255,255,255,0.08);
        }
        [data-theme="light"] {
          --bg:                #f4f4f8;
          --surface:           rgba(255,255,255,0.9);
          --surface-hover:     #ffffff;
          --border:            rgba(0,0,0,0.08);
          --border-hover:      rgba(7,166,38,0.45);
          --text-primary:      #0a0a14;
          --text-secondary:    rgba(0,0,0,0.5);
          --text-muted:        rgba(0,0,0,0.3);
          --accent-glow:       rgba(7,166,38,0.08);
          --tag-bg:            rgba(255,255,255,0.8);
          --tag-clr:           rgba(0,0,0,0.45);
          --tag-bdr:           rgba(0,0,0,0.1);
          --badge-trend-bg:    rgba(7,166,38,0.08);
          --badge-trend-clr:   #15803d;
          --badge-trend-bdr:   rgba(7,166,38,0.25);
          --pg-bg:             rgba(255,255,255,0.8);
          --pg-bdr:            rgba(0,0,0,0.12);
          --pg-clr:            rgba(0,0,0,0.55);
          --pg-active-bg:      rgba(7,166,38,0.1);
          --pg-active-bdr:     rgba(7,166,38,0.4);
          --pg-active-clr:     #15803d;
          --skeleton-bg:       rgba(0,0,0,0.06);
          --search-bg:         rgba(255,255,255,0.9);
          --search-bdr:        rgba(0,0,0,0.12);
          --search-clr:        #0a0a14;
          --search-ph:         rgba(0,0,0,0.3);
          --dot:               rgba(0,0,0,0.04);
          --divider:           rgba(0,0,0,0.1);
        }

        .brands-root {
          min-height: 100vh; background: var(--bg);
          font-family: sans-serif;
          padding-bottom: 80px; transition: background 0.35s;
          position: relative; overflow-x: hidden;
        }
        .brands-root::before {
          content: ''; position: fixed; inset: 0;
          background-image: radial-gradient(var(--dot) 1px, transparent 1px);
          background-size: 30px 30px; pointer-events: none; z-index: 0;
        }
        .brands-inner { position: relative; z-index: 1; }
        .bc-header{
          max-width: 1180px;
          margin: 0 auto 28px;
          padding: 0 24px;
        }

        /* ── Hero ── */
        .brands-hero {
          padding: 52px 24px 0;
          display: flex; flex-direction: column;
          align-items: center; text-align: center;
          gap: 16px; position: relative;
        }
        .brands-hero::before {
          content: ''; position: absolute; top: -20%; left: 50%;
          transform: translateX(-50%); width: 500px; height: 300px;
          background: radial-gradient(ellipse, rgba(7,166,38,.1) 0%, transparent 70%);
          border-radius: 50%; pointer-events: none;
        }
        [data-theme="light"] .brands-hero::before {
          background: radial-gradient(ellipse, rgba(7,166,38,.06) 0%, transparent 70%);
        }

        .hero-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 11px; background: rgba(7,166,38,.1);
          border: 1px solid rgba(7,166,38,.28); border-radius: 100px;
          font-size: 10px; font-weight: 600; color: #4ade80; letter-spacing: .2px;
        }
        [data-theme="light"] .hero-badge { background: rgba(7,166,38,.08); border-color: rgba(7,166,38,.22); color: #15803d; }
        .badge-dot {
          width: 5px; height: 5px; background: #07A626;
          border-radius: 50%; animation: pulse-dot 2s infinite;
        }
        @keyframes pulse-dot {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:.5; transform:scale(.75); }
        }

        .hero-title {
          font-size: clamp(26px, 4.5vw, 44px);
          font-weight: 900; line-height: 1.13; letter-spacing: -1.2px;
          color: var(--text-primary); text-wrap: balance; max-width: 600px;
          transition: color 0.35s;
        }
        .hero-title .accent {
          background: linear-gradient(135deg, #07A626, #34d058);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-sub {
          font-family: 'DM Sans', sans-serif;
          font-size: clamp(12.5px, 1.6vw, 14px);
          color: var(--text-secondary); line-height: 1.65; max-width: 480px;
          transition: color 0.35s;
        }

        .fmt-row { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
        .fmt-badge { padding: 2px 9px; border-radius: 5px; font-size: 10px; font-weight: 700; letter-spacing: .5px; border: 1px solid; }

        /* Search */
        .search-wrap { width: 100%; max-width: 560px; }
        .search-bar {
          width: 100%; display: flex; align-items: center; gap: 9px;
          padding: 11px 15px; background: var(--search-bg);
          border: 1.5px solid var(--search-bdr); border-radius: 12px;
          box-shadow: 0 2px 16px rgba(0,0,0,.1);
          transition: border-color .2s, box-shadow .2s, background 0.35s; cursor: text;
        }
        .search-bar.focused {
          border-color: rgba(7,166,38,.7);
          box-shadow: 0 0 0 3px rgba(7,166,38,.12), 0 0 24px rgba(7,166,38,.06);
        }
        .search-icon { color: rgba(128,128,160,0.5); flex-shrink: 0; }
        .search-input {
          flex: 1; background: none; border: none; outline: none;
          font-size: 13.5px; font-family: 'Sora', sans-serif; font-weight: 500;
          color: var(--search-clr); caret-color: #07A626; transition: color 0.3s;
        }
        .search-input::placeholder { color: var(--search-ph); }
        .search-clear {
          background: none; border: none; cursor: pointer; color: var(--text-muted);
          padding: 2px; border-radius: 4px; display: flex; align-items: center;
          justify-content: center; transition: color .18s; flex-shrink: 0;
        }
        .search-clear:hover { color: var(--text-secondary); }

        /* Divider */
        .brands-divider {
          width: calc(100% - 48px); max-width: 1200px;
          margin: 32px auto 0; height: 1px; background: var(--divider);
        }

        /* Filter row */
        .filter-count-row {
          padding: 20px 24px 0; display: flex; align-items: center;
          justify-content: space-between; flex-wrap: wrap; gap: 10px;
        }
        .filter-row { display: flex; gap: 6px; flex-wrap: wrap; }
        .filter-tab {
          padding: 5px 13px; border-radius: 100px; font-size: 11px; font-weight: 600;
          cursor: pointer; background: var(--tag-bg); border: 1px solid var(--tag-bdr);
          color: var(--tag-clr); transition: background .18s, border-color .18s, color .18s;
          font-family: 'Sora', sans-serif;
        }
        .filter-tab:hover { border-color: var(--border-hover); color: #07A626; }
        .filter-tab.active {
          background: rgba(7,166,38,0.15); border-color: rgba(7,166,38,0.45);
          color: var(--badge-trend-clr);
        }
        .results-badge {
          font-size: 11px; font-weight: 600; color: var(--text-muted);
          background: var(--tag-bg); border: 1px solid var(--tag-bdr);
          padding: 4px 10px; border-radius: 100px; white-space: nowrap; flex-shrink: 0;
        }

        /* Grid — fixed 5 per row, centered with side space */
        .brands-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
          max-width: 1180px;
          margin: 0 auto;
          padding: 20px 24px 0;
        }
        @media (max-width: 1024px) {
          .brands-grid { grid-template-columns: repeat(4, 1fr); }
        }
        @media (max-width: 768px) {
          .brands-grid { grid-template-columns: repeat(3, 1fr); }
        }

        /* Card */
        .logo-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 14px; overflow: hidden; cursor: pointer;
          transition: transform .2s, border-color .2s, background .2s, box-shadow .2s;
          animation: fadeUp .3s ease both; position: relative;
        }
        .logo-card:hover {
          transform: translateY(-3px); border-color: var(--border-hover);
          background: var(--surface-hover); box-shadow: 0 8px 32px rgba(7,166,38,.08);
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
       .card-img-wrap {
  width: 100%; aspect-ratio: 1 / 0.85; background: rgba(255,255,255,0.03);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden; position: relative;
  padding: 14%;               /* ← yeh add karo, taake 72% wala visual effect wapas aaye */
  box-sizing: border-box;     /* ← yeh bhi add karo */
}
.card-img {
  object-fit: contain;
  transition: transform .3s;
}
        [data-theme="light"] .card-img-wrap { background: rgba(0,0,0,0.03); }
      
        .logo-card:hover .card-img { transform: scale(1.06); }
        .card-placeholder {
          width: 72%; height: 72%; border-radius: 10px; background: var(--skeleton-bg);
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; font-weight: 800; color: var(--text-muted); letter-spacing: -1px;
        }
        .trend-badge {
          position: absolute; top: 8px; left: 8px;
          background: var(--badge-trend-bg); border: 1px solid var(--badge-trend-bdr);
          color: var(--badge-trend-clr); font-size: 9px; font-weight: 700;
          padding: 2px 7px; border-radius: 100px; display: flex; align-items: center; gap: 3px;
        }
        .bc-title{font-size:24px;font-weight:800;color:var(--bc-title);letter-spacing:-.4px;line-height:1;transition:color .3s}
        .bc-subtitle{font-family:'DM Sans',sans-serif;font-size:13px;color:var(--bc-sub);margin-top:6px;transition:color .3s}
        .trend-dot { width: 4px; height: 4px; border-radius: 50%; background: currentColor; animation: pulse-dot 2s infinite; }
        .card-body { padding: 10px 12px 12px; }
        .card-name { font-size: 12px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.2px; margin-bottom: 2px; }
        .card-cat { font-size: 10px; color: var(--text-secondary); font-weight: 400; margin-bottom: 8px; }
        .card-footer { display: flex; align-items: center; justify-content: space-between; }
        .color-dots { display: flex; gap: 4px; }
        .color-dot { width: 9px; height: 9px; border-radius: 50%; border: 1.5px solid rgba(0,0,0,0.15); flex-shrink: 0; }
        .fmt-chips { display: flex; gap: 3px; }
        .fmt { font-size: 8.5px; font-weight: 700; letter-spacing: .3px; padding: 1px 5px; border-radius: 3px; border: 1px solid; }
        .fmt-ai  { background:rgba(234,179,8,.1);  border-color:rgba(234,179,8,.25);  color:#fde68a; }
        .fmt-cdr { background:rgba(239,68,68,.1);  border-color:rgba(239,68,68,.25);  color:#fca5a5; }
        .fmt-svg { background:rgba(34,197,94,.1);  border-color:rgba(34,197,94,.25);  color:#86efac; }
        .fmt-png { background:rgba(59,130,246,.1); border-color:rgba(59,130,246,.25); color:#93c5fd; }
        [data-theme="light"] .fmt-ai  { color:#b45309; }
        [data-theme="light"] .fmt-cdr { color:#dc2626; }
        [data-theme="light"] .fmt-svg { color:#15803d; }
        [data-theme="light"] .fmt-png { color:#1d4ed8; }

        /* Skeleton */
        .skeleton-card {
          background: var(--skeleton-bg); border: 1px solid var(--border);
          border-radius: 14px; overflow: hidden;
          animation: shimmer 1.5s ease-in-out infinite alternate;
        }
        .skeleton-img  { width:100%; aspect-ratio:1/0.85; background:var(--skeleton-bg); }
        .skeleton-body { padding:10px 12px 12px; }
        .skeleton-line { height: 10px; border-radius: 5px; background: var(--skeleton-bg); margin-bottom: 6px; }
        @keyframes shimmer { from { opacity: .6; } to { opacity: 1; } }

        /* Pagination */
        .pagination-wrap { padding: 40px 24px 0; }
        .pagination-info {
          text-align: center; font-size: 11px; color: var(--text-muted);
          margin-bottom: 12px; font-weight: 500;
        }
        .pagination { display: flex; align-items: center; justify-content: center; gap: 6px; flex-wrap: wrap; }
        .pg-btn {
          min-width: 34px; height: 34px; padding: 0 10px; border-radius: 9px;
          font-size: 12px; font-weight: 600; cursor: pointer;
          border: 1px solid var(--pg-bdr); background: var(--pg-bg); color: var(--pg-clr);
          display: flex; align-items: center; justify-content: center;
          transition: all .18s; font-family: 'Sora', sans-serif;
        }
        .pg-btn:hover:not(:disabled) { border-color: var(--border-hover); color: #07A626; background: var(--accent-glow); }
        .pg-btn:disabled { opacity: .35; cursor: default; }
        .pg-btn.active { background: var(--pg-active-bg); border-color: var(--pg-active-bdr); color: var(--pg-active-clr); }
        .pg-ellipsis {
          color: var(--text-muted); font-size: 12px; padding: 0 2px; user-select: none;
          min-width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;
        }

        /* State box */
        .state-box { grid-column: 1 / -1; text-align: center; padding: 60px 24px; color: var(--text-secondary); font-size: 13px; }
        .state-box button {
          margin-top: 12px; padding: 7px 16px; border-radius: 8px; font-size: 12px;
          font-weight: 600; cursor: pointer; background: rgba(7,166,38,0.12);
          border: 1px solid rgba(7,166,38,0.3); color: var(--badge-trend-clr);
          font-family: 'Sora', sans-serif; transition: all .18s;
        }
        .state-box button:hover { background: rgba(7,166,38,0.2); }

        @media (max-width: 480px) {
          .brands-hero { padding: 36px 16px 0; }
          .brands-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 16px 14px 0; }
          .bc-header { padding: 0 14px; }
          .filter-count-row { padding-left: 14px; padding-right: 14px; }
          .brands-divider { width: calc(100% - 28px); }
          .pagination { gap: 4px; }
          .pg-btn { min-width: 30px; height: 30px; font-size: 11px; }
        }
      `}</style>

      <div className="brands-root">
        <div className="brands-inner">

          <div className="h-10" />
          {/* Hero */}
          <div className="bc-header">
            <h2 className="bc-title">Logo Templates</h2>
            <p className="bc-subtitle">Original logo concepts optimized for visual study</p>
          </div>
          {/* Grid */}
          <div className="brands-grid">


            {loading ? (
              Array.from({ length: PER_PAGE }).map((_, i) => (
                <div key={i} className="skeleton-card">
                  <div className="skeleton-img" />
                  <div className="skeleton-body">
                    <div className="skeleton-line" style={{ width: "60%" }} />
                    <div className="skeleton-line" style={{ width: "40%" }} />
                  </div>
                </div>
              ))
            ) : error ? (
              <div className="state-box">
                <p>Failed to load templates: {error}</p>
                <button onClick={() => fetchLogos(currentPage, activeFilter, debouncedSearch)}>Retry</button>
              </div>
            ) : logos.length === 0 ? (
              <div className="state-box">
                {debouncedSearch ? `No templates found for "${debouncedSearch}".` : "No templates found in this category."}
              </div>
            ) : (
              logos.map((logo, i) => <LogoCard key={logo.id} logo={logo} index={i} />)
            )}
          </div>

          {/* Pagination */}
          {!loading && !error && totalPages > 1 && (
            <div className="pagination-wrap">

              <div className="pagination">
                <button className="pg-btn" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} title="First">«</button>
                <button className="pg-btn" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} title="Previous">‹</button>

                {paginationItems.map((item, i) =>
                  item === "…" ? (
                    <span key={`e${i}`} className="pg-ellipsis">…</span>
                  ) : (
                    <button
                      key={item}
                      className={`pg-btn${item === currentPage ? " active" : ""}`}
                      onClick={() => setCurrentPage(item)}
                    >
                      {item}
                    </button>
                  )
                )}

                <button className="pg-btn" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} title="Next">›</button>
                <button className="pg-btn" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} title="Last">»</button>
              </div>
            </div>
          )}
        </div>
      </div>

    </>
  );
}

/* ─── Logo Card ─────────────────────────────────────────────────────────────── */
function LogoCard({ logo, index }) {
  const [imgError, setImgError] = useState(false);
  const colors = (logo.brandColors ?? []).slice(0, 3);
  const isTrending = logo.downloads > 8000;
  const router = useRouter();
  return (
    <div className="logo-card" style={{ animationDelay: `${index * 35}ms` }} onClick={() => { router.push(`/logo/${logo.slug?.toLowerCase()}`) }}>
      <div className="card-img-wrap">
        {logo.webpUrl && !imgError ? (
          <Image
            className="card-img"
            src={logo.webpUrl}
            alt={logo.logoName}
             width={100}
            height={100}
            sizes="(max-width: 480px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="card-placeholder">{getInitials(logo.logoName)}</div>
        )}
        {isTrending && (
          <div className="trend-badge"><span className="trend-dot" />Trending</div>
        )}
      </div>
      <div className="card-body">
        <div className="card-name">{logo.logoName}</div>
        <div className="card-cat">{logo.category[0]}</div>
        <div className="card-footer">

          <div className="fmt-chips">
            {FORMAT_CHIPS.map((f) => <span key={f.label} className={`fmt ${f.cls}`}>{f.label}</span>)}
          </div>
        </div>
      </div>

    </div>
  );
}