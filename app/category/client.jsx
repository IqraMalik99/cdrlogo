"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useTheme } from "../context/ThemeContext";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";

const LETTERS = ["All", "0-9", ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))];

export default function CategoriesClient() {
    const [searchValue, setSearchValue] = useState("");
    const [activeLetter, setActiveLetter] = useState("All");
    const [focused, setFocused] = useState(false);
    const [ready, setReady] = useState(false);
    const [categories, setCategories] = useState({});
    // allCategories caches the full "All" response so search always works across every letter
    const [allCategories, setAllCategories] = useState({});
    const [loading, setLoading] = useState(false);
    const { dark } = useTheme();
    const router = useRouter();
    const letterRefs = useRef({});

    // Derive which letters have categories from the full "All" cache
    const lettersWithData = useMemo(() => {
        return new Set(Object.keys(allCategories));
    }, [allCategories]);

    useEffect(() => {
        const t = setTimeout(() => setReady(true), 60);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        async function fetchCategories() {
            const letter = activeLetter === "All" ? "all" : activeLetter.toLowerCase();
            setLoading(true);
            try {
                const res = await fetch("/api/website/catageory-letter", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ letter }),
                });
                const data = await res.json();
                console.log("Fetched categories for letter", letter, data);

                // API returns { SectionKey: [ { name, slug }, ... ] }
                // Values are already objects — no JSON.parse needed
                const parsed = {};
                Object.entries(data || {}).forEach(([key, cats]) => {
                    parsed[key] = cats.map(c =>
                        typeof c === "object" && c !== null
                            ? c
                            : { name: String(c), slug: String(c).toLowerCase().replace(/\s+/g, "-") }
                    );
                });

                setCategories(parsed);
                if (activeLetter === "All") {
                    setAllCategories(parsed);
                }
            } catch (err) {
                console.error("Failed to fetch categories", err);
            } finally {
                setLoading(false);
            }
        }
        fetchCategories();
    }, [activeLetter]);

    const filteredCategories = () => {
        const query = searchValue.trim().toLowerCase();
        // when searching use the full "All" cache so results aren't limited to active letter
        const source = query ? allCategories : categories;

        if (query) {
            const result = {};
            Object.entries(source).forEach(([key, cats]) => {
                const matched = cats.filter(c => c.name.toLowerCase().includes(query));
                if (matched.length) result[key] = matched;
            });
            return result;
        }

        return source;
    };

    const handleCategoryClick = (cat) => {
        // cat is { name, slug } — use slug directly from API
        router.push(`/category/${encodeURIComponent(cat.slug)}`);
    };

    const handleLetterClick = (l) => {
        setSearchValue(""); // clear search when switching letters
        setActiveLetter(l);
    };

    const visible = Object.entries(filteredCategories()).filter(([, cats]) => cats.length > 0);

    const handleSearch = () => {
        const q = searchValue.trim().toLowerCase();
        if (!q) return;
        const slug = q.replace(/\s+/g, "-");
        router.push(`/category/${encodeURIComponent(slug)}`);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") handleSearch();
    };

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
          .accent {
             color: #07A626;
        }
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

        /* Letters that have categories */
        .letter-btn.has-data {
          color: var(--heading);
          border-color: rgba(7,166,38,.22);
        }
        [data-theme="light"] .letter-btn.has-data {
          color: var(--heading);
          border-color: rgba(7,166,38,.28);
        }

        /* Small green dot below the letter */
        .letter-dot {
          position: absolute;
          bottom: 3px;
          left: 50%;
          transform: translateX(-50%);
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: #07A626;
          opacity: 0.75;
          pointer-events: none;
        }

        .sections { display: flex; flex-direction: column; gap: 24px; }
        .section-letter {
          font-size: 13px; font-weight: 800;
          color: var(--section-lbl);
          letter-spacing: 0.5px;
          margin-bottom: 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid var(--divider);
        }
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
        .cat-card-arrow {
          margin-left: auto; opacity: 0; flex-shrink: 0;
          transition: opacity .15s, transform .15s;
          color: #07A626;
        }
        .cat-card:hover .cat-card-arrow { opacity: 1; transform: translateX(2px); }
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
        @keyframes shimmer {
          0%,100% { opacity: 1; } 50% { opacity: 0.35; }
        }
        .empty-state {
          text-align: center; padding: 48px 20px;
          color: var(--sub); font-size: 13px;
        }
        .empty-state strong {
          display: block; font-size: 15px; font-weight: 700;
          margin-bottom: 4px; color: var(--heading);
        }
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
                            <p className="cat-heading" style={{ margin: 0 }}>Browse Design Categories <span className="accent">&</span> Visual Archives</p>
                            <p className="cat-sub">
                                Explore an independent educational reference library organized by 0–9 and A–Z. Browse logo categories, 
original design concepts, and visual resources for research, learning, and creative inspiration.
                            </p>
                        </div>

                        {/* Search */}
                        <div className="anim d1">
                            <div
                                className={`search-bar${focused ? " focused" : ""}`}
                                onClick={() => document.getElementById("cat-search")?.focus()}
                            >
                                <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24"
                                    fill="none" stroke="currentColor" strokeWidth="2.2"
                                    strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                <input
                                    id="cat-search"
                                    className="search-input"
                                    type="text"
                                    placeholder="Search categories…"
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
                                        const hasData = l === "All"
                                            ? Object.keys(allCategories).length > 0
                                            : lettersWithData.has(l);
                                        return (
                                            <button
                                                key={l}
                                                ref={el => letterRefs.current[l] = el}
                                                className={[
                                                    "letter-btn",
                                                    l === "All" ? "all-btn" : "",
                                                    activeLetter === l ? "active" : "",
                                                    hasData ? "has-data" : "",
                                                ].filter(Boolean).join(" ")}
                                                onClick={() => handleLetterClick(l)}
                                            >
                                                {l}
                                                {hasData && l !== "All" && (
                                                    <span className="letter-dot" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Category sections */}
                        <div className="anim d3">
                            {loading ? (
                                <div className="sections">
                                    {[1, 2, 3].map(s => (
                                        <div key={s}>
                                            <div className="section-letter" style={{ width: 24, background: "var(--tag-bg)", height: 14, borderRadius: 4 }} />
                                            <div className="skeleton-grid">
                                                {Array.from({ length: 6 }).map((_, i) => (
                                                    <div key={i} className="skeleton-card" style={{ animationDelay: `${i * 80}ms` }} />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : visible.length === 0 ? (
                                <div className="empty-state">
                                    <strong>No categories found</strong>
                                    Try a different search term
                                </div>
                            ) : (
                                <div className="sections">
                                    {visible.map(([sectionKey, cats]) => (
                                        <div key={sectionKey}>
                                            <div className="section-letter">{sectionKey}</div>
                                            <div className="cat-grid">
                                                {cats.map(cat => (
                                                    <button
                                                        key={cat.slug}
                                                        className="cat-card"
                                                        onClick={() => handleCategoryClick(cat)}
                                                    >
                                                        {cat.name}
                                                        <svg className="cat-card-arrow" width="12" height="12" viewBox="0 0 24 24"
                                                            fill="none" stroke="currentColor" strokeWidth="2.5"
                                                            strokeLinecap="round" strokeLinejoin="round">
                                                            <line x1="5" y1="12" x2="19" y2="12" />
                                                            <polyline points="12 5 19 12 12 19" />
                                                        </svg>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </>
    );
}