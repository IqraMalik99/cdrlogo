"use client";

import Link from "next/link";
import Navbar from "../components/Navbar";
import { TEMPLATE_PAGE_CSS } from "../lib/templateStyles";

export default function TemplatesClient({ categories }) {
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
                  <span className="tp-cat-count">{c.count} template{c.count === 1 ? "" : "s"}</span>
                </div>

              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}