"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "../context/ThemeContext";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import ProfileSubNav from "../components/ProfileSubNav";
import "./profile-glass.css";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const { dark } = useTheme();
  const router = useRouter();
  const theme = dark ? "dark" : "light";

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [count, setCount] = useState(0);
  const [join, setJoin] = useState(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchProfile();
      const t = setTimeout(() => setReady(true), 80);
      return () => clearTimeout(t);
    }
  }, [status]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/favorites");
      const data = await res.json();
      setJoin(new Date(data.joined));
      setCount(data.downloadCountUsed);
      setFavoritesCount((data.favorites ?? []).length);
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="pg-loading-screen" style={{ background: dark ? "#08080e" : "#eef0f4" }}>
        <div className="pg-spinner" />
      </div>
    );
  }

  const user = session?.user;
  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="pg-root" data-pg={theme}>
      <Navbar />
      <div className="pg-blob pg-blob-1" />
      <div className="pg-blob pg-blob-2" />
      <div className="h-10" />

      <div className={`pg-layout${ready ? " pg-ready" : ""}`}>
        <div className="pg-page-header pg-anim pg-d0">
          <div className="pg-page-title">Account</div>
          <div className="pg-page-path">cdrlogo.com / <span>profile</span></div>
        </div>

        <div className="pg-anim pg-d0">
          <ProfileSubNav />
        </div>

        <div className="pg-glass pg-id-card pg-anim pg-d1">
          <div className="pg-avatar">{initials}</div>
          <div className="pg-user-name">{user?.name || "Anonymous"}</div>
          <div className="pg-user-email">{user?.email}</div>

          <div className="pg-meta-list">
            <div className="pg-meta-row">
              <span className="pg-meta-key">Status</span>
              <span className="pg-status-dot">Active</span>
            </div>
            <div className="pg-meta-row">
              <span className="pg-meta-key">Role</span>
              <span className={`pg-role-tag${user?.role === "admin" ? " admin" : ""}`}>
                {user?.role === "admin" ? "Admin" : "Member"}
              </span>
            </div>
            <div className="pg-meta-row">
              <span className="pg-meta-key">Joined</span>
              <span className="pg-meta-val">
                {loading ? "…" : join ? join.toLocaleDateString("en-GB") : "-"}
              </span>
            </div>
          </div>
        </div>

        <div className="pg-stat-row pg-anim pg-d2">
          <div className="pg-glass pg-stat-box">
            <div className="pg-stat-n green">{loading ? "–" : favoritesCount}</div>
            <div className="pg-stat-lbl">Liked</div>
          </div>
          <div className="pg-glass pg-stat-box">
            <div className="pg-stat-n">{loading ? "–" : count ?? 0}</div>
            <div className="pg-stat-lbl">Downloads</div>
          </div>
        </div>

        <div className="pg-anim pg-d3">
          <button className="pg-glass pg-signout" onClick={() => signOut({ callbackUrl: "/" })}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
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
  );
}