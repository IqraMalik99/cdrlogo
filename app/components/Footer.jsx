"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "../context/ThemeContext";
import Image from "next/image";

const SOCIAL_ICONS = {
  facebook: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
  instagram: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  ),
  pinterest: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
    </svg>
  ),
  linkedin: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.114 20.452H3.558V9h3.556v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  ),
 
};

const WHATSAPP_ICON = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2.05 22l5.25-1.38a9.86 9.86 0 0 0 4.74 1.21h.005c5.46 0 9.9-4.45 9.9-9.91C21.93 6.45 17.5 2 12.04 2zm5.8 14.08c-.24.68-1.4 1.33-1.93 1.4-.5.08-1.13.11-1.83-.11-.42-.13-.96-.32-1.66-.62-2.92-1.26-4.83-4.2-4.98-4.4-.14-.19-1.19-1.58-1.19-3.02s.75-2.14 1.02-2.43c.26-.29.58-.36.77-.36h.55c.18 0 .42-.03.65.5.24.55.83 1.98.9 2.13.07.14.11.32.02.51-.09.19-.14.32-.28.49-.14.17-.29.38-.42.51-.14.14-.28.29-.12.57.16.28.71 1.18 1.53 1.91 1.05.94 1.94 1.23 2.22 1.37.28.14.44.12.6-.07.16-.19.68-.79.86-1.06.18-.28.36-.23.6-.14.24.09 1.55.73 1.82.86.27.14.44.2.51.32.07.12.07.68-.17 1.35z" />
  </svg>
);

// ── Social links + WhatsApp number ──────────────────────────────────────────
const STATIC_SOCIALS = {
  facebook: "https://www.facebook.com/cdrlogo",
  instagram: "https://www.instagram.com/cdrlogo/",
  pinterest: "https://www.pinterest.com/cdrlogo",
  linkedin: "https://www.linkedin.com/company/cdrlogo"
};
const WHATSAPP_NUMBER = "923000047427"; // no '+', no leading zero — wa.me format

const QUICK_LINKS = [
  { label: "Contact Us", href: "/contact-us" },
  { label: "Request Logo", href: "/request" },
  { label: "Blogs", href: "/blog" },
  { label: "Brands", href: "/brands" },
  { label: "Template", href: "/template" },
  { label: "All Logos", href: "/logos" },
  { label: "LLM", href: "/llms.txt" },
  { label: "Sitemap", href: "/sitemap.xml" },
];

// ── Static footer config (was previously fetched from /api/website/footer) ──
const STATIC_FOOTER = {
  description:
    "All logos, trademarks, and brand assets are the property of their respective owners. Files are provided for educational, reference, and design-related purposes only.",
};
const STATIC_FOOTER_PAGES = [
  { id: "about-us", slug: "about-us", title: "About Us" },
];
const STATIC_LEGAL_PAGES = [
  { id: "privacy-policy", slug: "privacy-policy", title: "Privacy Policy" },
  { id: "terms-of-service", slug: "terms-of-service", title: "Terms of Service" },
  { id: "dmca-copyright-policy", slug: "dmca-copyright-policy", title: "DMCA & Copyright Policy" },
];

export default function Footer() {
  const { dark } = useTheme();

  // Static now — no more fetch
  const footer = STATIC_FOOTER;
  const footerPages = STATIC_FOOTER_PAGES;
  const legalPages = STATIC_LEGAL_PAGES;

  const theme = dark ? "dark" : "light";

  return (
    <>
      <style>{`

        [data-footer-theme="dark"] {
          --f-bg:        #08080e;
          --f-bg2:       #0d0d16;
          --f-border:    rgba(255,255,255,0.06);
          --f-border2:   rgba(255,255,255,0.04);
          --f-heading:   rgba(255,255,255,0.22);
          --f-link:      rgba(255,255,255,0.45);
          --f-link-h:    #4ade80;
          --f-dot:       rgba(255,255,255,0.12);
          --f-dot-h:     #4ade80;
          --f-copy:      rgba(255,255,255,0.2);
          --f-desc:      rgba(255,255,255,0.35);
          --f-sb-bg:     rgba(255,255,255,0.04);
          --f-sb-bdr:    rgba(255,255,255,0.08);
          --f-sb-clr:    rgba(255,255,255,0.38);
          --f-sb-hbg:    rgba(7,166,38,0.12);
          --f-sb-hbdr:   rgba(7,166,38,0.45);
          --f-sb-hclr:   #4ade80;
          --f-accent:    #07A626;
          --f-accent-lo: rgba(7,166,38,0.08);
          --f-accent-lo2:rgba(7,166,38,0.14);
          --f-accent-txt:#4ade80;
          --f-stat-bg:   rgba(255,255,255,0.03);
          --f-stat-bdr:  rgba(255,255,255,0.06);
          --f-stat-val:  rgba(255,255,255,0.75);
          --f-stat-lbl:  rgba(255,255,255,0.28);
        }
        [data-footer-theme="light"] {
          --f-bg:        #ededf3;
          --f-bg2:       #e6e6ee;
          --f-border:    rgba(0,0,0,0.07);
          --f-border2:   rgba(0,0,0,0.04);
          --f-heading:   rgba(0,0,0,0.28);
          --f-link:      rgba(0,0,0,0.48);
          --f-link-h:    #15803d;
          --f-dot:       rgba(0,0,0,0.14);
          --f-dot-h:     #15803d;
          --f-copy:      rgba(0,0,0,0.28);
          --f-desc:      rgba(0,0,0,0.42);
          --f-sb-bg:     rgba(0,0,0,0.04);
          --f-sb-bdr:    rgba(0,0,0,0.09);
          --f-sb-clr:    rgba(0,0,0,0.38);
          --f-sb-hbg:    rgba(7,166,38,0.08);
          --f-sb-hbdr:   rgba(7,166,38,0.35);
          --f-sb-hclr:   #15803d;
          --f-accent:    #07A626;
          --f-accent-lo: rgba(7,166,38,0.06);
          --f-accent-lo2:rgba(7,166,38,0.1);
          --f-accent-txt:#15803d;
          --f-stat-bg:   rgba(0,0,0,0.03);
          --f-stat-bdr:  rgba(0,0,0,0.06);
          --f-stat-val:  rgba(0,0,0,0.72);
          --f-stat-lbl:  rgba(0,0,0,0.32);
        }

        /* ─── Shell ─── */
        .cdr-footer {
          background: var(--f-bg);
          border-top: 1px solid var(--f-border);
          font-family: var(--font-sora), 'Segoe UI', sans-serif;
          transition: background 0.35s, border-color 0.35s;
          position: relative;
          overflow: hidden;
        }

        /* subtle top glow line */
        .cdr-footer::before {
          content: '';
          position: absolute;
          top: 0; left: 50%; transform: translateX(-50%);
          width: 480px; height: 1px;
          background: linear-gradient(90deg, transparent, var(--f-accent), transparent);
          opacity: 0.45;
          pointer-events: none;
        }

        .cdr-footer-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 60px 40px 0;
        }

        /* ─── Top grid ─── */
        .cdr-footer-top {
          display: grid;
          grid-template-columns: 1.8fr 1fr 1fr 1.1fr;
          gap: 48px;
          padding-bottom: 44px;
        }

        /* ─── Brand column ─── */
        .f-brand-col {
          display: flex;
          flex-direction: column;
        }
        .f-logo-wrap {
          display: inline-block;
          margin-bottom: 16px;
        }
        .f-desc {
          font-family: var(--font-dm-sans), sans-serif;
          font-size: 12.5px;
          line-height: 1.8;
          color: var(--f-desc);
          max-width: 252px;
          margin-bottom: 20px;
          transition: color 0.35s;
        }

        /* ─── Nav columns ─── */
        .f-col-head {
          font-size: 9.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.4px;
          color: var(--f-heading);
          margin-bottom: 18px;
          transition: color 0.35s;
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .f-col-head::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--f-border);
          border-radius: 1px;
        }

        .f-link-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 11px;
        }
        .f-link-list li a {
          font-family: var(--font-dm-sans), sans-serif;
          font-size: 12.5px;
          color: var(--f-link);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          transition: color 0.16s, gap 0.16s;
        }
        .f-link-list li a::before {
          content: '';
          width: 3px; height: 3px;
          border-radius: 50%;
          background: var(--f-dot);
          flex-shrink: 0;
          transition: background 0.16s, transform 0.16s;
        }
        .f-link-list li a:hover {
          color: var(--f-link-h);
          gap: 9px;
        }
        .f-link-list li a:hover::before {
          background: var(--f-dot-h);
          transform: scale(1.4);
        }

        /* quick links 2-col */
        .f-ql-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0 14px;
        }

        /* ─── Divider ─── */
        .f-divider {
          height: 1px;
          background: linear-gradient(90deg,
            transparent 0%,
            var(--f-border) 15%,
            var(--f-border) 85%,
            transparent 100%
          );
          margin: 0;
        }

        /* ─── Bottom bar ─── */
        .cdr-footer-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          padding: 18px 0 28px;
        }
        .f-copyright {
          font-family: var(--font-dm-sans), sans-serif;
          font-size: 11.5px;
          color: var(--f-copy);
          transition: color 0.35s;
        }
        .f-bottom-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        /* dark circular social icons — matches design regardless of theme */
        .f-social-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .f-social-btn {
          width: 30px; height: 30px;
          border-radius: 50%;
          background: #16161f;
          color: #ffffff;
          display: flex; align-items: center; justify-content: center;
          text-decoration: none;
          transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
        }
        [data-footer-theme="light"] .f-social-btn {
          background: #1a1a22;
        }
        .f-social-btn:hover {
          background: var(--f-accent);
          transform: translateY(-2px);
          box-shadow: 0 4px 14px rgba(7,166,38,0.3);
        }

        /* ─── Floating WhatsApp button ─── */
        .wa-float-btn {
          position: fixed;
          right: 20px;
          bottom: 20px;
          width: 54px; height: 54px;
          border-radius: 50%;
          background: #25D366;
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          text-decoration: none;
          box-shadow: 0 6px 20px rgba(37,211,102,0.4);
          z-index: 999;
          transition: transform 0.2s, box-shadow 0.2s;
          animation: wa-pulse 2.4s ease-in-out infinite;
        }
        .wa-float-btn:hover {
          transform: scale(1.08);
          box-shadow: 0 8px 26px rgba(37,211,102,0.5);
        }
        @keyframes wa-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(37,211,102,0.45), 0 6px 20px rgba(37,211,102,0.4); }
          70%  { box-shadow: 0 0 0 12px rgba(37,211,102,0), 0 6px 20px rgba(37,211,102,0.4); }
          100% { box-shadow: 0 0 0 0 rgba(37,211,102,0), 0 6px 20px rgba(37,211,102,0.4); }
        }
        @media (max-width: 480px) {
          .wa-float-btn { right: 14px; bottom: 14px; width: 48px; height: 48px; }
        }

        /* ─── Responsive ─── */
        @media (max-width: 1024px) {
          .cdr-footer-top { grid-template-columns: 1.5fr 1fr 1fr; }
          .cdr-footer-top > .f-brand-col { grid-column: 1 / -1; flex-direction: row; flex-wrap: wrap; gap: 24px; }
          .f-desc { margin-bottom: 0; max-width: 320px; }
        }
        @media (max-width: 700px) {
          .cdr-footer-inner { padding: 44px 20px 0; }
          .cdr-footer-top { grid-template-columns: 1fr 1fr; gap: 30px; }
          .cdr-footer-top > .f-brand-col { grid-column: 1 / -1; flex-direction: column; }
          .f-desc { max-width: 100%; margin-bottom: 16px; }
          .cdr-footer-bottom { justify-content: center; text-align: center; }
        }
        @media (max-width: 420px) {
          .cdr-footer-top { grid-template-columns: 1fr; }
          .f-ql-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <footer className="cdr-footer" data-footer-theme={theme}>
        <div className="cdr-footer-inner">

          {/* ── Top grid ── */}
          <div className="cdr-footer-top">

            {/* Brand */}
            <div className="f-brand-col">
              <Link href="/" className="f-logo-wrap">
                <Image src={`/cdrlogo-${theme}.svg`} width={140}
                  height={32} alt="CDRLOGO" className="h-10 w-auto" priority={true} />
              </Link>
              <p className="f-desc">
                {footer.description ||
                  "Your free library of high-quality brand logos and creative templates."}
              </p>
            </div>

            {/* Pages */}
            <div>
              <p className="f-col-head">Pages</p>
              <ul className="f-link-list">
                {footerPages.length > 0 ? (
                  footerPages.map((page) => (
                    <li key={page.id}>
                      <Link href={`/${page.slug}`}>{page.title}</Link>
                    </li>
                  ))
                ) : (
                  <li style={{ fontSize: 12, color: "var(--f-desc)" }}>No pages yet</li>
                )}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="f-col-head">Legal</p>
              <ul className="f-link-list">
                {legalPages.length > 0 ? (
                  legalPages.map((page) => (
                    <li key={page.id}>
                      <Link href={`/${page.slug}`}>{page.title}</Link>
                    </li>
                  ))
                ) : (
                  <li style={{ fontSize: 12, color: "var(--f-desc)" }}>No pages yet</li>
                )}
              </ul>
            </div>

            {/* Quick Links */}
            <div>
              <p className="f-col-head">Quick Links</p>
              <div className="f-ql-grid">
                <ul className="f-link-list">
                  {QUICK_LINKS.slice(0, Math.ceil(QUICK_LINKS.length / 2)).map((link) => (
                    <li key={link.href}>
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
                <ul className="f-link-list">
                  {QUICK_LINKS.slice(Math.ceil(QUICK_LINKS.length / 2)).map((link) => (
                    <li key={link.href}>
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* ── Gradient divider ── */}
          <div className="f-divider" />

          {/* ── Bottom bar ── */}
          <div className="cdr-footer-bottom">
            <span className="f-copyright">
              All trademarks belong to their respective owners
            </span>
            <div className="f-bottom-right">
              <div className="f-social-row">
                {["facebook", "twitter", "instagram", "pinterest", "linkedin", "youtube"].map(
                  (platform) =>
                    STATIC_SOCIALS[platform] ? (
                      <a
                        key={platform}
                        href={STATIC_SOCIALS[platform]}
                        className="f-social-btn"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={platform}
                      >
                        {SOCIAL_ICONS[platform]}
                      </a>
                    ) : null
                )}
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* ── Floating WhatsApp button (site-wide, bottom-right of viewport) ── */}
      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}`}
        className="wa-float-btn"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
      >
        {WHATSAPP_ICON}
      </a>
    </>
  );
}