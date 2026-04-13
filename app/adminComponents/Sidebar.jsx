"use client";

import { useState } from "react";
import {
  Upload, Database, Image, Tag, Download, Search, FileText,
  Heart, Shield, BarChart2, Link2, Droplets, HardDrive,
  Settings, RefreshCw, Globe, Layout, Menu as MenuIcon,
  Users, Mail, Archive, Sliders, X, ChevronRight, Zap
} from "lucide-react";

const navItems = [
  { icon: Upload, label: "Upload Logo", id: "upload" },
//   { icon: Database, label: "Bulk Operations", id: "bulk" },
//   { icon: Image, label: "Media Library", id: "media" },
//   { icon: Tag, label: "Categories", id: "categories" },
//   { icon: FileText, label: "Tags", id: "tags" },
//   { icon: Download, label: "Download Tracking", id: "download" },
//   { icon: Search, label: "Advanced Search", id: "search" },
//   { icon: FileText, label: "Search Logs", id: "logs" },
//   { icon: Heart, label: "Favorites / Collections", id: "favorites" },
//   { icon: Shield, label: "License Management", id: "license" },
//   { icon: BarChart2, label: "Analytics Dashboard", id: "analytics" },
//   { icon: Link2, label: "API / Integration", id: "api" },
//   { icon: Droplets, label: "Watermarking", id: "watermark" },
//   { icon: HardDrive, label: "Cache Management", id: "cache" },
//   { icon: Settings, label: "SEO Settings", id: "seo" },
//   { icon: RefreshCw, label: "Redirects", id: "redirects" },
//   { icon: Layout, label: "Pages / CMS", id: "pages" },
//   { icon: MenuIcon, label: "Navigation / Menus", id: "nav" },
//   { icon: Zap, label: "Ad Management", id: "ads" },
//   { icon: Archive, label: "DMCA / Reports", id: "dmca" },
//   { icon: Users, label: "Users", id: "users" },
//   { icon: Mail, label: "Email Templates", id: "email" },
//   { icon: Archive, label: "Backup & Export", id: "backup" },
//   { icon: Sliders, label: "Site Settings", id: "site" },
];

export default function Sidebar({ active, setActive, dark }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const bg = dark ? "#0f1117" : "#ffffff";
  const border = dark ? "#1e2535" : "#e8ecf4";
  const text = dark ? "#94a3b8" : "#64748b";
  const textHover = dark ? "#f1f5f9" : "#0f172a";
  const activeBg = dark ? "rgba(34,197,94,0.12)" : "rgba(22,163,74,0.08)";
  const activeText = "#22c55e";
  const hoverBg = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
  const logoTextColor = dark ? "#f1f5f9" : "#0f172a";

  const sidebarWidth = collapsed ? 64 : 230;

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            zIndex: 40, display: "none"
          }}
          className="mobile-overlay"
        />
      )}

      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="mobile-toggle"
        style={{
          position: "fixed", top: 14, left: 14, zIndex: 60,
          background: dark ? "#1e2535" : "#f1f5f9",
          border: `1px solid ${border}`,
          borderRadius: 8, padding: "6px 8px",
          color: text, cursor: "pointer", display: "none"
        }}
      >
        <MenuIcon size={18} />
      </button>

      {/* Sidebar */}
      <aside
        className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}
        style={{
          width: sidebarWidth,
          minWidth: sidebarWidth,
          background: bg,
          borderRight: `1px solid ${border}`,
          height: "100vh",
          position: "sticky",
          top: 0,
          display: "flex",
          flexDirection: "column",
          transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
          overflow: "hidden",
          zIndex: 50,
          flexShrink: 0,
        }}
      >
        {/* Logo area */}
        <div style={{
          padding: collapsed ? "18px 0" : "18px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          borderBottom: `1px solid ${border}`,
          minHeight: 60,
        }}>
          {!collapsed && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: "linear-gradient(135deg,#22c55e,#16a34a)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0
              }}>
                <Zap size={14} color="#fff" />
              </div>
              <span style={{
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 700, fontSize: 14,
                color: logoTextColor, letterSpacing: "-0.3px"
              }}>
                Admin Panel
              </span>
            </div>
          )}
          {collapsed && (
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: "linear-gradient(135deg,#22c55e,#16a34a)",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <Zap size={14} color="#fff" />
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: text, padding: 4, borderRadius: 4,
              display: "flex", alignItems: "center",
              flexShrink: 0,
            }}
          >
            <ChevronRight size={15} style={{
              transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
              transition: "transform 0.25s"
            }} />
          </button>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "10px 8px" }}
          className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = active === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => { setActive(item.id); setMobileOpen(false); }}
                title={collapsed ? item.label : ""}
                style={{
                  width: "100%", display: "flex", alignItems: "center",
                  gap: collapsed ? 0 : 10,
                  padding: collapsed ? "9px 0" : "9px 10px",
                  justifyContent: collapsed ? "center" : "flex-start",
                  background: isActive ? activeBg : "transparent",
                  border: "none", borderRadius: 8,
                  color: isActive ? activeText : text,
                  cursor: "pointer", marginBottom: 2,
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                  position: "relative",
                  textAlign: "left",
                }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = hoverBg; e.currentTarget.style.color = textHover; } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = text; } }}
              >
                {isActive && (
                  <span style={{
                    position: "absolute", left: collapsed ? "50%" : 0,
                    transform: collapsed ? "translateX(-50%)" : "none",
                    top: "50%", marginTop: collapsed ? 0 : "-50%",
                    width: collapsed ? "80%" : 3,
                    height: collapsed ? 3 : "80%",
                    background: "#22c55e",
                    borderRadius: 99,
                    bottom: collapsed ? "auto" : "10%",
                  }} />
                )}
                <Icon size={16} style={{ flexShrink: 0 }} />
                {!collapsed && (
                  <span style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13, fontWeight: isActive ? 600 : 400,
                    overflow: "hidden", textOverflow: "ellipsis"
                  }}>
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      <style>{`
        .sidebar-nav::-webkit-scrollbar { width: 3px; }
        .sidebar-nav::-webkit-scrollbar-track { background: transparent; }
        .sidebar-nav::-webkit-scrollbar-thumb { background: #22c55e44; border-radius: 99px; }
        @media (max-width: 768px) {
          .mobile-toggle { display: flex !important; }
          .mobile-overlay { display: block !important; }
          .sidebar {
            position: fixed !important;
            left: -250px !important;
            transition: left 0.28s cubic-bezier(0.4,0,0.2,1) !important;
            width: 230px !important;
          }
          .sidebar.mobile-open { left: 0 !important; }
        }
      `}</style>
    </>
  );
}