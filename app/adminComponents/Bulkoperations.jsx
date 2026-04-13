"use client";

import { useState } from "react";
import { Upload, Download, Trash2, RefreshCw, Tag, BarChart2, FileText, FileJson, FileCode } from "lucide-react";

export default function BulkOperations({ dark }) {
  const [dragging, setDragging] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const bg = dark ? "#0f1117" : "#f8fafc";
  const card = dark ? "#131720" : "#ffffff";
  const border = dark ? "#1e2535" : "#e2e8f0";
  const text = dark ? "#e2e8f0" : "#1e293b";
  const muted = dark ? "#64748b" : "#94a3b8";
  const inputBg = dark ? "#0d1117" : "#f8fafc";
  const green = "#22c55e";
  const greenDim = dark ? "rgba(34,197,94,0.12)" : "rgba(22,163,74,0.08)";
  const redDim = dark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.07)";
  const red = "#ef4444";
  const labelStyle = {
    display: "block", fontSize: 12, fontWeight: 600,
    color: muted, marginBottom: 6,
    fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.3px"
  };
  const selectStyle = {
    flex: 1, padding: "9px 12px",
    background: inputBg, border: `1px solid ${border}`,
    borderRadius: 8, color: text, fontSize: 13,
    fontFamily: "'DM Sans', sans-serif", outline: "none",
    appearance: "none", minWidth: 0,
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setCsvFile(f);
  };

  const startImport = () => {
    if (!csvFile) return;
    setImporting(true); setProgress(0);
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(interval); setImporting(false); return 100; }
        return p + 4;
      });
    }, 80);
  };

  return (
    <div style={{ background: bg, minHeight: "100vh", padding: "28px 24px", fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: text, letterSpacing: "-0.5px" }}>
          Bulk Operations
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: muted }}>
          Import, manage, and export multiple logos at once.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

        {/* Bulk Import */}
        <div style={{ background: card, borderRadius: 12, border: `1px solid ${border}`, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: greenDim, display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <Upload size={14} color={green} />
            </div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: text }}>Bulk Import</h3>
          </div>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: muted }}>
            Upload a CSV file with logo data to import multiple logos at once.
          </p>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragging ? green : border}`,
              borderRadius: 10, padding: "32px 16px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              background: dragging ? greenDim : "transparent",
              cursor: "pointer", transition: "all 0.2s", marginBottom: 14,
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: dark ? "#1e2535" : "#f1f5f9",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <FileText size={20} color={muted} />
            </div>
            {csvFile ? (
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: green }}>{csvFile.name}</p>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: text }}>Drop CSV file here</p>
                <p style={{ margin: 0, fontSize: 12, color: muted }}>Format: name, flag, category, description, colors, tags</p>
              </>
            )}
          </div>

          {/* Progress bar */}
          {importing && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: muted }}>Importing...</span>
                <span style={{ fontSize: 12, color: green, fontWeight: 600 }}>{progress}%</span>
              </div>
              <div style={{ height: 6, background: dark ? "#1e2535" : "#e2e8f0", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${progress}%`,
                  background: "linear-gradient(90deg,#22c55e,#16a34a)",
                  borderRadius: 99, transition: "width 0.1s linear"
                }} />
              </div>
            </div>
          )}
          {!importing && progress === 100 && (
            <div style={{
              padding: "8px 14px", background: greenDim,
              border: `1px solid ${green}44`, borderRadius: 8,
              color: green, fontSize: 12, fontWeight: 600, marginBottom: 14
            }}>
              ✓ Import completed successfully!
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 16px",
              background: "transparent", border: `1px solid ${border}`,
              borderRadius: 8, color: text, fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "'DM Sans', sans-serif"
            }}>
              <Download size={14} /> Download Template CSV
            </button>
            <button
              onClick={startImport}
              disabled={!csvFile || importing}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "9px 18px",
                background: csvFile && !importing ? "linear-gradient(135deg,#22c55e,#16a34a)" : (dark ? "#1e2535" : "#e2e8f0"),
                border: "none", borderRadius: 8,
                color: csvFile && !importing ? "#fff" : muted,
                fontSize: 13, fontWeight: 600,
                cursor: csvFile && !importing ? "pointer" : "not-allowed",
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: csvFile && !importing ? "0 3px 10px rgba(34,197,94,0.3)" : "none",
                transition: "all 0.2s"
              }}>
              <Upload size={14} /> {importing ? "Importing..." : "Start Import"}
            </button>
          </div>
        </div>

        {/* Bulk Actions */}
        <div style={{ background: card, borderRadius: 12, border: `1px solid ${border}`, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: greenDim, display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <RefreshCw size={14} color={green} />
            </div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: text }}>Bulk Actions</h3>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>

            {/* Bulk Status */}
            <div style={{
              background: dark ? "#0d1117" : "#f8fafc",
              borderRadius: 10, border: `1px solid ${border}`,
              padding: 16
            }}>
              <label style={labelStyle}>Bulk Status Change</label>
              <div style={{ display: "flex", gap: 8 }}>
                <select style={selectStyle} value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}>
                  <option value="">Select status</option>
                  <option>Published</option>
                  <option>Draft</option>
                  <option>Archived</option>
                </select>
                <button style={{
                  padding: "9px 16px", flexShrink: 0,
                  background: "linear-gradient(135deg,#22c55e,#16a34a)",
                  border: "none", borderRadius: 8,
                  color: "#fff", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  boxShadow: "0 2px 8px rgba(34,197,94,0.3)"
                }}>Apply</button>
              </div>
            </div>

            {/* Bulk Category */}
            <div style={{
              background: dark ? "#0d1117" : "#f8fafc",
              borderRadius: 10, border: `1px solid ${border}`,
              padding: 16
            }}>
              <label style={labelStyle}>Bulk Category Assign</label>
              <div style={{ display: "flex", gap: 8 }}>
                <select style={selectStyle} value={bulkCategory} onChange={e => setBulkCategory(e.target.value)}>
                  <option value="">Select category</option>
                  <option>Technology</option>
                  <option>Finance</option>
                  <option>Media</option>
                  <option>Healthcare</option>
                </select>
                <button style={{
                  padding: "9px 16px", flexShrink: 0,
                  background: "linear-gradient(135deg,#22c55e,#16a34a)",
                  border: "none", borderRadius: 8,
                  color: "#fff", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  boxShadow: "0 2px 8px rgba(34,197,94,0.3)"
                }}>Apply</button>
              </div>
            </div>

            {/* Bulk SEO */}
            <div style={{
              background: dark ? "#0d1117" : "#f8fafc",
              borderRadius: 10, border: `1px solid ${border}`,
              padding: 16
            }}>
              <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: text }}>Bulk SEO Update</p>
              <p style={{ margin: "0 0 10px", fontSize: 12, color: muted }}>Auto-generate meta titles & descriptions</p>
              <button style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px",
                background: greenDim, border: `1px solid ${green}44`,
                borderRadius: 8, color: green,
                fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif"
              }}>
                <RefreshCw size={13} /> Generate SEO for All
              </button>
            </div>

            {/* Bulk Delete */}
            <div style={{
              background: dark ? "#0d1117" : "#f8fafc",
              borderRadius: 10, border: `1px solid ${border}`,
              padding: 16
            }}>
              <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: text }}>Bulk Delete</p>
              <p style={{ margin: "0 0 10px", fontSize: 12, color: muted }}>Delete selected or filtered logos</p>
              <button style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px",
                background: redDim, border: `1px solid ${red}44`,
                borderRadius: 8, color: red,
                fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif"
              }}>
                <Trash2 size={13} /> Delete Selected
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Export */}
        <div style={{ background: card, borderRadius: 12, border: `1px solid ${border}`, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: greenDim, display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <Download size={14} color={green} />
            </div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: text }}>Bulk Export</h3>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { label: "Export as CSV", icon: FileText, color: "#22c55e" },
              { label: "Export as JSON", icon: FileJson, color: "#3b82f6" },
              { label: "Export as XML", icon: FileCode, color: "#a855f7" },
            ].map(({ label, icon: Icon, color }) => (
              <button key={label} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "9px 18px",
                background: "transparent",
                border: `1px solid ${border}`,
                borderRadius: 8, color: text,
                fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                transition: "all 0.15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.color = text; }}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}