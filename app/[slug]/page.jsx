"use client";

import { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { useParams, useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function CmsPage() {
  const { slug } = useParams();
  const { dark } = useTheme();
  const router = useRouter();

  const [page, setPage]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const res  = await fetch("/api/website/cms/get-slug", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Not found");
        setPage(json.data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&family=DM+Sans:wght@400;500&family=Fira+Code&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        [data-theme="dark"] {
          --bg:         #09090f;
          --surface:    rgba(255,255,255,0.03);
          --border:     rgba(255,255,255,0.08);
          --heading:    #ffffff;
          --body:       rgba(255,255,255,0.75);
          --muted:      rgba(255,255,255,0.35);
          --code-bg:    rgba(255,255,255,0.06);
          --code-clr:   #86efac;
          --pre-bg:     #07080f;
          --pre-bdr:    rgba(255,255,255,0.06);
          --quote-bdr:  #07A626;
          --quote-clr:  rgba(255,255,255,0.5);
          --hr:         rgba(255,255,255,0.07);
          --link:       #4ade80;
          --dot:        rgba(255,255,255,0.035);
          --tag-bg:     rgba(7,166,38,0.08);
          --tag-bdr:    rgba(7,166,38,0.22);
          --tag-clr:    #4ade80;
          --th-bg:      rgba(255,255,255,0.04);
          --td-bdr:     rgba(255,255,255,0.07);
          --mark-bg:    rgba(251,191,36,0.18);
          --mark-clr:   #fbbf24;
        }
        [data-theme="light"] {
          --bg:         #f4f4f8;
          --surface:    rgba(255,255,255,0.85);
          --border:     rgba(0,0,0,0.09);
          --heading:    #0a0a14;
          --body:       rgba(0,0,0,0.72);
          --muted:      rgba(0,0,0,0.38);
          --code-bg:    rgba(0,0,0,0.05);
          --code-clr:   #15803d;
          --pre-bg:     #f8f9fc;
          --pre-bdr:    rgba(0,0,0,0.08);
          --quote-bdr:  #07A626;
          --quote-clr:  rgba(0,0,0,0.5);
          --hr:         rgba(0,0,0,0.08);
          --link:       #15803d;
          --dot:        rgba(0,0,0,0.03);
          --tag-bg:     rgba(7,166,38,0.07);
          --tag-bdr:    rgba(7,166,38,0.2);
          --tag-clr:    #15803d;
          --th-bg:      rgba(0,0,0,0.03);
          --td-bdr:     rgba(0,0,0,0.08);
          --mark-bg:    rgba(251,191,36,0.22);
          --mark-clr:   #92400e;
        }

        .cms-page-root {
          min-height: 100vh;
          background: var(--bg);
          font-family: 'Sora', 'Segoe UI', sans-serif;
          transition: background 0.35s;
          position: relative;
          overflow: hidden;
        }

        /* Subtle background elements matching home */
        .bg-glow {
          position: fixed; inset: 0;
          pointer-events: none; z-index: 0;
        }
        .bg-glow::before {
          content: '';
          position: fixed;
          top: -10%; left: 50%;
          transform: translateX(-50%);
          width: 700px; height: 420px;
          background: radial-gradient(ellipse, rgba(7,166,38,.07) 0%, transparent 70%);
          border-radius: 50%;
        }
        [data-theme="light"] .bg-glow::before {
          background: radial-gradient(ellipse, rgba(7,166,38,.04) 0%, transparent 70%);
        }
        .dot-grid {
          position: fixed; inset: 0;
          background-image: radial-gradient(var(--dot) 1px, transparent 1px);
          background-size: 30px 30px;
          pointer-events: none; z-index: 0;
        }

        .cms-page-inner {
          position: relative; z-index: 1;
          max-width: 760px;
          margin: 0 auto;
          padding: 48px 24px 96px;
        }

        /* Back button */
        .back-btn {
          display: inline-flex; align-items: center; gap: 6px;
          margin-bottom: 32px;
          padding: 6px 14px 6px 10px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--muted);
          font-size: 12px; font-weight: 600;
          cursor: pointer;
          font-family: 'Sora', sans-serif;
          transition: color .2s, border-color .2s, background .2s;
          text-decoration: none;
        }
        .back-btn:hover {
          color: var(--link);
          border-color: rgba(7,166,38,.35);
          background: rgba(7,166,38,.06);
        }

        /* Page header */
        .cms-page-header {
          margin-bottom: 36px;
          padding-bottom: 28px;
          border-bottom: 1px solid var(--border);
        }
        .cms-page-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 10px;
          background: var(--tag-bg);
          border: 1px solid var(--tag-bdr);
          border-radius: 100px;
          font-size: 10px; font-weight: 600;
          color: var(--tag-clr); letter-spacing: .2px;
          margin-bottom: 14px;
        }
        .cms-page-title {
          font-size: clamp(22px, 4vw, 36px);
          font-weight: 900; line-height: 1.15;
          letter-spacing: -0.8px;
          color: var(--heading);
          margin-bottom: 10px;
          transition: color 0.35s;
        }
        .cms-page-meta {
          font-family: 'DM Sans', sans-serif;
          font-size: 12px;
          color: var(--muted);
          display: flex; align-items: center; gap: 10px;
          flex-wrap: wrap;
        }
        .cms-page-meta-dot {
          width: 3px; height: 3px; border-radius: 50%;
          background: var(--muted); display: inline-block;
        }

        /* ── Rich content styles ── */
        .cms-body {
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          line-height: 1.82;
          color: var(--body);
          transition: color 0.35s;
        }

        .cms-body > * + * { margin-top: 1em; }

        .cms-body h1 {
          font-family: 'Sora', sans-serif;
          font-size: clamp(20px, 3.5vw, 30px);
          font-weight: 900; line-height: 1.18;
          letter-spacing: -0.6px;
          color: var(--heading); margin-top: 1.8em;
        }
        .cms-body h2 {
          font-family: 'Sora', sans-serif;
          font-size: clamp(17px, 3vw, 24px);
          font-weight: 800; line-height: 1.22;
          letter-spacing: -0.4px;
          color: var(--heading); margin-top: 1.6em;
        }
        .cms-body h3 {
          font-family: 'Sora', sans-serif;
          font-size: clamp(14px, 2.5vw, 19px);
          font-weight: 700;
          color: var(--heading); margin-top: 1.4em;
        }
        .cms-body h1:first-child,
        .cms-body h2:first-child,
        .cms-body h3:first-child { margin-top: 0; }

        .cms-body p { color: var(--body); }

        .cms-body a {
          color: var(--link);
          text-decoration: underline;
          text-underline-offset: 2px;
          transition: opacity .15s;
        }
        .cms-body a:hover { opacity: .75; }

        .cms-body strong { color: var(--heading); font-weight: 700; }
        .cms-body em     { font-style: italic; }
        .cms-body u      { text-decoration: underline; text-underline-offset: 2px; }
        .cms-body s      { text-decoration: line-through; opacity: .6; }
        .cms-body mark   { background: var(--mark-bg); color: var(--mark-clr); border-radius: 3px; padding: 0 3px; }
        .cms-body sub    { font-size: .75em; vertical-align: sub; }
        .cms-body sup    { font-size: .75em; vertical-align: super; }

        .cms-body ul,
        .cms-body ol { padding-left: 22px; }
        .cms-body li  { margin: 4px 0; }
        .cms-body ul li::marker { color: var(--link); }
        .cms-body ol li::marker { color: var(--muted); font-weight: 600; }

        /* Task list */
        .cms-body ul[data-type="taskList"] {
          list-style: none; padding-left: 4px;
        }
        .cms-body ul[data-type="taskList"] li {
          display: flex; align-items: flex-start; gap: 8px;
        }
        .cms-body ul[data-type="taskList"] input[type="checkbox"] {
          accent-color: #07A626; width: 14px; height: 14px;
          margin-top: 4px; flex-shrink: 0;
        }

        .cms-body blockquote {
          border-left: 3px solid var(--quote-bdr);
          padding: 10px 18px;
          margin: 20px 0;
          background: rgba(7,166,38,.04);
          border-radius: 0 8px 8px 0;
          color: var(--quote-clr);
          font-style: italic;
        }

        .cms-body code {
          background: var(--code-bg);
          color: var(--code-clr);
          border-radius: 5px;
          padding: 2px 7px;
          font-size: 13px;
          font-family: 'Fira Code', monospace;
        }
        .cms-body pre {
          background: var(--pre-bg);
          border: 1px solid var(--pre-bdr);
          border-radius: 12px;
          padding: 18px 20px;
          overflow-x: auto;
          margin: 20px 0;
        }
        .cms-body pre code {
          background: none; border: none; padding: 0;
          font-size: 13px; color: #a5f3fc;
        }

        .cms-body hr {
          border: none;
          border-top: 1px solid var(--hr);
          margin: 32px 0;
        }

        .cms-body img {
          max-width: 100%; border-radius: 10px;
          border: 1px solid var(--border);
          margin: 8px 0;
          display: block;
        }

        /* Tables */
        .cms-body table {
          width: 100%; border-collapse: collapse;
          margin: 20px 0; border-radius: 10px;
          overflow: hidden;
          font-size: 13.5px;
        }
        .cms-body th {
          background: var(--th-bg);
          color: var(--muted);
          font-family: 'Sora', sans-serif;
          font-size: 10px; font-weight: 700;
          letter-spacing: .6px; text-transform: uppercase;
          padding: 10px 14px;
          border: 1px solid var(--td-bdr);
          text-align: left;
        }
        .cms-body td {
          padding: 9px 14px;
          border: 1px solid var(--td-bdr);
          color: var(--body);
        }
        .cms-body tr:nth-child(even) td {
          background: rgba(255,255,255,0.015);
        }

        /* Loading skeleton */
        @keyframes shimmer {
          from { opacity: .4; } to { opacity: .9; }
        }
        .skel {
          border-radius: 6px;
          background: var(--surface);
          border: 1px solid var(--border);
          animation: shimmer 1.2s ease-in-out infinite alternate;
        }

        /* Error / 404 */
        .cms-empty {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          min-height: 50vh; gap: 12px; text-align: center;
        }
        .cms-empty-icon {
          width: 56px; height: 56px; border-radius: 14px;
          background: rgba(239,68,68,.08);
          border: 1px solid rgba(239,68,68,.2);
          display: flex; align-items: center; justify-content: center;
          font-size: 24px; margin-bottom: 4px;
        }
        .cms-empty-title {
          font-family: 'Sora', sans-serif;
          font-size: 18px; font-weight: 800;
          color: var(--heading);
        }
        .cms-empty-sub {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; color: var(--muted); max-width: 280px;
        }

        @media (max-width: 480px) {
          .cms-page-inner { padding: 32px 16px 72px; }
        }
      `}</style>

      <div className="cms-page-root">
        <Navbar/>
        <div className="h-20"/>
        <div className="bg-glow" />
        <div className="dot-grid" />

        <div className="cms-page-inner">

        

          {/* Loading */}
          {loading && (
            <div>
              <div className="skel" style={{ height: 18, width: 90, marginBottom: 18 }} />
              <div className="skel" style={{ height: 38, width: "70%", marginBottom: 12 }} />
              <div className="skel" style={{ height: 12, width: 180, marginBottom: 36 }} />
              {[100, 90, 95, 80, 88].map((w, i) => (
                <div key={i} className="skel"
                  style={{ height: 13, width: `${w}%`, marginBottom: 10 }} />
              ))}
            </div>
          )}

          {/* Error / 404 */}
          {!loading && error && (
            <div className="cms-empty">
              <div className="cms-empty-icon">⚠️</div>
              <div className="cms-empty-title">Page not found</div>
              <div className="cms-empty-sub">
                The page <strong>/{slug}</strong> doesn't exist or hasn't been published yet.
              </div>
              <button className="back-btn" style={{ marginTop: 8 }} onClick={() => router.push("/")}>
                Go Home
              </button>
            </div>
          )}

          {/* Content */}
          {!loading && page && (
            <>
              <div className="cms-page-header">
             
                <h1 className="cms-page-title">{page.title}</h1>
                <div className="cms-page-meta">
                  <span>/{page.slug}</span>
                  <span className="cms-page-meta-dot" />
                  <span>
                    Updated{" "}
                    {new Date(page.updatedAt).toLocaleDateString("en-US", {
                      month: "long", day: "numeric", year: "numeric",
                    })}
                  </span>
                </div>
              </div>

              {/* HTML content from Tiptap */}
              <div
                className="cms-body"
                dangerouslySetInnerHTML={{ __html: page.content }}
              />
            </>
          )}

        </div>
        
      </div>
      <Footer/>
    </>
  );
}