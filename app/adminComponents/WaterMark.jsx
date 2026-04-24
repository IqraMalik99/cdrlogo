"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sliders, Image as ImageIcon, Save, CheckCircle, AlertCircle, Loader } from "lucide-react";

const POSITIONS = [
  { value: "center",        label: "Center" },
  { value: "top-left",      label: "Top Left" },
  { value: "top-right",     label: "Top Right" },
  { value: "bottom-left",   label: "Bottom Left" },
  { value: "bottom-right",  label: "Bottom Right" },
  { value: "top-center",    label: "Top Center" },
  { value: "bottom-center", label: "Bottom Center" },
];

const DEFAULT_SETTINGS = {
  enabled:  false,
  text:     "CDRLOGO.com",
  position: "center",
  opacity:  30,
  fontSize: 24,
  color:    "#ffffff",
};

// Real image dimensions that sharp will process (matches uploaded PNG approx)
const REAL_W = 1000;
const REAL_H = 1000;

// Canvas display resolution
const CANVAS_W = 500;
const CANVAS_H = 500;

// Scale factor: canvas / real
const SCALE = CANVAS_W / REAL_W;

function getWMPosition(position, W, H, wmW, wmH) {
  const pad = 20;
  return ({
    "center":        { x: (W - wmW) / 2,    y: (H - wmH) / 2 },
    "top-left":      { x: pad,               y: pad },
    "top-right":     { x: W - wmW - pad,     y: pad },
    "bottom-left":   { x: pad,               y: H - wmH - pad },
    "bottom-right":  { x: W - wmW - pad,     y: H - wmH - pad },
    "top-center":    { x: (W - wmW) / 2,     y: pad },
    "bottom-center": { x: (W - wmW) / 2,     y: H - wmH - pad },
  })[position] ?? { x: (W - wmW) / 2, y: (H - wmH) / 2 };
}

function drawWatermark(canvas, settings, bgImg) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width;   // CANVAS_W
  const H = canvas.height;  // CANVAS_H

  ctx.clearRect(0, 0, W, H);

  // ── Background ──
  if (bgImg) {
    const scale = Math.min(W / bgImg.width, H / bgImg.height);
    const sw = bgImg.width * scale;
    const sh = bgImg.height * scale;
    ctx.drawImage(bgImg, (W - sw) / 2, (H - sh) / 2, sw, sh);
  } else {
    const s = 16;
    for (let y = 0; y < H; y += s)
      for (let x = 0; x < W; x += s) {
        ctx.fillStyle = ((x / s + y / s) % 2 === 0) ? "#1a2030" : "#151b28";
        ctx.fillRect(x, y, s, s);
      }
    ctx.fillStyle = "#2a3548";
    ctx.fillRect(W * 0.05, H * 0.05, W * 0.9, H * 0.9);
    ctx.fillStyle = "#3a4a60";
    ctx.font = `${Math.floor(W * 0.03)}px 'DM Sans', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Preview Image", W / 2, H / 2);
  }

  if (!settings.enabled || !settings.text.trim()) return;

  // ── Scale fontSize to canvas size so preview matches real output ──
  // If real image is REAL_W px wide and user picks fontSize=24,
  // on canvas we draw at 24 * SCALE px — so proportions match exactly.
  const scaledFontSize = settings.fontSize * SCALE;

  ctx.globalAlpha = settings.opacity / 100;
  ctx.font = `bold ${scaledFontSize}px Arial, sans-serif`;
  ctx.fillStyle = settings.color;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const tw  = ctx.measureText(settings.text).width;
  const th  = scaledFontSize * 1.2;
  const pad = 20 * SCALE; // scale padding too

  const { x, y } = getWMPosition(settings.position, W, H, tw + pad * 2, th + pad * 2);
  ctx.fillText(settings.text, x + pad, y + pad);
  ctx.globalAlpha = 1;
}

export default function WatermarkSettings({ dark = true }) {
  const bg      = dark ? "#0f1117" : "#f8fafc";
  const card    = dark ? "#131929" : "#ffffff";
  const border  = dark ? "#1e2d45" : "#e2e8f0";
  const text    = dark ? "#e2e8f0" : "#1e293b";
  const muted   = dark ? "#64748b" : "#94a3b8";
  const green   = "#22c55e";
  const inputBg = dark ? "#0f1825" : "#f8fafc";

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading,  setLoading]  = useState(true);
  const [status,   setStatus]   = useState(null);

  const canvasRef = useRef(null);
  const bgImgRef  = useRef(null);

  // Load preview bg image
  useEffect(() => {
    bgImgRef.current = null;
    const src = dark ? "/cdrlogo-dark.svg" : "/cdrlogo-light.svg";
    const img = new window.Image();
    img.src = src;
    img.onload  = () => { bgImgRef.current = img; redrawCanvas(); };
    img.onerror = () => { bgImgRef.current = null; redrawCanvas(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark]);

  // Fetch saved settings on mount
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch("/api/website/watermark");
        const json = await res.json();
        if (json.success && json.data) {
          setSettings(prev => ({ ...prev, ...json.data }));
        }
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawWatermark(canvas, settings, bgImgRef.current);
  }, [settings]);

  useEffect(() => { redrawCanvas(); }, [redrawCanvas]);

  const set = (key, val) => setSettings(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setStatus("saving");
    try {
      const res = await fetch("/api/website/watermark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error();
      setStatus("saved");
    } catch {
      setStatus("error");
    } finally {
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const inp = {
    width: "100%", padding: "9px 12px",
    background: inputBg, border: `1px solid ${border}`,
    borderRadius: 8, color: text,
    fontSize: 13, fontFamily: "'DM Sans', sans-serif",
    outline: "none",
  };

  const lbl = {
    fontSize: 11, fontWeight: 700, color: muted, marginBottom: 6,
    display: "block", letterSpacing: "0.06em", textTransform: "uppercase",
  };

  if (loading) {
    return (
      <div style={{ padding: "24px 20px", background: bg, minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: "'DM Sans', sans-serif" }}>
        <Loader size={18} color={green} style={{ animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: 13, color: muted }}>Loading watermark settings…</span>
        <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        .wm-input:focus { border-color:#22c55e !important; box-shadow:0 0 0 3px rgba(34,197,94,0.12) !important; }
        .wm-toggle { position:relative; display:inline-block; width:42px; height:24px; flex-shrink:0; }
        .wm-toggle input { opacity:0; width:0; height:0; }
        .wm-slider { position:absolute; inset:0; background:#1e2d45; border-radius:24px; cursor:pointer; transition:0.2s; }
        .wm-slider:before { content:''; position:absolute; width:18px; height:18px; left:3px; bottom:3px; background:#64748b; border-radius:50%; transition:0.2s; }
        input:checked + .wm-slider { background:#22c55e22; }
        input:checked + .wm-slider:before { transform:translateX(18px); background:#22c55e; }
        .wm-range { -webkit-appearance:none; appearance:none; width:100%; height:4px; border-radius:99px; background:#1e2d45; outline:none; }
        .wm-range::-webkit-slider-thumb { -webkit-appearance:none; width:16px; height:16px; border-radius:50%; background:#22c55e; cursor:pointer; border:2px solid #0f1117; }
        .wm-save-btn { display:flex; align-items:center; gap:8px; padding:10px 22px; border-radius:9px; border:none; font-size:13px; font-weight:700; cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.15s; background:#22c55e; color:#0f1117; }
        .wm-save-btn:hover:not(:disabled) { background:#16a34a; transform:translateY(-1px); }
        .wm-save-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .wm-scale-note { font-size:10px; color:#64748b; margin-top:4px; font-style:italic; }
        @media (max-width:700px) {
          .wm-layout { flex-direction:column !important; }
          .wm-panel  { min-width:unset !important; width:100% !important; }
          .wm-canvas-wrap { height:220px !important; }
        }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>

      <div style={{ padding: "24px 20px", background: bg, minHeight: "100%", fontFamily: "'DM Sans', sans-serif" }}>

        {/* Header */}
        <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#22c55e18", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sliders size={17} color={green} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: text }}>Watermarking System</h2>
            <p style={{ margin: 0, fontSize: 12, color: muted }}>Preview is scaled to match real output proportions</p>
          </div>
        </div>

        <div className="wm-layout" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

          {/* Settings panel */}
          <div className="wm-panel" style={{ minWidth: 300, width: 340, flexShrink: 0 }}>
            <div style={{ background: card, borderRadius: 14, border: `1px solid ${border}`, overflow: "hidden" }}>

              {/* Enable toggle */}
              <div style={{ padding: "16px 18px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: text }}>Enable Watermarking</div>
                  <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>Overlay text on all preview images</div>
                </div>
                <label className="wm-toggle">
                  <input type="checkbox" checked={settings.enabled} onChange={e => set("enabled", e.target.checked)} />
                  <span className="wm-slider" />
                </label>
              </div>

              <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Text */}
                <div>
                  <span style={lbl}>Watermark Text</span>
                  <input className="wm-input" style={inp}
                    value={settings.text} onChange={e => set("text", e.target.value)}
                    placeholder="e.g. CDRLOGO.com" />
                </div>

                {/* Position */}
                <div>
                  <span style={lbl}>Position</span>
                  <div style={{ position: "relative" }}>
                    <select className="wm-input" style={{ ...inp, appearance: "none", cursor: "pointer" }}
                      value={settings.position} onChange={e => set("position", e.target.value)}>
                      {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                    <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: muted, pointerEvents: "none", fontSize: 11 }}>▾</span>
                  </div>
                </div>

                {/* Opacity */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ ...lbl, marginBottom: 0 }}>Opacity</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: green }}>{settings.opacity}%</span>
                  </div>
                  <input type="range" className="wm-range" min={5} max={100} value={settings.opacity}
                    onChange={e => set("opacity", Number(e.target.value))} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: muted }}>Subtle</span>
                    <span style={{ fontSize: 10, color: muted }}>Fully visible</span>
                  </div>
                </div>

                {/* Font size — 0 to 200 */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ ...lbl, marginBottom: 0 }}>Font Size</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: green }}>{settings.fontSize}px</span>
                  </div>
                  <input type="range" className="wm-range" min={0} max={200} value={settings.fontSize}
                    onChange={e => set("fontSize", Number(e.target.value))} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: muted }}>0px</span>
                    <span style={{ fontSize: 10, color: muted }}>200px</span>
                  </div>
                  {/* Show actual scaled size for context */}
                  <div className="wm-scale-note">
                    On a {REAL_W}px wide image · preview scaled at {Math.round(SCALE * 100)}%
                  </div>
                </div>

                {/* Color */}
                <div>
                  <span style={lbl}>Text Color</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="color" value={settings.color} onChange={e => set("color", e.target.value)}
                      style={{ width: 36, height: 36, border: `1px solid ${border}`, borderRadius: 8, background: inputBg, cursor: "pointer", padding: 2, flexShrink: 0 }} />
                    <input className="wm-input" style={inp} value={settings.color}
                      onChange={e => set("color", e.target.value)} placeholder="#ffffff" />
                  </div>
                </div>

              </div>

              {/* Save footer */}
              <div style={{ padding: "14px 18px", borderTop: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <p style={{ margin: 0, fontSize: 11, color: muted }}>Downloaded originals will be clean</p>
                <button className="wm-save-btn" onClick={handleSave} disabled={status === "saving"}>
                  {status === "saving" && <Loader size={14} style={{ animation: "spin 1s linear infinite" }} />}
                  {status === "saved"  && <CheckCircle size={14} />}
                  {status === "error"  && <AlertCircle size={14} color="#ef4444" />}
                  {!status             && <Save size={14} />}
                  {status === "saving" ? "Saving…" : status === "saved" ? "Saved!" : status === "error" ? "Failed" : "Save Settings"}
                </button>
              </div>
            </div>
          </div>

          {/* Preview panel */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ background: card, borderRadius: 14, border: `1px solid ${border}`, overflow: "hidden" }}>

              <div style={{ padding: "13px 18px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 8 }}>
                <ImageIcon size={14} color={green} />
                <span style={{ fontSize: 13, fontWeight: 700, color: text }}>Preview</span>
                <span style={{ marginLeft: 6, fontSize: 11, color: muted }}>
                  ({dark ? "cdrlogo-dark.svg" : "cdrlogo-light.svg"}) · scaled {Math.round(SCALE * 100)}%
                </span>
                {settings.enabled && (
                  <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: green, background: "#22c55e18", padding: "3px 10px", borderRadius: 20 }}>
                    Watermark Active
                  </span>
                )}
              </div>

              <div className="wm-canvas-wrap" style={{ padding: 16, height: 360, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <canvas
                  ref={canvasRef}
                  width={CANVAS_W}
                  height={CANVAS_H}
                  style={{ borderRadius: 10, width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                />
              </div>

              {/* Status strip */}
              <div style={{
                margin: "0 16px 16px", borderRadius: 9,
                background: settings.enabled ? "#22c55e0d" : dark ? "#1a2236" : "#f1f5f9",
                border: `1px solid ${settings.enabled ? "#22c55e33" : border}`,
                padding: "10px 14px", display: "flex", alignItems: "center", gap: 8,
              }}>
                <CheckCircle size={14} color={settings.enabled ? green : muted} />
                <span style={{ fontSize: 12, color: settings.enabled ? green : muted, fontWeight: 500 }}>
                  {settings.enabled
                    ? `Active · "${settings.text}" · ${settings.position} · ${settings.opacity}% opacity · ${settings.fontSize}px on ${REAL_W}px image`
                    : "Downloaded original files will be clean (no watermark)"}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}