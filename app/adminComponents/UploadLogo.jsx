
  "use client";

import { useState, useRef } from "react";
import { Upload, Plus, X, Globe, Search } from "lucide-react";

const COLORS_INIT = ["#3B82F6", "#1E3A5F", "#FBFAFC"];
const FILE_ACCEPT = ".ai,.cdr,.svg,.png,.zip,image/svg+xml,image/png,application/zip,application/x-zip-compressed";
const CATEGORIES = [
  "All",
  "Technology",
  "Social Media",
  "Sports",
  "Automotive",
  "Food & Beverage",
  "Fashion",
  "Finance",
  "Entertainment",
  "Gaming",
  "Airline",
  "E-commerce"
];
function filePreviewUrl(file) {
  if (file.type.startsWith("image/")) return URL.createObjectURL(file);
  return null;
}

function FileIcon({ ext }) {
  const colors = { zip: "#f59e0b", ai: "#ff9a00", cdr: "#00b140", svg: "#3b82f6", png: "#a855f7" };
  const c = colors[ext] || "#64748b";
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 8,
      background: c + "22", border: `1px solid ${c}44`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 10, fontWeight: 800, color: c,
      fontFamily: "'DM Sans', sans-serif",
      flexShrink: 0,
    }}>
      {ext.toUpperCase()}
    </div>
  );
}

export default function UploadLogo({ dark }) {
  const fileInputRef = useRef(null);

  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState([]);
  const [colors, setColors] = useState(COLORS_INIT);
  const [newColor, setNewColor] = useState("#ffffff");
  const [tags, setTags] = useState(["Brands", "Technology", "AI"]);
  const [tagInput, setTagInput] = useState("");
  const [publishStatus, setPublishStatus] = useState("Draft");
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  const [form, setForm] = useState({
    logoName: "", brand: "", website: "",
    category: "", industry: "", country: "",
    license: "", description: "", history: "",
    metaTitle: "", metaDescription: "", altText: "",
    focusKeywords: "", canonicalUrl: "", relatedLogos: "",
  });

  const bg = dark ? "#0f1117" : "#f8fafc";
  const card = dark ? "#131720" : "#ffffff";
  const border = dark ? "#1e2535" : "#e2e8f0";
  const text = dark ? "#e2e8f0" : "#1e293b";
  const muted = dark ? "#64748b" : "#94a3b8";
  const inputBg = dark ? "#0d1117" : "#f8fafc";
  const inputBorder = dark ? "#1e2535" : "#e2e8f0";
  const labelColor = dark ? "#94a3b8" : "#475569";
  const green = "#22c55e";
  const greenDim = dark ? "rgba(34,197,94,0.12)" : "rgba(22,163,74,0.08)";

  const inputStyle = {
    width: "100%", padding: "9px 12px",
    background: inputBg, border: `1px solid ${inputBorder}`,
    borderRadius: 8, color: text, fontSize: 13,
    fontFamily: "'DM Sans', sans-serif",
    outline: "none", boxSizing: "border-box",
    transition: "border-color 0.15s",
  };

  const labelStyle = {
    display: "block", fontSize: 12, fontWeight: 600,
    color: labelColor, marginBottom: 5,
    fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.3px"
  };

  const rowStyle = { display: "flex", gap: 14, flexWrap: "wrap" };
  const colStyle = { flex: 1, minWidth: 200 };

  // ✅ ZIP ONLY FILE HANDLING
  const addFiles = (fileList) => {
    const valid = [];

    Array.from(fileList).forEach((f) => {
      const isZip =
        f.type === "application/zip" ||
        f.type === "application/x-zip-compressed" ||
        f.name.toLowerCase().endsWith(".zip");

      if (!isZip) {
        setSubmitResult({ ok: false, message: "Only ZIP files are allowed." });
        return;
      }

      valid.push({
        file: f,
        id: Math.random().toString(36).slice(2),
        preview: null,
        ext: "zip",
      });
    });

    if (valid.length > 0) {
      setFiles(prev => [...prev, ...valid]);
      setSubmitResult(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleBrowse = (e) => {
    addFiles(e.target.files);
    e.target.value = "";
  };

  const removeFile = (id) => {
    setFiles(prev => prev.filter(x => x.id !== id));
  };

  const addTag = (e) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) setTags(prev => [...prev, tagInput.trim()]);
      setTagInput("");
    }
  };

  const removeTag = (t) => setTags(prev => prev.filter(x => x !== t));

  const removeColor = (c) => setColors(prev => prev.filter(x => x !== c));
  const addColor = () => { if (!colors.includes(newColor)) setColors(prev => [...prev, newColor]); };

  const setField = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  // ✅ SUBMIT FIX
  const handleSubmit = async () => {
    if (
      !form.logoName.trim() ||
      !form.category ||
      !form.description.trim() ||
      files.length === 0
    ) {
      setSubmitResult({
        ok: false,
        message: "All required fields + ZIP file are required.",
      });
      return;
    }

    const invalidFile = files.find(({ file }) =>
      !file.name.toLowerCase().endsWith(".zip")
    );

    if (invalidFile) {
      setSubmitResult({
        ok: false,
        message: "Only ZIP files are allowed.",
      });
      return;
    }

    setSubmitting(true);
    setSubmitResult(null);

    try {
      const fd = new FormData();

      files.forEach(({ file }) => fd.append("files", file));
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append("tags", JSON.stringify(tags));
      fd.append("brandColors", JSON.stringify(colors));
      fd.append("publishStatus", publishStatus);

    //   const res = await fetch("/api/logos/upload", {
    //     method: "POST",
    //     body: fd,
    //   });

    //   const data = await res.json();

    //   if (res.ok) {
    //     setSubmitResult({
    //       ok: true,
    //       message: data.message || "Logo uploaded successfully!",
    //     });

    //     setForm({
    //       logoName: "", brand: "", website: "",
    //       category: "", industry: "", country: "",
    //       license: "", description: "", history: "",
    //       metaTitle: "", metaDescription: "", altText: "",
    //       focusKeywords: "", canonicalUrl: "", relatedLogos: "",
    //     });

    //     setFiles([]);
    //     setTags(["Brands", "Technology", "AI"]);
    //     setColors(COLORS_INIT);
    //     setPublishStatus("Draft");

    //   } else {
    //     setSubmitResult({
    //       ok: false,
    //       message: data.error || "Upload failed",
    //     });
    //   }

    } catch (err) {
      setSubmitResult({
        ok: false,
        message: "Network error: " + err.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ background: bg, minHeight: "100vh", padding: "28px 24px", fontFamily: "'DM Sans', sans-serif" }}>
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
            background: dragging ? greenDim : card,
            transition: "all 0.2s",
          }}
        >
          {files.length === 0 ? (
            <>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: greenDim, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                <Upload size={22} color={green} />
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: text }}>Drag & drop logo files here</p>
              <p style={{ margin: 0, fontSize: 12, color: muted }}>Supports AI, CDR, SVG, PNG, ZIP (Max 50MB each)</p>
            </>
          ) : (
            <div style={{ width: "100%", display: "flex", flexWrap: "wrap", gap: 10 }}>
              {files.map(({ id, file, preview, ext }) => (
                <div key={id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: dark ? "#0d1117" : "#f1f5f9",
                  border: `1px solid ${border}`,
                  borderRadius: 10, padding: "8px 10px",
                  flex: "1 1 180px", maxWidth: 240,
                }}>
                  {preview
                    ? <img src={preview} alt={file.name} style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                    : <FileIcon ext={ext} />}
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

          <input ref={fileInputRef} type="file" multiple accept={FILE_ACCEPT} style={{ display: "none" }} onChange={handleBrowse} />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ marginTop: files.length > 0 ? 4 : 8, padding: "8px 18px", background: "transparent", border: `1px solid ${border}`, borderRadius: 8, color: text, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            {files.length > 0 ? "+ Add More Files" : "Browse Files"}
          </button>
        </div>

        {/* ── Basic Info ── */}
        <div style={{ background: card, borderRadius: 12, border: `1px solid ${border}`, padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: text }}>Basic Information</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={rowStyle}>
              <div style={colStyle}>
                <label style={labelStyle}>Logo Name <span style={{ color: green }}>*</span></label>
                <input style={inputStyle} placeholder="e.g. TechNova" value={form.logoName} onChange={setField("logoName")} />
              </div>
              <div style={colStyle}>
                <label style={labelStyle}>Brand / Company</label>
                <input style={inputStyle} placeholder="Company name" value={form.brand} onChange={setField("brand")} />
              </div>
            </div>
            <div style={rowStyle}>
              <div style={colStyle}>
                <label style={labelStyle}>Website</label>
                <input style={inputStyle} placeholder="https://..." value={form.website} onChange={setField("website")} />
              </div>
              <div style={colStyle}>
                <label style={labelStyle}>Category <span style={{ color: green }}>*</span></label>
                <select
  style={{ ...inputStyle, appearance: "none" }}
  value={form.category}
  onChange={setField("category")}
>
  <option value="">Select category</option>

  {CATEGORIES.map((cat) => (
    <option key={cat} value={cat}>
      {cat}
    </option>
  ))}
</select>
              </div>
            </div>
            <div style={rowStyle}>
              <div style={colStyle}>
                <label style={labelStyle}>Industry</label>
                <input style={inputStyle} placeholder="e.g. Software, Banking" value={form.industry} onChange={setField("industry")} />
              </div>
              <div style={colStyle}>
                <label style={labelStyle}>Country</label>
                <input style={inputStyle} placeholder="e.g. United States" value={form.country} onChange={setField("country")} />
              </div>
            </div>
            <div style={{ maxWidth: "50%" }}>
              <label style={labelStyle}>License</label>
              <select style={{ ...inputStyle, appearance: "none" }} value={form.license} onChange={setField("license")}>
                <option value="">Select license</option>
                <option>Free</option><option>CC BY</option><option>Commercial</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Description <span style={{ color: green }}>*</span></label>
              <textarea style={{ ...inputStyle, minHeight: 90, resize: "vertical" }} placeholder="Detailed description of the logo and brand..." value={form.description} onChange={setField("description")} />
            </div>
            <div>
              <label style={labelStyle}>Logo History / About</label>
              <textarea style={{ ...inputStyle, minHeight: 90, resize: "vertical" }} placeholder="Write detailed history about this logo and brand evolution..." value={form.history} onChange={setField("history")} />
            </div>
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
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: text }}>Tags</h3>
          <input style={inputStyle} placeholder="Type a tag and press Enter..." value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={addTag} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {tags.map(t => (
              <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: greenDim, border: `1px solid ${green}44`, borderRadius: 99, padding: "3px 10px", color: green, fontSize: 12, fontWeight: 600 }}>
                {t}
                <button onClick={() => removeTag(t)} style={{ background: "none", border: "none", cursor: "pointer", color: green, padding: 0, display: "flex" }}><X size={11} /></button>
              </span>
            ))}
          </div>
        </div>

        {/* ── Related Logos ── */}
        {/* <div style={{ background: card, borderRadius: 12, border: `1px solid ${border}`, padding: 20 }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: text }}>Related Logos (Internal Linking)</h3>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: muted }}>Link related logos for better SEO internal linking</p>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: muted }} />
            <input style={{ ...inputStyle, paddingLeft: 32 }} placeholder="Search and link related logos..." value={form.relatedLogos} onChange={setField("relatedLogos")} />
          </div>
        </div> */}

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
            <div>
              <label style={labelStyle}>Focus Keywords</label>
              <input style={inputStyle} placeholder="technova logo, technova vector, download technova" value={form.focusKeywords} onChange={setField("focusKeywords")} />
            </div>
            <div>
              <label style={labelStyle}>Alt Text for Images</label>
              <input style={inputStyle} placeholder="TechNova logo vector download free AI CDR SVG PNG" value={form.altText} onChange={setField("altText")} />
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
              <option>Draft</option><option>Published</option><option>Scheduled</option>
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

        {/* ── Submit button ── */}
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}