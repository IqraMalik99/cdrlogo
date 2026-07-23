"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";

// ── Static nav config (was previously fetched from /api/website/header) ──
const STATIC_NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Brands", href: "/brands" },
  { label: "Logo Templates", href: "/template" },
  { label: "Categories", href: "/category" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact-us" },
  { label: "Request Logo", href: "/request" },
];
const STATIC_SHOW_THEME_TOGGLE = true;

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const { dark, setDark } = useTheme();

  // Static now — no more fetch/loading state
  const navLinks = STATIC_NAV_LINKS;
  const showThemeToggle = STATIC_SHOW_THEME_TOGGLE;

  // Upload Logo modal
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

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

  // ── Account menu items shown in the avatar dropdown / mobile menu ──────
  // (Upload Logo removed from here — it's its own standalone button)
  const accountItems = [
    {
      href: "/profile",
      label: "Profile",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      href: "/upload-logo",
      label: "Upload Logos",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      ),
    },
    {
      href: "/my-logos",
      label: "My Logos",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      ),
    },
    {
      href: "/liked-logos",
      label: "Liked Logos",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
        </svg>
      ),
    },
  ];

  function openUpload() {
    setUploadError("");
    setUploadFile(null);
    setUploadOpen(true);
  }

  function closeUpload() {
    if (uploading) return; // don't let them close mid-request
    setUploadOpen(false);
    setUploadFile(null);
    setUploadError("");
  }

  async function submitUpload() {
    if (!uploadFile) {
      setUploadError("Please choose a file first.");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);

      const res = await fetch("/api/logos/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      setUploadOpen(false);
      setUploadFile(null);
    } catch (err) {
      console.error(err);
      setUploadError("Something went wrong uploading your logo. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  // Standalone "Upload Logo" button icon — matches screenshot (green pill next to avatar)
  const uploadLogoIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );

  return (
    <>
      <style>{`
  

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
          font-family:  sans-serif;
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
        .navbar-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

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
          white-space: nowrap; font-family: var(--font-sora), sans-serif;
        }
        .login-btn:hover { background: rgba(7,166,38,0.18); border-color: rgba(7,166,38,0.55); }
        [data-theme="dark"] .login-btn { color: #4ade80; }
        [data-theme="dark"] .login-btn:hover { color: #86efac; }

        /* Upload Logo button — standalone, solid green, only visible when logged in */
        .upload-logo-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 16px;
          background: linear-gradient(135deg, #07A626 0%, #05891e 100%);
          border: none;
          border-radius: 9px; color: #fff;
          font-size: 13.5px; font-weight: 600;
          cursor: pointer; text-decoration: none;
          transition: filter 0.2s, transform 0.2s;
          white-space: nowrap; font-family: var(--font-sora), sans-serif;
          box-shadow: 0 2px 10px rgba(7,166,38,0.25);
        }
        .upload-logo-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }

        /* Wraps Upload Logo + Avatar so both share one outside-click boundary */
        .account-actions { display: flex; align-items: center; gap: 8px; position: relative; }

        /* Avatar button */
        .avatar-wrap { position: relative; }
        .avatar-btn {
          width: 36px; height: 36px; border-radius: 50%;
          background: linear-gradient(135deg, #07A626 0%, #05891e 100%);
          border: 2px solid rgba(7,166,38,0.4);
          color: #fff; font-family: var(--font-sora),sans-serif;
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
          min-width: 232px;
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
          font-family: var(--font-sora), sans-serif;
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

        /* Vertical list of account items (Profile, My Logos, Liked Logos) */
        .drop-list { padding: 6px; display: flex; flex-direction: column; gap: 1px; }
        .drop-item {
          display: flex; align-items: center; gap: 11px;
          padding: 9px 10px;
          font-size: 13px; font-weight: 500;
          color: var(--drop-text); text-decoration: none;
          border-radius: 9px;
          transition: background 0.15s;
          cursor: pointer; border: none; background: transparent;
          width: 100%; font-family: var(--font-sora), sans-serif; text-align: left;
        }
        .drop-item svg { color: var(--icon-color); flex-shrink: 0; transition: color 0.15s; }
        .drop-item:hover { background: var(--drop-hover); }
        .drop-item:hover svg { color: var(--drop-text); }

        /* Sign out row — red, separated at the bottom */
        .drop-signout-wrap { padding: 6px; }
        .drop-item.signout {
          color: var(--drop-logout-color);
        }
        .drop-item.signout svg { color: var(--drop-logout-color); }
        .drop-item.signout:hover {
          background: var(--drop-logout-bg);
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

        /* Mobile Upload Logo button */
        .mobile-upload-btn {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 10px 16px; margin-top: 6px;
          background: linear-gradient(135deg, #07A626 0%, #05891e 100%);
          border: none; border-radius: 9px; color: #fff;
          font-size: 14px; font-weight: 600;
          text-decoration: none; font-family: var(--font-sora), sans-serif;
          transition: filter 0.2s;
        }
        .mobile-upload-btn:hover { filter: brightness(1.08); }

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

        /* Mobile account list — same vertical list as desktop dropdown */
        .mobile-account-list {
          display: flex; flex-direction: column; gap: 2px;
          margin-top: 6px;
        }
        .mobile-account-item {
          display: flex; align-items: center; gap: 11px;
          padding: 10px 12px;
          border-radius: 9px; border: none;
          font-family: var(--font-sora), sans-serif;
          font-size: 14px; font-weight: 500;
          color: var(--link-color);
          cursor: pointer; text-decoration: none;
          background: transparent;
          width: 100%; text-align: left;
          transition: background 0.2s, color 0.2s;
        }
        .mobile-account-item svg { flex-shrink: 0; color: var(--icon-color); }
        .mobile-account-item:hover { background: var(--link-hover-bg); color: var(--link-hover-color); }
        .mobile-account-item:hover svg { color: var(--link-hover-color); }
        .mobile-account-item.signout {
          color: var(--drop-logout-color);
          margin-top: 6px;
        }
        .mobile-account-item.signout svg { color: var(--drop-logout-color); }
        .mobile-account-item.signout:hover { background: var(--drop-logout-hover); }

        /* Mobile login */
        .mobile-login {
          margin-top: 10px;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 10px 16px;
          background: rgba(7,166,38,0.1); border: 1px solid rgba(7,166,38,0.35);
          border-radius: 9px; color: #07A626;
          font-size: 14px; font-weight: 600;
          text-decoration: none; font-family: var(--font-sora), sans-serif;
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
          font-family: var(--font-sora), sans-serif; font-size: 13px; font-weight: 600;
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

        /* Upload Logo modal */
        .upload-modal-overlay {
          position: fixed; inset: 0; z-index: 300;
          background: rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
        }
        .upload-modal {
          width: 100%; max-width: 420px;
          background: var(--drop-bg);
          border: 1px solid var(--drop-border);
          border-radius: 16px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.3);
          padding: 20px;
          font-family: var(--font-sora), sans-serif;
        }
        .upload-modal-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 14px;
        }
        .upload-modal-header h3 {
          margin: 0; font-size: 16px; font-weight: 700; color: var(--drop-text);
        }
        .upload-modal-close {
          border: none; background: transparent; cursor: pointer;
          color: var(--icon-color); padding: 4px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.2s, color 0.2s;
        }
        .upload-modal-close:hover { background: var(--drop-hover); color: var(--drop-text); }

        .upload-drop-zone {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 8px; text-align: center;
          padding: 32px 16px;
          border: 1.5px dashed var(--drop-border);
          border-radius: 12px;
          color: var(--drop-sub);
          font-size: 13px; font-weight: 500;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
        }
        .upload-drop-zone:hover { border-color: rgba(7,166,38,0.5); background: var(--drop-hover); }
        .upload-drop-zone svg { color: #07A626; }
        .upload-file-name { color: var(--drop-text); font-weight: 600; word-break: break-all; }

        .upload-error {
          margin-top: 10px; font-size: 12.5px; color: var(--drop-logout-color);
        }

        .upload-modal-actions {
          display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px;
        }
        .upload-cancel-btn, .upload-submit-btn {
          padding: 8px 16px; border-radius: 9px; font-size: 13.5px; font-weight: 600;
          cursor: pointer; font-family: var(--font-sora), sans-serif; border: none;
          transition: filter 0.2s, opacity 0.2s;
        }
        .upload-cancel-btn {
          background: var(--drop-hover); color: var(--drop-text);
          border: 1px solid var(--drop-border);
        }
        .upload-cancel-btn:hover { background: var(--nav-border); }
        .upload-submit-btn {
          background: linear-gradient(135deg, #07A626 0%, #05891e 100%); color: #fff;
        }
        .upload-submit-btn:hover { filter: brightness(1.08); }
        .upload-cancel-btn:disabled, .upload-submit-btn:disabled {
          opacity: 0.6; cursor: not-allowed;
        }

        @media (max-width: 900px) {
          .nav-links    { display: none; }
          .login-btn    { display: none; }
          .upload-logo-btn { display: none; }
          .hamburger    { display: flex; }
          .theme-toggle { display: none; }
          .avatar-wrap  { display: none; }
        }
      `}</style>

      <nav className="navbar">
        <div className="navbar-inner">

          {/* Logo */}
          <Link href="/" className="navbar-logo">
            <Image src={dark ? "/cdrlogo-dark.svg" : "/cdrlogo-light.svg"} width={140}
              height={32} alt="CDRLogo" />
          </Link>

          {/* Desktop nav links */}
          <ul className="nav-links">
            {navLinks.map((link) => (
              <li key={link.label}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>

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

            {/* Desktop: Upload Logo + Avatar both toggle the same account
                dropdown, and share one outside-click ref so it opens/closes
                correctly from either button. */}
            {!isLoading && isLogged ? (
              <div className="account-actions" ref={dropRef}>
                <button type="button" className="upload-logo-btn" onClick={() => setDropOpen(v => !v)}>
                  {uploadLogoIcon}
                  Upload Logo
                </button>

                <div className="avatar-wrap">
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

                    {/* Profile / My Logos / Liked Logos */}
                    <div className="drop-list">
                      {accountItems.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="drop-item"
                          onClick={() => setDropOpen(false)}
                        >
                          {item.icon}
                          {item.label}
                        </Link>
                      ))}
                    </div>

                    <div className="drop-divider" />

                    {/* Logout */}
                    <div className="drop-signout-wrap">
                      <button
                        className="drop-item signout"
                        onClick={() => { setDropOpen(false); signOut(); }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        Logout
                      </button>
                    </div>
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
              {/* Upload Logo — standalone, mobile. No account items nested inside it. */}
              <button
                type="button"
                className="mobile-upload-btn"
                onClick={() => { setMenuOpen(false); openUpload(); }}
              >
                {uploadLogoIcon}
                Upload Logo
              </button>

              <div className="mobile-user-card">
                <div className="mobile-avatar">{initial}</div>
                <div>
                  <div className="mob-name">{username || "Account"}</div>
                  <div className="mob-email">{email}</div>
                </div>
              </div>

              {/* Profile / My Logos / Liked Logos — appears exactly once */}
              <div className="mobile-account-list">
                {accountItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="mobile-account-item"
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ))}
                <button
                  className="mobile-account-item signout"
                  onClick={() => { setMenuOpen(false); signOut(); }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Logout
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

      {/* ── Upload Logo modal ── */}
      {uploadOpen && (
        <div className="upload-modal-overlay" onMouseDown={closeUpload}>
          <div className="upload-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="upload-modal-header">
              <h3>Upload Logo</h3>
              <button
                type="button"
                className="upload-modal-close"
                aria-label="Close"
                onClick={closeUpload}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <label className="upload-drop-zone" htmlFor="upload-logo-input">
              {uploadFile ? (
                <span className="upload-file-name">{uploadFile.name}</span>
              ) : (
                <>
                  {uploadLogoIcon}
                  <span>Click to choose a file, or drag it here</span>
                </>
              )}
              <input
                id="upload-logo-input"
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  setUploadError("");
                  setUploadFile(e.target.files?.[0] ?? null);
                }}
              />
            </label>

            {uploadError && <div className="upload-error">{uploadError}</div>}

            <div className="upload-modal-actions">
              <button type="button" className="upload-cancel-btn" onClick={closeUpload} disabled={uploading}>
                Cancel
              </button>
              <button type="button" className="upload-submit-btn" onClick={submitUpload} disabled={uploading}>
                {uploading ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}