"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, Plus, X, Globe, BarChart2, RefreshCw, Tag, Loader2 } from "lucide-react";

const COLORS_INIT = ["#3B82F6", "#1E3A5F", "#FBFAFC"];

const CATEGORIES = [
  "Technology", "Social Media", "Sports", "Automotive",
  "Food & Beverage", "Fashion", "Finance", "Entertainment",
  "Gaming", "Airline", "E-commerce",
];

function toSlug(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function FileIcon() {
  const c = "#f59e0b";
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 8,
      background: c + "22", border: `1px solid ${c}44`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 10, fontWeight: 800, color: c,
      fontFamily: "'DM Sans', sans-serif", flexShrink: 0,
    }}>ZIP</div>
  );
}

export default function UploadLogo({ dark }) {
  const fileInputRef = useRef(null);
  const tagInputRef = useRef(null);
  const nameDebounceRef = useRef(null);

  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState([]);
  const [colors, setColors] = useState(COLORS_INIT);
  const [newColor, setNewColor] = useState("#ffffff");

  // ── Tags ─────────────────────────────────────────────────────────
  const [availableTags, setAvailableTags] = useState([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [selectedTags, setSelectedTags] = useState([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const [tagError, setTagError] = useState("");

  const [publishStatus, setPublishStatus] = useState("Draft");
  const [slugEdited, setSlugEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  const [dlCount, setDlCount] = useState(100);
  const [dlUnlimited, setDlUnlimited] = useState(false);

  // ── Logo name AI suggestion ─────────────────────────────────────
  const [nameSuggestion, setNameSuggestion] = useState(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const [form, setForm] = useState({
    logoName: "", slug: "", brand: "", website: "",
    category: "", industry: "", country: "",
    license: "", description: "", history: "",
    metaTitle: "", metaDescription: "", altText: "",
    focusKeywords: "",
  });

  // ── Fetch available tags once on mount ───────────────────────────
  useEffect(() => {
    async function loadTags() {
      setTagsLoading(true);
      try {
        const res = await fetch("/api/admin/tags");
        const data = await res.json();
        setAvailableTags(Array.isArray(data.tags) ? data.tags : []);
      } catch {
        setAvailableTags([]);
      } finally {
        setTagsLoading(false);
      }
    }
    loadTags();
  }, []);

  // ── Debounced AI name suggestion (2s after typing stops) ─────────
  useEffect(() => {
    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);

    const name = form.logoName.trim();

    if (name.length < 2) {
      setNameSuggestion(null);
      return;
    }

    nameDebounceRef.current = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const res = await fetch("/api/logo/suggest-name", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            logoName: name,
            brand: form.brand,
            category: form.category,
          }),
        });
        const data = await res.json();
        setNameSuggestion(data.suggestion || null);
      } catch {
        setNameSuggestion(null);
      } finally {
        setSuggestLoading(false);
      }
    }, 2000);

    return () => clearTimeout(nameDebounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.logoName]);

  // ── theme tokens ─────────────────────────────────────────────────
  const bg       = dark ? "#0f1117" : "#FFFFFF";
  const card     = dark ? "#131720" : "#ffffff";
  const border   = dark ? "#1e2535" : "#e2e8f0";
  const text     = dark ? "#e2e8f0" : "#1e293b";
  const muted    = dark ? "#64748b" : "#94a3b8";
  const inputBg  = dark ? "#0d1117" : "#FFFFFF";
  const inputBdr = dark ? "#1e2535" : "#e2e8f0";
  const labelClr = dark ? "#94a3b8" : "#475569";
  const green    = "#22c55e";
  const greenDim = dark ? "rgba(34,197,94,0.12)" : "rgba(22,163,74,0.08)";
  const tagBg    = dark ? "#1a2235" : "#f1f5f9";
  const tagBdr   = dark ? "#263047" : "#e2e8f0";

  const inputStyle = {
    width: "100%", padding: "9px 12px",
    background: inputBg, border: `1px solid ${inputBdr}`,
    borderRadius: 8, color: text, fontSize: 13,
    fontFamily: "'DM Sans', sans-serif",
    outline: "none", boxSizing: "border-box",
    transition: "border-color 0.15s",
  };
  const labelStyle = {
    display: "block", fontSize: 12, fontWeight: 600,
    color: labelClr, marginBottom: 5,
    fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.3px",
  };
  const rowStyle = { display: "flex", gap: 14, flexWrap: "wrap" };
  const colStyle = { flex: 1, minWidth: 200 };

  // ── field helpers ─────────────────────────────────────────────────
  const setField = (key) => (e) => {
    const val = e.target.value;
    setForm(prev => {
      const next = { ...prev, [key]: val };
      if (key === "logoName" && !slugEdited) next.slug = toSlug(val);
      return next;
    });
  };

  const handleSlugChange = (e) => {
    setSlugEdited(true);
    setForm(prev => ({ ...prev, slug: toSlug(e.target.value) }));
  };

  const regenerateSlug = () => {
    setSlugEdited(false);
    setForm(prev => ({ ...prev, slug: toSlug(prev.logoName) }));
  };

  // ── accept AI name suggestion ─────────────────────────────────────
  const acceptSuggestion = () => {
    if (!nameSuggestion) return;
    setForm(prev => {
      const next = { ...prev, logoName: nameSuggestion };
      if (!slugEdited) next.slug = toSlug(nameSuggestion);
      return next;
    });
    setNameSuggestion(null);
  };

  // ── file handling ─────────────────────────────────────────────────
  const addFiles = (fileList) => {
    const valid = [];
    let rejected = false;
    Array.from(fileList).forEach(f => {
      const isZip =
        f.type === "application/zip" ||
        f.type === "application/x-zip-compressed" ||
        f.name.toLowerCase().endsWith(".zip");
      if (!isZip) { rejected = true; return; }
      valid.push({ file: f, id: Math.random().toString(36).slice(2) });
    });
    if (rejected) setSubmitResult({ ok: false, message: "Only ZIP files are accepted." });
    else setSubmitResult(null);
    if (valid.length) setFiles(prev => [...prev, ...valid]);
  };

  const handleDrop = (e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); };
  const handleBrowse = (e) => { addFiles(e.target.files); e.target.value = ""; };
  const removeFile = (id) => setFiles(prev => prev.filter(x => x.id !== id));

  // ── tag toggle ────────────────────────────────────────────────────
  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // ── create new tag inline ─────────────────────────────────────────
  const handleCreateTag = async () => {
    const trimmed = newTagInput.trim();
    if (!trimmed) return;

    // duplicate check
    if (availableTags.map(t => t.toLowerCase()).includes(trimmed.toLowerCase())) {
      setTagError("Tag already exists.");
      setTimeout(() => setTagError(""), 2000);
      // just select it if not selected
      const existing = availableTags.find(t => t.toLowerCase() === trimmed.toLowerCase());
      if (existing && !selectedTags.includes(existing)) toggleTag(existing);
      setNewTagInput("");
      return;
    }

    setCreatingTag(true);
    setTagError("");
    try {
      const res = await fetch("/api/admin/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create tag");

      // data.tags is the full updated list from the server
      const updated = data.tags ?? [...availableTags, trimmed];
      setAvailableTags(updated);
      // auto-select the new tag
      setSelectedTags(prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
      setNewTagInput("");
      tagInputRef.current?.focus();
    } catch (err) {
      setTagError(err.message);
      setTimeout(() => setTagError(""), 3000);
    } finally {
      setCreatingTag(false);
    }
  };

  const handleTagKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); handleCreateTag(); }
  };

  // ── colors ────────────────────────────────────────────────────────
  const removeColor = (c) => setColors(p => p.filter(x => x !== c));
  const addColor = () => { if (!colors.includes(newColor)) setColors(p => [...p, newColor]); };

  // ── submit ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.logoName.trim())    return setSubmitResult({ ok: false, message: "Logo Name is required." });
    if (!form.slug.trim())        return setSubmitResult({ ok: false, message: "Slug is required." });
    if (!form.category)           return setSubmitResult({ ok: false, message: "Category is required." });
    if (files.length === 0)       return setSubmitResult({ ok: false, message: "Please upload at least one ZIP file." });

    setSubmitting(true);
    setSubmitResult(null);

    try {
      const fd = new FormData();
      files.forEach(({ file }) => fd.append("files", file));
      fd.append("logoName",        form.logoName.trim());
      fd.append("slug",            form.slug.trim());
      fd.append("brand",           form.brand);
      fd.append("website",         form.website);
      fd.append("category",        form.category);
      fd.append("industry",        form.industry);
      fd.append("country",         form.country);
      fd.append("license",         form.license);
      fd.append("description",     form.description);
      fd.append("history",         form.history);
      fd.append("tags",            JSON.stringify(selectedTags));
      fd.append("brandColors",     JSON.stringify(colors));
      fd.append("metaTitle",       form.metaTitle);
      fd.append("metaDescription", form.metaDescription);
      fd.append("publishStatus",   publishStatus);
      fd.append("downloadCount",   dlUnlimited ? "unlimited" : String(dlCount));

      const res  = await fetch("/api/logo/upload/single", { method: "POST", body: fd });
      const data = await res.json();

      if (res.ok) {
        setSubmitResult({ ok: true, message: data.message || "Logo uploaded successfully!" });
        setForm({
          logoName: "", slug: "", brand: "", website: "",
          category: "", industry: "", country: "",
          license: "", description: "", history: "",
          metaTitle: "", metaDescription: ""
        });
        setFiles([]);
        setSelectedTags([]);
        setColors(COLORS_INIT);
        setPublishStatus("Draft");
        setSlugEdited(false);
        setDlCount(0);
        setDlUnlimited(false);
        setNameSuggestion(null);
      } else {
        setSubmitResult({ ok: false, message: data.error || "Upload failed." });
      }
    } catch (err) {
      setSubmitResult({ ok: false, message: "Network error: " + err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Toggle ────────────────────────────────────────────────────────
  const Toggle = ({ on, toggle, label }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div onClick={toggle} style={{
        width: 36, height: 20, borderRadius: 99,
        background: on ? green : (dark ? "#1e2535" : "#cbd5e1"),
        cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}>
        <div style={{
          position: "absolute", top: 2, left: on ? 18 : 2,
          width: 16, height: 16, borderRadius: "50%",
          background: "#fff", transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }} />
      </div>
      {label && <span style={{ fontSize: 12, color: on ? green : muted, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{label}</span>}
    </div>
  );

  return (
    <div style={{ background: bg, minHeight: "100vh", padding: "28px 24px", fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: text, letterSpacing: "-0.5px" }}>Upload Logo</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: muted }}>Add a new logo with metadata, SEO settings and publish controls.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── Drop zone ── */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragging ? green : border}`,
            borderRadius: 12,
            padding: files.length > 0 ? "18px 20px" : "36px 20px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            background: dragging ? greenDim : card, transition: "all 0.2s",
          }}
        >
          {files.length === 0 ? (
            <>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: greenDim, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                <Upload size={22} color={green} />
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: text }}>Drag & drop ZIP file here</p>
              <p style={{ margin: 0, fontSize: 12, color: muted }}>Only ZIP files accepted (Max 50MB each)</p>
            </>
          ) : (
            <div style={{ width: "100%", display: "flex", flexWrap: "wrap", gap: 10 }}>
              {files.map(({ id, file }) => (
                <div key={id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: dark ? "#0d1117" : "#f1f5f9",
                  border: `1px solid ${border}`, borderRadius: 10,
                  padding: "8px 10px", flex: "1 1 180px", maxWidth: 260,
                }}>
                  <FileIcon />
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: muted }}>{(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button onClick={() => removeFile(id)} style={{ background: dark ? "#1e2535" : "#e2e8f0", border: "none", borderRadius: 6, width: 22, height: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: muted, flexShrink: 0 }}>
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input ref={fileInputRef} type="file" multiple accept=".zip,application/zip,application/x-zip-compressed" style={{ display: "none" }} onChange={handleBrowse} />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ marginTop: files.length > 0 ? 4 : 8, padding: "8px 18px", background: "transparent", border: `1px solid ${border}`, borderRadius: 8, color: text, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            {files.length > 0 ? "+ Add More ZIP Files" : "Browse Files"}
          </button>
        </div>

        {/* ── Basic Info ── */}
        <div style={{ background: card, borderRadius: 12, border: `1px solid ${border}`, padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: text }}>Basic Information</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            <div style={rowStyle}>
              <div style={colStyle}>
                <label style={labelStyle}>Logo Name <span style={{ color: green }}>*</span></label>
                <input style={inputStyle} placeholder="e.g. Nike" value={form.logoName} onChange={setField("logoName")} />

                {suggestLoading && (
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: muted, display: "flex", alignItems: "center", gap: 5 }}>
                    <Loader2 size={11} style={{ animation: "spin 0.8s linear infinite" }} />
                    Checking name…
                  </p>
                )}

                {!suggestLoading && nameSuggestion && (
                  <button
                    onClick={acceptSuggestion}
                    style={{
                      marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6,
                      background: greenDim, border: `1px solid ${green}44`,
                      borderRadius: 99, padding: "5px 12px",
                      color: green, fontSize: 12, fontWeight: 600,
                      cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                     Use "{nameSuggestion}"
                  </button>
                )}
              </div>
              <div style={colStyle}>
                <label style={labelStyle}>
                  Slug
                  <span style={{ marginLeft: 6, fontSize: 11, color: muted, fontWeight: 400 }}>auto-generated</span>
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: muted, pointerEvents: "none", userSelect: "none" }}>/</span>
                  <input style={{ ...inputStyle, paddingLeft: 20, paddingRight: 36 }} placeholder="nike" value={form.slug} onChange={handleSlugChange} />
                  <button onClick={regenerateSlug} title="Re-generate from Logo Name" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: slugEdited ? green : muted, padding: 0, display: "flex" }}>
                    <RefreshCw size={13} />
                  </button>
                </div>
              </div>
            </div>

            <div style={rowStyle}>
              <div style={colStyle}>
                <label style={labelStyle}>Brand / Company</label>
                <input style={inputStyle} placeholder="Company name" value={form.brand} onChange={setField("brand")} />
              </div>
              <div style={colStyle}>
                <label style={labelStyle}>Website</label>
                <input style={inputStyle} placeholder="https://..." value={form.website} onChange={setField("website")} />
              </div>
            </div>

            <div style={rowStyle}>
              <div style={colStyle}>
                <label style={labelStyle}>Category <span style={{ color: green }}>*</span></label>
                <select style={{ ...inputStyle, appearance: "none" }} value={form.category} onChange={setField("category")}>
                  <option value="">Select category</option>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div style={colStyle}>
                <label style={labelStyle}>Industry</label>
                <input style={inputStyle} placeholder="e.g. Software, Banking" value={form.industry} onChange={setField("industry")} />
              </div>
            </div>

            <div style={rowStyle}>
              <div style={colStyle}>
                <label style={labelStyle}>Country</label>
                <input style={inputStyle} placeholder="e.g. United States" value={form.country} onChange={setField("country")} />
              </div>
              <div style={{ ...colStyle, maxWidth: "50%" }}>
                <label style={labelStyle}>License</label>
                <select style={{ ...inputStyle, appearance: "none" }} value={form.license} onChange={setField("license")}>
                  <option value="">Select license</option>
                  <option>Educational</option><option>Reference & Design Use Only </option>
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Description <span style={{ color: green }}></span></label>
              <textarea style={{ ...inputStyle, minHeight: 90, resize: "vertical" }} placeholder="Detailed description of the logo and brand..." value={form.description} onChange={setField("description")} />
            </div>
            <div>
              <label style={labelStyle}>Logo History / About</label>
              <textarea style={{ ...inputStyle, minHeight: 90, resize: "vertical" }} placeholder="Write detailed history about this logo and brand evolution..." value={form.history} onChange={setField("history")} />
            </div>
          </div>
        </div>

        {/* ── Download Counter ── */}
        <div style={{ background: card, borderRadius: 12, border: `1px solid ${border}`, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <BarChart2 size={16} color={green} />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: text }}>Download Counter</h3>
          </div>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: muted }}>
            Set the visible download count shown on the logo page.
          </p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={labelStyle}>Download Count</label>
              <input
                type="number" min={0}
                value={dlUnlimited ? "" : dlCount}
                placeholder={dlUnlimited ? "Unlimited" : "0"}
                disabled={dlUnlimited}
                onChange={e => setDlCount(Math.max(0, Number(e.target.value)))}
                style={{
                  ...inputStyle,
                  background: dlUnlimited ? (dark ? "#0a0d12" : "#e8ecf0") : inputBg,
                  color: dlUnlimited ? muted : text,
                  cursor: dlUnlimited ? "not-allowed" : "text",
                  MozAppearance: "textfield",
                }}
              />
            </div>
            <div style={{ paddingBottom: 10 }}>
              <Toggle on={dlUnlimited} toggle={() => setDlUnlimited(p => !p)} label="Unlimited" />
            </div>
          </div>
          <div style={{
            marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6,
            background: greenDim, border: `1px solid ${green}33`,
            borderRadius: 99, padding: "5px 14px",
          }}>
            <BarChart2 size={12} color={green} />
            <span style={{ fontSize: 12, fontWeight: 700, color: green, fontFamily: "'DM Sans', sans-serif" }}>
              {dlUnlimited ? "Unlimited" : dlCount.toLocaleString()} downloads
            </span>
          </div>
        </div>

        {/* ── Brand Colors ── */}
        <div style={{ background: card, borderRadius: 12, border: `1px solid ${border}`, padding: 20 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: text }}>Brand Colors</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {colors.map(c => (
              <div key={c} style={{ display: "flex", alignItems: "center", gap: 5, background: dark ? "#1e2535" : "#f1f5f9", borderRadius: 99, padding: "4px 10px 4px 6px", border: `1px solid ${border}` }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: c, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: text, fontWeight: 500 }}>{c}</span>
                <button onClick={() => removeColor(c)} style={{ background: "none", border: "none", cursor: "pointer", color: muted, padding: 0, display: "flex" }}><X size={12} /></button>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} style={{ width: 28, height: 28, border: "none", borderRadius: 6, cursor: "pointer", background: "none" }} />
              <button onClick={addColor} style={{ display: "flex", alignItems: "center", gap: 4, background: greenDim, border: `1px solid ${green}44`, borderRadius: 99, padding: "4px 12px", color: green, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                <Plus size={12} /> Add Color
              </button>
            </div>
          </div>
        </div>

        {/* ── Tags ── */}
        <div style={{ background: card, borderRadius: 12, border: `1px solid ${border}`, padding: 20 }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: greenDim, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Tag size={13} color={green} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: text }}>Tags</h3>
                <p style={{ margin: 0, fontSize: 11, color: muted }}>
                  {tagsLoading ? "Loading tags..." : `${selectedTags.length} selected · ${availableTags.length} available`}
                </p>
              </div>
            </div>
            {selectedTags.length > 0 && (
              <button
                onClick={() => setSelectedTags([])}
                style={{
                  background: "none", border: `1px solid ${border}`,
                  borderRadius: 7, padding: "4px 10px", cursor: "pointer",
                  fontSize: 11, fontWeight: 600, color: muted,
                  fontFamily: "'DM Sans', sans-serif",
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <X size={10} /> Clear all
              </button>
            )}
          </div>

          {/* ── Create new tag inline ── */}
          <div style={{ marginBottom: 14 }}>
            <div style={{
              display: "flex", gap: 7, alignItems: "center",
            }}>
              <div style={{
                flex: 1, display: "flex", alignItems: "center", gap: 7,
                background: inputBg, border: `1px solid ${tagError ? "#ef4444" : inputBdr}`,
                borderRadius: 8, padding: "0 10px",
                transition: "border-color 0.15s",
              }}>
                <Tag size={12} color={muted} style={{ flexShrink: 0 }} />
                <input
                  ref={tagInputRef}
                  value={newTagInput}
                  onChange={e => { setNewTagInput(e.target.value); setTagError(""); }}
                  onKeyDown={handleTagKeyDown}
                  placeholder="Type a new tag and press Enter or click Add…"
                  maxLength={40}
                  disabled={creatingTag}
                  style={{
                    flex: 1, background: "none", border: "none", outline: "none",
                    fontSize: 12, color: text, fontFamily: "'DM Sans', sans-serif",
                    padding: "8px 0",
                  }}
                />
                {newTagInput && (
                  <button
                    onClick={() => setNewTagInput("")}
                    style={{ background: "none", border: "none", cursor: "pointer", color: muted, padding: 0, display: "flex", flexShrink: 0 }}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
              <button
                onClick={handleCreateTag}
                disabled={creatingTag || !newTagInput.trim()}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "0 14px", height: 36, borderRadius: 8,
                  border: "none", cursor: creatingTag || !newTagInput.trim() ? "not-allowed" : "pointer",
                  background: creatingTag || !newTagInput.trim()
                    ? (dark ? "#1e2535" : "#e2e8f0")
                    : `linear-gradient(135deg, #22c55e, #16a34a)`,
                  color: creatingTag || !newTagInput.trim() ? muted : "#fff",
                  fontSize: 12, fontWeight: 700,
                  fontFamily: "'DM Sans', sans-serif",
                  flexShrink: 0,
                  transition: "all 0.15s",
                  boxShadow: creatingTag || !newTagInput.trim() ? "none" : "0 2px 8px rgba(34,197,94,0.3)",
                }}
              >
                {creatingTag
                  ? <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} />
                  : <Plus size={12} />}
                {creatingTag ? "Adding…" : "Add Tag"}
              </button>
            </div>

            {/* inline error */}
            {tagError && (
              <p style={{ margin: "5px 0 0 2px", fontSize: 11, color: "#ef4444", fontFamily: "'DM Sans', sans-serif" }}>
                ⚠ {tagError}
              </p>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: border, marginBottom: 12 }} />

          {/* Existing tags — selectable pills */}
          {tagsLoading ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} style={{
                  height: 30, width: 60 + (i % 4) * 18, borderRadius: 99,
                  background: dark ? "#1e2535" : "#e2e8f0",
                  animation: "shimmer 1.4s ease-in-out infinite",
                  animationDelay: `${i * 0.07}s`,
                }} />
              ))}
            </div>
          ) : availableTags.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: muted, fontSize: 12 }}>
              <p style={{ margin: 0, fontWeight: 600, color: text, fontSize: 13 }}>No tags yet</p>
              <p style={{ margin: "4px 0 0" }}>Create your first tag using the input above.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {availableTags.map(tag => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "5px 12px", borderRadius: 99,
                      border: `1px solid ${active ? green + "66" : tagBdr}`,
                      background: active ? greenDim : tagBg,
                      color: active ? green : text,
                      fontSize: 12, fontWeight: active ? 700 : 500,
                      cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                      transition: "all 0.15s", outline: "none",
                    }}
                  >
                    {active && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 3" stroke="#22c55e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {tag}
                  </button>
                );
              })}
            </div>
          )}

          {/* Selected preview strip */}
          {selectedTags.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${border}` }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Selected ({selectedTags.length})
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {selectedTags.map(tag => (
                  <span key={tag} style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    background: greenDim, border: `1px solid ${green}44`,
                    borderRadius: 99, padding: "3px 10px",
                    color: green, fontSize: 12, fontWeight: 600,
                    fontFamily: "'DM Sans', sans-serif",
                  }}>
                    {tag}
                    <button
                      onClick={() => toggleTag(tag)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: green, padding: 0, display: "flex", alignItems: "center" }}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── SEO Settings ── */}
        <div style={{ background: card, borderRadius: 12, border: `1px solid ${border}`, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Globe size={16} color={green} />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: text }}>SEO Settings</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>Meta Title</label>
              <input style={inputStyle} placeholder="Download TechNova Logo in AI, CDR, SVG, PNG" value={form.metaTitle} onChange={setField("metaTitle")} />
              <p style={{ margin: "4px 0 0", fontSize: 11, color: muted }}>Recommended: 50–60 characters</p>
            </div>
            <div>
              <label style={labelStyle}>Meta Description</label>
              <textarea style={{ ...inputStyle, minHeight: 72, resize: "vertical" }} placeholder="Free download TechNova logo vector..." value={form.metaDescription} onChange={setField("metaDescription")} />
              <p style={{ margin: "4px 0 0", fontSize: 11, color: muted }}>Recommended: 150–160 characters</p>
            </div>
            
            
          </div>
        </div>            

        {/* ── Publish Status ── */}
        <div style={{ background: card, borderRadius: 12, border: `1px solid ${border}`, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: text }}>Publish Status</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: muted }}>Set as draft to review before publishing</p>
            </div>
            <select value={publishStatus} onChange={e => setPublishStatus(e.target.value)} style={{ ...inputStyle, width: "auto", minWidth: 120 }}>
              <option>Draft</option><option>Published</option>
            </select>
          </div>
        </div>

        {/* ── Result banner ── */}
        {submitResult && (
          <div style={{
            padding: "11px 16px",
            background: submitResult.ok ? greenDim : "rgba(239,68,68,0.1)",
            border: `1px solid ${submitResult.ok ? green + "44" : "#ef444444"}`,
            borderRadius: 10, color: submitResult.ok ? green : "#ef4444",
            fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
          }}>
            {submitResult.ok ? "✓ " : "✕ "}{submitResult.message}
          </div>
        )}

        {/* ── Submit ── */}
        <div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              minWidth: 160, padding: "12px 24px",
              background: submitting ? (dark ? "#1e2535" : "#e2e8f0") : "linear-gradient(135deg,#22c55e,#16a34a)",
              border: "none", borderRadius: 10,
              color: submitting ? muted : "#fff",
              fontSize: 14, fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans', sans-serif",
              boxShadow: submitting ? "none" : "0 4px 14px rgba(34,197,94,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              transition: "all 0.2s",
            }}>
            {submitting ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.8s linear infinite" }}>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
                Uploading...
              </>
            ) : (
              <><Upload size={15} /> Save & Publish</>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.9; } }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
    </div>
  );
}