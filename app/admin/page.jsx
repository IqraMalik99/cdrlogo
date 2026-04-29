"use client";

import { useState, useEffect } from "react";
import { Sun, Moon, User } from "lucide-react";
import Sidebar from "../adminComponents/Sidebar";
import { useSession } from "next-auth/react";
import Dashboard from "../adminComponents/Dashboard";
import UploadLogo from "../adminComponents/UploadLogo";
import WatermarkSettings from "../adminComponents/WaterMark";
import AdminCategories from "../adminComponents/adminCatageory";
import LogoManagement from "../adminComponents/LogoManagement";
import UserManagement from "../adminComponents/UserManagement";
import PagesCMS from "../adminComponents/CMS";
import NavigationMenu from "../adminComponents/NavigationMenu";
import MediaLibrary from "../adminComponents/Media";
import SiteSettings from "../adminComponents/SiteSetting";
import ContactMessages from "../adminComponents/ContactMessages";
import LogoRequests    from "../adminComponents/LogoRequest";
import BlogManager from "../adminComponents/Blog";
import Report from "../adminComponents/Report";

import { useRouter } from "next/navigation";

// ── Page title map — keys MUST match the case used in setActive() calls ──
const PAGE_TITLES = {
  dashboard: "Dashboard",
  upload: "Upload Logo",
  LogoManagement: "Logo Management",
  watermark: "Watermark Settings",
  categories: "Categories",
  User: "User Management",
  "Page/CMS": "CMS / Pages",
  "Navigation/Menu": "Navigation/Menu",
  "Media Library": "Media Library",
  "SiteSettings": "Site Settings",
  "ContactMessages": "Contact Messages",
"LogoRequests":    "Logo Requests",
"BlogManager": "Blog Manager",
"DCMA/Report": "DCMA / Report",

};

export default function AdminPage() {
  const [dark, setDark] = useState(true);
  const { data: session, status } = useSession();
  const router = useRouter();
  // default to dashboard so users land on it first
  const [active, setActive] = useState("dashboard");

  useEffect(() => {
    if (status === "loading") return;

    // not logged in OR not admin
    if (!session || session.user.role !== "admin") {
      router.push("/login"); // or "/"
    }
  }, [session, status]);

  // ⏳ loading state
  if (status === "loading") {
    return <div style={{ padding: 40 }}>Checking access...</div>;
  }



  const bg = dark ? "#0f1117" : "#f8fafc";
  const headerBg = dark ? "#0f1117" : "#ffffff";
  const border = dark ? "#1e2535" : "#e2e8f0";
  const text = dark ? "#e2e8f0" : "#1e293b";
  const muted = dark ? "#64748b" : "#94a3b8";

  const renderContent = () => {
    switch (active) {
      case "dashboard":
        // ↓ pass setActive so quick-action buttons inside Dashboard
        //   can navigate to other sections directly
        return <Dashboard dark={dark} setActive={setActive} />;

      case "upload":
        return <UploadLogo dark={dark} />;

      case "watermark":
        return <WatermarkSettings dark={dark} />;

      case "categories":
        return <AdminCategories dark={dark} />;

      case "LogoManagement":
        return <LogoManagement dark={dark} />;

      case "User":
        return <UserManagement dark={dark} />;

      case "Page/CMS":
        return <PagesCMS dark={dark} />;
      case "Navigation/Menu":
        return <NavigationMenu dark={dark} />;
      case "Media Library":
        return <MediaLibrary dark={dark} />;
      case "SiteSettings":
        return <SiteSettings dark={dark} />;
        case "ContactMessages": return <ContactMessages dark={dark} />;
case "LogoRequests":    return <LogoRequests dark={dark} />;
case "Blog": return <BlogManager dark={dark} />;
case "DCMA/Report": return <Report dark={dark} />;

      default:
        return (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: "100%", flexDirection: "column", gap: 12,
            color: muted, fontFamily: "'DM Sans', sans-serif",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: dark ? "#1e2535" : "#e2e8f0",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24,
            }}>
              🚧
            </div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: text }}>Coming Soon</p>
            <p style={{ margin: 0, fontSize: 13 }}>This section is under construction.</p>
          </div>
        );
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; padding: 0; }
        input:focus, textarea:focus, select:focus {
          border-color: #22c55e !important;
          box-shadow: 0 0 0 3px rgba(34,197,94,0.12) !important;
        }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #22c55e44; border-radius: 99px; }
      `}</style>

      <div style={{
        display: "flex", height: "100vh", background: bg,
        fontFamily: "'DM Sans', sans-serif", overflow: "hidden",
      }}>

        {/* Sidebar — receives setActive so nav items work */}
        <Sidebar active={active} setActive={setActive} dark={dark} />

        {/* Main content area */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          overflow: "hidden", minWidth: 0,
        }}>

          {/* Top bar */}
          <header style={{
            height: 56, background: headerBg,
            borderBottom: `1px solid ${border}`,
            display: "flex", alignItems: "center",
            justifyContent: "space-between",
            // 56px left pad gives room for the mobile hamburger button
            padding: "0 20px 0 56px",
            flexShrink: 0,
            position: "sticky", top: 0, zIndex: 20,
          }}>
            <span style={{
              fontSize: 13, fontWeight: 600, color: muted,
              fontFamily: "'DM Sans', sans-serif",
            }}>
              {PAGE_TITLES[active] ?? active.charAt(0).toUpperCase() + active.slice(1)}
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Light / dark toggle */}
              <button
                onClick={() => setDark(d => !d)}
                style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: dark ? "#1e2535" : "#f1f5f9",
                  border: `1px solid ${border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: muted, transition: "all 0.2s",
                }}
                title={dark ? "Switch to light mode" : "Switch to dark mode"}
              >
                {dark ? <Sun size={15} /> : <Moon size={15} />}
              </button>

              {/* Avatar */}
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "linear-gradient(135deg,#22c55e,#16a34a)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}>
                <User size={15} color="#fff" />
              </div>
            </div>
          </header>

          {/* Page content */}
          <main style={{ flex: 1, overflowY: "auto" }}>
            {renderContent()}
          </main>

        </div>
      </div>
    </>
  );
}