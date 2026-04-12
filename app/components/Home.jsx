"use client";

import { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";

const popularSearches = [
  "Technology logos",
  "Automotive brands",
  "Finance logos",
  "Gaming logos",
];

const stats = [
  { value: "50,000+", label: "Premium Resources" },
  { value: "4",       label: "File Formats"      },
  { value: "Free",    label: "Always"             },
];

export default function Home() {
  const [searchValue, setSearchValue] = useState("");
  const [focused,     setFocused]     = useState(false);
  const [ready,       setReady]       = useState(false);
  const { dark } = useTheme();

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&family=DM+Sans:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── Theme tokens ─────────────────────────────── */
        [data-theme="dark"] {
          --home-bg:        #09090f;
          --heading-color:  #ffffff;
          --sub-color:      rgba(255,255,255,0.45);
          --stat-value:     #ffffff;
          --stat-label:     rgba(255,255,255,0.3);
          --stat-divider:   rgba(255,255,255,0.08);
          --search-bg:      rgba(255,255,255,0.04);
          --search-border:  rgba(255,255,255,0.1);
          --search-color:   #ffffff;
          --search-ph:      rgba(255,255,255,0.3);
          --kbd-color:      rgba(255,255,255,0.2);
          --kbd-bg:         rgba(255,255,255,0.06);
          --kbd-border:     rgba(255,255,255,0.1);
          --tag-bg:         rgba(255,255,255,0.05);
          --tag-border:     rgba(255,255,255,0.1);
          --tag-color:      rgba(255,255,255,0.55);
          --pop-label:      rgba(255,255,255,0.25);
          --dot-grid:       rgba(255,255,255,0.04);
        }
        [data-theme="light"] {
          --home-bg:        #f4f4f8;
          --heading-color:  #0a0a14;
          --sub-color:      rgba(0,0,0,0.5);
          --stat-value:     #0a0a14;
          --stat-label:     rgba(0,0,0,0.38);
          --stat-divider:   rgba(0,0,0,0.1);
          --search-bg:      rgba(255,255,255,0.9);
          --search-border:  rgba(0,0,0,0.12);
          --search-color:   #0a0a14;
          --search-ph:      rgba(0,0,0,0.3);
          --kbd-color:      rgba(0,0,0,0.3);
          --kbd-bg:         rgba(0,0,0,0.05);
          --kbd-border:     rgba(0,0,0,0.1);
          --tag-bg:         rgba(255,255,255,0.8);
          --tag-border:     rgba(0,0,0,0.1);
          --tag-color:      rgba(0,0,0,0.55);
          --pop-label:      rgba(0,0,0,0.3);
          --dot-grid:       rgba(0,0,0,0.04);
        }

        /* ── Root ─────────────────────────────────────── */
        .home-root {
          min-height: 100vh;
          background: var(--home-bg);
          font-family: 'Sora', 'Segoe UI', sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 72px 24px 40px;
          position: relative;
          overflow: hidden;
          transition: background 0.35s;
        }

        /* ── Background ───────────────────────────────── */
        .bg-glow {
          position: absolute; inset: 0;
          pointer-events: none; z-index: 0;
        }
        .bg-glow::before {
          content: '';
          position: absolute;
          top: -10%; left: 50%;
          transform: translateX(-50%);
          width: 700px; height: 500px;
          background: radial-gradient(ellipse, rgba(139,92,246,.18) 0%, transparent 70%);
          border-radius: 50%;
          animation: glow-pulse 5s ease-in-out infinite;
          transition: opacity 0.35s;
        }
        [data-theme="light"] .bg-glow::before {
          background: radial-gradient(ellipse, rgba(139,92,246,.1) 0%, transparent 70%);
        }
        .bg-glow::after {
          content: '';
          position: absolute;
          bottom: 0; left: 30%;
          width: 400px; height: 300px;
          background: radial-gradient(ellipse, rgba(99,102,241,.1) 0%, transparent 70%);
          border-radius: 50%;
        }
        @keyframes glow-pulse {
          0%,100% { opacity:1;  transform:translateX(-50%) scale(1);    }
          50%      { opacity:.7; transform:translateX(-50%) scale(1.08); }
        }

        .dot-grid {
          position: absolute; inset: 0;
          background-image: radial-gradient(var(--dot-grid) 1px, transparent 1px);
          background-size: 32px 32px;
          pointer-events: none; z-index: 0;
        }

        /* ── Animations ───────────────────────────────── */
        .anim {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity .6s cubic-bezier(.22,1,.36,1),
                      transform .6s cubic-bezier(.22,1,.36,1);
        }
        .ready .anim { opacity: 1; transform: translateY(0); }

        .d0 { transition-delay:   0ms; }
        .d1 { transition-delay:  80ms; }
        .d2 { transition-delay: 160ms; }
        .d3 { transition-delay: 240ms; }
        .d4 { transition-delay: 320ms; }
        .d5 { transition-delay: 400ms; }
        .d6 { transition-delay: 480ms; }

        .tag-anim {
          opacity: 0; transform: translateX(-10px);
          transition: opacity .45s cubic-bezier(.22,1,.36,1),
                      transform .45s cubic-bezier(.22,1,.36,1);
        }
        .ready .tag-anim { opacity: 1; transform: translateX(0); }

        /* ── Content ──────────────────────────────────── */
        .home-content {
          position: relative; z-index: 1;
          width: 100%; max-width: 780px;
          display: flex; flex-direction: column;
          align-items: center; gap: 18px;
        }

        /* Badge */
        .badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 2px 6px;
          background: rgba(139,92,246,.1);
          border: 1px solid rgba(139,92,246,.28);
          border-radius: 100px;
          font-size: 10px; font-weight: 600; color: #c4b5fd; letter-spacing: .2px;
        }
        [data-theme="light"] .badge {
          background: rgba(139,92,246,.08);
          border-color: rgba(139,92,246,.22);
          color: #7c3aed;
        }
        .badge-dot {
          width: 6px; height: 6px; background: #a78bfa; border-radius: 50%;
          animation: pulse-dot 2s infinite;
        }
        [data-theme="light"] .badge-dot { background: #7c3aed; }
        @keyframes pulse-dot {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:.5; transform:scale(.8); }
        }

        /* Heading */
        .home-heading {
          text-align: center;
          font-size: clamp(30px, 5.5vw, 58px);
          font-weight: 900; line-height: 1.1;
          letter-spacing: -1.5px;
          color: var(--heading-color);
          text-wrap: balance;
          transition: color 0.35s;
        }
        .home-heading .accent {
          background: linear-gradient(135deg, #a855f7, #818cf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* Sub */
        .home-sub {
          font-family: 'DM Sans', sans-serif;
          font-size: clamp(13px, 1.8vw, 15px);
          color: var(--sub-color);
          text-align: center; line-height: 1.65; max-width: 480px;
          transition: color 0.35s;
        }

        /* Format badges */
        .format-badges {
          display: flex; align-items: center;
          gap: 7px; flex-wrap: wrap; justify-content: center;
        }
        .format-badge {
          padding: 3px 10px; border-radius: 6px;
          font-size: 11px; font-weight: 700; letter-spacing: .5px;
          border: 1px solid;
        }
        .fmt-cdr { background:rgba(239,68,68,.1);  border-color:rgba(239,68,68,.25);  color:#fca5a5; }
        .fmt-ai  { background:rgba(234,179,8,.1);  border-color:rgba(234,179,8,.25);  color:#fde68a; }
        .fmt-svg { background:rgba(34,197,94,.1);  border-color:rgba(34,197,94,.25);  color:#86efac; }
        .fmt-png { background:rgba(59,130,246,.1); border-color:rgba(59,130,246,.25); color:#93c5fd; }
        [data-theme="light"] .fmt-cdr { color:#dc2626; }
        [data-theme="light"] .fmt-ai  { color:#b45309; }
        [data-theme="light"] .fmt-svg { color:#15803d; }
        [data-theme="light"] .fmt-png { color:#1d4ed8; }

        /* Search */
        .search-bar {
          width: 100%;
          display: flex; align-items: center; gap: 10px;
          padding: 12px 18px;
          background: var(--search-bg);
          border: 1.5px solid var(--search-border);
          border-radius: 13px;
          box-shadow: 0 2px 20px rgba(0,0,0,.12);
          transition: border-color .25s, box-shadow .25s, background 0.35s;
          cursor: text;
        }
        .search-bar.focused {
          border-color: rgba(168,85,247,.7);
          box-shadow: 0 0 0 4px rgba(168,85,247,.15), 0 0 30px rgba(168,85,247,.08);
        }
        .search-icon { color: rgba(128,128,160,0.6); flex-shrink: 0; }
        .search-input {
          flex: 1; background: none; border: none; outline: none;
          font-size: 14px; font-family: 'Sora', sans-serif; font-weight: 500;
          color: var(--search-color); caret-color: #a855f7;
          transition: color 0.3s;
        }
        .search-input::placeholder { color: var(--search-ph); }
        .search-kbd {
          font-size: 10.5px; font-weight: 600;
          color: var(--kbd-color);
          background: var(--kbd-bg);
          border: 1px solid var(--kbd-border);
          border-radius: 5px; padding: 2px 7px; flex-shrink: 0;
          transition: color 0.3s, background 0.3s;
        }

        /* Popular searches */
        .popular-wrap {
          width: 100%; max-width: 600px;
          display: flex; align-items: center; flex-wrap: wrap; gap: 7px;
        }
        .popular-label {
          font-size: 11px; font-weight: 600;
          color: var(--pop-label);
          text-transform: uppercase; letter-spacing: .8px;
          display: flex; align-items: center; gap: 5px; white-space: nowrap;
          transition: color 0.3s;
        }
        .popular-tag {
          padding: 4px 12px;
          background: var(--tag-bg);
          border: 1px solid var(--tag-border);
          border-radius: 100px;
          font-size: 12px; font-weight: 500;
          color: var(--tag-color);
          cursor: pointer;
          transition: background .2s, border-color .2s, color .2s, transform .15s;
          white-space: nowrap;
          font-family: 'Sora', sans-serif;
        }
        .popular-tag:hover {
          background: rgba(168,85,247,.12);
          border-color: rgba(168,85,247,.35);
          color: #c4b5fd;
          transform: translateY(-2px);
        }
        [data-theme="light"] .popular-tag:hover { color: #7c3aed; }

        /* Stats */
        .stats-row {
          display: flex; align-items: center; gap: 28px; margin-top: 4px;
        }
        .stat { display: flex; flex-direction: column; align-items: center; gap: 1px; }
        .stat-value {
          font-size: 18px; font-weight: 800;
          color: var(--stat-value); letter-spacing: -.5px;
          transition: color 0.35s;
        }
        .stat-label {
          font-size: 11px; font-weight: 500;
          color: var(--stat-label);
          text-transform: uppercase; letter-spacing: .6px;
          transition: color 0.35s;
        }
        .stat-divider {
          width: 1px; height: 32px;
          background: var(--stat-divider);
          transition: background 0.35s;
        }

        @media (max-width: 600px) {
          .home-root    { padding: 76px 18px 36px; }
          .stats-row    { gap: 18px; }
          .search-kbd   { display: none; }
          .home-content { gap: 14px; }
        }
      `}</style>

      <main className="home-root">
        <div className="bg-glow" />
        <div className="dot-grid" />

        <div className={`home-content${ready ? " ready" : ""}`}>

<div className="h-2"/>
          {/* Badge */}
          <div className="anim d0">
            <div className="badge">
              <span className="badge-dot" />
              50,000+ Premium Logo Resources
            </div>
          </div>

          {/* Heading */}
          <div className="anim d1">
            <h1 className="home-heading">
              CDRLogo – Free{" "}
              <span className="accent">Brand &amp; Template</span>
              {" "}Vector Logos
            </h1>
          </div>

          {/* Sub */}
          <div className="anim d2">
            <p className="home-sub">
              Your free online library of high-quality brand logos and creative
              templates. Download instantly in CDR, AI, SVG, and PNG formats
              for any design project.
            </p>
          </div>

          {/* Format badges */}
          <div className="anim d3">
            <div className="format-badges">
              {[
                { label: "CDR", cls: "fmt-cdr" },
                { label: "AI",  cls: "fmt-ai"  },
                { label: "SVG", cls: "fmt-svg" },
                { label: "PNG", cls: "fmt-png" },
              ].map(f => (
                <span key={f.label} className={`format-badge ${f.cls}`}>{f.label}</span>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="anim d4" style={{ width: "100%", maxWidth: 600 }}>
            <div
              className={`search-bar${focused ? " focused" : ""}`}
              onClick={() => document.getElementById("logo-search")?.focus()}
            >
              <svg className="search-icon" width="17" height="17" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                id="logo-search"
                className="search-input"
                type="text"
                placeholder="Technology logos"
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
              />
              <span className="search-kbd">ESC</span>
            </div>
          </div>

          {/* Popular searches */}
          <div className="anim d5" style={{ width: "100%", maxWidth: 600 }}>
            <div className="popular-wrap">
              <span className="popular-label">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                  <polyline points="17 6 23 6 23 12"/>
                </svg>
                Popular
              </span>
              {popularSearches.map((tag, i) => (
                <button
                  key={tag}
                  className="popular-tag tag-anim"
                  style={{ transitionDelay: ready ? `${420 + i * 65}ms` : "0ms" }}
                  onClick={() => setSearchValue(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="anim d6">
            <div className="stats-row">
              {stats.map((s, i) => (
                <span key={s.label} style={{ display: "contents" }}>
                  {i > 0 && <div className="stat-divider" />}
                  <div className="stat">
                    <span className="stat-value">{s.value}</span>
                    <span className="stat-label">{s.label}</span>
                  </div>
                </span>
              ))}
            </div>
          </div>

        </div>
      </main>
    </>
  );
}