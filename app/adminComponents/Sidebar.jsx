"use client";

import { useState, useEffect } from "react";
import {
  LayoutDashboard, Upload, LayoutGrid, Droplets,
  Tag, Users, FileText, Navigation, Image,
  Mail, Bookmark, Settings, Menu, X, ChevronRight,
  Key
} from "lucide-react";
import { useRouter } from "next/navigation";

// ── NAV_ITEMS ─────────────────────────────────────────────────────────────
// key MUST exactly match the case string used in AdminPage's renderContent switch
const NAV_ITEMS = [
  // 🧠 Core overview
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },

  // ⚡ Main business actions (most used)
  { key: "upload", label: "Upload Logo", icon: Upload },
  { key: "LogoManagement", label: "Logo Management", icon: LayoutGrid },

  // 🏷️ Organization
  { key: "categories", label: "Categories", icon: Tag },
  { key: "Tags", label: "Tags", icon: Tag },

  // 👥 Users & interactions
  { key: "User", label: "Users", icon: Users },
  { key: "ContactMessages", label: "Contact Messages", icon: Mail },
  { key: "LogoRequests", label: "Logo Requests", icon: Bookmark },

  // ⚠️ Moderation / Legal (important but less frequent)
  { key: "DCMA/Report", label: "DCMA / Report", icon: Menu },

  // 📝 Content management
  { key: "Blog", label: "Blog", icon: FileText },
  { key: "Page/CMS", label: "CMS / Pages", icon: FileText },
  { key: "Navigation/Menu", label: "Navigation/Menu", icon: Navigation },

  // 🖼️ Assets & branding
  { key: "Media Library", label: "Media Library", icon: Image },
  { key: "watermark", label: "Watermark", icon: Droplets },

  // 🔌 System / technical
  { key: "Api Integration", label: "Api Integration", icon: Key },
  { key: "Email Templates", label: "Email Templates", icon: Mail },

  // ⚙️ Lowest priority (rarely changed)
  { key: "SiteSettings", label: "Site Settings", icon: Settings },
];

export default function Sidebar({ active, setActive, dark }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // close mobile drawer whenever active section changes
  useEffect(() => { setMobileOpen(false); }, [active]);

  // theme tokens
  const bg = dark ? "#0b0f1a" : "#ffffff";
  const border = dark ? "#1e2535" : "#e2e8f0";
  const text = dark ? "#e2e8f0" : "#1e293b";
  const muted = dark ? "#64748b" : "#94a3b8";
  const green = "#22c55e";
  const hoverBg = dark ? "#1a2236" : "#f1f5f9";
  const activeBg = dark ? "#22c55e15" : "#dcfce7";

  const sidebarW = collapsed && !isMobile ? 64 : 220;

  // ── Single nav button ────────────────────────────────────────────────────
  const NavItem = ({ item }) => {
    const Icon = item.icon;
    const isActive = active === item.key;

    return (
      <button
        onClick={() => {
          setActive(item.key);
          if (isMobile) setMobileOpen(false);
        }}
        title={collapsed && !isMobile ? item.label : undefined}
        style={{
          display: "flex",
          alignItems: "center",
          gap: collapsed && !isMobile ? 0 : 10,
          justifyContent: collapsed && !isMobile ? "center" : "flex-start",
          width: "100%",
          padding: collapsed && !isMobile ? "10px 0" : "10px 12px",
          borderRadius: 10,
          border: "none",
          cursor: "pointer",
          background: isActive ? activeBg : "transparent",
          color: isActive ? green : muted,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          fontWeight: isActive ? 700 : 500,
          transition: "all 0.15s",
          position: "relative",
          // left-border accent when active
          boxShadow: isActive ? `inset 3px 0 0 ${green}` : "none",
          textAlign: "left",
        }}
        onMouseEnter={e => {
          if (!isActive) {
            e.currentTarget.style.background = hoverBg;
            e.currentTarget.style.color = text;
          }
        }}
        onMouseLeave={e => {
          if (!isActive) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = muted;
          }
        }}
      >
        <Icon size={16} style={{ flexShrink: 0 }} />

        {(!collapsed || isMobile) && (
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", flex: 1 }}>
            {item.label}
          </span>
        )}

        {isActive && (!collapsed || isMobile) && (
          <ChevronRight size={13} style={{ marginLeft: "auto", opacity: 0.45 }} />
        )}

        {/* Tooltip shown only in collapsed desktop mode */}
        {collapsed && !isMobile && (
          <span
            className="sidebar-tooltip"
            style={{
              position: "absolute", left: "calc(100% + 10px)", top: "50%",
              transform: "translateY(-50%)",
              background: dark ? "#1e2535" : "#1e293b", color: "#fff",
              fontSize: 11, fontWeight: 600, padding: "4px 10px",
              borderRadius: 6, whiteSpace: "nowrap",
              pointerEvents: "none", opacity: 0, transition: "opacity 0.15s",
              zIndex: 999,
            }}
          >
            {item.label}
          </span>
        )}
      </button>
    );
  };

  // ── Sidebar inner content ─────────────────────────────────────────────────
  const SidebarContent = () => (
    <div style={{
      width: isMobile ? 260 : sidebarW,
      height: "100%",
      background: bg,
      borderRight: `1px solid ${border}`,
      display: "flex",
      flexDirection: "column",
      transition: "width 0.2s ease",
      flexShrink: 0,
      overflow: "hidden",
    }}>
      {/* Brand / logo */}
      <div
        style={{
          height: 56,
          display: "flex", alignItems: "center",
          padding: collapsed && !isMobile ? "0 12px" : "0 16px",
          justifyContent: collapsed && !isMobile ? "center" : "space-between",
          borderBottom: `1px solid ${border}`,
          flexShrink: 0,
          cursor: "pointer",
        }}
      >
        {(!collapsed || isMobile) && (
          <div
            style={{ display: "flex", alignItems: "center", gap: 8 }}
            onClick={() => router.push("/")}
          >
            <span style={{ fontSize: 14, fontWeight: 800, color: text, letterSpacing: "-0.3px" }}>
              CDR<span style={{ color: green }}>LOGO</span>
            </span>
          </div>
        )}

        {/* Collapse toggle — desktop only */}
        {!isMobile && (
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{
              width: 26, height: 26, borderRadius: 7,
              border: `1px solid ${border}`,
              background: dark ? "#1a2236" : "#f1f5f9",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: muted, flexShrink: 0,
            }}
          >
            <Menu size={13} />
          </button>
        )}

        {/* Close — mobile only */}
        {isMobile && (
          <button
            onClick={() => setMobileOpen(false)}
            style={{
              width: 28, height: 28, borderRadius: 7,
              border: "none", background: "transparent",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: muted,
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Section label */}
      {(!collapsed || isMobile) && (
        <div style={{
          padding: "14px 16px 6px",
          fontSize: 10, fontWeight: 700, color: muted,
          letterSpacing: "0.08em", textTransform: "uppercase",
        }}>
          Navigation
        </div>
      )}

      {/* Nav items */}

      <nav style={{
        padding: "4px 8px",
        display: "flex", flexDirection: "column", gap: 2,
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
      }}>
        {NAV_ITEMS.map(item => <NavItem key={item.key} item={item} />)}
      </nav>

      {/* Footer */}
      {(!collapsed || isMobile) && (
        <div style={{
          padding: "12px 14px",
          borderTop: `1px solid ${border}`,
          fontSize: 10, color: muted, textAlign: "center",
        }}>
          Admin Panel · v1.0
        </div>
      )}
    </div>
  );

  // ── Mobile: overlay drawer ───────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <style>{`
    
            button:hover .sidebar-tooltip { opacity: 1 !important; }
  nav::-webkit-scrollbar { width: 3px; }
  nav::-webkit-scrollbar-track { background: transparent; }
  nav::-webkit-scrollbar-thumb { background: #22c55e33; border-radius: 99px; }
  nav::-webkit-scrollbar-thumb:hover { background: #22c55e66; }

          .mobile-backdrop {
            position: fixed; inset: 0;
            background: #00000080; z-index: 100;
            backdrop-filter: blur(2px);
          }
          .mobile-drawer {
            position: fixed; top: 0; left: 0; height: 100%;
            z-index: 101;
            transform: translateX(-100%);
            transition: transform 0.25s cubic-bezier(.4,0,.2,1);
          }
          .mobile-drawer.open { transform: translateX(0); }
        `}</style>

        {/* Hamburger button in top-left */}
        <div style={{
          position: "fixed", top: 11, left: 12, zIndex: 99,
        }}>
          <button
            onClick={() => setMobileOpen(true)}
            style={{
              width: 34, height: 34, borderRadius: 9,
              background: dark ? "#1e2535" : "#f1f5f9",
              border: `1px solid ${border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: muted,
            }}
          >
            <Menu size={16} />
          </button>
        </div>

        {/* Backdrop */}
        {mobileOpen && (
          <div className="mobile-backdrop" onClick={() => setMobileOpen(false)} />
        )}

        {/* Drawer */}
        <div className={`mobile-drawer ${mobileOpen ? "open" : ""}`}>
          <SidebarContent />
        </div>

        {/* Zero-width spacer keeps flex layout intact */}
        <div style={{ width: 0 }} />
      </>
    );
  }

  // ── Desktop: static sidebar ──────────────────────────────────────────────
  return (
    <>
      <style>{`button:hover .sidebar-tooltip { opacity: 1 !important; }`}</style>
      <SidebarContent />
    </>
  );
}