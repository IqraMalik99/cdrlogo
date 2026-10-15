"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { TEMPLATE_PAGE_CSS } from "../../lib/templateStyles";
import Footer from "../../components/Footer";

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
              {logos.map((l) => (
                <Link key={l.slug} href={`/logo/${l.slug}`} className="tp-logo">
                  <div className="tp-logo-img">
                    {l.webpUrl && (
                      <img src={l.webpUrl} alt={l.altText || `${l.logoName} logo`} loading="lazy" />
                    )}
                  </div>
                  <div className="tp-logo-name">{l.logoName}</div>
                </Link>
              ))}
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