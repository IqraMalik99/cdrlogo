"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "../context/ThemeContext";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";

const LETTERS = ["All", "0-9", ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))];
const PAGE_LIMIT = 60;

export default function BrandsClient() {
    const [searchValue, setSearchValue] = useState("");
    const [activeLetter, setActiveLetter] = useState("All");
    const [focused, setFocused] = useState(false);
    const [ready, setReady] = useState(false);

    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [lettersWithData, setLettersWithData] = useState(new Set());

    const { dark } = useTheme();
    const router = useRouter();

    const searchDebounceRef = useRef(null);
    const searchFirstRender = useRef(true);

    useEffect(() => {
        const t = setTimeout(() => setReady(true), 60);
        return () => clearTimeout(t);
    }, []);

    // ── fetch brands whenever letter, page, or (debounced) search changes ──
    async function fetchBrands({ letter, pageNum, query }) {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (query) {
                params.set("search", query);
            } else {
                params.set("letter", letter === "All" ? "all" : letter);
            }
            params.set("page", String(pageNum));
            params.set("limit", String(PAGE_LIMIT));

            const res = await fetch(`/api/sub-cat/list?${params.toString()}`, { method: "GET" });
            const data = await res.json();
            console.log("[BrandsClient] fetched", { letter, pageNum, query, count: data.brands?.length, total: data.total });

            setBrands(data.brands || []);
            setTotalPages(data.totalPages || 1);
            setTotal(data.total || 0);
            if (Array.isArray(data.lettersWithData)) {
                setLettersWithData(new Set(data.lettersWithData));
            }
        } catch (err) {
            console.error("[BrandsClient] fetch failed", err);
            setBrands([]);
        } finally {
            setLoading(false);
        }
    }

    // letter / page changes → fetch immediately (only when not actively searching)
    useEffect(() => {
        if (searchValue.trim()) return; // search effect below handles this case
        fetchBrands({ letter: activeLetter, pageNum: page, query: "" });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeLetter, page]);

    // search changes → debounce, reset to page 1, fetch across all letters
    useEffect(() => {
        if (searchFirstRender.current) {
            searchFirstRender.current = false;
            return;
        }
        clearTimeout(searchDebounceRef.current);
        const q = searchValue.trim();

        if (!q) {
            setPage(1);
            fetchBrands({ letter: activeLetter, pageNum: 1, query: "" });
            return;
        }

        searchDebounceRef.current = setTimeout(() => {
            setPage(1);
            fetchBrands({ letter: activeLetter, pageNum: 1, query: q });
        }, 400);

        return () => clearTimeout(searchDebounceRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchValue]);

    function cleanSlug(slug = "") {
        return slug
            .trim()
            .toLowerCase()
            .replace(/^\/+/, "")
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    const handleBrandClick = (brand) => {
        router.push(`/categories/logos/${encodeURIComponent(cleanSlug(brand.slug))}`);
    };

    const handleLetterClick = (l) => {
        setSearchValue("");
        setActiveLetter(l);
        setPage(1);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            clearTimeout(searchDebounceRef.current);
            const q = searchValue.trim();
            if (q) { setPage(1); fetchBrands({ letter: activeLetter, pageNum: 1, query: q }); }
        }
    };

    const goToPage = (p) => {
        if (p < 1 || p > totalPages || p === page) return;
        setPage(p);
        if (searchValue.trim()) {
            fetchBrands({ letter: activeLetter, pageNum: p, query: searchValue.trim() });
        }
        // non-search case is handled by the [activeLetter, page] effect
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // build a compact page-number list: 1 … p-1 p p+1 … last
    const pageNumbers = (() => {
        const nums = [];
        const add = (n) => { if (n >= 1 && n <= totalPages && !nums.includes(n)) nums.push(n); };
        add(1); add(page - 1); add(page); add(page + 1); add(totalPages);
        return nums.sort((a, b) => a - b);
    })();

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&family=DM+Sans:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        [data-theme="dark"] {
          --bg:           #09090f;
          --heading:      #ffffff;
          --sub:          rgba(255,255,255,0.45);
          --divider:      rgba(255,255,255,0.08);
          --search-bg:    rgba(255,255,255,0.04);
          --search-bdr:   rgba(255,255,255,0.1);
          --search-clr:   #ffffff;
          --search-ph:    rgba(255,255,255,0.3);
          --tag-bg:       rgba(255,255,255,0.05);
          --tag-bdr:      rgba(255,255,255,0.09);
          --tag-clr:      rgba(255,255,255,0.7);
          --letter-bg:    rgba(255,255,255,0.04);
          --letter-bdr:   rgba(255,255,255,0.09);
          --letter-clr:   rgba(255,255,255,0.5);
          --dot:          rgba(255,255,255,0.04);
          --section-lbl:  #07A626;
        }
        [data-theme="light"] {
          --bg:           #f4f4f8;
          --heading:      #0a0a14;
          --sub:          rgba(0,0,0,0.5);
          --divider:      rgba(0,0,0,0.08);
          --search-bg:    rgba(255,255,255,0.9);
          --search-bdr:   rgba(0,0,0,0.12);
          --search-clr:   #0a0a14;
          --search-ph:    rgba(0,0,0,0.3);
          --tag-bg:       rgba(255,255,255,0.9);
          --tag-bdr:      rgba(0,0,0,0.1);
          --tag-clr:      rgba(0,0,0,0.7);
          --letter-bg:    rgba(255,255,255,0.8);
          --letter-bdr:   rgba(0,0,0,0.1);
          --letter-clr:   rgba(0,0,0,0.5);
          --dot:          rgba(0,0,0,0.04);
          --section-lbl:  #059c1f;
        }

        .cat-root {
          min-height: 100vh;
          background: var(--bg);
          font-family: 'Sora', 'Segoe UI', sans-serif;
          padding: 48px 20px 80px;
          position: relative;
          overflow-x: hidden;
          transition: background 0.35s;
        }
        .bg-glow {
          position: absolute; top: 0; left: 0; right: 0;
          height: 320px; pointer-events: none; z-index: 0;
        }
        .accent { color: #07A626; }
        .bg-glow::before {
          content: '';
          position: absolute;
          top: -10%; left: 50%;
          transform: translateX(-50%);
          width: 700px; height: 340px;
          background: radial-gradient(ellipse, rgba(7,166,38,.1) 0%, transparent 70%);
          border-radius: 50%;
          animation: glow-pulse 5s ease-in-out infinite;
        }
        [data-theme="light"] .bg-glow::before {
          background: radial-gradient(ellipse, rgba(7,166,38,.06) 0%, transparent 70%);
        }
        @keyframes glow-pulse {
          0%,100% { opacity:1; transform:translateX(-50%) scale(1); }
          50%      { opacity:.7; transform:translateX(-50%) scale(1.07); }
        }
        .dot-grid {
          position: absolute; inset: 0;
          background-image: radial-gradient(var(--dot) 1px, transparent 1px);
          background-size: 30px 30px;
          pointer-events: none; z-index: 0;
        }
        .cat-inner {
          position: relative; z-index: 1;
          max-width: 860px; margin: 0 auto;
          display: flex; flex-direction: column; gap: 28px;
        }
        .anim { opacity: 0; transform: translateY(14px);
          transition: opacity .5s cubic-bezier(.22,1,.36,1), transform .5s cubic-bezier(.22,1,.36,1); }
        .ready .anim { opacity: 1; transform: translateY(0); }
        .d0 { transition-delay: 0ms; }
        .d1 { transition-delay: 60ms; }
        .d2 { transition-delay: 120ms; }
        .d3 { transition-delay: 180ms; }
        .cat-heading {
          font-size: clamp(22px, 4vw, 36px);
          font-weight: 900; letter-spacing: -0.8px;
          color: var(--heading); text-align: center;
          line-height: 1.15; transition: color 0.35s;
        }
        .cat-sub {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; color: var(--sub);
          text-align: center; line-height: 1.65;
          max-width: 520px; margin: 0 auto;
          transition: color 0.35s;
        }
        .search-bar {
          display: flex; align-items: center; gap: 9px;
          padding: 10px 14px;
          background: var(--search-bg);
          border: 1.5px solid var(--search-bdr);
          border-radius: 11px;
          box-shadow: 0 2px 16px rgba(0,0,0,.08);
          transition: border-color .2s, box-shadow .2s, background 0.35s;
          cursor: text;
        }
        .search-bar.focused {
          border-color: rgba(7,166,38,.7);
          box-shadow: 0 0 0 3px rgba(7,166,38,.1);
        }
        .search-icon { color: rgba(128,128,160,0.5); flex-shrink: 0; }
        .search-input {
          flex: 1; background: none; border: none; outline: none;
          font-size: 13.5px; font-family: 'Sora', sans-serif; font-weight: 500;
          color: var(--search-clr); caret-color: #07A626;
          transition: color 0.3s;
        }
        .search-input::placeholder { color: var(--search-ph); }
        .letter-nav {
          display: flex; flex-wrap: wrap; gap: 5px;
          justify-content: center;
        }
        .letter-btn {
          position: relative;
          width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center;
          background: var(--letter-bg);
          border: 1px solid var(--letter-bdr);
          border-radius: 7px;
          font-size: 11px; font-weight: 700;
          color: var(--letter-clr);
          cursor: pointer;
          transition: background .2s, border-color .2s, color .2s, transform .15s;
          font-family: 'Sora', sans-serif;
        }
        .letter-btn:hover {
          background: rgba(7,166,38,.1);
          border-color: rgba(7,166,38,.3);
          color: #4ade80;
          transform: translateY(-1px);
        }
        [data-theme="light"] .letter-btn:hover { color: #15803d; }
        .letter-btn.active {
          background: rgba(7,166,38,.15);
          border-color: rgba(7,166,38,.55);
          color: #07A626;
        }
        [data-theme="light"] .letter-btn.active { color: #059c1f; }
        .letter-btn.all-btn { width: auto; padding: 0 12px; }
        .letter-btn.has-data { color: var(--heading); border-color: rgba(7,166,38,.22); }
        [data-theme="light"] .letter-btn.has-data { color: var(--heading); border-color: rgba(7,166,38,.28); }
        .letter-dot {
          position: absolute; bottom: 3px; left: 50%; transform: translateX(-50%);
          width: 3px; height: 3px; border-radius: 50%;
          background: #07A626; opacity: 0.75; pointer-events: none;
        }

        .results-meta {
          font-family: 'DM Sans', sans-serif;
          font-size: 12px; color: var(--sub);
          text-align: center;
        }
        .results-meta strong { color: var(--heading); font-weight: 700; }

        .cat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 8px;
        }
        .cat-card {
          background: var(--tag-bg);
          border: 1px solid var(--tag-bdr);
          border-radius: 9px;
          padding: 10px 14px;
          font-size: 12.5px; font-weight: 600;
          color: var(--tag-clr);
          cursor: pointer;
          transition: background .2s, border-color .2s, color .2s, transform .15s;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          display: flex; align-items: center; gap: 7px;
          font-family: 'Sora', sans-serif;
          text-align: left;
        }
        .cat-card:hover {
          background: rgba(7,166,38,.1);
          border-color: rgba(7,166,38,.35);
          color: #4ade80;
          transform: translateY(-1px);
        }
        [data-theme="light"] .cat-card:hover { color: #15803d; }
        .cat-card-count {
          margin-left: auto; flex-shrink: 0;
          font-size: 10px; font-weight: 700;
          color: var(--sub);
          background: var(--letter-bg);
          border: 1px solid var(--tag-bdr);
          border-radius: 100px;
          padding: 1px 7px;
        }
        .cat-card:hover .cat-card-count { color: #07A626; border-color: rgba(7,166,38,.3); }

        .skeleton-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 8px; margin-top: 10px;
        }
        .skeleton-card {
          height: 40px; border-radius: 9px;
          background: var(--tag-bg);
          border: 1px solid var(--tag-bdr);
          animation: shimmer 1.4s ease-in-out infinite;
        }
        @keyframes shimmer { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        .empty-state {
          text-align: center; padding: 48px 20px;
          color: var(--sub); font-size: 13px;
        }
        .empty-state strong {
          display: block; font-size: 15px; font-weight: 700;
          margin-bottom: 4px; color: var(--heading);
        }

        .pagination {
          display: flex; align-items: center; justify-content: center;
          gap: 6px; margin-top: 8px; flex-wrap: wrap;
        }
        .page-btn {
          min-width: 32px; height: 32px; padding: 0 8px;
          display: flex; align-items: center; justify-content: center;
          background: var(--letter-bg);
          border: 1px solid var(--letter-bdr);
          border-radius: 7px;
          font-size: 12px; font-weight: 700;
          color: var(--letter-clr);
          cursor: pointer;
          font-family: 'Sora', sans-serif;
          transition: background .2s, border-color .2s, color .2s;
        }
        .page-btn:hover:not(:disabled) {
          background: rgba(7,166,38,.1);
          border-color: rgba(7,166,38,.3);
          color: #4ade80;
        }
        [data-theme="light"] .page-btn:hover:not(:disabled) { color: #15803d; }
        .page-btn.active {
          background: rgba(7,166,38,.15);
          border-color: rgba(7,166,38,.55);
          color: #07A626;
        }
        .page-btn:disabled { opacity: .35; cursor: not-allowed; }
        .page-ellipsis { color: var(--sub); font-size: 12px; padding: 0 2px; }

        @media (max-width: 480px) {
          .cat-root { padding: 36px 14px 60px; }
          .letter-btn { width: 28px; height: 28px; font-size: 10px; }
          .cat-grid, .skeleton-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
        }
      `}</style>

            <div>
                <Navbar />

                <div className="cat-root">
                    <div className="bg-glow" />
                    <div className="dot-grid" />

                    <div className={`cat-inner${ready ? " ready" : ""}`}>
                        <div className="h-10" />

                        {/* Header */}
                        <div className="anim d0" style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "8px" }}>
                            <p className="cat-heading" style={{ margin: 0 }}>Browse Design Categories <span className="accent">&</span> Visual Archives </p>
                            <p className="cat-sub">
                                Every brand in our library, listed once — no duplicates. Browse alphabetically or search
                                to jump straight to a brand's logo, then explore its full collection.
                            </p>
                        </div>

                        {/* Search */}
                        <div className="anim d1">
                            <div
                                className={`search-bar${focused ? " focused" : ""}`}
                                onClick={() => document.getElementById("brand-search")?.focus()}
                            >
                                <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24"
                                    fill="none" stroke="currentColor" strokeWidth="2.2"
                                    strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                <input
                                    id="brand-search"
                                    className="search-input"
                                    type="text"
                                    placeholder="Search brands…"
                                    value={searchValue}
                                    onChange={e => setSearchValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onFocus={() => setFocused(true)}
                                    onBlur={() => setFocused(false)}
                                />
                                {searchValue && (
                                    <button
                                        onClick={() => setSearchValue("")}
                                        style={{
                                            background: "none", border: "none", cursor: "pointer",
                                            color: "rgba(128,128,160,0.5)", fontSize: "16px", lineHeight: 1, padding: "0 2px"
                                        }}
                                    >×</button>
                                )}
                            </div>
                        </div>

                        {/* Letter nav — hidden while searching */}
                        {!searchValue && (
                            <div className="anim d2">
                                <div className="letter-nav">
                                    {LETTERS.map(l => {
                                        const hasData = l === "All" ? true : lettersWithData.has(l);
                                        return (
                                            <button
                                                key={l}
                                                className={[
                                                    "letter-btn",
                                                    l === "All" ? "all-btn" : "",
                                                    activeLetter === l ? "active" : "",
                                                    hasData ? "has-data" : "",
                                                ].filter(Boolean).join(" ")}
                                                onClick={() => handleLetterClick(l)}
                                            >
                                                {l}
                                                {hasData && l !== "All" && <span className="letter-dot" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Results meta */}
                        {!loading && total > 0 && (
                            <div className="results-meta anim d2">
                                <strong>{total.toLocaleString()}</strong> brand{total === 1 ? "" : "s"}
                                {searchValue ? <> matching "<strong>{searchValue}</strong>"</> : null}
                            </div>
                        )}

                        {/* Brand grid */}
                        <div className="anim d3">
                            {loading ? (
                                <div className="skeleton-grid">
                                    {Array.from({ length: 12 }).map((_, i) => (
                                        <div key={i} className="skeleton-card" style={{ animationDelay: `${i * 60}ms` }} />
                                    ))}
                                </div>
                            ) : brands.length === 0 ? (
                                <div className="empty-state">
                                    <strong>No Categories found</strong>
                                    Try a different search term or letter
                                </div>
                            ) : (
                                <div className="cat-grid">
                                    {brands.map(brand => (
                                        <button
                                            key={brand.slug}
                                            className="cat-card"
                                            onClick={() => handleBrandClick(brand)}
                                        >
                                            {brand.name}
                                            <span className="cat-card-count">{brand.logoCount}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Pagination */}
                        {!loading && totalPages > 1 && (
                            <div className="pagination anim d3">
                                <button className="page-btn" onClick={() => goToPage(page - 1)} disabled={page === 1}>‹</button>
                                {pageNumbers.map((n, i) => {
                                    const prev = pageNumbers[i - 1];
                                    const showEllipsis = prev !== undefined && n - prev > 1;
                                    return (
                                        <span key={n} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            {showEllipsis && <span className="page-ellipsis">…</span>}
                                            <button
                                                className={`page-btn${n === page ? " active" : ""}`}
                                                onClick={() => goToPage(n)}
                                            >{n}</button>
                                        </span>
                                    );
                                })}
                                <button className="page-btn" onClick={() => goToPage(page + 1)} disabled={page === totalPages}>›</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}