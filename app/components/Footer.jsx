"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "../context/ThemeContext";

const SOCIAL_ICONS = {
    twitter: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.261 5.635 5.904-5.635Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
    ),
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
};

const QUICK_LINKS = [
    { label: "Contact Us", href: "/contact-us" },
    { label: "Request Logo", href: "/request" },
    { label: "Brands", href: "/brands" },
    { label: "Template", href: "/template" },
];

export default function Footer() {
    const { dark } = useTheme();
    const [footer, setFooter] = useState({});
    const [footerPages, setFooterPages] = useState([]);
    const [legalPages, setLegalPages] = useState([]);

    useEffect(() => {
        fetch("/api/website/footer")
            .then((r) => r.json())
            .then(({ footer, footerPages, legalPages }) => {
                setFooter(footer ?? {});
                setFooterPages(footerPages ?? []);
                setLegalPages(legalPages ?? []);
            })
            .catch(() => { });
    }, []);

    const theme = dark ? "dark" : "light";

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:wght@400;500&display=swap');

        [data-footer-theme="dark"] {
          --f-bg:       #09090f;
          --f-border:   rgba(255,255,255,0.07);
          --f-heading:  rgba(255,255,255,0.25);
          --f-link:     rgba(255,255,255,0.5);
          --f-link-h:   #4ade80;
          --f-dot:      rgba(255,255,255,0.15);
          --f-dot-h:    #4ade80;
          --f-copy:     rgba(255,255,255,0.22);
          --f-desc:     rgba(255,255,255,0.38);
          --f-sb-bg:    rgba(255,255,255,0.04);
          --f-sb-bdr:   rgba(255,255,255,0.1);
          --f-sb-clr:   rgba(255,255,255,0.4);
          --f-sb-hbg:   rgba(7,166,38,0.1);
          --f-sb-hbdr:  rgba(7,166,38,0.5);
          --f-sb-hclr:  #4ade80;
        }
        [data-footer-theme="light"] {
          --f-bg:       #f0f0f5;
          --f-border:   rgba(0,0,0,0.08);
          --f-heading:  rgba(0,0,0,0.3);
          --f-link:     rgba(0,0,0,0.5);
          --f-link-h:   #15803d;
          --f-dot:      rgba(0,0,0,0.15);
          --f-dot-h:    #15803d;
          --f-copy:     rgba(0,0,0,0.3);
          --f-desc:     rgba(0,0,0,0.45);
          --f-sb-bg:    rgba(0,0,0,0.04);
          --f-sb-bdr:   rgba(0,0,0,0.1);
          --f-sb-clr:   rgba(0,0,0,0.4);
          --f-sb-hbg:   rgba(7,166,38,0.08);
          --f-sb-hbdr:  rgba(7,166,38,0.4);
          --f-sb-hclr:  #15803d;
        }

        .cdr-footer {
          background: var(--f-bg);
          border-top: 1px solid var(--f-border);
          font-family: 'Sora', 'Segoe UI', sans-serif;
          transition: background 0.35s;
        }
        .cdr-footer-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 56px 40px 28px;
        }
        .cdr-footer-top {
          display: grid;
          grid-template-columns: 1.7fr 1fr 1fr 1fr 1fr;
          gap: 40px;
          padding-bottom: 40px;
          border-bottom: 1px solid var(--f-border);
        }

        .f-logo-mark {
          display: inline-flex; align-items: center; gap: 8px;
          margin-bottom: 14px; text-decoration: none;
        }
        .f-logo-icon {
          width: 32px; height: 32px;
          background: linear-gradient(135deg, #07A626, #34d058);
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-weight: 900; font-size: 13px; color: #fff; letter-spacing: -0.5px;
          flex-shrink: 0;
        }
        .f-logo-text { font-size: 15px; font-weight: 800; letter-spacing: -0.4px; }
        [data-footer-theme="dark"] .f-logo-text { color: #fff; }
        [data-footer-theme="light"] .f-logo-text { color: #0a0a14; }
        .f-logo-text .accent { color: #4ade80; }
        [data-footer-theme="light"] .f-logo-text .accent { color: #15803d; }

        .f-desc {
          font-family: 'DM Sans', sans-serif;
          font-size: 12.5px; line-height: 1.75;
          color: var(--f-desc);
          max-width: 260px;
          margin-bottom: 18px;
          transition: color 0.35s;
        }

        .f-socials { display: flex; gap: 7px; flex-wrap: wrap; }
        .f-social-btn {
          width: 32px; height: 32px;
          border-radius: 8px;
          border: 1px solid var(--f-sb-bdr);
          background: var(--f-sb-bg);
          color: var(--f-sb-clr);
          display: flex; align-items: center; justify-content: center;
          text-decoration: none;
          transition: all 0.2s;
        }
        .f-social-btn:hover {
          border-color: var(--f-sb-hbdr);
          background: var(--f-sb-hbg);
          color: var(--f-sb-hclr);
          transform: translateY(-2px);
        }

        .f-col-head {
          font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 1.2px;
          color: var(--f-heading);
          margin-bottom: 16px;
          transition: color 0.35s;
        }
        .f-link-list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
        .f-link-list li a {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; color: var(--f-link);
          text-decoration: none;
          display: inline-flex; align-items: center; gap: 6px;
          transition: color 0.18s;
        }
        .f-link-list li a::before {
          content: '';
          width: 3px; height: 3px; border-radius: 50%;
          background: var(--f-dot);
          flex-shrink: 0;
          transition: background 0.18s;
        }
        .f-link-list li a:hover { color: var(--f-link-h); }
        .f-link-list li a:hover::before { background: var(--f-dot-h); }

        .cdr-footer-bottom {
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 10px;
          padding-top: 22px;
        }
        .f-copyright {
          font-family: 'DM Sans', sans-serif;
          font-size: 11.5px; color: var(--f-copy);
          transition: color 0.35s;
        }
        .f-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 10px;
          background: rgba(7,166,38,.08);
          border: 1px solid rgba(7,166,38,.18);
          border-radius: 100px;
          font-size: 9.5px; font-weight: 600;
          color: rgba(74,222,128,.7); letter-spacing: .2px;
        }
        [data-footer-theme="light"] .f-badge { color: #15803d; background: rgba(7,166,38,.06); }
        .f-pulse {
          width: 5px; height: 5px; background: #07A626;
          border-radius: 50%;
          animation: f-pd 2s infinite;
        }
        @keyframes f-pd { 0%,100%{opacity:1}50%{opacity:.4} }

        @media (max-width: 1024px) {
          .cdr-footer-top { grid-template-columns: 1.4fr 1fr 1fr 1fr; }
          .cdr-footer-top > *:first-child { grid-column: 1 / -1; }
        }
        @media (max-width: 700px) {
          .cdr-footer-inner { padding: 40px 20px 24px; }
          .cdr-footer-top { grid-template-columns: 1fr 1fr; gap: 28px; }
          .cdr-footer-top > *:first-child { grid-column: 1 / -1; }
        }
        @media (max-width: 400px) {
          .cdr-footer-top { grid-template-columns: 1fr; }
        }
      `}</style>

            <footer className="cdr-footer" data-footer-theme={theme}>
                <div className="cdr-footer-inner">
                    <div className="cdr-footer-top">

                        {/* ── Brand Column ── */}
                        <div>
                            <Link href="/" className="">
                                <img src={`/cdrlogo-${theme}.svg`} alt="CDRLOGO" className="h-10 w-auto" />

                            </Link>

                            <p className="f-desc">
                                {footer.description ||
                                    "Your free library of high-quality brand logos and creative templates."}
                            </p>

                            <div className="f-socials">
                                {["twitter", "facebook", "instagram", "pinterest"].map((platform) =>
                                    footer[platform] ? (
                                        <a
                                            key={platform}
                                            href={footer[platform]}
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

                        {/* ── Pages Column (InFooter=true) ── */}
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

                        {/* ── Legal Column (InLegal=true) ── */}
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

                        {/* ── Quick Links Column ── */}
                        <div>
                            <p className="f-col-head">Quick Links</p>
                            <ul className="f-link-list">
                                {QUICK_LINKS.map((link) => (
                                    <li key={link.href}>
                                        <Link href={link.href}>{link.label}</Link>
                                    </li>
                                ))}
                            </ul>
                        </div>


                    </div>

                    {/* ── Bottom Bar ── */}
                    <div className="cdr-footer-bottom">
                        <span className="f-copyright">
                            {footer.copyright || "© 2024 CDRLOGO.com. All rights reserved."}
                        </span>
                        <span className="f-badge">
                            <span className="f-pulse" />
                            50,000+ Logo Resources
                        </span>
                    </div>
                </div>
            </footer>
        </>
    );
}