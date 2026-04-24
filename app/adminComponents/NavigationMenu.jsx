"use client";

import { useState, useEffect } from "react";
import {
  Plus, Trash2, Edit3, Check, X,
  GripVertical, Link2, Type, Save,
  Loader2, AlertCircle, ExternalLink, FileText,
  Navigation, ToggleLeft, ToggleRight,
} from "lucide-react";

// ─── uid ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);

// ─── Default footer content (used if backend returns null) ────────────────
const DEFAULT_CONTENT = {
  description: "CDRLOGO.com is a premium resource for downloading professional logo files in AI, CDR, SVG, and PNG formats.",
  copyright:   "© 2024 CDRLOGO.com. All rights reserved.",
  facebook:    "https://facebook.com/cdrlogo",
  twitter:     "https://twitter.com/cdrlogo",
  instagram:   "https://instagram.com/cdrlogo",
  pinterest:   "https://pinterest.com/cdrlogo",
};

// ─── Footer API (original, untouched) ─────────────────────────────────────
const apiFetch = async () => {
  const r = await fetch("/api/admin/footer", { method: "POST" });
  if (!r.ok) throw new Error("Load failed");
  return r.json();
};

const apiSave = async (payload) => {
  const r = await fetch("/api/admin/footer", {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });
  if (!r.ok) throw new Error("Save failed");
  return r.json();
};

const apiToggle = async (pageId, section, action) => {
  const r = await fetch("/api/admin/footer", {
    method:  "DELETE",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ pageId, section, action }),
  });
  if (!r.ok) throw new Error(`Toggle failed: ${action} ${section}`);
  return r.json();
};

// ─── Nav API ───────────────────────────────────────────────────────────────
// POST  → { navItems, allPages }
//   navItems  = Website.navItems JSON array
//                item shape: { link, label, custom, add }  ← NO pageId
//   allPages  = every Page row (id, title, slug, publishStatus, InHome)
const apiFetchNav = async () => {
  const r = await fetch("/api/admin/nav", { method: "POST" });
  if (!r.ok) throw new Error("Nav load failed");
  return r.json();
};

// PATCH → bulk-save full navItems array
const apiSaveNav = async (navItems) => {
  const r = await fetch("/api/admin/nav", {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ navItems }),
  });
  if (!r.ok) throw new Error("Nav save failed");
  return r.json();
};

// PUT → single-item instant op  { op, ...payload }
// op: "toggle"        { link }
// op: "add_default"   { link, label }
// op: "remove_default"{ link }          (also removes custom items by link)
// op: "add_cms"       { link, label }   sets InHome=true via slug
// op: "remove_cms"    { link }          sets InHome=false via slug
const apiNavOp = async (payload) => {
  const r = await fetch("/api/admin/nav", {
    method:  "PUT",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Nav op failed: ${payload.op}`);
  return r.json(); // { ok, navItems }
};

// ─── small UI helpers ──────────────────────────────────────────────────────
const iconBtnStyle = (color) => ({
  width: 26, height: 26, borderRadius: 6, flexShrink: 0,
  background: "transparent", border: "none",
  color, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
});

const pillBtn = (color) => ({
  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
  background: color + "18", border: `1px solid ${color}44`,
  color, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
});

// ─── PageRow — one row in a footer link column (original, untouched) ──────
function PageRow({ page, dark, onRemove }) {
  const border  = dark ? "#1f2d3d" : "#e2e8f0";
  const text    = dark ? "#f1f5f9" : "#0f172a";
  const muted   = dark ? "#475569" : "#94a3b8";
  const surface = dark ? "#111827" : "#ffffff";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "9px 12px",
      background: surface,
      border: `1px solid ${border}`,
      borderRadius: 10,
      transition: "border-color 0.15s",
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "#22c55e44"}
      onMouseLeave={e => e.currentTarget.style.borderColor = border}
    >
      <GripVertical size={13} style={{ color: muted, flexShrink: 0 }} />

      <span style={{
        flex: 1, fontSize: 13, fontWeight: 500, color: text,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {page.title}
      </span>

      <span style={{
        fontSize: 11, color: "#22c55e",
        background: "#22c55e15", border: "1px solid #22c55e33",
        borderRadius: 6, padding: "2px 8px",
        fontFamily: "monospace", whiteSpace: "nowrap", flexShrink: 0,
      }}>
        /{page.slug}
      </span>

      <span style={{
        fontSize: 10, fontWeight: 600, flexShrink: 0,
        color: page.publishStatus === "published" ? "#22c55e" : "#f59e0b",
        background: (page.publishStatus === "published" ? "#22c55e" : "#f59e0b") + "15",
        border: `1px solid ${(page.publishStatus === "published" ? "#22c55e" : "#f59e0b")}33`,
        borderRadius: 20, padding: "2px 7px",
        textTransform: "uppercase", letterSpacing: "0.06em",
      }}>
        {page.publishStatus}
      </span>

      <button onClick={onRemove} style={iconBtnStyle("#ef4444")}>
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ─── NavItemRow — one row in the header nav list ──────────────────────────
function NavItemRow({ item, dark, onToggle, onRemove }) {
  const border  = dark ? "#1f2d3d" : "#e2e8f0";
  const text    = dark ? "#f1f5f9" : "#0f172a";
  const muted   = dark ? "#475569" : "#94a3b8";
  const surface = dark ? "#111827" : "#ffffff";
  const accent  = item.add ? "#22c55e" : "#475569";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "9px 12px", background: surface,
      border: `1px solid ${item.add ? "#22c55e33" : border}`,
      borderRadius: 10, transition: "border-color 0.15s, opacity 0.2s",
      opacity: item.add ? 1 : 0.5,
    }}>
      <GripVertical size={13} style={{ color: muted, flexShrink: 0 }} />

      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {item.label}
      </span>

      <span style={{ fontSize: 11, color: "#64748b", background: "#64748b15", border: "1px solid #64748b33", borderRadius: 6, padding: "2px 8px", fontFamily: "monospace", whiteSpace: "nowrap", flexShrink: 0 }}>
        {item.link}
      </span>

      {/* badge */}
      <span style={{ fontSize: 10, fontWeight: 600, flexShrink: 0,
        color:       item.custom ? "#a78bfa" : "#38bdf8",
        background:  (item.custom ? "#a78bfa" : "#38bdf8") + "15",
        border:      `1px solid ${(item.custom ? "#a78bfa" : "#38bdf8")}33`,
        borderRadius: 20, padding: "2px 7px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {item.custom ? "CMS" : "Route"}
      </span>

      {/* toggle visible / hidden */}
      <button onClick={onToggle} title={item.add ? "Hide from nav" : "Show in nav"}
        style={{ ...iconBtnStyle(accent), width: 30, height: 30 }}>
        {item.add ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
      </button>

      {/* remove */}
      <button onClick={onRemove} style={iconBtnStyle("#ef4444")}>
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ─── AddNavPageRow — dropdown to add a CMS page to header nav ─────────────
function AddNavPageRow({ available, dark, onAdd }) {
  const [selected, setSelected] = useState("");
  const border = dark ? "#1f2d3d" : "#e2e8f0";
  const text   = dark ? "#f1f5f9" : "#0f172a";
  const muted  = dark ? "#475569" : "#94a3b8";

  const add = () => {
    if (!selected) return;
    const page = available.find(p => p.id === selected);
    if (page) { onAdd(page); setSelected(""); }
  };

  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8, padding: "10px 12px", background: dark ? "#0b0f17" : "#f8fafc", border: `1px dashed ${border}`, borderRadius: 10, alignItems: "center" }}>
      <Plus size={13} style={{ color: "#a78bfa", flexShrink: 0 }} />
      <select value={selected} onChange={e => setSelected(e.target.value)}
        style={{ flex: 1, minWidth: 0, background: dark ? "#111827" : "#fff", border: `1px solid ${border}`, borderRadius: 7, padding: "6px 10px", fontSize: 12, color: selected ? text : muted, fontFamily: "'DM Sans', sans-serif", outline: "none" }}>
        <option value="">— Add a CMS page to nav —</option>
        {available.map(p => (
          <option key={p.id} value={p.id}>{p.title}  /{p.slug}</option>
        ))}
      </select>
      <button onClick={add} disabled={!selected}
        style={{ ...pillBtn("#a78bfa"), opacity: selected ? 1 : 0.4, cursor: selected ? "pointer" : "not-allowed" }}>
        <Check size={13} />
      </button>
    </div>
  );
}

// ─── AddDefaultNavRow — add a new route item (custom:false) ───────────────
function AddDefaultNavRow({ dark, onAdd }) {
  const [label, setLabel] = useState("");
  const [link,  setLink]  = useState("");
  const border = dark ? "#1f2d3d" : "#e2e8f0";
  const text   = dark ? "#f1f5f9" : "#0f172a";
  const muted  = dark ? "#475569" : "#94a3b8";
  const canAdd = label.trim().length > 0 && link.trim().startsWith("/");

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd(link.trim(), label.trim());
    setLabel(""); setLink("");
  };

  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8, padding: "10px 12px", background: dark ? "#0b0f17" : "#f8fafc", border: `1px dashed ${border}`, borderRadius: 10, alignItems: "center" }}>
      <Plus size={13} style={{ color: "#38bdf8", flexShrink: 0 }} />
      <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Label"
        onKeyDown={e => e.key === "Enter" && handleAdd()}
        style={{ flex: 1, minWidth: 0, background: dark ? "#111827" : "#fff", border: `1px solid ${border}`, borderRadius: 7, padding: "6px 10px", fontSize: 12, color: text, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
      <input value={link} onChange={e => setLink(e.target.value)} placeholder="/link"
        onKeyDown={e => e.key === "Enter" && handleAdd()}
        style={{ width: 110, background: dark ? "#111827" : "#fff", border: `1px solid ${border}`, borderRadius: 7, padding: "6px 10px", fontSize: 12, color: "#38bdf8", fontFamily: "monospace", outline: "none" }} />
      <button onClick={handleAdd} disabled={!canAdd}
        style={{ ...pillBtn("#38bdf8"), opacity: canAdd ? 1 : 0.4, cursor: canAdd ? "pointer" : "not-allowed" }}>
        <Check size={13} />
      </button>
    </div>
  );
}

// ─── SectionCard ──────────────────────────────────────────────────────────
function SectionCard({ title, icon: Icon, accent = "#22c55e", dark, animDelay = 0, children }) {
  const surface = dark ? "#111827" : "#ffffff";
  const border  = dark ? "#1f2d3d" : "#e2e8f0";
  const text    = dark ? "#f1f5f9" : "#0f172a";

  return (
    <div style={{
      background: surface, border: `1px solid ${border}`,
      borderRadius: 16, overflow: "hidden",
      boxShadow: dark ? "0 4px 24px #00000022" : "0 4px 16px #0000000a",
      animation: `fadeUp 0.4s ease ${animDelay}ms both`,
    }}>
      <div style={{
        padding: "14px 20px", borderBottom: `1px solid ${border}`,
        display: "flex", alignItems: "center", gap: 9,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: accent + "18",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: accent,
        }}>
          <Icon size={14} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: text }}>{title}</span>
      </div>
      <div style={{ padding: "18px 20px" }}>{children}</div>
    </div>
  );
}

// ─── InputField ───────────────────────────────────────────────────────────
function InputField({ label, value, onChange, placeholder, dark, icon: Icon }) {
  const border = dark ? "#1f2d3d" : "#e2e8f0";
  const text   = dark ? "#f1f5f9" : "#0f172a";
  const muted  = dark ? "#475569" : "#94a3b8";
  const input  = dark ? "#0b0f17" : "#f8fafc";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 10.5, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        {Icon && (
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: muted, pointerEvents: "none" }}>
            <Icon size={12} />
          </span>
        )}
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: "100%", boxSizing: "border-box",
            background: input, border: `1px solid ${border}`, borderRadius: 9,
            padding: Icon ? "8px 12px 8px 30px" : "8px 12px",
            fontSize: 13, color: text,
            fontFamily: "'DM Sans', sans-serif",
          }}
        />
      </div>
    </div>
  );
}

// ─── AddLinkRow — dropdown of pages not yet in this column (original) ─────
function AddLinkRow({ available, dark, onAdd }) {
  const [selected, setSelected] = useState("");
  const border  = dark ? "#1f2d3d" : "#e2e8f0";
  const text    = dark ? "#f1f5f9" : "#0f172a";
  const muted   = dark ? "#475569" : "#94a3b8";

  const add = () => {
    if (!selected) return;
    const page = available.find(p => p.id === selected);
    if (page) { onAdd(page); setSelected(""); }
  };

  return (
    <div style={{
      display: "flex", gap: 8, marginTop: 10,
      padding: "10px 12px",
      background: dark ? "#0b0f17" : "#f8fafc",
      border: `1px dashed ${border}`, borderRadius: 10,
      alignItems: "center",
    }}>
      <Plus size={13} style={{ color: muted, flexShrink: 0 }} />
      <select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        style={{
          flex: 1, minWidth: 0,
          background: dark ? "#111827" : "#fff",
          border: `1px solid ${border}`, borderRadius: 7,
          padding: "6px 10px", fontSize: 12, color: selected ? text : muted,
          fontFamily: "'DM Sans', sans-serif", outline: "none",
        }}
      >
        <option value="">— Select a page to add —</option>
        {available.map(p => (
          <option key={p.id} value={p.id}>
            {p.title}  /{p.slug}
          </option>
        ))}
      </select>
      <button
        onClick={add}
        disabled={!selected}
        style={{
          ...pillBtn("#22c55e"),
          opacity: selected ? 1 : 0.4,
          cursor: selected ? "pointer" : "not-allowed",
        }}
      >
        <Check size={13} />
      </button>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function FooterSettings({ dark = true }) {

  // ── Nav state ─────────────────────────────────────────────────────────────
  // navItems shape: { link, label, custom, add }  — NO pageId
  const [navItems,      setNavItems]      = useState([]);
  const [navAllPages,   setNavAllPages]   = useState([]); // pages not yet InHome (for dropdown)
  const [navSaving,     setNavSaving]     = useState(false);
  const [navLoading,    setNavLoading]    = useState(true);

  // ── Footer state (original, untouched) ────────────────────────────────────
  const [quickLinks,  setQuickLinks]  = useState([]);
  const [legalLinks,  setLegalLinks]  = useState([]);
  const [otherPages,  setOtherPages]  = useState([]);
  const [allPageIds,  setAllPageIds]  = useState([]);
  const [content,     setContent]     = useState(DEFAULT_CONTENT);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [toast,       setToast]       = useState(null);

  // ── load nav ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetchNav();
        setNavItems(data.navItems ?? []);
        // Pages not yet in nav (InHome:false) → available for the "add CMS page" dropdown
        setNavAllPages((data.allPages ?? []).filter(p => !p.InHome));
      } catch {
        // nav fails silently
      }
      setNavLoading(false);
    })();
  }, []);

  // ── load footer (original, untouched) ─────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch();
        setQuickLinks(data.quickLinks ?? []);
        setLegalLinks(data.legalLinks ?? []);
        setOtherPages(data.otherPages ?? []);
        setAllPageIds([
          ...(data.quickLinks ?? []),
          ...(data.legalLinks ?? []),
          ...(data.otherPages ?? []),
        ].map(p => p.id));
        if (data.footer) setContent({ ...DEFAULT_CONTENT, ...data.footer });
      } catch {
        // fallback: empty state, content form still works
      }
      setLoading(false);
    })();
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  // ── Nav handlers ──────────────────────────────────────────────────────────

  // Toggle `add` on any nav item — backend matches by `link` regardless of custom flag
  const toggleNavItem = async (index) => {
    const item = navItems[index];
    // Optimistic update
    setNavItems(prev => prev.map((i, idx) => idx === index ? { ...i, add: !i.add } : i));
    try {
      const res = await apiNavOp({ op: "toggle", link: item.link });
      if (res.navItems) setNavItems(res.navItems);
    } catch {
      showToast("Failed to update nav item", "error");
      // Rollback
      setNavItems(prev => prev.map((i, idx) => idx === index ? { ...i, add: !i.add } : i));
    }
  };

  // Add a CMS page (custom:true) to nav — passes link + label (no pageId)
  const addCmsPageToNav = async (page) => {
    const link  = "/" + page.slug;
    const label = page.title;
    const newItem = { link, label, custom: true, add: true };
    // Optimistic
    setNavItems(l => [...l, newItem]);
    setNavAllPages(l => l.filter(p => p.id !== page.id));
    try {
      const res = await apiNavOp({ op: "add_cms", link, label });
      if (res.navItems) setNavItems(res.navItems);
    } catch {
      showToast("Failed to add page to nav", "error");
      setNavItems(l => l.filter(i => i.link !== link));
      setNavAllPages(l => [...l, page]);
    }
  };

  // Remove any nav item — both custom and default identified by link
  const removeNavItem = async (item, index) => {
    const snapshot = navItems;
    setNavItems(l => l.filter((_, i) => i !== index));
    // If CMS page, put it back in the dropdown
    if (item.custom) {
      // Find the page from allPages (we need the id for the dropdown)
      setNavAllPages(l => {
        // Avoid duplicates
        if (l.some(p => "/" + p.slug === item.link)) return l;
        return [...l, { id: uid(), title: item.label, slug: item.link.replace(/^\//, ""), publishStatus: "published", InHome: false }];
      });
    }
    try {
      const op  = item.custom ? "remove_cms" : "remove_default";
      const res = await apiNavOp({ op, link: item.link });
      if (res.navItems) setNavItems(res.navItems);
      // Re-fetch allPages to get accurate page ids in dropdown
      if (item.custom) {
        const data = await apiFetchNav();
        setNavAllPages((data.allPages ?? []).filter(p => !p.InHome));
      }
    } catch {
      showToast("Failed to remove nav item", "error");
      setNavItems(snapshot);
      if (item.custom) setNavAllPages(l => l.filter(p => "/" + p.slug !== item.link));
    }
  };

  // Add a new default (custom:false) route item — passes link + label
  const addDefaultNavItem = async (link, label) => {
    const newItem = { link, label, custom: false, add: true };
    setNavItems(l => [...l, newItem]);
    try {
      const res = await apiNavOp({ op: "add_default", link, label });
      if (res.navItems) setNavItems(res.navItems);
    } catch {
      showToast("Failed to add route item", "error");
      setNavItems(l => l.filter(i => !(i.custom === false && i.link === link)));
    }
  };

  const handleSaveNav = async () => {
    setNavSaving(true);
    try {
      await apiSaveNav(navItems);
      showToast("Navigation saved!");
    } catch {
      showToast("Nav save failed.", "error");
    }
    setNavSaving(false);
  };

  // ── Footer handlers (original, untouched) ─────────────────────────────────

  const addToQuick = async (page) => {
    setQuickLinks(l => [...l, page]);
    setOtherPages(l => l.filter(p => p.id !== page.id));
    setLegalLinks(l => l.filter(p => p.id !== page.id));
    try {
      await apiToggle(page.id, "quick", "add");
    } catch {
      showToast("Failed to add page to Quick Links", "error");
      setQuickLinks(l => l.filter(p => p.id !== page.id));
      setOtherPages(l => [...l, page]);
    }
  };

  const removeFromQuick = async (pageId) => {
    const page = quickLinks.find(p => p.id === pageId);
    setQuickLinks(l => l.filter(p => p.id !== pageId));
    if (page) setOtherPages(l => [...l, page]);
    try {
      await apiToggle(pageId, "quick", "remove");
    } catch {
      showToast("Failed to remove page from Quick Links", "error");
      if (page) {
        setQuickLinks(l => [...l, page]);
        setOtherPages(l => l.filter(p => p.id !== pageId));
      }
    }
  };

  const addToLegal = async (page) => {
    setLegalLinks(l => [...l, page]);
    setOtherPages(l => l.filter(p => p.id !== page.id));
    setQuickLinks(l => l.filter(p => p.id !== page.id));
    try {
      await apiToggle(page.id, "legal", "add");
    } catch {
      showToast("Failed to add page to Legal", "error");
      setLegalLinks(l => l.filter(p => p.id !== page.id));
      setOtherPages(l => [...l, page]);
    }
  };

  const removeFromLegal = async (pageId) => {
    const page = legalLinks.find(p => p.id === pageId);
    setLegalLinks(l => l.filter(p => p.id !== pageId));
    if (page) setOtherPages(l => [...l, page]);
    try {
      await apiToggle(pageId, "legal", "remove");
    } catch {
      showToast("Failed to remove page from Legal", "error");
      if (page) {
        setLegalLinks(l => [...l, page]);
        setOtherPages(l => l.filter(p => p.id !== pageId));
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiSave({
        content,
        quickLinkIds:   quickLinks.map(p => p.id),
        legalLinkIds:   legalLinks.map(p => p.id),
        allPageIds,
        quickLinkSlugs: quickLinks.map(p => p.slug),
        legalLinkSlugs: legalLinks.map(p => p.slug),
      });
      showToast("Footer saved successfully!");
    } catch {
      showToast("Save failed. Please try again.", "error");
    }
    setSaving(false);
  };

  // ── theme ──────────────────────────────────────────────────────────────────
  const bg     = dark ? "#0b0f17" : "#f0f4f8";
  const border = dark ? "#1f2d3d" : "#e2e8f0";
  const text   = dark ? "#f1f5f9" : "#0f172a";
  const muted  = dark ? "#475569" : "#94a3b8";
  const input  = dark ? "#0b0f17" : "#f8fafc";

  if (loading) return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: 320, gap: 10, color: muted,
      background: bg, fontFamily: "'DM Sans', sans-serif",
    }}>
      <Loader2 size={17} style={{ animation: "spin 0.8s linear infinite" }} />
      <span style={{ fontSize: 13 }}>Loading settings…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes toastIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        input:focus,textarea:focus,select:focus{
          border-color:#22c55e!important;
          box-shadow:0 0 0 3px rgba(34,197,94,.10)!important;
          outline:none!important;
        }
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#22c55e44;border-radius:99px}
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          display: "flex", alignItems: "center", gap: 9,
          background: toast.type === "success" ? "#22c55e" : "#ef4444",
          color: "#fff", borderRadius: 10, padding: "11px 18px",
          fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
          boxShadow: "0 8px 32px #00000033",
          animation: "toastIn 0.25s ease both",
        }}>
          {toast.type === "success" ? <Check size={14} /> : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}

      <div style={{
        background: bg, minHeight: "100%",
        fontFamily: "'DM Sans', sans-serif",
        padding: "28px 28px 60px",
      }}>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* HEADER NAV                                                         */}
        {/* ══════════════════════════════════════════════════════════════════ */}

        <div style={{
          display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", marginBottom: 20, gap: 12,
          animation: "fadeUp 0.3s ease both",
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: text, letterSpacing: "-0.03em" }}>
              Header &amp; Footer Settings
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: muted }}>
              Manage header navigation and footer links
            </p>
          </div>
        </div>

        <SectionCard title="Header Navigation" icon={Navigation} accent="#f59e0b" dark={dark} animDelay={0}>

          {/* sub-header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Nav Items
              </span>
              {!navLoading && (
                <span style={{ fontSize: 10, fontWeight: 600, color: "#f59e0b", background: "#f59e0b15", border: "1px solid #f59e0b33", borderRadius: 20, padding: "1px 7px" }}>
                  {navItems.filter(i => i.add).length} visible / {navItems.length} total
                </span>
              )}
            </div>

            <button
              onClick={handleSaveNav}
              disabled={navSaving || navLoading}
              style={{ display: "flex", alignItems: "center", gap: 7, background: navSaving ? "#1a2535" : "linear-gradient(135deg,#f59e0b,#d97706)", border: "none", borderRadius: 9, padding: "8px 14px", cursor: (navSaving || navLoading) ? "not-allowed" : "pointer", color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans',sans-serif", opacity: (navSaving || navLoading) ? 0.7 : 1, transition: "opacity 0.2s", boxShadow: navSaving ? "none" : "0 4px 16px #f59e0b33" }}
            >
              {navSaving ? <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} /> : <Save size={12} />}
              {navSaving ? "Saving…" : "Save Nav"}
            </button>
          </div>

          {/* legend */}
          <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
            {[
              { color: "#22c55e", label: "Visible" },
              { color: "#475569", label: "Hidden" },
              { color: "#38bdf8", label: "Route item" },
              { color: "#a78bfa", label: "CMS page" },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: muted }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />{label}
              </div>
            ))}
          </div>

          {/* loading state */}
          {navLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "18px 14px", borderRadius: 10, border: `1px dashed ${border}`, color: muted, fontSize: 12 }}>
              <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} />
              Loading nav items…
            </div>
          ) : (
            <>
              {navItems.length === 0 && (
                <div style={{ padding: "18px 14px", borderRadius: 10, border: `1px dashed ${border}`, textAlign: "center", color: muted, fontSize: 12 }}>
                  No nav items yet — add route items or CMS pages below
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {navItems.map((item, i) => (
                  <NavItemRow
                    key={`${item.link}-${i}`}
                    item={item}
                    dark={dark}
                    onToggle={() => toggleNavItem(i)}
                    onRemove={() => removeNavItem(item, i)}
                  />
                ))}
              </div>

              {/* Add CMS page (InHome → true, custom: true in navItems) */}
              <AddNavPageRow available={navAllPages} dark={dark} onAdd={addCmsPageToNav} />

              {/* Add a custom route item (custom: false) */}
              <AddDefaultNavRow dark={dark} onAdd={addDefaultNavItem} />
            </>
          )}
        </SectionCard>

        <div style={{ height: 28 }} />

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* FOOTER — everything below is original, completely untouched        */}
        {/* ══════════════════════════════════════════════════════════════════ */}

        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", marginBottom: 28, gap: 12,
          animation: "fadeUp 0.3s ease both",
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: text, letterSpacing: "-0.03em" }}>
              Footer Settings
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: muted }}>
              Manage footer links from your CMS pages and site-wide content
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
              background: saving ? "#1a2535" : "linear-gradient(135deg,#22c55e,#16a34a)",
              border: "none", borderRadius: 10, padding: "10px 18px",
              cursor: saving ? "not-allowed" : "pointer",
              color: "#fff", fontSize: 13, fontWeight: 700,
              fontFamily: "'DM Sans',sans-serif",
              opacity: saving ? 0.7 : 1, transition: "opacity 0.2s",
              boxShadow: saving ? "none" : "0 4px 16px #22c55e33",
            }}
          >
            {saving
              ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} />
              : <Save size={13} />
            }
            {saving ? "Saving…" : "Save Footer"}
          </button>
        </div>

        {/* ── Footer Links columns ── */}
        <SectionCard title="Footer Links" icon={Link2} dark={dark} animDelay={0}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 24,
          }}>

            {/* Column 1: Quick Links */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Column 1 — Quick Links
                </span>
                <span style={{
                  marginLeft: "auto", fontSize: 10, fontWeight: 600,
                  color: "#22c55e", background: "#22c55e15",
                  border: "1px solid #22c55e33", borderRadius: 20, padding: "1px 7px",
                }}>
                  {quickLinks.length} pages
                </span>
              </div>

              {quickLinks.length === 0 && (
                <div style={{
                  padding: "18px 14px", borderRadius: 10,
                  border: `1px dashed ${border}`, textAlign: "center",
                  color: muted, fontSize: 12,
                }}>
                  No quick links yet — add pages below
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {quickLinks.map(page => (
                  <PageRow
                    key={page.id}
                    page={page}
                    dark={dark}
                    onRemove={() => removeFromQuick(page.id)}
                  />
                ))}
              </div>

              <AddLinkRow available={otherPages} dark={dark} onAdd={addToQuick} />
            </div>

            {/* Column 2: Legal */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#3b82f6", flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Column 2 — Legal
                </span>
                <span style={{
                  marginLeft: "auto", fontSize: 10, fontWeight: 600,
                  color: "#3b82f6", background: "#3b82f615",
                  border: "1px solid #3b82f633", borderRadius: 20, padding: "1px 7px",
                }}>
                  {legalLinks.length} pages
                </span>
              </div>

              {legalLinks.length === 0 && (
                <div style={{
                  padding: "18px 14px", borderRadius: 10,
                  border: `1px dashed ${border}`, textAlign: "center",
                  color: muted, fontSize: 12,
                }}>
                  No legal links yet — add pages below
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {legalLinks.map(page => (
                  <PageRow
                    key={page.id}
                    page={page}
                    dark={dark}
                    onRemove={() => removeFromLegal(page.id)}
                  />
                ))}
              </div>

              <AddLinkRow available={otherPages} dark={dark} onAdd={addToLegal} />
            </div>

          </div>

          {otherPages.length > 0 && (
            <div style={{
              marginTop: 20, padding: "10px 14px",
              background: dark ? "#0b0f17" : "#f8fafc",
              border: `1px solid ${border}`, borderRadius: 10,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <FileText size={13} style={{ color: muted, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: muted }}>
                <strong style={{ color: text }}>{otherPages.length}</strong> page{otherPages.length !== 1 ? "s" : ""} available to add:&nbsp;
                {otherPages.map((p, i) => (
                  <span key={p.id}>
                    <span style={{ color: "#22c55e", fontFamily: "monospace", fontSize: 11 }}>/{p.slug}</span>
                    {i < otherPages.length - 1 ? ", " : ""}
                  </span>
                ))}
              </span>
            </div>
          )}
        </SectionCard>

        <div style={{ height: 20 }} />

        {/* ── Footer Content ── */}
        <SectionCard title="Footer Content" icon={Type} accent="#3b82f6" dark={dark} animDelay={80}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Footer Description
              </label>
              <textarea
                value={content.description}
                onChange={e => setContent(c => ({ ...c, description: e.target.value }))}
                rows={3}
                placeholder="Brief description of your site…"
                style={{
                  background: input, border: `1px solid ${border}`, borderRadius: 9,
                  padding: "10px 12px", fontSize: 13, color: text,
                  fontFamily: "'DM Sans', sans-serif",
                  resize: "vertical", lineHeight: 1.6, boxSizing: "border-box", width: "100%",
                }}
              />
            </div>

            <InputField
              label="Copyright Text"
              value={content.copyright}
              onChange={v => setContent(c => ({ ...c, copyright: v }))}
              placeholder="© 2024 CDRLOGO.com. All rights reserved."
              dark={dark}
              icon={FileText}
            />

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}>
              <InputField label="Facebook URL"  value={content.facebook}  onChange={v => setContent(c => ({ ...c, facebook: v }))}  placeholder="https://facebook.com/…"  dark={dark} icon={ExternalLink} />
              <InputField label="Twitter URL"   value={content.twitter}   onChange={v => setContent(c => ({ ...c, twitter: v }))}   placeholder="https://twitter.com/…"   dark={dark} icon={ExternalLink} />
              <InputField label="Instagram URL" value={content.instagram} onChange={v => setContent(c => ({ ...c, instagram: v }))} placeholder="https://instagram.com/…" dark={dark} icon={ExternalLink} />
              <InputField label="Pinterest URL" value={content.pinterest} onChange={v => setContent(c => ({ ...c, pinterest: v }))} placeholder="https://pinterest.com/…" dark={dark} icon={ExternalLink} />
            </div>
          </div>
        </SectionCard>

        {/* ── JSON preview ── */}
        <div style={{ height: 20 }} />
        <div style={{
          background: dark ? "#111827" : "#ffffff",
          border: `1px solid ${border}`, borderRadius: 16,
          padding: "16px 20px",
          animation: "fadeUp 0.5s ease 160ms both",
          boxShadow: dark ? "0 4px 24px #00000022" : "0 4px 16px #0000000a",
        }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Live Preview — Website.Footer JSON
          </p>
          <pre style={{
            margin: 0, fontSize: 11, color: "#22c55e",
            fontFamily: "'DM Mono', monospace", lineHeight: 1.65,
            overflow: "auto", maxHeight: 200,
          }}>
            {JSON.stringify({
              ...content,
              quickLinks: quickLinks.map(p => ({ label: p.title, slug: "/" + p.slug })),
              legalLinks: legalLinks.map(p => ({ label: p.title, slug: "/" + p.slug })),
            }, null, 2)}
          </pre>
        </div>

      </div>
    </>
  );
}