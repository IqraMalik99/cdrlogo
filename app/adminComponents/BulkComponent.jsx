"use client";

import { useState, useRef ,useEffect } from "react";
import { Upload, X, BarChart2, Globe, CheckCircle, XCircle, Loader2, Package } from "lucide-react";

const COLORS_INIT = ["#3B82F6", "#1E3A5F", "#FBFAFC"];


export default function BulkUploadLogo({ dark }) {
  const fileInputRef = useRef(null);

  const [dragging, setDragging]     = useState(false);
  const [wrapperFile, setWrapperFile] = useState(null);

  const [category,      setCategory]      = useState("");
  const [license,       setLicense]       = useState("");
  const [publishStatus, setPublishStatus] = useState("Draft");
  const [dlCount,       setDlCount]       = useState(100);
  const [dlUnlimited,   setDlUnlimited]   = useState(false);
  const [colors,        setColors]        = useState(COLORS_INIT);

  const [submitting,   setSubmitting]   = useState(false);
  const [submitResult, setSubmitResult] = useState(null); 
  // { ok, message, results, successCount, failCount, total }

  // ── Categories (live from API) ────────────────────────────────
  const [categories, setCategories] = useState([]);
  const [isTemplate, setIsTemplate] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch("/api/catageory/home");
        const data = await res.json();
        if (data?.success) {
          setCategories([...data.data]);
        }
      } catch (err) {
        console.error("Failed to load categories", err);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    setCategory(isTemplate ? "template" : "");
  }, [isTemplate]);

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

  const inputStyle = {
    width: "100%", padding: "9px 12px",
    background: inputBg, border: `1px solid ${inputBdr}`,
    borderRadius: 8, color: text, fontSize: 13,
    fontFamily: "'DM Sans', sans-serif",
    outline: "none", boxSizing: "border-box",
  };
  const labelStyle = {
    display: "block", fontSize: 12, fontWeight: 600,
    color: labelClr, marginBottom: 5,
    fontFamily: "'DM Sans', sans-serif",
  };

  // ── Toggle ────────────────────────────────────────────────────────
  const Toggle = ({ on, toggle, label }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div onClick={toggle} style={{
        width: 36, height: 20, borderRadius: 99,
        background: on ? green : (dark ? "#1e2535" : "#cbd5e1"),
        cursor: "pointer", position: "relative", transition: "background 0.2s",
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

  // ── file drop/browse ──────────────────────────────────────────────
  const handleFile = (f) => {
    if (!f) return;
    const isZip =
      f.type === "application/zip" ||
      f.type === "application/x-zip-compressed" ||
      f.name.toLowerCase().endsWith(".zip");
    if (!isZip) {
      setSubmitResult({ ok: false, message: "Only a ZIP file is accepted as the wrapper." });
      return;
    }
    setSubmitResult(null);
    setWrapperFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };
  const handleBrowse = (e) => { handleFile(e.target.files[0]); e.target.value = ""; };

  // ── submit ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!wrapperFile) return setSubmitResult({ ok: false, message: "Please upload a wrapper ZIP file." });
 

    setSubmitting(true);
    setSubmitResult(null);

    try {
      const fd = new FormData();
      fd.append("file",          wrapperFile);
      fd.append("category",      category);
      fd.append("license",       license);
      fd.append("publishStatus", publishStatus);
      fd.append("downloadCount", dlUnlimited ? "unlimited" : String(dlCount));
      fd.append("brandColors",   JSON.stringify(colors));

      const res  = await fetch("/api/logo/upload/bulk", { method: "POST", body: fd });
      const data = await res.json();

      if (res.ok) {
        setSubmitResult({
          ok: true,
          message: data.message,
          results: data.results || [],
          successCount: data.successCount,
          failCount: data.failCount,
          total: data.total      
        });
          setIsTemplate(false);
        setWrapperFile(null);
      } else {
        setSubmitResult({ ok: false, message: data.error || "Bulk upload failed." });
      }
    } catch (err) {
      setSubmitResult({ ok: false, message: "Network error: " + err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ background: bg, minHeight: "100vh", padding: "28px 24px", fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: greenDim, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Package size={16} color={green} />
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: text, letterSpacing: "-0.5px" }}>Bulk Upload Logos</h1>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: muted }}>
          Upload a single wrapper ZIP containing multiple logo ZIPs. Each inner folder has different format becomes one logo — name and SEO are auto-generated by AI.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── How it works ── */}
        <div style={{
          background: dark ? "#0d1117" : "#f8fafc",
          border: `1px solid ${border}`, borderRadius: 12, padding: "14px 18px",
          display: "flex", gap: 24, flexWrap: "wrap",
        }}>
          {[
            { step: "1", label: "Wrapper ZIP", desc: "One ZIP containing all your logo ZIPs" },
            { step: "2", label: "Inner Folder",  desc: "Each Folder = one logo (name from filename)" },
            { step: "3", label: "AI generates", desc: "Slug, meta title, description, tags — auto" },
          ].map(({ step, label, desc }) => (
            <div key={step} style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: "1 1 160px" }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%",
                background: greenDim, border: `1px solid ${green}44`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800, color: green, flexShrink: 0, marginTop: 1,
              }}>{step}</div>
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: text }}>{label}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: muted }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Drop zone ── */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragging ? green : border}`,
            borderRadius: 12,
            padding: wrapperFile ? "18px 20px" : "40px 20px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            background: dragging ? greenDim : card, transition: "all 0.2s",
          }}
        >
          {wrapperFile ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              background: dark ? "#0d1117" : "#f1f5f9",
              border: `1px solid ${border}`, borderRadius: 10,
              padding: "12px 16px", width: "100%", maxWidth: 400,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: greenDim, border: `1px solid ${green}44`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 800, color: green, flexShrink: 0,
              }}>ZIP</div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {wrapperFile.name}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: muted }}>
                  {(wrapperFile.size / (1024 * 1024)).toFixed(2)} MB · Wrapper ZIP
                </p>
              </div>
              <button
                onClick={() => setWrapperFile(null)}
                style={{ background: dark ? "#1e2535" : "#e2e8f0", border: "none", borderRadius: 6, width: 26, height: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: muted, flexShrink: 0 }}
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: greenDim, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                <Upload size={24} color={green} />
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: text }}>Drop your wrapper ZIP here</p>
              <p style={{ margin: 0, fontSize: 12, color: muted }}>One ZIP file containing all logo ZIPs inside</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            style={{ display: "none" }}
            onChange={handleBrowse}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              marginTop: wrapperFile ? 4 : 8, padding: "8px 18px",
              background: "transparent", border: `1px solid ${border}`,
              borderRadius: 8, color: text, fontSize: 13, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {wrapperFile ? "Replace ZIP" : "Browse Files"}
          </button>
        </div>

        {/* ── Shared Settings ── */}
        <div style={{ background: card, borderRadius: 12, border: `1px solid ${border}`, padding: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: text }}>
            Shared Settings
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: muted }}>applied to every logo in this batch</span>
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Category + License */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
<div style={{ flex: 1, minWidth: 180 }}>
  <label style={labelStyle}>Category <span style={{ color: green }}>*</span></label>
  <select
    style={{
      ...inputStyle,
      appearance: "none",
      background: isTemplate ? (dark ? "#0a0d12" : "#e8ecf0") : inputBg,
      color: isTemplate ? muted : text,
      cursor: isTemplate ? "not-allowed" : "pointer",
    }}
    value={category}
    onChange={e => setCategory(e.target.value)}
    disabled={isTemplate}
  >
    <option value="">Select category</option>
    {categories.map(c => <option key={c}>{c}</option>)}
  </select>

  <div style={{ marginTop: 8 }}>
    <button
      type="button"
      onClick={() => setIsTemplate(p => !p)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 12px", borderRadius: 99,
        border: `1px solid ${isTemplate ? "#a855f7" + "66" : border}`,
        background: isTemplate ? "rgba(168,85,247,0.12)" : "transparent",
        color: isTemplate ? "#a855f7" : muted,
        fontSize: 12, fontWeight: 700,
        cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
        transition: "all 0.15s",
      }}
    >
      {isTemplate && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5l2.5 2.5L8 3" stroke="#a855f7" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
      Template
    </button>
    {isTemplate && (
      <span style={{ marginLeft: 8, fontSize: 11, color: muted }}>
        Category set to <strong style={{ color: text }}>template</strong>
      </span>
    )}
  </div>
</div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={labelStyle}>License</label>
                <select style={{ ...inputStyle, appearance: "none" }} value={license} onChange={e => setLicense(e.target.value)}>
                  <option value="">Select license</option>
                  <option>Educational</option>
                  <option>Reference & Design Use Only</option>
                </select>
              </div>
            </div>

            {/* Publish Status */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: text }}>Publish Status</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: muted }}>Set as draft to review before publishing</p>
              </div>
              <select
                value={publishStatus}
                onChange={e => setPublishStatus(e.target.value)}
                style={{ ...inputStyle, width: "auto", minWidth: 120 }}
              >
                <option>Draft</option>
                <option>Published</option>
              </select>
            </div>

            {/* Download Counter */}
            <div style={{ paddingTop: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <BarChart2 size={14} color={green} />
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: text }}>Download Counter</p>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={labelStyle}>Count</label>
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
                marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6,
                background: greenDim, border: `1px solid ${green}33`,
                borderRadius: 99, padding: "5px 14px",
              }}>
                <BarChart2 size={12} color={green} />
                <span style={{ fontSize: 12, fontWeight: 700, color: green, fontFamily: "'DM Sans', sans-serif" }}>
                  {dlUnlimited ? "Unlimited" : dlCount.toLocaleString()} downloads per logo
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── AI Notice ── */}
        <div style={{
          background: dark ? "#0d1020" : "#f5f3ff",
          border: `1px solid ${dark ? "#2d2060" : "#c4b5fd"}`,
          borderRadius: 10, padding: "12px 16px",
          display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <Globe size={15} color="#a78bfa" style={{ marginTop: 1, flexShrink: 0 }} />
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: dark ? "#c4b5fd" : "#6d28d9" }}>AI-powered SEO generation</p>
            <p style={{ margin: "3px 0 0", fontSize: 11, color: dark ? "#8b7fd4" : "#7c3aed" }}>
              Each logo gets a unique slug (from ZIP filename), meta title, meta description, description, history, and tags — all generated by GPT-4o-mini. Existing logo variants are auto-versioned (e.g. Nike → Nike V2).
            </p>
          </div>
        </div>

        {/* ── Result Banner ── */}
        {submitResult && (
          <div style={{
            padding: "14px 16px",
            background: submitResult.ok ? greenDim : "rgba(239,68,68,0.1)",
            border: `1px solid ${submitResult.ok ? green + "44" : "#ef444444"}`,
            borderRadius: 10,
          }}>
            <p style={{
              margin: "0 0 (submitResult.results?.length ? 14 : 0)",
              fontSize: 13, fontWeight: 700,
              color: submitResult.ok ? green : "#ef4444",
              fontFamily: "'DM Sans', sans-serif",
            }}>
              {submitResult.ok ? "✓ " : "✕ "}{submitResult.message}
            </p>

            {/* Per-logo results table */}
            {submitResult.results?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                {/* Summary pills */}
                <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  <span style={{ background: greenDim, border: `1px solid ${green}44`, borderRadius: 99, padding: "3px 12px", fontSize: 11, fontWeight: 700, color: green }}>
                    ✓ {submitResult.successCount} uploaded
                  </span>
                  {submitResult.failCount > 0 && (
                    <span style={{ background: "rgba(239,68,68,0.1)", border: "1px solid #ef444444", borderRadius: 99, padding: "3px 12px", fontSize: 11, fontWeight: 700, color: "#ef4444" }}>
                      ✕ {submitResult.failCount} failed
                    </span>
                  )}
                  <span style={{ background: dark ? "#1e2535" : "#f1f5f9", border: `1px solid ${border}`, borderRadius: 99, padding: "3px 12px", fontSize: 11, fontWeight: 600, color: muted }}>
                    {submitResult.total} total
                  </span>
                </div>

                {/* Results list */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                  {submitResult.results.map((r, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      background: dark ? "#0d1117" : "#f8fafc",
                      border: `1px solid ${r.success ? (green + "33") : "#ef444433"}`,
                      borderRadius: 8, padding: "8px 12px",
                    }}>
                      {r.success
                        ? <CheckCircle size={14} color={green} style={{ flexShrink: 0 }} />
                        : <XCircle size={14} color="#ef4444" style={{ flexShrink: 0 }} />
                      }
                      <div style={{ flex: 1, overflow: "hidden" }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: r.success ? text : "#ef4444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.logoName}
                          {r.versioned && (
                            <span style={{ marginLeft: 6, fontSize: 10, color: "#a78bfa", fontWeight: 500 }}>
                              auto-versioned from "{r.originalName}"
                            </span>
                          )}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.success ? `/${r.slug}` : r.error}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Submit ── */}
        <div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              minWidth: 200, padding: "13px 28px",
              background: submitting ? (dark ? "#1e2535" : "#e2e8f0") : "linear-gradient(135deg,#22c55e,#16a34a)",
              border: "none", borderRadius: 10,
              color: submitting ? muted : "#fff",
              fontSize: 14, fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans', sans-serif",
              boxShadow: submitting ? "none" : "0 4px 14px rgba(34,197,94,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.2s",
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} />
                Processing logos…
              </>
            ) : (
              <><Package size={15} /> Start Bulk Upload</>
            )}
          </button>
          {submitting && (
            <p style={{ margin: "10px 0 0", fontSize: 12, color: muted, fontFamily: "'DM Sans', sans-serif" }}>
              Processing sequentially — this may take a while depending on how many logos are in the ZIP.
            </p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
    </div>
  );
}