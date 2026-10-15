"use client";

import Link from "next/link";
import Navbar from "../components/Navbar";
import { TEMPLATE_PAGE_CSS } from "../lib/templateStyles";

const BADGES = {
  AI:  { bg: "#FFF7E0", border: "#F5DFA0", color: "#B7791F" },
  CDR: { bg: "#FDECEC", border: "#F5B5B5", color: "#D93636" },
  SVG: { bg: "#E8F7EE", border: "#A8DDBC", color: "#1F8A4C" },
  PNG: { bg: "#E8F0FE", border: "#A9C4F5", color: "#2B5FD9" },
};

const CARD_CSS = `
.tp-cats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
}
.tc-card {
  display: flex;
  flex-direction: column;
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
  aspect-ratio: 6 / 5;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.tc-img img { max-width: 100%; max-height: 100%; object-fit: contain; }
.tc-placeholder { font-size: 56px; font-weight: 700; color: #c9c9d6; }
.tc-body { padding: 4px 16px 16px; }
.tc-title { margin: 0; font-size: 15px; font-weight: 700; line-height: 1.3; color: #14142b; }
.tc-sub { margin: 4px 0 0; font-size: 13px; color: #8a8a9a; }
.tc-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.tc-badge {
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  padding: 5px 9px;
  border-radius: 6px;
  border: 1px solid;
}
`;

function TemplateCard({
  href,
  image,
  title,
  subtitle = "template",
  formats = ["AI", "CDR", "SVG", "PNG"],
}) {
  return (
    <Link href={href} className="tc-card">
      <div className="tc-img">
        {image ? (
          <img src={image} alt={title} loading="lazy" />
        ) : (
          <span className="tc-placeholder">{title?.charAt(0)}</span>
        )}
      </div>

      <div className="tc-body">
        <h3 className="tc-title">{title}</h3>
        {subtitle && <p className="tc-sub">{subtitle}</p>}

        {formats.length > 0 && (
          <div className="tc-badges">
            {formats.map((f) => {
              const s = BADGES[f] || BADGES.AI;
              return (
                <span
                  key={f}
                  className="tc-badge"
                  style={{ background: s.bg, borderColor: s.border, color: s.color }}
                >
                  {f}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function TemplatesClient({ categories }) {
  return (
    <>
      <style>{TEMPLATE_PAGE_CSS}</style>
      <style>{CARD_CSS}</style>
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
              <TemplateCard
                key={c.id}
                href={`/logo-templates/${c.id}`}
                image={c.image || c.thumbnail}
                title={c.name}
                subtitle="template"
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}