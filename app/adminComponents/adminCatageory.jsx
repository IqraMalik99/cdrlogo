"use client";

import { useState, useEffect } from "react";

const TABS = ["Main Categories", "Brand Categories", "Template Categories"];

export default function AdminCategories({ dark = true }) {
  // ── Theme tokens ───────────────────────────────────────────────────────
  const bg         = dark ? "#0f1117"                    : "#FFFFFF";
  const card       = dark ? "#131929"                    : "#ffffff";
  const border     = dark ? "#1e2d45"                    : "#e2e8f0";
  const text       = dark ? "#e2e8f0"                    : "#1e293b";
  const muted      = dark ? "#64748b"                    : "#94a3b8";
  const green      = "#22c55e";
  const inputBg    = dark ? "#0f1825"                    : "#FFFFFF";
  const surfaceHov = dark ? "rgba(255,255,255,0.055)"    : "#ffffff";
  const borderHov  = dark ? "rgba(255,255,255,0.16)"     : "rgba(0,0,0,0.18)";

  // ── State ──────────────────────────────────────────────────────────────
  const [activeTab,     setActiveTab]     = useState("Main Categories");
  const [grouped,       setGrouped]       = useState({});   // raw { "T":[...], "S":[...] }
  const [loading,       setLoading]       = useState(false);
  const [modalOpen,     setModalOpen]     = useState(false);
  const [editItem,      setEditItem]      = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [form,          setForm]          = useState({ name: "", slug: "", type: "brand" });
  const [formError,     setFormError]     = useState("");
  const [saving,        setSaving]        = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────
  useEffect(() => { fetchCategories(); }, []);

  async function fetchCategories() {
    setLoading(true);
    try {
      const res  = await fetch("/api/website/catageory-letter", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ letter: "all" }),
      });
      const data = await res.json();
      // API returns grouped object { "T": [{name,slug,type}], ... }
      // store it as-is; we flatten below
      setGrouped(data && typeof data === "object" && !Array.isArray(data) ? data : {});
    } catch (err) {
      console.error("Failed to fetch categories", err);
      setGrouped({});
    } finally {
      setLoading(false);
    }
  }

  // ── Flatten grouped → flat array ───────────────────────────────────────
  // Object.values({T:[...], S:[...]}) → [[...],[...]] → flat [...]
  const allCats = Object.values(grouped).flat();

  const filtered = allCats.filter(c => {
    if (activeTab === "Main Categories")     return true;
    if (activeTab === "Brand Categories")    return c.type === "brand";
    if (activeTab === "Template Categories") return c.type === "template";
    return true;
  });

  const brandCount    = allCats.filter(c => c.type === "brand").length;
  const templateCount = allCats.filter(c => c.type === "template").length;

  const tabCounts = {
    "Main Categories":     allCats.length,
    "Brand Categories":    brandCount,
    "Template Categories": templateCount,
  };

  // ── Modal helpers ──────────────────────────────────────────────────────
  function openNew() {
    setEditItem(null);
    setForm({ name: "", slug: "", type: "brand" });
    setFormError("");
    setModalOpen(true);
  }
  function openEdit(cat) {
    setEditItem(cat);
    setForm({ name: cat.name, slug: cat.slug, type: cat.type });
    setFormError("");
    setModalOpen(true);
  }
  function closeModal() {
    setModalOpen(false);
    setEditItem(null);
    setFormError("");
  }
  function handleNameChange(e) {
    const name = e.target.value;
    const slug = name.trim().toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    setForm(f => ({ ...f, name, slug }));
  }

  // ── Save ───────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.name.trim()) { setFormError("Name is required."); return; }
    if (!form.slug.trim()) { setFormError("Slug is required.");  return; }
    setSaving(true);
    setFormError("");
    try {
      const isEdit = !!editItem;
      const url    = isEdit ? `/api/website/catageory-letter/${editItem.slug}` : "/api/website/catageory-letter";
      const method = isEdit ? "PUT" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFormError(err.message || "Something went wrong.");
        return;
      }
      await fetchCategories();
      closeModal();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────
  async function handleDelete(slug) {
    setDeleting(true);
    try {
      await fetch(`/api/website/catageory-letter/${slug}`, { method: "DELETE" });
      await fetchCategories();
      setDeleteConfirm(null);
    } catch (err) {
      console.error("Delete failed", err);
    } finally {
      setDeleting(false);
    }
  }

  // ── Shared style shortcuts ─────────────────────────────────────────────
  const inp = {
    width: "100%", padding: "9px 12px",
    background: inputBg, border: `1px solid ${border}`,
    borderRadius: 8, color: text,
    fontSize: 13, fontFamily: "'DM Sans', sans-serif",
    outline: "none", boxSizing: "border-box",
  };
  const lbl = {
    fontSize: 11, fontWeight: 700, color: muted, marginBottom: 6,
    display: "block", letterSpacing: "0.06em", textTransform: "uppercase",
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Sora:wght@600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .ac-inp:focus        { border-color:#22c55e !important; box-shadow:0 0 0 3px rgba(34,197,94,0.12) !important; }
        .ac-card:hover       { background:${surfaceHov} !important; border-color:${borderHov} !important; box-shadow:0 2px 16px rgba(0,0,0,.1) !important; }
        .ac-edit:hover       { color:#22c55e !important; background:rgba(34,197,94,0.08) !important; }
        .ac-del:hover        { color:#ef4444 !important; background:rgba(239,68,68,0.08) !important; }
        .ac-tab:hover        { color:${text} !important; }
        .ac-new:hover        { background:#16a34a !important; transform:translateY(-1px); }
        .ac-save:hover:not(:disabled)       { background:#16a34a !important; transform:translateY(-1px); }
        .ac-del-ok:hover:not(:disabled)     { background:#dc2626 !important; }
        .ac-cancel:hover     { border-color:${borderHov} !important; color:${text} !important; }
        @keyframes shimmer   { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes spin      { to{transform:rotate(360deg)} }
        @media(max-width:600px){ .ac-grid{grid-template-columns:1fr !important;} .ac-tabwrap{overflow-x:auto;} }
      `}</style>

      <div style={{ padding: "28px 28px 80px", background: bg, minHeight: "100vh", fontFamily: "'DM Sans',sans-serif" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: text, fontFamily: "'Sora',sans-serif", letterSpacing: "-0.4px" }}>
              Categories
            </h1>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: muted }}>
              {allCats.length} total · {brandCount} brand · {templateCount} template
            </p>
          </div>
          <button className="ac-new" onClick={openNew} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 18px", background: green, color: "#0f1117",
            border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700,
            fontFamily: "'DM Sans',sans-serif", cursor: "pointer", transition: "all .15s",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Category
          </button>
        </div>

        {/* Tabs */}
        <div className="ac-tabwrap" style={{ display: "flex", borderBottom: `1px solid ${border}`, marginBottom: 22 }}>
          {TABS.map(t => (
            <button key={t} className="ac-tab" onClick={() => setActiveTab(t)} style={{
              padding: "9px 16px", fontSize: 12.5, fontWeight: 600,
              color: activeTab === t ? text : muted,
              background: "none", border: "none",
              borderBottom: `2px solid ${activeTab === t ? green : "transparent"}`,
              marginBottom: -1, cursor: "pointer",
              transition: "color .15s, border-color .15s",
              fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {t}
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20,
                background: activeTab === t ? `${green}22` : dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                color: activeTab === t ? green : muted,
              }}>
                {tabCounts[t]}
              </span>
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="ac-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{
                background: card, border: `1px solid ${border}`, borderRadius: 12, height: 84,
                animation: "shimmer 1.4s ease-in-out infinite", animationDelay: `${i * 80}ms`,
              }} />
            ))
          ) : filtered.length === 0 ? (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "56px 20px", color: muted, fontSize: 13 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: text, marginBottom: 4 }}>No categories found</div>
              {activeTab === "Main Categories" ? "Add your first category." : `No ${activeTab.toLowerCase()} yet.`}
            </div>
          ) : (
            filtered.map(cat => (
              <div key={cat.slug} className="ac-card" style={{
                background: card, border: `1px solid ${border}`,
                borderRadius: 12, padding: "14px 16px",
                transition: "background .2s, border-color .2s, box-shadow .2s",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: text, fontFamily: "'Sora',sans-serif" }}>
                    {cat.name}
                  </span>
                  <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                    <button className="ac-edit" title="Edit" onClick={() => openEdit(cat)} style={{
                      width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                      background: "none", border: "none", borderRadius: 7, cursor: "pointer",
                      color: muted, transition: "all .15s",
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button className="ac-del" title="Delete" onClick={() => setDeleteConfirm(cat)} style={{
                      width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                      background: "none", border: "none", borderRadius: 7, cursor: "pointer",
                      color: muted, transition: "all .15s",
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center",
                    padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                    letterSpacing: ".2px", border: "1px solid",
                    ...(cat.type === "brand"
                      ? { background: "rgba(59,130,246,0.1)", borderColor: "rgba(59,130,246,0.28)", color: dark ? "#93c5fd" : "#1d4ed8" }
                      : { background: "rgba(168,85,247,0.1)", borderColor: "rgba(168,85,247,0.28)", color: dark ? "#d8b4fe" : "#7c3aed" }
                    ),
                  }}>
                    {cat.type === "brand" ? "Brand" : "Template"}
                  </span>
                  <span style={{
                    fontSize: 11, color: muted, fontFamily: "monospace",
                    background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                    padding: "2px 8px", borderRadius: 5,
                  }}>
                    /{cat.slug}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div onClick={e => e.target === e.currentTarget && closeModal()} style={{
          position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20, backdropFilter: "blur(4px)",
        }}>
          <div style={{
            background: card, border: `1px solid ${border}`, borderRadius: 16, padding: 28,
            width: "100%", maxWidth: 420, boxShadow: "0 24px 64px rgba(0,0,0,.3)",
          }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 800, color: text, fontFamily: "'Sora',sans-serif", letterSpacing: "-0.3px" }}>
              {editItem ? "Edit Category" : "New Category"}
            </h2>

            <div style={{ marginBottom: 14 }}>
              <span style={lbl}>Name</span>
              <input className="ac-inp" style={inp} type="text"
                placeholder="e.g. Technology" value={form.name} onChange={handleNameChange} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <span style={lbl}>Slug</span>
              <input className="ac-inp"
                style={{ ...inp, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", color: muted, fontSize: 12 }}
                type="text" placeholder="auto-generated" value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <span style={lbl}>Type</span>
              <div style={{ display: "flex", gap: 8 }}>
                {["brand", "template"].map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))} style={{
                    flex: 1, padding: "9px 0", borderRadius: 8,
                    fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans',sans-serif",
                    cursor: "pointer", transition: "all .15s", border: "1.5px solid",
                    ...(form.type === t
                      ? t === "brand"
                        ? { background: "rgba(59,130,246,0.12)", borderColor: "rgba(59,130,246,0.35)", color: dark ? "#93c5fd" : "#1d4ed8" }
                        : { background: "rgba(168,85,247,0.12)", borderColor: "rgba(168,85,247,0.35)", color: dark ? "#d8b4fe" : "#7c3aed" }
                      : { background: inputBg, borderColor: border, color: muted }
                    ),
                  }}>
                    {t === "brand" ? "Brand" : "Template"}
                  </button>
                ))}
              </div>
            </div>

            {formError && (
              <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {formError}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button className="ac-cancel" onClick={closeModal} style={{
                padding: "8px 16px", background: "none", border: `1.5px solid ${border}`,
                borderRadius: 9, fontSize: 12.5, fontWeight: 600, color: muted,
                cursor: "pointer", transition: "all .15s", fontFamily: "'DM Sans',sans-serif",
              }}>
                Cancel
              </button>
              <button className="ac-save" onClick={handleSave} disabled={saving} style={{
                padding: "8px 20px", background: green, border: "none", borderRadius: 9,
                fontSize: 12.5, fontWeight: 700, color: "#0f1117",
                cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.65 : 1,
                transition: "all .15s", fontFamily: "'DM Sans',sans-serif",
                display: "flex", alignItems: "center", gap: 7,
              }}>
                {saving && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                )}
                {saving ? "Saving…" : editItem ? "Save Changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div onClick={e => e.target === e.currentTarget && setDeleteConfirm(null)} style={{
          position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20, backdropFilter: "blur(4px)",
        }}>
          <div style={{
            background: card, border: `1px solid ${border}`, borderRadius: 16, padding: 28,
            width: "100%", maxWidth: 360, boxShadow: "0 24px 64px rgba(0,0,0,.3)",
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "rgba(239,68,68,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </div>
            <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 800, color: text, fontFamily: "'Sora',sans-serif" }}>
              Delete Category
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: muted, lineHeight: 1.6 }}>
              Are you sure you want to delete{" "}
              <span style={{ color: text, fontWeight: 600 }}>{deleteConfirm.name}</span>?
              {" "}This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="ac-cancel" onClick={() => setDeleteConfirm(null)} style={{
                padding: "8px 16px", background: "none", border: `1.5px solid ${border}`,
                borderRadius: 9, fontSize: 12.5, fontWeight: 600, color: muted,
                cursor: "pointer", transition: "all .15s", fontFamily: "'DM Sans',sans-serif",
              }}>
                Cancel
              </button>
              <button className="ac-del-ok" onClick={() => handleDelete(deleteConfirm.slug)} disabled={deleting} style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "8px 20px", background: "#ef4444", border: "none", borderRadius: 9,
                fontSize: 12.5, fontWeight: 700, color: "#fff",
                cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.6 : 1,
                transition: "all .15s", fontFamily: "'DM Sans',sans-serif",
              }}>
                {deleting && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                )}
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}