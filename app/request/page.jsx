"use client";

import { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import Navbar from "../components/Navbar";

const categories = [
  "Technology", "Automotive", "Finance", "Gaming", "Food & Beverage",
  "Healthcare", "Fashion", "Sports", "Entertainment", "Education",
  "Real Estate", "Travel", "Retail", "Media", "Other",
];
const formatOptions = ["AI", "CDR", "SVG", "PNG"];

export default function RequestLogoPage() {
  const [ready, setReady] = useState(false);
  const { dark } = useTheme();

  const [form, setForm] = useState({ brandName: "", websiteUrl: "", category: "", formats: [], notes: "", email: "" });
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  const toggleFormat = (fmt) => {
    setForm(prev => ({
      ...prev,
      formats: prev.formats.includes(fmt) ? prev.formats.filter(f => f !== fmt) : [...prev.formats, fmt],
    }));
  };

  const handleSubmit = async () => {
    if (!form.brandName.trim()) { setErrorMsg("Brand / Company name is required."); return; }
    setErrorMsg("");
    setStatus("loading");
    try {
      const res = await fetch("/api/request-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setStatus("success");
      setForm({ brandName: "", websiteUrl: "", category: "", formats: [], notes: "", email: "" });
    } catch (err) {
      setErrorMsg(err.message);
      setStatus("error");
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&family=DM+Sans:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        [data-theme="dark"] {
          --bg: #09090f; --card-bg: rgba(255,255,255,0.03); --card-bdr: rgba(255,255,255,0.07);
          --heading: #ffffff; --sub: rgba(255,255,255,0.4); --label: rgba(255,255,255,0.5);
          --input-bg: rgba(255,255,255,0.05); --input-bdr: rgba(255,255,255,0.09);
          --input-clr: #ffffff; --input-ph: rgba(255,255,255,0.22);
          --dot: rgba(255,255,255,0.03); --icon: rgba(255,255,255,0.28);
        }
        [data-theme="light"] {
          --bg: #f4f4f8; --card-bg: rgba(255,255,255,0.92); --card-bdr: rgba(0,0,0,0.09);
          --heading: #0a0a14; --sub: rgba(0,0,0,0.48); --label: rgba(0,0,0,0.58);
          --input-bg: #ffffff; --input-bdr: rgba(0,0,0,0.11);
          --input-clr: #0a0a14; --input-ph: rgba(0,0,0,0.26);
          --dot: rgba(0,0,0,0.035); --icon: rgba(0,0,0,0.28);
        }

        .rl-root {
          min-height: 100vh; background: var(--bg);
          font-family: 'Sora', sans-serif;
          display: flex; flex-direction: column; align-items: center;
          padding: 60px 16px 60px; position: relative; overflow: hidden;
          transition: background 0.35s;
        }
        .bg-glow { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
        .bg-glow::before {
          content: ''; position: absolute; top: -8%; left: 50%;
          transform: translateX(-50%); width: 600px; height: 300px;
          background: radial-gradient(ellipse, rgba(7,166,38,.4) 0%, transparent 68%);
          border-radius: 50%; animation: glow-pulse 5s ease-in-out infinite;
        }
        [data-theme="light"] .bg-glow::before { background: radial-gradient(ellipse, rgba(7,166,38,.07) 0%, transparent 68%); }
        @keyframes glow-pulse {
          0%,100% { opacity:1; transform:translateX(-50%) scale(1); }
          50% { opacity:.6; transform:translateX(-50%) scale(1.07); }
        }
        .dot-grid {
          position: absolute; inset: 0;
          background-image: radial-gradient(var(--dot) 1px, transparent 1px);
          background-size: 28px 28px; pointer-events: none; z-index: 0;
        }

        .rl-content {
          position: relative; z-index: 1; width: 100%; max-width: 500px;
          display: flex; flex-direction: column; align-items: center; gap: 4px;
        }
        .anim { opacity: 0; transform: translateY(14px); transition: opacity .5s cubic-bezier(.22,1,.36,1), transform .5s cubic-bezier(.22,1,.36,1); }
        .ready .anim { opacity: 1; transform: translateY(0); }
        .d0 { transition-delay: 0ms; } .d1 { transition-delay: 60ms; } .d2 { transition-delay: 120ms; }

        .rl-heading {
          font-size: clamp(22px, 5vw, 36px); font-weight: 900; letter-spacing: -1px;
          color: var(--heading); text-align: center; line-height: 1.1; text-wrap: balance; transition: color 0.35s;
        }
        .rl-heading .accent {
          background: linear-gradient(135deg, rgba(7,166,38,.5), rgba(7,166,38,.85));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .rl-sub { font-family: 'DM Sans', sans-serif; font-size: 12.5px; color: var(--sub); text-align: center; margin-bottom: 4px; transition: color 0.35s; }

        .card {
          width: 100%; background: var(--card-bg); border: 1px solid var(--card-bdr);
          border-radius: 14px; padding: 20px 20px 18px;
          backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          display: flex; flex-direction: column; gap: 12px;
          box-shadow: 0 2px 24px rgba(0,0,0,.07); transition: background 0.35s, border-color 0.35s;
        }
        .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .field { display: flex; flex-direction: column; gap: 4px; }
        .field-label {
          font-size: 10.5px; font-weight: 600; color: var(--label);
          letter-spacing: .3px; display: flex; align-items: center; gap: 4px;
          text-transform: uppercase; transition: color 0.3s;
        }
        .field-input, .field-select, .field-textarea {
          width: 100%; background: var(--input-bg); border: 1.5px solid var(--input-bdr);
          border-radius: 8px; padding: 8px 11px; font-size: 12.5px;
          font-family: 'Sora', sans-serif; color: var(--input-clr); outline: none;
          transition: border-color .2s, box-shadow .2s, background 0.35s;
          appearance: none; -webkit-appearance: none;
        }
        .field-input::placeholder, .field-textarea::placeholder { color: var(--input-ph); }
        .field-input:focus, .field-select:focus, .field-textarea:focus {
          border-color: rgba(7,166,38,.65); box-shadow: 0 0 0 3px rgba(7,166,38,.09);
        }
        .field-textarea { resize: vertical; min-height: 76px; line-height: 1.55; }

        .select-wrap { position: relative; }
        .select-wrap svg { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--icon); }
        .field-select { padding-right: 30px; cursor: pointer; }
        .field-select option { background: #1a1a2e; color: #fff; }
        [data-theme="light"] .field-select option { background: #fff; color: #0a0a14; }

        .formats-row { display: flex; gap: 6px; flex-wrap: wrap; }
        .fmt-check {
          display: flex; align-items: center; gap: 5px; cursor: pointer;
          padding: 5px 10px; border-radius: 7px; border: 1.5px solid var(--input-bdr);
          background: var(--input-bg); font-size: 11px; font-weight: 600;
          color: var(--label); transition: background .2s, border-color .2s, color .2s; user-select: none;
        }
        .fmt-check.active { background: rgba(7,166,38,.09); border-color: rgba(7,166,38,.42); color: #4ade80; }
        [data-theme="light"] .fmt-check.active { color: #15803d; }
        .fmt-check-box {
          width: 12px; height: 12px; border-radius: 3px; border: 1.5px solid currentColor;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background .15s;
        }
        .fmt-check.active .fmt-check-box { background: rgba(7,166,38,.22); border-color: #4ade80; }

        .error-msg {
          font-size: 11.5px; color: #f87171; background: rgba(239,68,68,.07);
          border: 1px solid rgba(239,68,68,.18); border-radius: 7px; padding: 7px 11px;
        }
        .success-banner {
          display: flex; align-items: center; gap: 9px;
          background: rgba(7,166,38,.07); border: 1px solid rgba(7,166,38,.22);
          border-radius: 10px; padding: 11px 14px;
          color: #4ade80; font-size: 12.5px; font-weight: 500;
        }
        [data-theme="light"] .success-banner { color: #15803d; }

        .submit-btn {
          width: 100%; padding: 11px; border: none; border-radius: 9px;
          background: linear-gradient(135deg, rgba(7,166,38,.45), rgba(7,166,38,.72));
          color: #fff; font-size: 13px; font-family: 'Sora', sans-serif;
          font-weight: 700; letter-spacing: .15px; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          transition: opacity .2s, transform .15s, box-shadow .2s;
          box-shadow: 0 3px 16px rgba(7,166,38,.28);
        }
        .submit-btn:hover:not(:disabled) { opacity: .91; transform: translateY(-1px); box-shadow: 0 5px 22px rgba(7,166,38,.38); }
        .submit-btn:active:not(:disabled) { transform: translateY(0); }
        .submit-btn:disabled { opacity: .6; cursor: not-allowed; }
        .spinner { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,.3); border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 480px) {
          .rl-root { padding: 52px 12px 52px; }
          .card { padding: 16px 14px 14px; gap: 10px; }
          .row2 { grid-template-columns: 1fr; }
        }
      `}</style>

      <main className="rl-root" data-theme={dark ? "dark" : "light"}>
        <Navbar />
            <div className="h-10"/>
        <div className="bg-glow" />
        <div className="dot-grid" />

        <div className={`rl-content${ready ? " ready" : ""}`}>
          <div className="anim d0">
            <h1 className="rl-heading">Request a <span className="accent">Logo</span></h1>
          </div>
          <div className="anim d1">
            <p className="rl-sub">Can't find a logo? Request it and we'll add it to our collection.</p>
          </div>

          <div className="anim d2" style={{ width: "100%", marginTop: "6px" }}>
            <div className="card">
              {status === "success" && (
                <div className="success-banner">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  Request submitted! We'll review and add it soon.
                </div>
              )}

              {/* Brand + Website */}
              <div className="row2">
                <div className="field">
                  <label className="field-label">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    Brand Name <span style={{color:"#f87171"}}>*</span>
                  </label>
                  <input className="field-input" type="text" placeholder="e.g. Tesla, Spotify" value={form.brandName}
                    onChange={e => setForm(p => ({ ...p, brandName: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="field-label">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    Website URL
                  </label>
                  <input className="field-input" type="url" placeholder="https://example.com" value={form.websiteUrl}
                    onChange={e => setForm(p => ({ ...p, websiteUrl: e.target.value }))} />
                </div>
              </div>

              {/* Category + Email in a row */}
              <div className="row2">
                <div className="field">
                  <label className="field-label">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
                    Category
                  </label>
                  <div className="select-wrap">
                    <select className="field-select" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                      <option value="">Select…</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    Email <span style={{color:"var(--sub)",fontWeight:400,textTransform:"none",letterSpacing:0,fontSize:"10px"}}>(optional)</span>
                  </label>
                  <input className="field-input" type="email" placeholder="Notify me when added" value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
              </div>

              {/* Formats */}
              <div className="field">
                <label className="field-label">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                  Preferred Formats
                </label>
                <div className="formats-row">
                  {formatOptions.map(fmt => (
                    <label key={fmt} className={`fmt-check${form.formats.includes(fmt) ? " active" : ""}`} onClick={() => toggleFormat(fmt)}>
                      <span className="fmt-check-box">
                        {form.formats.includes(fmt) && (
                          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                      </span>
                      {fmt}
                    </label>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="field">
                <label className="field-label">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  Additional Notes
                </label>
                <textarea className="field-textarea" placeholder="Any specific version or variant you need?" value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>

              {errorMsg && <div className="error-msg">{errorMsg}</div>}

              <button className="submit-btn" onClick={handleSubmit} disabled={status === "loading"}>
                {status === "loading" ? (
                  <><span className="spinner" /> Submitting…</>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    Submit Request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}