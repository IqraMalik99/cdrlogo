"use client";

import { useState } from "react";
import {  Sun, Moon, User } from "lucide-react";
import Sidebar from "../adminComponents/Sidebar";
import UploadLogo from "../adminComponents/UploadLogo";
import BulkOperations from "../adminComponents/Bulkoperations";

export default function AdminPage() {
  const [dark, setDark] = useState(true);
  const [active, setActive] = useState("upload");

  const bg = dark ? "#0f1117" : "#f8fafc";
  const headerBg = dark ? "#0f1117" : "#ffffff";
  const border = dark ? "#1e2535" : "#e2e8f0";
  const text = dark ? "#e2e8f0" : "#1e293b";
  const muted = dark ? "#64748b" : "#94a3b8";
  const green = "#22c55e";

  const renderContent = () => {
    switch (active) {
      case "upload": return <UploadLogo dark={dark} />;
      case "bulk": return <BulkOperations dark={dark} />;
      default:
        return (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: "100%", flexDirection: "column", gap: 12,
            color: muted, fontFamily: "'DM Sans', sans-serif"
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: dark ? "#1e2535" : "#e2e8f0",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24
            }}>🚧</div>
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
        fontFamily: "'DM Sans', sans-serif", overflow: "hidden"
      }}>
        {/* Sidebar */}
        <Sidebar active={active} setActive={setActive} dark={dark} />

        {/* Main */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

          {/* Top bar */}
          <header style={{
            height: 56, background: headerBg,
            borderBottom: `1px solid ${border}`,
            display: "flex", alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px", flexShrink: 0,
            position: "sticky", top: 0, zIndex: 20
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                fontSize: 13, fontWeight: 600, color: muted,
                fontFamily: "'DM Sans', sans-serif"
              }}>
                {active === "upload" ? "Upload Logo" : active === "bulk" ? "Bulk Operations" : active.charAt(0).toUpperCase() + active.slice(1)}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Theme toggle */}
              <button
                onClick={() => setDark(!dark)}
                style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: dark ? "#1e2535" : "#f1f5f9",
                  border: `1px solid ${border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: muted, transition: "all 0.2s"
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
                cursor: "pointer"
              }}>
                <User size={15} color="#fff" />
              </div>
            </div>
          </header>

          {/* Content */}
          <main style={{ flex: 1, overflowY: "auto" }}>
            {renderContent()}
          </main>
        </div>
      </div>
    </>
  );
}