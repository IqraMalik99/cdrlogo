// app/search/[query]/page.jsx  (or pages/search/[query].jsx)
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";

const PAGE_SIZE = 12;

function applyFrontend(allLogos, page) {
    const totalPages = Math.max(1, Math.ceil(allLogos.length / PAGE_SIZE));
    const logos = allLogos.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return { logos, totalPages };
}

function SkeletonCard() {
    return (
        <div className="logo-card skeleton-card">
            <div className="card-image skeleton-img" />
            <div className="card-body">
                <div className="skeleton-line w60" />
                <div className="skeleton-line w40 mt4" />
                <div className="skeleton-line w80 mt4" />
                <div className="card-formats" style={{ marginTop: 8 }}>
                    {[1, 2, 3].map(i => <div key={i} className="skeleton-badge" />)}
                </div>
            </div>
        </div>
    );
}

function LogoCard({ logo }) {
    const [imgErr, setImgErr] = useState(false);
    const colors = Array.isArray(logo.brandColors) ? logo.brandColors : [];
    const formats = ["SVG", "PNG", "AI", "CDR"];
    const router = useRouter(); 

    return (
        <div className="logo-card"  onClick={() => router.push(`/logo/${logo.slug}`)}  >
            <div className="card-image">
                {!imgErr && logo.webpUrl ? (
                    <img src={logo.webpUrl} alt={logo.logoName}
                        onError={() => setImgErr(true)} className="card-img" />
                ) : (
                    <span className="card-initials">
                        {(logo.brand || logo.logoName)?.slice(0, 2).toUpperCase()}
                    </span>
                )}
            </div>

            <div className="card-body">
                <div className="card-name">{logo.brand || logo.logoName}</div>
                <span className="card-category">{logo.category}</span>

                {logo.description && (
                    <p className="card-desc">{logo.description}</p>
                )}

                {colors.length > 0 && (
                    <div className="card-colors">
                        {colors.slice(0, 3).map((c, i) => (
                            <span key={i} className="color-dot" style={{ background: c }} />
                        ))}
                    </div>
                )}

                <div className="card-formats">
                    {formats.map(f => (
                        <span key={f} className={`fmt-tag fmt-${f.toLowerCase()}`}>{f}</span>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function SearchPage() {
    const params = useParams();
    const router = useRouter();
    const rawQuery = decodeURIComponent(params?.query ?? "");

    const [inputVal, setInputVal] = useState(rawQuery);
    const [allLogos, setAllLogos] = useState([]);
    const [logos, setLogos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [lastQuery, setLastQuery] = useState("");
    const inputRef = useRef(null);

    const doSearch = useCallback(async (q) => {
        const trimmed = q?.trim();
        if (!trimmed) return;
        setLoading(true);
        setError(null);
        setPage(1);
        setLastQuery(trimmed);
        try {
            const res = await fetch("/api/searches", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: trimmed }),
            });
            if (!res.ok) throw new Error(`Server error ${res.status}`);
            const data = await res.json();
            console.log("Search results:", data);
            setAllLogos(data.results ?? []);
        } catch (err) {
            setError(err.message);
            setAllLogos([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Search on mount from URL param
    useEffect(() => {
        if (rawQuery) doSearch(rawQuery);
    }, []);  // eslint-disable-line

    // Paginate in JS when allLogos or page changes
    useEffect(() => {
        const { logos: sliced, totalPages: tp } = applyFrontend(allLogos, page);
        setLogos(sliced);
        setTotalPages(tp);
    }, [allLogos, page]);

    const handleSubmit = (e) => {
        e?.preventDefault();
        const q = inputVal.trim().toLowerCase();
        if (!q) return;

        const slug = q.replace(/\s+/g, "-"); // 👈 space → hyphen

        router.push(`/search/${encodeURIComponent(slug)}`);
        doSearch(q);
    };


    const handleKeyDown = (e) => {
        if (e.key === "Enter") handleSubmit();
    };

    return (
        <>
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
          --card-img-bg:    #1a1a24;
          --skeleton:       rgba(255,255,255,0.06);
          --error-color:    #f87171;
          --pill-border:    rgba(255,255,255,0.1);
          --page-btn-bg:    rgba(255,255,255,0.06);
          --page-btn-color: rgba(255,255,255,0.5);
          --page-btn-hover: rgba(255,255,255,0.1);
          --page-active-bg:     rgba(7,166,38,0.2);
          --page-active-color:  #4ade80;
          --page-active-border: rgba(7,166,38,0.45);
          --input-bg:       rgba(255,255,255,0.05);
          --input-border:   rgba(255,255,255,0.1);
          --input-focus:    rgba(7,166,38,0.5);
          --input-color:    #ffffff;
          --input-placeholder: rgba(255,255,255,0.3);
          --search-btn-bg:  rgba(7,166,38,0.85);
          --search-btn-hover: rgba(7,166,38,1);
          --tag-bg:         rgba(255,255,255,0.07);
          --tag-color:      rgba(255,255,255,0.5);
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
          --card-img-bg:    #f0f0f5;
          --skeleton:       rgba(0,0,0,0.06);
          --error-color:    #dc2626;
          --pill-border:    rgba(0,0,0,0.09);
          --page-btn-bg:    rgba(0,0,0,0.05);
          --page-btn-color: rgba(0,0,0,0.5);
          --page-btn-hover: rgba(0,0,0,0.09);
          --page-active-bg:     rgba(7,166,38,0.1);
          --page-active-color:  #15803d;
          --page-active-border: rgba(7,166,38,0.35);
          --input-bg:       #ffffff;
          --input-border:   rgba(0,0,0,0.12);
          --input-focus:    rgba(7,166,38,0.4);
          --input-color:    #0a0a14;
          --input-placeholder: rgba(0,0,0,0.3);
          --search-btn-bg:  rgba(7,166,38,0.9);
          --search-btn-hover: #07a626;
          --tag-bg:         rgba(0,0,0,0.05);
          --tag-color:      rgba(0,0,0,0.5);
        }

        .search-page {
          min-height: 100vh;
          background: var(--page-bg);
          font-family: 'Sora', sans-serif;
          padding: 0 0 60px;
          transition: background 0.35s;
        }
        .search-container { max-width: 1200px; margin: 0 auto; padding: 90px 24px 0; }

        /* ── Search bar ── */
        .search-hero { margin-bottom: 32px; }
        .search-label {
          font-size: 22px; font-weight: 800; color: var(--text-primary);
          letter-spacing: -0.5px; margin-bottom: 16px; display: block;
          transition: color 0.3s;
        }
        .search-label span { color: #4ade80; }
        [data-theme="light"] .search-label span { color: #15803d; }

        .search-row {
          display: flex; gap: 10px; align-items: center;
        }
        .search-input-wrap {
          flex: 1; position: relative; display: flex; align-items: center;
        }
        .search-icon {
          position: absolute; left: 14px; color: var(--input-placeholder);
          display: flex; align-items: center; pointer-events: none;
        }
        .search-input {
          width: 100%; height: 48px; padding: 0 48px 0 44px;
          background: var(--input-bg); border: 1px solid var(--input-border);
          border-radius: 12px; font-family: 'Sora', sans-serif;
          font-size: 14px; font-weight: 500; color: var(--input-color);
          outline: none; transition: border-color 0.2s, box-shadow 0.2s;
        }
        .search-input::placeholder { color: var(--input-placeholder); }
        .search-input:focus {
          border-color: var(--input-focus);
          box-shadow: 0 0 0 3px rgba(7,166,38,0.1);
        }
        .search-clear {
          position: absolute; right: 12px; background: none; border: none;
          color: var(--input-placeholder); cursor: pointer; padding: 4px;
          display: flex; align-items: center; border-radius: 4px;
          transition: color 0.15s;
        }
        .search-clear:hover { color: var(--text-primary); }

        .search-btn {
          height: 48px; padding: 0 22px; border-radius: 12px; border: none;
          background: var(--search-btn-bg); color: #fff;
          font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 700;
          cursor: pointer; white-space: nowrap;
          transition: background 0.2s, transform 0.1s;
          display: flex; align-items: center; gap: 6px;
        }
        .search-btn:hover { background: var(--search-btn-hover); }
        .search-btn:active { transform: scale(0.98); }
        .search-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── Result meta ── */
        .result-meta {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 20px; flex-wrap: wrap; gap: 8px;
        }
        .result-count {
          font-family: 'DM Sans', sans-serif; font-size: 13px;
          color: var(--text-secondary); transition: color 0.3s;
        }
        .result-count strong { color: var(--text-primary); font-weight: 600; }
        .query-tag {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 12px; border-radius: 100px;
          background: var(--tag-bg); font-size: 12px; color: var(--tag-color);
          font-weight: 500;
        }

        /* ── Cards (same as LogosPage) ── */
        .logos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; margin-bottom: 36px; }

        .logo-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 14px; overflow: hidden; cursor: pointer; position: relative;
          transition: background 0.2s, border-color 0.2s, transform 0.2s, box-shadow 0.2s;
        }
        .logo-card:hover {
          background: var(--surface-hover); border-color: var(--border-hover);
          transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.15);
        }
        [data-theme="dark"] .logo-card:hover { box-shadow: 0 12px 32px rgba(0,0,0,0.5); }

        .card-image {
          width: 100%; height: 130px; background: var(--card-img-bg);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; transition: background 0.3s;
        }
        .card-img { width: 100%; height: 100%; object-fit: contain; padding: 16px; }
        .card-initials { font-size: 30px; font-weight: 900; color: var(--text-secondary); letter-spacing: -1px; }

        .card-body { padding: 10px 12px 12px; }
        .card-name { font-size: 15px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.3px; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color 0.3s; }
        .card-category { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 6px; transition: color 0.3s; }
        .card-desc { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .card-colors { display: flex; gap: 4px; margin-bottom: 8px; }
        .color-dot { width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.15); }
        [data-theme="light"] .color-dot { border-color: rgba(0,0,0,0.1); }

        .card-formats { display: flex; flex-wrap: wrap; gap: 4px; }
        .fmt-tag { padding: 2px 6px; border-radius: 4px; font-size: 9.5px; font-weight: 700; letter-spacing: 0.3px; border: 1px solid; }
        .fmt-ai  { background:rgba(234,179,8,.1);  border-color:rgba(234,179,8,.25);  color:#fde68a; }
        .fmt-svg { background:rgba(34,197,94,.1);  border-color:rgba(34,197,94,.25);  color:#86efac; }
        .fmt-png { background:rgba(59,130,246,.1); border-color:rgba(59,130,246,.25); color:#93c5fd; }
        .fmt-cdr { background:rgba(168,85,247,.1); border-color:rgba(168,85,247,.25); color:#d8b4fe; }
        [data-theme="light"] .fmt-ai  { color:#92400e; }
        [data-theme="light"] .fmt-svg { color:#166534; }
        [data-theme="light"] .fmt-png { color:#1e40af; }
        [data-theme="light"] .fmt-cdr { color:#6b21a8; }

        /* ── Skeleton ── */
        .skeleton-card { pointer-events: none; }
        .skeleton-img { width: 100%; height: 130px; background: var(--skeleton); animation: shimmer 1.6s infinite linear; }
        .skeleton-line { height: 10px; border-radius: 5px; background: var(--skeleton); animation: shimmer 1.6s infinite linear; }
        .w60{width:60%} .w40{width:40%} .w80{width:80%} .mt4{margin-top:4px}
        .skeleton-badge { width:28px; height:16px; border-radius:4px; background:var(--skeleton); animation:shimmer 1.6s infinite linear; }
        @keyframes shimmer { 0%{opacity:1} 50%{opacity:0.4} 100%{opacity:1} }

        /* ── States ── */
        .error-state { text-align:center; padding:60px 24px; color:var(--error-color); font-size:14px; }
        .error-state button { margin-top:12px; padding:8px 20px; border-radius:8px; border:1px solid var(--error-color); background:transparent; color:var(--error-color); font-family:'Sora',sans-serif; font-size:13px; font-weight:600; cursor:pointer; }
        .empty-state { grid-column:1/-1; text-align:center; padding:60px 24px; color:var(--text-secondary); font-size:14px; }
        .empty-icon { font-size: 36px; margin-bottom: 12px; display: block; }
        .idle-state { text-align:center; padding:80px 24px; color:var(--text-secondary); font-size:14px; }

        /* ── Pagination ── */
        .pagination { display:flex; align-items:center; justify-content:center; gap:6px; }
        .page-btn { min-width:36px; height:36px; padding:0 10px; border-radius:9px; border:1px solid var(--pill-border); background:var(--page-btn-bg); font-family:'Sora',sans-serif; font-size:13px; font-weight:600; color:var(--page-btn-color); cursor:pointer; transition:background 0.15s,color 0.15s,border-color 0.15s; display:flex; align-items:center; justify-content:center; }
        .page-btn:hover:not(.active):not(:disabled) { background:var(--page-btn-hover); color:var(--text-primary); }
        .page-btn.active { background:var(--page-active-bg); border-color:var(--page-active-border); color:var(--page-active-color); }
        .page-btn:disabled { opacity:0.35; cursor:not-allowed; }
        .page-ellipsis { color:var(--text-muted); font-size:13px; padding:0 4px; }

        /* ── Mobile ── */
        @media (max-width:640px) {
          .search-container { padding: 20px 12px 0; }
          .search-label { font-size: 18px; margin-bottom: 12px; }
          .search-btn span { display: none; }
          .search-btn { padding: 0 16px; }
          .logos-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 24px; }
          .card-image { height: 105px; }
          .card-name { font-size: 13px; }
          .card-formats { gap: 3px; }
          .pagination { gap: 4px; }
          .page-btn { min-width: 32px; height: 32px; font-size: 12px; }
        }
      `}</style>
            <div>
                <Navbar />
                <div className="search-page">
                    <div className="search-container">
                        {/* ── Search hero ── */}
                        <div className="search-hero">
                            <span className="search-label">
                                Search <span>Logos</span>
                            </span>
                            <div className="search-row">
                                <div className="search-input-wrap">
                                    <span className="search-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                                        </svg>
                                    </span>
                                    <input
                                        ref={inputRef}
                                        className="search-input"
                                        type="text"
                                        placeholder="Search by brand, category, keyword…"
                                        value={inputVal}
                                        onChange={e => setInputVal(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                    />
                                    {inputVal && (
                                        <button className="search-clear" onClick={() => { setInputVal(""); inputRef.current?.focus(); }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                                <button className="search-btn" onClick={handleSubmit} disabled={loading || !inputVal.trim()}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    </svg>
                                    <span>Search</span>
                                </button>
                            </div>
                        </div>

                        {/* ── Result meta ── */}
                        {!loading && !error && lastQuery && allLogos.length > 0 && (
                            <div className="result-meta">
                                <p className="result-count">
                                    <strong>{allLogos.length}</strong> result{allLogos.length !== 1 ? "s" : ""} found
                                </p>
                                <span className="query-tag">"{lastQuery}"</span>
                            </div>
                        )}

                        {/* ── Grid ── */}
                        {error ? (
                            <div className="error-state">
                                <span> Not found</span>
                                <button onClick={() => doSearch(lastQuery)}>Try again</button>
                            </div>
                        ) : !lastQuery && !loading ? (
                            <div className="idle-state">Type something above to search logos.</div>
                        ) : (
                            <div className="logos-grid">
                                {loading
                                    ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
                                    : logos.length === 0
                                        ? (
                                            <div className="empty-state">
                                                <span className="empty-icon">🔍</span>
                                                No logos found for "{lastQuery}"
                                            </div>
                                        )
                                        : logos.map(logo => <LogoCard key={logo.id} logo={logo} />)
                                }
                            </div>
                        )}

                        {/* ── Pagination ── */}
                        {!error && !loading && logos.length > 0 && totalPages > 1 && (
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
            </div>
            <Footer />
        </>
    );
}