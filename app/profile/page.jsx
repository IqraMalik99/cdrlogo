"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "../context/ThemeContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../components/Navbar";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const { dark } = useTheme();
  const router = useRouter();
  const theme = dark ? "dark" : "light";

  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchFavorites();
      const t = setTimeout(() => setReady(true), 80);
      return () => clearTimeout(t);
    }
  }, [status]);

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/favorites");
      const data = await res.json();
      setFavorites(data.favorites ?? []);
    } catch {
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUnfavorite = async (logoId) => {
    setRemoving(logoId);
    try {
      await fetch("/api/logo/favourite/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoId }),
      });
      setFavorites((prev) => prev.filter((l) => l.id !== logoId));
    } catch {}
    setRemoving(null);
  };

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: dark ? "#08080e" : "#f2f2f7"
      }}>
        <div className="pr-spinner" />
      </div>
    );
  }

  const user = session?.user;
  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "?";

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "—";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        [data-pr="dark"] {
          --bg:          #08080e;
          --surface:     #0f0f18;
          --surface2:    #13131f;
          --border:      rgba(255,255,255,0.07);
          --border2:     rgba(255,255,255,0.04);
          --text:        rgba(255,255,255,0.88);
          --text2:       rgba(255,255,255,0.45);
          --text3:       rgba(255,255,255,0.22);
          --accent:      #07A626;
          --accent-dim:  rgba(7,166,38,0.08);
          --accent-mid:  rgba(7,166,38,0.18);
          --accent-text: #4ade80;
          --danger:      rgba(239,68,68,0.75);
          --danger-dim:  rgba(239,68,68,0.08);
          --danger-mid:  rgba(239,68,68,0.16);
          --img-bg:      rgba(255,255,255,0.03);
          --mono-bg:     rgba(255,255,255,0.04);
        }
        [data-pr="light"] {
          --bg:          #f2f2f7;
          --surface:     #ffffff;
          --surface2:    #f7f7fc;
          --border:      rgba(0,0,0,0.08);
          --border2:     rgba(0,0,0,0.05);
          --text:        #0d0d1a;
          --text2:       rgba(0,0,0,0.48);
          --text3:       rgba(0,0,0,0.25);
          --accent:      #07A626;
          --accent-dim:  rgba(7,166,38,0.06);
          --accent-mid:  rgba(7,166,38,0.14);
          --accent-text: #15803d;
          --danger:      rgba(220,38,38,0.8);
          --danger-dim:  rgba(220,38,38,0.06);
          --danger-mid:  rgba(220,38,38,0.12);
          --img-bg:      rgba(0,0,0,0.03);
          --mono-bg:     rgba(0,0,0,0.04);
        }

        *, *::before, *::after { box-sizing: border-box; }

        .pr-root {
          min-height: 100vh;
          background: var(--bg);
          font-family: 'Sora', system-ui, sans-serif;
          transition: background 0.3s;
        }

        .pr-layout {
          max-width: 1020px;
          margin: 0 auto;
          padding: 48px 24px 96px;
        }

        /* Page header */
        .pr-page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 32px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--border);
        }
        .pr-page-title {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: var(--text3);
        }
        .pr-page-path {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: var(--text3);
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .pr-page-path span { color: var(--accent-text); }

        /* Body grid */
        .pr-body {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 20px;
          align-items: start;
        }

        /* Sidebar */
        .pr-sidebar {
          display: flex;
          flex-direction: column;
          gap: 10px;
          position: sticky;
          top: 24px;
        }

        /* Identity card */
        .pr-id-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
        }
        .pr-id-top {
          padding: 22px 18px 18px;
          border-bottom: 1px solid var(--border2);
        }
        .pr-avatar {
          width: 44px; height: 44px;
          border-radius: 9px;
          background: var(--accent-dim);
          border: 1px solid var(--accent-mid);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700;
          color: var(--accent-text);
          letter-spacing: -0.5px;
          margin-bottom: 13px;
          font-family: 'JetBrains Mono', monospace;
        }
        .pr-user-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--text);
          letter-spacing: -0.3px;
          margin-bottom: 3px;
          line-height: 1.3;
          word-break: break-word;
        }
        .pr-user-email {
          font-size: 11px;
          color: var(--text3);
          word-break: break-all;
          font-family: 'JetBrains Mono', monospace;
        }

        .pr-id-meta { padding: 0; }
        .pr-meta-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 9px 18px;
          border-bottom: 1px solid var(--border2);
          font-size: 11px;
        }
        .pr-meta-row:last-child { border-bottom: none; }
        .pr-meta-key { color: var(--text3); font-weight: 500; }
        .pr-meta-val {
          color: var(--text2);
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
        }
        .pr-status-dot {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11px; color: var(--accent-text);
        }
        .pr-status-dot::before {
          content: '';
          width: 5px; height: 5px;
          border-radius: 50%;
          background: var(--accent);
          display: block;
          flex-shrink: 0;
        }
        .pr-role-tag {
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 9.5px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          font-family: 'JetBrains Mono', monospace;
          background: var(--mono-bg);
          color: var(--text3);
          border: 1px solid var(--border);
        }
        .pr-role-tag.admin {
          background: rgba(234,179,8,0.08);
          color: #ca8a04;
          border-color: rgba(234,179,8,0.2);
        }

        /* Stat pair */
        .pr-stat-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .pr-stat-box {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 14px 14px 11px;
        }
        .pr-stat-n {
          font-size: 22px;
          font-weight: 700;
          color: var(--text);
          letter-spacing: -1px;
          line-height: 1;
          margin-bottom: 5px;
        }
        .pr-stat-n.green { color: var(--accent-text); }
        .pr-stat-lbl {
          font-size: 9.5px;
          font-weight: 600;
          color: var(--text3);
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }

        /* Sign out */
        .pr-signout {
          width: 100%;
          display: flex; align-items: center; justify-content: center; gap: 7px;
          padding: 9px;
          background: none;
          border: 1px solid var(--border);
          border-radius: 9px;
          font-family: 'Sora', sans-serif;
          font-size: 11.5px;
          font-weight: 500;
          color: var(--text3);
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s, background 0.15s;
        }
        .pr-signout:hover {
          border-color: var(--danger-mid);
          color: var(--danger);
          background: var(--danger-dim);
        }

        /* Main panel */
        .pr-main { }

        .pr-section-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 14px;
          margin-bottom: 16px;
          border-bottom: 1px solid var(--border);
        }
        .pr-section-label {
          display: flex; align-items: center; gap: 9px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text);
        }
        .pr-count {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          padding: 1px 6px;
          border-radius: 4px;
          background: var(--accent-dim);
          border: 1px solid var(--accent-mid);
          color: var(--accent-text);
        }
        .pr-browse-link {
          font-size: 11px;
          font-weight: 500;
          color: var(--text3);
          text-decoration: none;
          display: flex; align-items: center; gap: 4px;
          transition: color 0.15s;
        }
        .pr-browse-link:hover { color: var(--accent-text); }

        /* Grid */
        .pr-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(145px, 1fr));
          gap: 10px;
        }

        /* Logo card */
        .pr-logo {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          overflow: hidden;
          position: relative;
          transition: border-color 0.15s, box-shadow 0.15s;
          animation: pr-fadein 0.3s ease both;
        }
        @keyframes pr-fadein {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: none; }
        }
        .pr-logo:hover {
          border-color: rgba(7,166,38,0.2);
          box-shadow: 0 3px 16px rgba(0,0,0,0.07);
        }
        .pr-logo-img {
          aspect-ratio: 4/3;
          background: var(--img-bg);
          display: flex; align-items: center; justify-content: center;
          padding: 18px;
          border-bottom: 1px solid var(--border2);
        }
        .pr-logo-img img {
          width: 100%; height: 100%;
          object-fit: contain;
        }
        .pr-no-img {
          width: 28px; height: 28px;
          border-radius: 5px;
          background: var(--border);
        }
        .pr-logo-foot {
          padding: 9px 11px 10px;
        }
        .pr-logo-name {
          font-size: 11px;
          font-weight: 600;
          color: var(--text);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          margin-bottom: 2px;
        }
        .pr-logo-cat {
          font-size: 10px;
          color: var(--text3);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        /* Remove btn */
        .pr-remove {
          position: absolute;
          top: 7px; right: 7px;
          width: 22px; height: 22px;
          border-radius: 5px;
          background: var(--danger-dim);
          border: 1px solid var(--danger-mid);
          color: var(--danger);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.15s, background 0.15s;
        }
        .pr-logo:hover .pr-remove { opacity: 1; }
        .pr-remove:hover { background: var(--danger-mid); }
        .pr-remove.busy {
          opacity: 1;
          animation: pr-spin 0.7s linear infinite;
        }
        @keyframes pr-spin { to { transform: rotate(360deg); } }

        /* Empty */
        .pr-empty {
          grid-column: 1/-1;
          padding: 52px 20px;
          border: 1px dashed var(--border);
          border-radius: 10px;
          text-align: center;
        }
        .pr-empty-title {
          font-size: 13px; font-weight: 600;
          color: var(--text2); margin-bottom: 5px;
        }
        .pr-empty-sub {
          font-size: 11.5px; color: var(--text3); margin-bottom: 16px;
        }
        .pr-empty-link {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 8px 15px;
          border: 1px solid var(--border);
          border-radius: 7px;
          font-size: 11.5px; font-weight: 500;
          color: var(--text2); text-decoration: none;
          transition: border-color 0.15s, color 0.15s;
        }
        .pr-empty-link:hover { border-color: var(--accent-mid); color: var(--accent-text); }

        /* Skeleton */
        .pr-skel {
          border-radius: 10px; overflow: hidden;
          border: 1px solid var(--border);
        }
        .pr-skel-img {
          aspect-ratio: 4/3;
          background: linear-gradient(90deg, var(--surface) 25%, var(--surface2) 50%, var(--surface) 75%);
          background-size: 300% 100%;
          animation: skel-anim 1.5s infinite;
        }
        .pr-skel-foot {
          padding: 9px 11px 10px;
          background: var(--surface);
          border-top: 1px solid var(--border2);
          display: flex; flex-direction: column; gap: 5px;
        }
        .pr-skel-line {
          height: 8px; border-radius: 3px;
          background: linear-gradient(90deg, var(--surface) 25%, var(--surface2) 50%, var(--surface) 75%);
          background-size: 300% 100%;
          animation: skel-anim 1.5s infinite;
        }
        .pr-skel-line.s { width: 50%; }
        @keyframes skel-anim {
          0%   { background-position: 300% 0; }
          100% { background-position: -300% 0; }
        }

        /* Spinner */
        .pr-spinner {
          width: 26px; height: 26px;
          border: 1.5px solid rgba(255,255,255,0.08);
          border-top-color: #07A626;
          border-radius: 50%;
          animation: pr-spin 0.7s linear infinite;
        }

        /* Anim classes */
        .pr-anim {
          opacity: 0; transform: translateY(10px);
          transition: opacity .42s cubic-bezier(.22,1,.36,1),
                      transform .42s cubic-bezier(.22,1,.36,1);
        }
        .pr-ready .pr-anim { opacity: 1; transform: none; }
        .pr-d0{transition-delay:0ms} .pr-d1{transition-delay:55ms}
        .pr-d2{transition-delay:110ms} .pr-d3{transition-delay:165ms}

        @media (max-width: 720px) {
          .pr-body { grid-template-columns: 1fr; }
          .pr-sidebar { position: static; }
          .pr-layout { padding: 28px 16px 72px; }
        }
        @media (max-width: 480px) {
          .pr-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

      <div className="pr-root" data-pr={theme}>
        <Navbar />
        <div className="h-10" />

        <div className={`pr-layout${ready ? " pr-ready" : ""}`}>

          {/* Page header */}
          <div className="pr-page-header pr-anim pr-d0">
            <div className="pr-page-title">Account</div>
            <div className="pr-page-path">
              cdrlogo.com / <span>profile</span>
            </div>
          </div>

          <div className="pr-body">

            {/* ── Sidebar ── */}
            <div className="pr-sidebar">

              <div className="pr-id-card pr-anim pr-d1">
                <div className="pr-id-top">
                  <div className="pr-avatar">{initials}</div>
                  <div className="pr-user-name">{user?.name || "Anonymous"}</div>
                  <div className="pr-user-email">{user?.email}</div>
                </div>
                <div className="pr-id-meta">
                  <div className="pr-meta-row">
                    <span className="pr-meta-key">Status</span>
                    <span className="pr-status-dot">Active</span>
                  </div>
                  <div className="pr-meta-row">
                    <span className="pr-meta-key">Role</span>
                    <span className={`pr-role-tag${user?.role === "admin" ? " admin" : ""}`}>
                      {user?.role === "admin" ? "Admin" : "Member"}
                    </span>
                  </div>
                  <div className="pr-meta-row">
                    <span className="pr-meta-key">Joined</span>
                    <span className="pr-meta-val">{memberSince}</span>
                  </div>
                </div>
              </div>

              <div className="pr-stat-row pr-anim pr-d2">
                <div className="pr-stat-box">
                  <div className="pr-stat-n green">{favorites.length}</div>
                  <div className="pr-stat-lbl">Saved</div>
                </div>
                <div className="pr-stat-box">
                  <div className="pr-stat-n">{user?.downloadCountUsed ?? 0}</div>
                  <div className="pr-stat-lbl">Downloads</div>
                </div>
              </div>

              <div className="pr-anim pr-d3">
                <button className="pr-signout" onClick={() => signOut({ callbackUrl: "/" })}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sign out
                </button>
              </div>
            </div>

            {/* ── Main panel ── */}
            <div className="pr-main pr-anim pr-d2">
              <div className="pr-section-bar">
                <div className="pr-section-label">
                  Collection / Liked logos
                  <span className="pr-count">{favorites.length}</span>
                </div>
                <Link href="/brands" className="pr-browse-link">
                  Browse library
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
              </div>

              <div className="pr-grid">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="pr-skel" style={{ animationDelay: `${i * 25}ms` }}>
                      <div className="pr-skel-img" />
                      <div className="pr-skel-foot">
                        <div className="pr-skel-line" />
                        <div className="pr-skel-line s" />
                      </div>
                    </div>
                  ))
                ) : favorites.length === 0 ? (
                  <div className="pr-empty">
                    <div className="pr-empty-title">No saved logos</div>
                    <div className="pr-empty-sub">Logos you save will appear here for quick access.</div>
                    <Link href="/brands" className="pr-empty-link">
                      Browse logos
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </Link>
                  </div>
                ) : (
                  favorites.map((logo, i) => (
                    <div
                      key={logo.id}
                      className="pr-logo"
                      style={{ animationDelay: `${i * 25}ms` }}
                    >
                      <Link href={`/logo/${logo.slug}`} style={{ textDecoration: "none" }}>
                        <div className="pr-logo-img">
                          {logo.webpUrl
                            ? <img src={logo.webpUrl} alt={logo.logoName} />
                            : <div className="pr-no-img" />
                          }
                        </div>
                        <div className="pr-logo-foot">
                          <div className="pr-logo-name">{logo.logoName}</div>
                          <div className="pr-logo-cat">{logo.category}</div>
                        </div>
                      </Link>

                      <button
                        className={`pr-remove${removing === logo.id ? " busy" : ""}`}
                        title="Remove"
                        onClick={(e) => { e.preventDefault(); handleUnfavorite(logo.id); }}
                      >
                        {removing === logo.id ? (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M21 12a9 9 0 1 1-9-9" />
                          </svg>
                        ) : (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}