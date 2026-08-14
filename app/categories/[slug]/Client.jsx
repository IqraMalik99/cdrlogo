



"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "../../context/ThemeContext";
import Navbar from "../../components/Navbar";

export default function CategoryGroupClient({ slug, initialCategoryName, initialData }) {
  const router = useRouter();
  const { dark } = useTheme();

  const [data, setData] = useState(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(null);
  const [searchValue, setSearchValue] = useState("");
  const [sort, setSort] = useState("az"); // "az" | "count"

  const fetchGroup = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/catageory/group/${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!initialData) fetchGroup();
  }, [fetchGroup, initialData]);

  // Client-side filter + sort — instant, no refetch on keystroke
  const visibleSubcategories = useMemo(() => {
    if (!data?.subcategories) return [];
    const q = searchValue.trim().toLowerCase();
    let list = q
      ? data.subcategories.filter((s) => s.name.toLowerCase().includes(q))
      : data.subcategories;

    list = [...list].sort((a, b) =>
      sort === "count" ? b.count - a.count : a.name.localeCompare(b.name)
    );
    return list;
  }, [data, searchValue, sort]);

  const handleSubClick = (sub) => {
    router.push(`/categories/logos/${encodeURIComponent(sub.slug)}`);
  };

  const categoryName = data?.categoryName || initialCategoryName || slug;
  const totalLogos = data?.totalLogos ?? 0;
  const totalSubs = data?.subcategories?.length ?? 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&family=DM+Sans:wght@400;500&display=swap');

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
          --search-bg:      rgba(255,255,255,0.04);
          --search-bdr:     rgba(255,255,255,0.1);
          --search-clr:     #ffffff;
          --search-ph:      rgba(255,255,255,0.3);
          --toggle-bg:      rgba(255,255,255,0.05);
          --toggle-border:  rgba(255,255,255,0.09);
          --toggle-active-bg: rgba(7,166,38,0.18);
          --toggle-active-clr: #4ade80;
          --skeleton:       rgba(255,255,255,0.06);
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
          --search-bg:      rgba(255,255,255,0.9);
          --search-bdr:     rgba(0,0,0,0.12);
          --search-clr:     #0a0a14;
          --search-ph:      rgba(0,0,0,0.3);
          --toggle-bg:      rgba(255,255,255,0.9);
          --toggle-border:  rgba(0,0,0,0.1);
          --toggle-active-bg: rgba(7,166,38,0.1);
          --toggle-active-clr: #15803d;
          --skeleton:       rgba(0,0,0,0.06);
          --error-color:    #dc2626;
        }

        .grp-page { min-height: 100vh; background: var(--page-bg); font-family: 'Sora', sans-serif; padding: 0 0 60px; transition: background 0.35s; }
        .grp-container { max-width: 1200px; margin: 0 auto; padding: 24px 24px 0; }

        .grp-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 6px; flex-wrap: wrap; }
        .grp-title { font-size: 26px; font-weight: 900; color: var(--text-primary); letter-spacing: -0.6px; }
        .grp-sub { font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--text-secondary); margin-top: 6px; max-width: 560px; line-height: 1.6; }
        .grp-count { text-align: right; flex-shrink: 0; }
        .grp-count-num { font-size: 22px; font-weight: 900; color: var(--text-primary); line-height: 1; }
        .grp-count-lbl { font-family: 'DM Sans', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.6px; color: var(--text-muted); text-transform: uppercase; }

        .grp-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 22px 0 10px; flex-wrap: wrap; }

        .grp-search { flex: 1; min-width: 220px; display: flex; align-items: center; gap: 8px; padding: 9px 14px; background: var(--search-bg); border: 1.5px solid var(--search-bdr); border-radius: 10px; }
        .grp-search input { flex: 1; background: none; border: none; outline: none; font-size: 13px; font-family: 'Sora', sans-serif; font-weight: 500; color: var(--search-clr); }
        .grp-search input::placeholder { color: var(--search-ph); }
        .grp-search svg { color: rgba(128,128,160,0.5); flex-shrink: 0; }

        .sort-toggle { display: flex; border: 1px solid var(--toggle-border); border-radius: 9px; overflow: hidden; background: var(--toggle-bg); flex-shrink: 0; }
        .sort-btn { padding: 8px 14px; font-size: 12px; font-weight: 700; font-family: 'Sora', sans-serif; color: var(--text-secondary); background: none; border: none; cursor: pointer; transition: background .15s, color .15s; }
        .sort-btn.active { background: var(--toggle-active-bg); color: var(--toggle-active-clr); }

        .grp-result-line { font-family: 'DM Sans', sans-serif; font-size: 12px; color: var(--text-muted); margin-bottom: 14px; }

        .sub-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
        .sub-card { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; cursor: pointer; transition: background .2s, border-color .2s, transform .15s; text-align: left; }
        .sub-card:hover { background: var(--surface-hover); border-color: var(--border-hover); transform: translateY(-2px); }
        .sub-name { font-size: 13.5px; font-weight: 700; color: var(--text-primary); margin-bottom: 3px; }
        .sub-count { font-family: 'DM Sans', sans-serif; font-size: 11.5px; color: var(--text-muted); }
        .sub-arrow { color: #07A626; opacity: 0.7; flex-shrink: 0; transition: opacity .15s, transform .15s; }
        .sub-card:hover .sub-arrow { opacity: 1; transform: translate(2px,-2px); }

        .skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
        .skeleton-card { height: 56px; border-radius: 12px; background: var(--skeleton); animation: shimmer 1.4s ease-in-out infinite; }
        @keyframes shimmer { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

        .error-state, .empty-state { text-align: center; padding: 60px 24px; color: var(--text-secondary); font-size: 14px; }
        .error-state { color: var(--error-color); }
        .error-state button { margin-top: 12px; padding: 8px 20px; border-radius: 8px; border: 1px solid var(--error-color); background: transparent; color: var(--error-color); font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; }

        @media (max-width: 640px) {
          .grp-container { padding: 14px 12px 0; }
          .grp-title { font-size: 21px; }
          .sub-grid, .skeleton-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .grp-toolbar { flex-direction: column; align-items: stretch; }
        }
      `}</style>

      <div className="grp-page">
        <div className="grp-container">
          <Navbar />
          <div className="h-20" />

          <div className="grp-header">
            <div>
              <p className="grp-title">{categoryName}</p>
              <p className="grp-sub">
                Browse all sub-categories under {categoryName} and find the logos you need.
              </p>
            </div>
            <div className="grp-count">
              <div className="grp-count-num">{totalLogos.toLocaleString()}</div>
              <div className="grp-count-lbl">Logos</div>
            </div>
          </div>

          {error ? (
            <div className="error-state">
              <p>Failed to load categories: {error}</p>
              <button onClick={fetchGroup}>Try again</button>
            </div>
          ) : (
            <>
              <div className="grp-toolbar">
                <div className="grp-search">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Filter sub-categories…"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                  />
                </div>

                <div className="sort-toggle">
                  <button
                    className={`sort-btn${sort === "az" ? " active" : ""}`}
                    onClick={() => setSort("az")}
                  >
                    A–Z
                  </button>
                  <button
                    className={`sort-btn${sort === "count" ? " active" : ""}`}
                    onClick={() => setSort("count")}
                  >
                    Most logos
                  </button>
                </div>
              </div>

              {!loading && (
                <div className="grp-result-line">
                  {visibleSubcategories.length} of {totalSubs} sub-categories
                </div>
              )}

              {loading ? (
                <div className="skeleton-grid">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="skeleton-card" style={{ animationDelay: `${i * 60}ms` }} />
                  ))}
                </div>
              ) : visibleSubcategories.length === 0 ? (
                <div className="empty-state">No sub-categories match your search.</div>
              ) : (
                <div className="sub-grid">
                  {visibleSubcategories.map((sub) => (
                    <button
                      key={sub.slug}
                      className="sub-card"
                      onClick={() => handleSubClick(sub)}
                    >
                      <div>
                        <div className="sub-name">{sub.name}</div>
                        <div className="sub-count">
                          {sub.count} {sub.count === 1 ? "logo" : "logos"}
                        </div>
                      </div>
                      <svg className="sub-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="7" y1="17" x2="17" y2="7" />
                        <polyline points="7 7 17 7 17 17" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

