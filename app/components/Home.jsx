"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "../context/ThemeContext";
import { useRouter } from "next/navigation";

const popularSearches = [
  "Technology Logos",
  "Automotive Brands",
  "Gaming Concepts",
  "Finance Icons",
];

export default function Home() {
  const [searchValue, setSearchValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [ready, setReady] = useState(false);
  const { dark } = useTheme();

  const router = useRouter();
  const debounceRef = useRef(null);
  const isFirstRender = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  const handleSearch = () => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return;

    const slug = q.replace(/\s+/g, "-"); // 👈 space → hyphen

    router.push(`/search/${encodeURIComponent(slug)}`);
  };
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      clearTimeout(debounceRef.current);
      handleSearch();
    }
  };
  useEffect(() => {
    if (isFirstRender.current === null) {
      isFirstRender.current = true;
      return;
    }

    clearTimeout(debounceRef.current);

    const q = searchValue.trim().toLowerCase();
    if (!q) return;

    debounceRef.current = setTimeout(() => {
      const slug = q.replace(/\s+/g, "-");
      router.push(`/search/${encodeURIComponent(slug)}`);
    }, 3000);

    return () => clearTimeout(debounceRef.current);
  }, [searchValue, router]);

  return (
    <>
      <style>{`

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        [data-theme="dark"] {
          --bg:           #08080d;
          --bg-2:         #0c0c14;
          --heading:      #ffffff;
          --sub:          rgba(255,255,255,0.55);
          --divider:      rgba(255,255,255,0.08);
          --search-bg:    rgba(255,255,255,0.04);
          --search-bdr:   rgba(255,255,255,0.1);
          --search-clr:   #ffffff;
          --search-ph:    rgba(255,255,255,0.3);
          --kbd-clr:      rgba(255,255,255,0.2);
          --kbd-bg:       rgba(255,255,255,0.06);
          --kbd-bdr:      rgba(255,255,255,0.1);
          --tag-bg:       rgba(255,255,255,0.05);
          --tag-bdr:      rgba(255,255,255,0.1);
          --tag-clr:      rgba(255,255,255,0.55);
          --pop-lbl:      rgba(255,255,255,0.25);
          --dot:          rgba(255,255,255,0.035);
        }
        [data-theme="light"] {
          --bg:           #f7f7fb;
          --bg-2:         #ffffff;
          --heading:      #0a0a14;
          --sub:          rgba(0,0,0,0.58);
          --divider:      rgba(0,0,0,0.1);
          --search-bg:    rgba(255,255,255,0.9);
          --search-bdr:   rgba(0,0,0,0.12);
          --search-clr:   #0a0a14;
          --search-ph:    rgba(0,0,0,0.3);
          --kbd-clr:      rgba(0,0,0,0.3);
          --kbd-bg:       rgba(0,0,0,0.05);
          --kbd-bdr:      rgba(0,0,0,0.1);
          --tag-bg:       rgba(255,255,255,0.8);
          --tag-bdr:      rgba(0,0,0,0.1);
          --tag-clr:      rgba(0,0,0,0.55);
          --pop-lbl:      rgba(0,0,0,0.3);
          --dot:          rgba(0,0,0,0.035);
        }

        .home-root {
          min-height: 50vh;
          background: linear-gradient(180deg, var(--bg-2) 0%, var(--bg) 100%);
          font-family: var(--font-sora),sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 64px 20px 40px;
          position: relative;
          overflow: hidden;
          transition: background 0.35s;
        }

        .bg-glow {
          position: absolute; inset: 0;
          pointer-events: none; z-index: 0;
        }
        .bg-glow::before {
          content: '';
          position: absolute;
          top: -12%; left: 50%;
          transform: translateX(-50%);
          width: 560px; height: 320px;
          background: radial-gradient(ellipse, rgba(7,166,38,.10) 0%, transparent 72%);
          border-radius: 50%;
          animation: glow-pulse 6s ease-in-out infinite;
        }
        [data-theme="light"] .bg-glow::before {
          background: radial-gradient(ellipse, rgba(7,166,38,.06) 0%, transparent 72%);
        }
        @keyframes glow-pulse {
          0%,100% { opacity:1;  transform:translateX(-50%) scale(1);    }
          50%      { opacity:.75; transform:translateX(-50%) scale(1.05); }
        }
        .dot-grid {
          position: absolute; inset: 0;
          background-image: radial-gradient(var(--dot) 1px, transparent 1px);
          background-size: 32px 32px;
          -webkit-mask-image: radial-gradient(ellipse 60% 50% at 50% 0%, #000 40%, transparent 100%);
          mask-image: radial-gradient(ellipse 60% 50% at 50% 0%, #000 40%, transparent 100%);
          pointer-events: none; z-index: 0;
        }

        .anim {
          opacity: 0; transform: translateY(16px);
          transition: opacity .55s cubic-bezier(.22,1,.36,1),
                      transform .55s cubic-bezier(.22,1,.36,1);
        }
        .ready .anim { opacity: 1; transform: translateY(0); }
        .d0 { transition-delay:   0ms; }
        .d1 { transition-delay:  70ms; }
        .d2 { transition-delay: 140ms; }
        .d4 { transition-delay: 210ms; }
        .d5 { transition-delay: 280ms; }
        .tag-anim {
          opacity: 0; transform: translateX(-8px);
          transition: opacity .4s cubic-bezier(.22,1,.36,1),
                      transform .4s cubic-bezier(.22,1,.36,1);
        }
        .ready .tag-anim { opacity: 1; transform: translateX(0); }

        .home-content {
          position: relative; z-index: 1;
          width: 100%; max-width: 960px;
          display: flex; flex-direction: column;
          align-items: center; gap: 18px;
        }

        /* Badge */
        .badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 10px;
          background: rgba(7,166,38,.1);
          border: 1px solid rgba(7,166,38,.28);
          border-radius: 100px;
          font-size: 10px; font-weight: 600; color: #4ade80; letter-spacing: .2px;
        }
        [data-theme="light"] .badge { background: rgba(7,166,38,.08); border-color: rgba(7,166,38,.22); color: #15803d; }
        .badge-dot {
          width: 5px; height: 5px; background: #07A626; border-radius: 50%;
          animation: pulse-dot 2s infinite;
        }
        @keyframes pulse-dot {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:.5; transform:scale(.75); }
        }

        /* Heading — first row */
        .home-heading {
          text-align: center;
          font-size: clamp(18px, 2.6vw, 32px);
          font-weight: 800; line-height: 1.2;
          letter-spacing: -0.8px;
          color: var(--heading);
          text-wrap: balance;
          transition: color 0.35s, font-size 0.2s;
        }
        .home-heading .accent {
          background: linear-gradient(135deg, #07A626, #34d058);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* Sub — second row */
        .home-sub {
          font-family: var(--font-sora), 'DM Sans', sans-serif;
          font-size: clamp(13px, 1.7vw, 15px);
          font-weight: 400;
          color: var(--sub); text-align: center;
          line-height: 1.65; max-width: 680px;
          transition: color 0.35s;
        }

        /* Search */
        .search-bar {
          width: 100%;
          display: flex; align-items: center; gap: 9px;
          padding: 11px 15px;
          background: var(--search-bg);
          border: 1.5px solid var(--search-bdr);
          border-radius: 12px;
          box-shadow: 0 2px 16px rgba(0,0,0,.1);
          transition: border-color .2s, box-shadow .2s, background 0.35s;
          cursor: text;
        }
        .search-bar.focused {
          border-color: rgba(7,166,38,.7);
          box-shadow: 0 0 0 3px rgba(7,166,38,.12), 0 0 24px rgba(7,166,38,.06);
        }
        .search-icon { color: rgba(128,128,160,0.55); flex-shrink: 0; }
        .search-input {
          flex: 1; background: none; border: none; outline: none;
          font-size: 13.5px; font-family: var(--font-sora), sans-serif; font-weight: 500;
          color: var(--search-clr); caret-color: #07A626;
          transition: color 0.3s;
        }
        .search-input::placeholder { color: var(--search-ph); }
        .search-kbd {
          font-size: 10px; font-weight: 600;
          color: var(--kbd-clr); background: var(--kbd-bg);
          border: 1px solid var(--kbd-bdr);
          border-radius: 4px; padding: 1px 6px; flex-shrink: 0;
        }

        /* Popular */
        .popular-wrap {
          width: 100%;
          display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
        }
        .popular-label {
          font-size: 10px; font-weight: 600;
          color: var(--pop-lbl);
          text-transform: uppercase; letter-spacing: .8px;
          display: flex; align-items: center; gap: 4px; white-space: nowrap;
          transition: color 0.3s;
        }
        .popular-tag {
          padding: 3px 10px;
          background: var(--tag-bg);
          border: 1px solid var(--tag-bdr);
          border-radius: 100px;
          font-size: 11px; font-weight: 500;
          color: var(--tag-clr);
          cursor: pointer;
          transition: background .2s, border-color .2s, color .2s, transform .15s;
          white-space: nowrap;
          font-family: var(--font-sora), sans-serif;
        }
        .popular-tag:hover {
          background: rgba(7,166,38,.1);
          border-color: rgba(7,166,38,.35);
          color: #4ade80;
          transform: translateY(-1px);
        }
        [data-theme="light"] .popular-tag:hover { color: #15803d; }

        @media (max-width: 480px) {
          .home-root    { padding: 52px 16px 52px; }
          .home-content { gap: 14px; }
          .home-heading { font-size: 20px; letter-spacing: -0.5px; line-height: 1.3; }
          .home-sub     { font-size: 12.5px; }
          .search-kbd   { display: none; }
        }
      `}</style>

      <main className="home-root">
        <div className="bg-glow" />
        <div className="dot-grid" />

        <div className={`home-content${ready ? " ready" : ""}`}>
          <div className="h-2" />

          {/* Heading — first row */}
          <div className="anim d1">
            <h1 className="home-heading">
              CDRLogo – {" "}
              <span className="accent">Vector Logo </span>
              {" "}Reference Library for Designers <span className="accent">&amp;</span> Students
            </h1>
          </div>

          {/* Sub — second row */}
          <div className="anim d2">
            <p className="home-sub">
              Explore an independent educational reference library of logo references, visual identities,
              and branding resources for research, learning, and creative inspiration.
              Access AI, CDR, SVG, and PNG reference files, one-click SVG codes,
              official website links, and color information through a fast, organized platform.
            </p>
          </div>

          {/* Search */}
          <div className="anim d4" style={{ width: "100%" }}>
            <div
              className={`search-bar${focused ? " focused" : ""}`}
              onClick={() => document.getElementById("logo-search")?.focus()}
            >
              <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                id="logo-search"
                className="search-input"
                type="text"
                placeholder="Search logos, brands, templates…"
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={handleKeyDown}
              />
              <span className="search-kbd">ESC</span>
            </div>
          </div>

          {/* Popular searches */}
          <div className="anim d5" style={{ width: "100%" }}>
            <div className="popular-wrap">
              <span className="popular-label">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
                Explore
              </span>
              {popularSearches.map((tag, i) => (
                <button
                  key={tag}
                  className="popular-tag tag-anim"
                  style={{ transitionDelay: ready ? `${300 + i * 55}ms` : "0ms" }}
                  onClick={() => {
                    clearTimeout(debounceRef.current);
                    setSearchValue(tag);
                    const slug = tag.trim().toLowerCase().replace(/\s+/g, "-");
                    router.push(`/search/${encodeURIComponent(slug)}`);
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

        </div>
      </main>
    </>
  );
}