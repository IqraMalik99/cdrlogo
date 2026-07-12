"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "../context/ThemeContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../components/Navbar";
import ProfileSubNav from "../components/ProfileSubNav";
import "../profile/profile-glass.css";

export default function LikedLogosPage() {
  const { status } = useSession();
  const { dark } = useTheme();
  const router = useRouter();
  const theme = dark ? "dark" : "light";

  const [ready, setReady] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(null);

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
      <div className="pg-loading-screen" style={{ background: dark ? "#08080e" : "#eef0f4" }}>
        <div className="pg-spinner" />
      </div>
    );
  }

  return (
    <div className="pg-root" data-pg={theme}>
      <Navbar />
      <div className="pg-blob pg-blob-1" />
      <div className="pg-blob pg-blob-2" />
      <div className="h-10" />

      <div className={`pg-layout${ready ? " pg-ready" : ""}`}>
        <div className="pg-page-header pg-anim pg-d0">
          <div className="pg-page-title">Account</div>
          <div className="pg-page-path">cdrlogo.com / <span>liked logos</span></div>
        </div>

        <div className="pg-anim pg-d0">
          <ProfileSubNav />
        </div>

        <div className="pg-anim pg-d1">
          <div className="pg-section-bar">
            <div className="pg-section-label">
              Liked logos <span className="pg-count">{favorites.length}</span>
            </div>
            <Link href="/brands" className="pg-browse-link">
              Browse library
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>

          <div className="pg-grid">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="pg-glass pg-skel" style={{ animationDelay: `${i * 25}ms` }}>
                  <div className="pg-skel-img" />
                  <div className="pg-skel-foot">
                    <div className="pg-skel-line" />
                    <div className="pg-skel-line s" />
                  </div>
                </div>
              ))
            ) : favorites.length === 0 ? (
              <div className="pg-glass pg-empty">
                <div className="pg-empty-title">No liked logos yet</div>
                <div className="pg-empty-sub">Logos you like will appear here for quick access.</div>
                <Link href="/brands" className="pg-empty-link">
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
                <div key={logo.id} className="pg-glass pg-logo" style={{ animationDelay: `${i * 25}ms` }}>
                  <Link href={`/logo/${logo.slug}`} style={{ textDecoration: "none" }}>
                    <div className="pg-logo-img">
                      {logo.webpUrl ? <img src={logo.webpUrl} alt={logo.logoName} /> : <div className="pg-no-img" />}
                      <div className="pg-view-overlay">
                        <span className="pg-view-pill">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          View
                        </span>
                      </div>
                    </div>
                    <div className="pg-logo-foot">
                      <div className="pg-logo-name">{logo.logoName}</div>
                      <div className="pg-logo-cat">{logo.category}</div>
                    </div>
                  </Link>

                  <button
                    className={`pg-remove${removing === logo.id ? " busy" : ""}`}
                    title="Remove from liked"
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
  );
}