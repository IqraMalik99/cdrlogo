"use client";

import { useState, useRef } from "react";
import { Upload, X, BarChart2, Globe, CheckCircle, XCircle, Loader2, Package } from "lucide-react";

const COLORS_INIT = ["#3B82F6", "#1E3A5F", "#FBFAFC"];

// ── Safe JSON parsing ──────────────────────────────────────────────
// Prevents "Unexpected token '<', <!DOCTYPE...' is not valid JSON" crashes.
// If the server 500s / crashes before returning JSON (Next.js sends an
// HTML error page in that case), this surfaces a clear, readable error
// instead of a raw JSON-parse exception.
async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      res.ok
        ? "Server returned an unexpected non-JSON response."
        : `Server error (${res.status}): ${text.slice(0, 200)}`
    );
  }
}

export default function BulkUploadLogo({ dark }) {
  const fileInputRef = useRef(null);

  const [dragging, setDragging] = useState(false);
  const [wrapperFile, setWrapperFile] = useState(null);

  const [license, setLicense] = useState("");
  const [publishStatus, setPublishStatus] = useState("Draft");
  const [dlCount, setDlCount] = useState(100);
  const [dlUnlimited, setDlUnlimited] = useState(false);
  const [colors, setColors] = useState(COLORS_INIT);

  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  // { ok, message, results, successCount, failCount, total }

  // Category dropdown removed — category is now empty ("") by default and
  // only becomes "template" when the Template toggle is on. When empty,
  // the backend AI classifies the category automatically.
  const [isTemplate, setIsTemplate] = useState(false);
  const category = isTemplate ? "template" : "";
  const [uploadProgress, setUploadProgress] = useState(0);

  // ── theme tokens ─────────────────────────────────────────────────
  const bg = dark ? "#0f1117" : "#FFFFFF";
  const card = dark ? "#131720" : "#ffffff";
  const border = dark ? "#1e2535" : "#e2e8f0";
  const text = dark ? "#e2e8f0" : "#1e293b";
  const muted = dark ? "#64748b" : "#94a3b8";
  const inputBg = dark ? "#0d1117" : "#FFFFFF";
  const inputBdr = dark ? "#1e2535" : "#e2e8f0";
  const labelClr = dark ? "#94a3b8" : "#475569";
  const green = "#22c55e";
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
      // Step 1: presigned URL
      const presignRes = await fetch("/api/logo/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: wrapperFile.name }),
      });
      const { url, key } = await safeJson(presignRes);
      if (!url) throw new Error("Failed to get upload URL.");

      // Step 2: poora zip ek hi baar R2 pe (direct, Vercel ko touch nahi karta)
      const putRes = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/zip" },
        body: wrapperFile,
      });
      if (!putRes.ok) throw new Error("Direct upload to storage failed.");

      // Step 3: folder list nikalo
      const listRes = await fetch("/api/logo/upload/bulk/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const listData = await safeJson(listRes);
      const folders = listData.folders || [];
      if (folders.length === 0) throw new Error("No logo folders found in ZIP.");

      // Step 4: ek-ek folder process karo — turant screen update
      const allResults = [];
      let successCount = 0, failCount = 0;

      for (let i = 0; i < folders.length; i++) {
        const folderName = folders[i];

        setSubmitResult({
          ok: true,
          message: `Processing ${i + 1}/${folders.length}: ${folderName}...`,
          results: [...allResults],
          successCount,
          failCount,
          total: folders.length,
        });

        // Per-folder isolation: if ONE folder's request crashes/500s/times
        // out, don't let it abort the whole batch — record it as a failed
        // result and move on to the next folder.
        let data;
        try {
          const res = await fetch("/api/logo/upload/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              key,
              folderName,
              category,
              license,
              publishStatus,
              downloadCount: dlUnlimited ? "unlimited" : String(dlCount),
              brandColors: colors,
            }),
          });
          data = await safeJson(res);
          if (!(res.ok && data.success)) {
            data = { ...data, success: false, logoName: data.logoName || folderName };
          }
        } catch (err) {
          data = { success: false, logoName: folderName, error: err.message };
        }

        if (data.success) successCount++;
        else failCount++;

        allResults.push(data);

        // is folder ke result ke saath turant screen update
        setSubmitResult({
          ok: true,
          message: `Processing ${i + 1}/${folders.length}: ${folderName}... done`,
          results: [...allResults],
          successCount,
          failCount,
          total: folders.length,
        });
      }

      setSubmitResult({
        ok: true,
        message: `Bulk upload complete. ${successCount} succeeded, ${failCount} failed.`,
        results: allResults,
        successCount,
        failCount,
        total: folders.length,
      });
      setIsTemplate(false);
      setWrapperFile(null);

    } catch (err) {
      setSubmitResult({ ok: false, message: "Error: " + err.message });
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
            { step: "2", label: "Inner Folder", desc: "Each Folder = one logo (name from filename)" },
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

            {/* Template + License */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={labelStyle}>Type</label>
                <button
                  type="button"
                  onClick={() => setIsTemplate(p => !p)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "8px 14px", borderRadius: 99,
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
                      <path d="M2 5l2.5 2.5L8 3" stroke="#a855f7" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  Template
                </button>
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
              margin: `0 0 ${submitResult.results?.length ? 14 : 0}px`,
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
                        {r.descriptionNeedsDraft && (
                          <p style={{
                            margin: "4px 0 0", fontSize: 11, fontWeight: 700,
                            color: "#f59e0b", display: "flex", alignItems: "center", gap: 5,
                          }}>
                            ⚠ Saved as Draft — no verified facts found, description needs manual review
                          </p>
                        )}
                        {r.needsReview && (
                          <p style={{
                            margin: "4px 0 0", fontSize: 11, fontWeight: 700,
                            color: "#f59e0b", display: "flex", alignItems: "center", gap: 5,
                          }}>
                            ⚠ Needs Review — validation failed after retries, admin must check before publishing
                          </p>
                        )}
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