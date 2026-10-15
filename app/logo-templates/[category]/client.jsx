"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { TEMPLATE_PAGE_CSS } from "../../lib/templateStyles";
import Footer from "../../components/Footer";

const BADGES = {
  AI:  { bg: "#FFF7E0", border: "#F5DFA0", color: "#B7791F" },
  CDR: { bg: "#FDECEC", border: "#F5B5B5", color: "#D93636" },
  SVG: { bg: "#E8F7EE", border: "#A8DDBC", color: "#1F8A4C" },
  PNG: { bg: "#E8F0FE", border: "#A9C4F5", color: "#2B5FD9" },
};

const CARD_CSS = `
.tp-root .tp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
  align-items: stretch;
}
.tc-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  border: 1px solid #e8e8ee;
  border-radius: 16px;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  box-shadow: 0 1px 3px rgba(0,0,0,.04);
  transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
}
.tc-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 24px rgba(0,0,0,.08);
  border-color: #d5d5e0;
}
.tc-img {
  width: 100%;
  aspect-ratio: 4 / 3;
  flex-shrink: 0;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  box-sizing: border-box;
}
.tc-img img { max-width: 100%; max-height: 100%; object-fit: contain; }
.tc-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 2px 12px 12px;
}
.tc-title {
  margin: 0;
  font-size: 13.5px;
  font-weight: 700;
  line-height: 1.35;
  color: #14142b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tc-sub { margin: 2px 0 0; font-size: 12px; color: #8a8a9a; }
.tc-badges {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  margin-top: auto;
  padding-top: 10px;
}
.tc-badge {
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  padding: 3px 6px;
  border-radius: 6px;
  border: 1px solid;
  white-space: nowrap;
}
@media (max-width: 480px) {
  .tp-root .tp-grid { grid-template-columns: 1fr; }
}
`;

const DEFAULT_FORMATS = ["AI", "CDR", "SVG", "PNG"];

export default function CategoryClient({
  category, otherCategories, initialLogos, initialTotal, initialTotalPages, limit,
}) {
  const [logos, setLogos] = useState(initialLogos);
  const [total, setTotal] = useState(initialTotal);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  async function goToPage(p) {
    if (p < 1 || p > totalPages || p === page) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/template-categories/logos?category=${category.id}&page=${p}&limit=${limit}`
      );
      const data = await res.json();
      setLogos(data.logos || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setPage(p);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("[CategoryClient] fetch failed", err);
    } finally {
      setLoading(false);
    }
  }

  const pageNumbers = (() => {
    const nums = [];
    const add = (n) => { if (n >= 1 && n <= totalPages && !nums.includes(n)) nums.push(n); };
    add(1); add(page - 1); add(page); add(page + 1); add(totalPages);
    return nums.sort((a, b) => a - b);
  })();

  return (
    <>
      <style>{TEMPLATE_PAGE_CSS}</style>
      <style>{CARD_CSS}</style>
      <Navbar />
      <div className="tp-root">
        <div className="tp-dots" />
        <div className="tp-inner">
          <div style={{ height: 24 }} />

          <nav className="tp-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> / <Link href="/logo-templates">Logo Templates</Link> / <span>{category.name}</span>
          </nav>

          <h1 className="tp-h1">{category.name} Logo Templates</h1>
          <p className="tp-sub">{category.intro}</p>

          {loading ? (
            <div className="tp-grid">
              {Array.from({ length: 12 }).map((_, i) => <div key={i} className="tp-skel" />)}
            </div>
          ) : logos.length === 0 ? (
            <div className="tp-empty">
              <strong>No templates yet</strong>
              Templates for this category are being added.
            </div>
          ) : (
            <div className="tp-grid">
              {logos.map((l) => {
                const formats = Array.isArray(l.formats) && l.formats.length ? l.formats : DEFAULT_FORMATS;
                return (
                  <Link key={l.slug} href={`/logo/${l.slug}`} className="tc-card">
                    <div className="tc-img">
                      {l.webpUrl && (
                        <img src={l.webpUrl} alt={l.altText || `${l.logoName} logo`} loading="lazy" />
                      )}
                    </div>
                    <div className="tc-body">
                      <h3 className="tc-title" title={l.logoName}>{l.logoName}</h3>
                      <p className="tc-sub">template</p>
                      <div className="tc-badges">
                        {formats.map((f) => {
                          const s = BADGES[String(f).toUpperCase()] || BADGES.AI;
                          return (
                            <span
                              key={f}
                              className="tc-badge"
                              style={{ background: s.bg, borderColor: s.border, color: s.color }}
                            >
                              {String(f).toUpperCase()}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="tp-pag">
              <button className="tp-pbtn" onClick={() => goToPage(page - 1)} disabled={page === 1 || loading}>‹</button>
              {pageNumbers.map((n, i) => {
                const gap = pageNumbers[i - 1] !== undefined && n - pageNumbers[i - 1] > 1;
                return (
                  <span key={n} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {gap && <span style={{ color: "var(--sub)" }}>…</span>}
                    <button className={`tp-pbtn${n === page ? " active" : ""}`} onClick={() => goToPage(n)} disabled={loading}>{n}</button>
                  </span>
                );
              })}
              <button className="tp-pbtn" onClick={() => goToPage(page + 1)} disabled={page === totalPages || loading}>›</button>
            </div>
          )}

        </div>
      </div>
      <Footer/>
    </>
  );
}