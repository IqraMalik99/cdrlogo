"use client";

import { useState } from "react";
import { useTheme } from "../context/ThemeContext";

const navLinks = [
  { label: "Home",           href: "#" },
  { label: "Categories",     href: "#" },
  { label: "Brands",         href: "#" },
  { label: "Logo Templates", href: "#" },
  { label: "Blog",           href: "#" },
  { label: "Contact Us",     href: "#" },
  { label: "Request Logo",   href: "#" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { dark, setDark } = useTheme();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');

        [data-theme="dark"]  {
          --nav-bg: rgba(10,10,15,0.85);
          --nav-border: rgba(255,255,255,0.06);
          --nav-mobile-bg: rgba(10,10,15,0.98);
          --nav-mobile-border: rgba(255,255,255,0.07);
          --logo-text: #ffffff;
          --link-color: rgba(255,255,255,0.65);
          --link-hover-color: #fff;
          --link-hover-bg: rgba(255,255,255,0.07);
          --icon-color: rgba(255,255,255,0.55);
          --icon-hover-color: #fff;
          --icon-hover-bg: rgba(255,255,255,0.08);
          --hamburger-line: rgba(255,255,255,0.7);
        }
        [data-theme="light"] {
          --nav-bg: rgba(255,255,255,0.88);
          --nav-border: rgba(0,0,0,0.08);
          --nav-mobile-bg: rgba(250,250,252,0.99);
          --nav-mobile-border: rgba(0,0,0,0.07);
          --logo-text: #0a0a14;
          --link-color: rgba(0,0,0,0.58);
          --link-hover-color: #000;
          --link-hover-bg: rgba(0,0,0,0.05);
          --icon-color: rgba(0,0,0,0.45);
          --icon-hover-color: #000;
          --icon-hover-bg: rgba(0,0,0,0.06);
          --hamburger-line: rgba(0,0,0,0.65);
        }

        .navbar {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          background: var(--nav-bg);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--nav-border);
          font-family: 'Sora', 'Segoe UI', sans-serif;
          transition: background 0.35s, border-color 0.35s;
        }

        .navbar-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 24px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        /* Logo */
        .navbar-logo {
          display: flex;
          align-items: center;
          text-decoration: none;
          flex-shrink: 0;
        }
        .navbar-logo img {
          height: 32px;
          width: auto;
          display: block;
        }

        /* Nav links */
        .nav-links {
          display: flex; align-items: center;
          gap: 2px; list-style: none; margin: 0; padding: 0;
        }
        .nav-links a {
          display: block;
          padding: 6px 13px;
          font-size: 13.5px; font-weight: 500;
          color: var(--link-color);
          text-decoration: none;
          border-radius: 8px;
          transition: color 0.2s, background 0.2s;
          white-space: nowrap;
        }
        .nav-links a:hover {
          color: var(--link-hover-color);
          background: var(--link-hover-bg);
        }

        /* Actions */
        .navbar-actions {
          display: flex; align-items: center;
          gap: 6px; flex-shrink: 0;
        }

        .icon-btn {
          width: 36px; height: 36px;
          border-radius: 8px;
          background: transparent; border: none;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: var(--icon-color);
          transition: background 0.2s, color 0.2s;
        }
        .icon-btn:hover {
          background: var(--icon-hover-bg);
          color: var(--icon-hover-color);
        }

        /* Theme toggle pill */
        .theme-toggle {
          display: flex; align-items: center;
          background: transparent;
          border: 1px solid var(--nav-border);
          border-radius: 10px;
          overflow: hidden;
          transition: border-color 0.3s;
        }
        .theme-btn {
          width: 34px; height: 32px;
          border: none; background: transparent;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: var(--icon-color);
          transition: background 0.2s, color 0.2s;
        }
        .theme-btn.active {
          background: rgba(7,166,38,0.15);
          color: #07A626;
        }
        [data-theme="light"] .theme-btn.active {
          background: rgba(7,166,38,0.1);
          color: #07A626;
        }
        .theme-btn:not(.active):hover {
          background: var(--icon-hover-bg);
          color: var(--icon-hover-color);
        }

        /* Login */
        .login-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 16px;
          background: rgba(7,166,38,0.1);
          border: 1px solid rgba(7,166,38,0.35);
          border-radius: 9px;
          color: #07A626;
          font-size: 13.5px; font-weight: 600;
          cursor: pointer; text-decoration: none;
          transition: background 0.2s, border-color 0.2s, color 0.2s;
          white-space: nowrap;
          font-family: 'Sora', sans-serif;
        }
        .login-btn:hover {
          background: rgba(7,166,38,0.18);
          border-color: rgba(7,166,38,0.55);
          color: #05891e;
        }
        [data-theme="dark"] .login-btn {
          color: #4ade80;
          background: rgba(7,166,38,0.1);
          border-color: rgba(7,166,38,0.3);
        }
        [data-theme="dark"] .login-btn:hover {
          color: #86efac;
          background: rgba(7,166,38,0.18);
          border-color: rgba(7,166,38,0.5);
        }

        /* Hamburger */
        .hamburger {
          display: none;
          flex-direction: column; justify-content: center;
          gap: 5px;
          width: 36px; height: 36px;
          border: none; background: transparent;
          cursor: pointer; padding: 4px;
          border-radius: 8px;
          transition: background 0.2s;
        }
        .hamburger:hover { background: var(--icon-hover-bg); }
        .hamburger span {
          display: block; height: 2px;
          background: var(--hamburger-line);
          border-radius: 2px;
          transition: all 0.3s;
        }
        .hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
        .hamburger.open span:nth-child(2) { opacity: 0; }
        .hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

        /* Mobile menu */
        .mobile-menu {
          display: none; flex-direction: column;
          background: var(--nav-mobile-bg);
          border-top: 1px solid var(--nav-mobile-border);
          padding: 12px 24px 20px;
          gap: 2px;
          transition: background 0.3s;
        }
        .mobile-menu.open { display: flex; }
        .mobile-menu a {
          padding: 10px 12px;
          font-size: 14px; font-weight: 500;
          color: var(--link-color);
          text-decoration: none; border-radius: 8px;
          transition: background 0.2s, color 0.2s;
        }
        .mobile-menu a:hover {
          background: var(--link-hover-bg);
          color: var(--link-hover-color);
        }
        .mobile-login {
          margin-top: 10px;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 10px 16px;
          background: rgba(7,166,38,0.1);
          border: 1px solid rgba(7,166,38,0.35);
          border-radius: 9px;
          color: #07A626;
          font-size: 14px; font-weight: 600;
          cursor: pointer; text-decoration: none;
          transition: background 0.2s;
          font-family: 'Sora', sans-serif;
        }
        .mobile-login:hover { background: rgba(7,166,38,0.18); }
        [data-theme="dark"] .mobile-login { color: #4ade80; }

        @media (max-width: 900px) {
          .nav-links       { display: none; }
          .login-btn       { display: none; }
          .hamburger       { display: flex; }
          .theme-toggle    { display: none; }
          .icon-btn.bookmark { display: none; }
        }
      `}</style>

      <nav className="navbar">
        <div className="navbar-inner">

          {/* Logo — switches between dark/light SVG */}
          <a href="#" className="navbar-logo">
            <img
              src={dark ? "/cdrlogo-dark.svg" : "/cdrlogo-light.svg"}
              alt="CDRLogo"
            />
          </a>

          {/* Desktop nav links */}
          <ul className="nav-links">
            {navLinks.map(link => (
              <li key={link.label}><a href={link.href}>{link.label}</a></li>
            ))}
          </ul>

          {/* Actions */}
          <div className="navbar-actions">

            {/* Bookmark */}
            <button className="icon-btn bookmark" aria-label="Bookmarks">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
            </button>

            {/* Light / Dark toggle */}
            <div className="theme-toggle">
              <button
                className={`theme-btn${!dark ? " active" : ""}`}
                aria-label="Light mode"
                onClick={() => setDark(false)}
                title="Light mode"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1"  x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22"  y1="4.22"  x2="5.64"  y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1"  y1="12" x2="3"  y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36"/>
                  <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"/>
                </svg>
              </button>
              <button
                className={`theme-btn${dark ? " active" : ""}`}
                aria-label="Dark mode"
                onClick={() => setDark(true)}
                title="Dark mode"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              </button>
            </div>

            {/* Login */}
            <a href="#" className="login-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Login
            </a>

            {/* Hamburger */}
            <button
              className={`hamburger${menuOpen ? " open" : ""}`}
              aria-label="Toggle menu"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`mobile-menu${menuOpen ? " open" : ""}`}>
          {navLinks.map(link => (
            <a key={link.label} href={link.href}>{link.label}</a>
          ))}
          {/* Mobile theme toggle */}
          <div style={{ display:"flex", gap:8, margin:"8px 0 4px", padding:"0 2px" }}>
            <button
              onClick={() => setDark(false)}
              style={{
                flex:1, padding:"8px 0", borderRadius:8, border:"1px solid",
                borderColor: !dark ? "rgba(7,166,38,0.5)" : "var(--nav-mobile-border)",
                background: !dark ? "rgba(7,166,38,0.1)" : "transparent",
                color: !dark ? "#07A626" : "var(--link-color)",
                fontFamily:"'Sora',sans-serif", fontSize:13, fontWeight:600,
                cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                transition:"all 0.2s"
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
              Light
            </button>
            <button
              onClick={() => setDark(true)}
              style={{
                flex:1, padding:"8px 0", borderRadius:8, border:"1px solid",
                borderColor: dark ? "rgba(7,166,38,0.5)" : "var(--nav-mobile-border)",
                background: dark ? "rgba(7,166,38,0.1)" : "transparent",
                color: dark ? "#4ade80" : "var(--link-color)",
                fontFamily:"'Sora',sans-serif", fontSize:13, fontWeight:600,
                cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                transition:"all 0.2s"
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
              Dark
            </button>
          </div>
          <a href="#" className="mobile-login">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            Login
          </a>
        </div>
      </nav>
    </>
  );
}