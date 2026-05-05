"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const { dark, setDark } = useTheme();
  const [navLinks, setNavLinks] = useState([]);
  const [loadingNav, setLoadingNav] = useState(true);
  const [showThemeToggle, setShowThemeToggle] = useState(false);

  const dropRef = useRef(null);
  const { data: session, status } = useSession();

  const isLoading = status === "loading";
  const isLogged = status === "authenticated";

  const username = session?.user?.name ?? "";
  const email = session?.user?.email ?? "";
  const initial = username?.charAt(0)?.toUpperCase() || email?.charAt(0)?.toUpperCase() || "?";

  useEffect(() => {
    function handleClick(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    async function loadNav() {
      try {
        const res = await fetch("/api/website/header", { cache: "no-store" });
        const data = await res.json();
        if (Array.isArray(data?.navItems)) {
          setNavLinks(
            data.navItems
              .filter((item) => item.add)
              .map((item) => ({ label: item.label, href: item.link }))
          );
        }
        if (typeof data?.showmode === "boolean") {
          setShowThemeToggle(data.showmode);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingNav(false);
      }
    }
    loadNav();
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');

        [data-theme="dark"] {
          --nav-bg: rgba(10,10,15,0.85);
          --nav-border: rgba(255,255,255,0.06);
          --nav-mobile-bg: rgba(10,10,15,0.98);
          --nav-mobile-border: rgba(255,255,255,0.07);
          --link-color: rgba(255,255,255,0.65);
          --link-hover-color: #fff;
          --link-hover-bg: rgba(255,255,255,0.07);
          --icon-color: rgba(255,255,255,0.55);
          --icon-hover-color: #fff;
          --icon-hover-bg: rgba(255,255,255,0.08);
          --hamburger-line: rgba(255,255,255,0.7);
          --drop-bg: rgba(14,14,20,0.98);
          --drop-border: rgba(255,255,255,0.08);
          --drop-text: rgba(255,255,255,0.85);
          --drop-sub: rgba(255,255,255,0.38);
          --drop-divider: rgba(255,255,255,0.07);
          --drop-hover: rgba(255,255,255,0.05);
          --drop-logout-bg: rgba(239,68,68,0.1);
          --drop-logout-hover: rgba(239,68,68,0.18);
          --drop-logout-color: #f87171;
        }
        [data-theme="light"] {
          --nav-bg: rgba(255,255,255,0.88);
          --nav-border: rgba(0,0,0,0.08);
          --nav-mobile-bg: rgba(250,250,252,0.99);
          --nav-mobile-border: rgba(0,0,0,0.07);
          --link-color: rgba(0,0,0,0.58);
          --link-hover-color: #000;
          --link-hover-bg: rgba(0,0,0,0.05);
          --icon-color: rgba(0,0,0,0.45);
          --icon-hover-color: #000;
          --icon-hover-bg: rgba(0,0,0,0.06);
          --hamburger-line: rgba(0,0,0,0.65);
          --drop-bg: rgba(255,255,255,0.98);
          --drop-border: rgba(0,0,0,0.09);
          --drop-text: rgba(0,0,0,0.85);
          --drop-sub: rgba(0,0,0,0.4);
          --drop-divider: rgba(0,0,0,0.07);
          --drop-hover: rgba(0,0,0,0.04);
          --drop-logout-bg: rgba(239,68,68,0.07);
          --drop-logout-hover: rgba(239,68,68,0.13);
          --drop-logout-color: #dc2626;
        }

        .navbar {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          background: var(--nav-bg);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--nav-border);
          font-family: 'Sora', 'Segoe UI', sans-serif;
          transition: background 0.35s, border-color 0.35s;
        }
        .navbar-inner {
          max-width: 1280px; margin: 0 auto;
          padding: 0 24px; height: 64px;
          display: flex; align-items: center;
          justify-content: space-between; gap: 16px;
        }

        /* Logo */
        .navbar-logo { display: flex; align-items: center; text-decoration: none; flex-shrink: 0; }
        .navbar-logo img { height: 32px; width: auto; display: block; }

        /* Nav links */
        .nav-links { display: flex; align-items: center; gap: 2px; list-style: none; margin: 0; padding: 0; }
        .nav-links a {
          display: block; padding: 6px 13px;
          font-size: 13.5px; font-weight: 500;
          color: var(--link-color); text-decoration: none;
          border-radius: 8px; transition: color 0.2s, background 0.2s; white-space: nowrap;
        }
        .nav-links a:hover { color: var(--link-hover-color); background: var(--link-hover-bg); }

        /* Actions */
        .navbar-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

        /* Theme toggle */
        .theme-toggle {
          display: flex; align-items: center;
          background: transparent; border: 1px solid var(--nav-border);
          border-radius: 10px; overflow: hidden; transition: border-color 0.3s;
        }
        .theme-btn {
          width: 34px; height: 32px; border: none; background: transparent;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          color: var(--icon-color); transition: background 0.2s, color 0.2s;
        }
        .theme-btn.active { background: rgba(7,166,38,0.15); color: #07A626; }
        [data-theme="light"] .theme-btn.active { background: rgba(7,166,38,0.1); color: #07A626; }
        .theme-btn:not(.active):hover { background: var(--icon-hover-bg); color: var(--icon-hover-color); }

        /* Login button */
        .login-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 16px;
          background: rgba(7,166,38,0.1); border: 1px solid rgba(7,166,38,0.35);
          border-radius: 9px; color: #07A626;
          font-size: 13.5px; font-weight: 600;
          cursor: pointer; text-decoration: none;
          transition: background 0.2s, border-color 0.2s, color 0.2s;
          white-space: nowrap; font-family: 'Sora', sans-serif;
        }
        .login-btn:hover { background: rgba(7,166,38,0.18); border-color: rgba(7,166,38,0.55); }
        [data-theme="dark"] .login-btn { color: #4ade80; }
        [data-theme="dark"] .login-btn:hover { color: #86efac; }

        /* Avatar button */
        .avatar-wrap { position: relative; }
        .avatar-btn {
          width: 36px; height: 36px; border-radius: 50%;
          background: linear-gradient(135deg, #07A626 0%, #05891e 100%);
          border: 2px solid rgba(7,166,38,0.4);
          color: #fff; font-family: 'Sora', sans-serif;
          font-size: 14px; font-weight: 700;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
          flex-shrink: 0;
        }
        .avatar-btn:hover {
          transform: scale(1.07);
          box-shadow: 0 0 0 3px rgba(7,166,38,0.2);
          border-color: rgba(7,166,38,0.6);
        }

        /* Dropdown */
        .avatar-dropdown {
          position: absolute; top: calc(100% + 10px); right: 0;
          min-width: 220px;
          background: var(--drop-bg);
          border: 1px solid var(--drop-border);
          border-radius: 14px;
          box-shadow: 0 16px 40px rgba(0,0,0,0.2);
          overflow: hidden;
          opacity: 0; transform: translateY(-6px) scale(0.97);
          pointer-events: none;
          transition: opacity 0.18s, transform 0.18s;
          z-index: 200;
        }
        .avatar-dropdown.open {
          opacity: 1; transform: translateY(0) scale(1);
          pointer-events: auto;
        }

        .drop-header {
          display: flex; align-items: center; gap: 11px;
          padding: 14px 16px 12px;
        }
        .drop-avatar {
          width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, #07A626 0%, #05891e 100%);
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 15px; font-weight: 700;
          font-family: 'Sora', sans-serif;
        }
        .drop-user-info { overflow: hidden; }
        .drop-name {
          font-size: 13px; font-weight: 600;
          color: var(--drop-text);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .drop-email {
          font-size: 11px;
          color: var(--drop-sub); margin-top: 1px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .drop-divider { height: 1px; background: var(--drop-divider); }

        /* Generic dropdown item */
        .drop-item {
          display: flex; align-items: center; gap: 9px;
          padding: 9px 16px;
          font-size: 13px; font-weight: 500;
          color: var(--drop-text); text-decoration: none;
          transition: background 0.15s;
          cursor: pointer; border: none; background: transparent;
          width: 100%; font-family: 'Sora', sans-serif; text-align: left;
        }
        .drop-item:hover { background: var(--drop-hover); }

        /* Profile item — green accent */
        .drop-item.profile {
          color: #07A626;
        }
        [data-theme="dark"] .drop-item.profile { color: #4ade80; }
        .drop-item.profile:hover {
          background: rgba(7,166,38,0.08);
        }

        /* Sign out item — red */
        .drop-item.signout {
          color: var(--drop-logout-color);
        }
        .drop-item.signout:hover {
          background: var(--drop-logout-bg);
        }

        /* Bottom action row inside dropdown */
        .drop-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          padding: 8px;
        }
        .drop-action-btn {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid;
          font-family: 'Sora', sans-serif;
          font-size: 12px; font-weight: 600;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
          text-decoration: none;
          white-space: nowrap;
        }
        /* Profile action btn — green */
        .drop-action-btn.profile {
          background: rgba(7,166,38,0.08);
          border-color: rgba(7,166,38,0.25);
          color: #07A626;
        }
        [data-theme="dark"] .drop-action-btn.profile {
          color: #4ade80;
          background: rgba(7,166,38,0.1);
          border-color: rgba(7,166,38,0.28);
        }
        .drop-action-btn.profile:hover {
          background: rgba(7,166,38,0.15);
          border-color: rgba(7,166,38,0.4);
        }
        /* Sign out action btn — subtle red */
        .drop-action-btn.signout {
          background: var(--drop-logout-bg);
          border-color: rgba(239,68,68,0.2);
          color: var(--drop-logout-color);
        }
        .drop-action-btn.signout:hover {
          background: var(--drop-logout-hover);
          border-color: rgba(239,68,68,0.35);
        }

        /* Hamburger */
        .hamburger {
          display: none; flex-direction: column; justify-content: center;
          gap: 5px; width: 36px; height: 36px;
          border: none; background: transparent; cursor: pointer;
          padding: 4px; border-radius: 8px; transition: background 0.2s;
        }
        .hamburger:hover { background: var(--icon-hover-bg); }
        .hamburger span {
          display: block; height: 2px; background: var(--hamburger-line);
          border-radius: 2px; transition: all 0.3s;
        }
        .hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
        .hamburger.open span:nth-child(2) { opacity: 0; }
        .hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

        /* Mobile menu */
        .mobile-menu {
          display: none; flex-direction: column;
          background: var(--nav-mobile-bg);
          border-top: 1px solid var(--nav-mobile-border);
          padding: 12px 16px 20px; gap: 2px;
          transition: background 0.3s;
        }
        .mobile-menu.open { display: flex; }
        .mobile-menu a {
          padding: 10px 12px; font-size: 14px; font-weight: 500;
          color: var(--link-color); text-decoration: none;
          border-radius: 8px; transition: background 0.2s, color 0.2s;
        }
        .mobile-menu a:hover { background: var(--link-hover-bg); color: var(--link-hover-color); }

        /* Mobile user card */
        .mobile-user-card {
          display: flex; align-items: center; gap: 12px;
          padding: 12px; margin: 6px 0 2px;
          background: var(--drop-hover);
          border: 1px solid var(--drop-border);
          border-radius: 11px;
        }
        .mobile-avatar {
          width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, #07A626 0%, #05891e 100%);
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 15px; font-weight: 700;
        }
        .mob-name { font-size: 13.5px; font-weight: 600; color: var(--drop-text); }
        .mob-email { font-size: 11.5px; color: var(--drop-sub); margin-top: 1px; }

        /* Mobile action buttons row */
        .mobile-action-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 8px;
        }
        .mob-action-btn {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 10px 8px;
          border-radius: 9px; border: 1px solid;
          font-family: 'Sora', sans-serif;
          font-size: 13px; font-weight: 600;
          cursor: pointer; text-decoration: none;
          transition: background 0.2s;
        }
        .mob-action-btn.profile {
          background: rgba(7,166,38,0.08);
          border-color: rgba(7,166,38,0.3);
          color: #07A626;
        }
        [data-theme="dark"] .mob-action-btn.profile {
          color: #4ade80;
          background: rgba(7,166,38,0.1);
        }
        .mob-action-btn.profile:hover { background: rgba(7,166,38,0.16); }
        .mob-action-btn.signout {
          background: var(--drop-logout-bg);
          border-color: rgba(239,68,68,0.22);
          color: var(--drop-logout-color);
        }
        .mob-action-btn.signout:hover { background: var(--drop-logout-hover); }

        /* Mobile login */
        .mobile-login {
          margin-top: 10px;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 10px 16px;
          background: rgba(7,166,38,0.1); border: 1px solid rgba(7,166,38,0.35);
          border-radius: 9px; color: #07A626;
          font-size: 14px; font-weight: 600;
          text-decoration: none; font-family: 'Sora', sans-serif;
          transition: background 0.2s;
        }
        .mobile-login:hover { background: rgba(7,166,38,0.18); }
        [data-theme="dark"] .mobile-login { color: #4ade80; }

        /* Mobile theme toggle */
        .mob-theme-row {
          display: flex; gap: 8px;
          margin: 8px 0 4px;
        }
        .mob-theme-btn {
          flex: 1; padding: 8px 0; border-radius: 8px; border: 1px solid;
          font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;
          transition: all 0.2s;
        }
        .mob-theme-btn.active {
          border-color: rgba(7,166,38,0.5);
          background: rgba(7,166,38,0.1);
          color: #07A626;
        }
        [data-theme="dark"] .mob-theme-btn.active { color: #4ade80; }
        .mob-theme-btn:not(.active) {
          border-color: var(--nav-mobile-border);
          background: transparent;
          color: var(--link-color);
        }

        @media (max-width: 900px) {
          .nav-links    { display: none; }
          .login-btn    { display: none; }
          .hamburger    { display: flex; }
          .theme-toggle { display: none; }
          .avatar-wrap  { display: none; }
        }
      `}</style>

      <nav className="navbar">
        <div className="navbar-inner">

          {/* Logo */}
          <Link href="/" className="navbar-logo">
            <img src={dark ? "/cdrlogo-dark.svg" : "/cdrlogo-light.svg"} alt="CDRLogo" />
          </Link>

          {/* Desktop nav links */}
          {!loadingNav && (
            <ul className="nav-links">
              {navLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          )}

          {/* Actions */}
          <div className="navbar-actions">

            {/* Theme toggle */}
            {showThemeToggle && (
              <div className="theme-toggle">
                <button
                  className={`theme-btn${!dark ? " active" : ""}`}
                  aria-label="Light mode" onClick={() => setDark(false)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                </button>
                <button
                  className={`theme-btn${dark ? " active" : ""}`}
                  aria-label="Dark mode" onClick={() => setDark(true)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                </button>
              </div>
            )}

            {/* Desktop: Avatar + Dropdown */}
            {!isLoading && isLogged ? (
              <div className="avatar-wrap" ref={dropRef}>
                <button
                  className="avatar-btn"
                  aria-label="Account menu"
                  onClick={() => setDropOpen(v => !v)}
                >
                  {initial}
                </button>

                <div className={`avatar-dropdown${dropOpen ? " open" : ""}`}>
                  {/* User info */}
                  <div className="drop-header">
                    <div className="drop-avatar">{initial}</div>
                    <div className="drop-user-info">
                      <div className="drop-name">{username || "Account"}</div>
                      <div className="drop-email">{email}</div>
                    </div>
                  </div>

                  <div className="drop-divider" />

                  {/* Profile + Sign out as two side-by-side buttons */}
                  <div className="drop-actions">
                    <Link
                      href="/profile"
                      className="drop-action-btn profile"
                      onClick={() => setDropOpen(false)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      Profile
                    </Link>

                    <button
                      className="drop-action-btn signout"
                      onClick={() => { setDropOpen(false); signOut(); }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            ) : !isLoading ? (
              <Link href="/login" className="login-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Login
              </Link>
            ) : null}

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

        {/* ── Mobile menu ── */}
        <div className={`mobile-menu${menuOpen ? " open" : ""}`}>

          {/* Nav links */}
          {navLinks.map(link => (
            <a key={link.label} href={link.href} onClick={() => setMenuOpen(false)}>
              {link.label}
            </a>
          ))}

          {/* Theme toggle */}
          {showThemeToggle && (
            <div className="mob-theme-row">
              <button className={`mob-theme-btn${!dark ? " active" : ""}`} onClick={() => setDark(false)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
                Light
              </button>
              <button className={`mob-theme-btn${dark ? " active" : ""}`} onClick={() => setDark(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                Dark
              </button>
            </div>
          )}

          {/* Logged in */}
          {isLogged ? (
            <>
              <div className="mobile-user-card">
                <div className="mobile-avatar">{initial}</div>
                <div>
                  <div className="mob-name">{username || "Account"}</div>
                  <div className="mob-email">{email}</div>
                </div>
              </div>

              <div className="mobile-action-row">
                <Link
                  href="/profile"
                  className="mob-action-btn profile"
                  onClick={() => setMenuOpen(false)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Profile
                </Link>
                <button className="mob-action-btn signout" onClick={() => signOut()}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <Link href="/login" className="mobile-login" onClick={() => setMenuOpen(false)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Login
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}