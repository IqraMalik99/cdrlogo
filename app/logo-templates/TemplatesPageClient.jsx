"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "../components/Navbar";
import { TEMPLATE_PAGE_CSS } from "../lib/templateStyles";

export default function TemplatesClient({ categories: initialCategories }) {
  // Start with the server-rendered (cached) counts, then refresh from the API
  // in the browser. This only runs after mount, so it never touches the build.
  const [categories, setCategories] = useState(initialCategories);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/template-categories", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.categories)) {
          setCategories(data.categories);
        }
      })
      .catch((err) => {
        // keep the server-rendered counts if the refresh fails
        console.error("[TemplatesClient] count refresh failed", err);
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <style>{TEMPLATE_PAGE_CSS}</style>
      <Navbar />
      <div className="tp-root">
        <div className="tp-dots" />
        <div className="tp-inner">
          <div style={{ height: 24 }} />
          <h1 className="tp-h1">Logo Templates by <span className="tp-accent">Category</span></h1>
          <p className="tp-sub">
            Choose a category to see its logo templates. Each category groups templates by the type of business or style they suit.
          </p>

          <div className="tp-cats">
            {categories.map((c) => (
              <Link key={c.id} href={`/logo-templates/${c.id}`} className="tp-cat">
                <div className="tp-cat-top">
                  <span className="tp-cat-name">{c.name}</span>
                  <span className="tp-cat-count">
                    {c.count} template{c.count === 1 ? "" : "s"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}