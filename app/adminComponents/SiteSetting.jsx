"use client";

import { useState, useEffect } from "react";
import {
  Globe, FileText, Moon, AlertTriangle,
  Save, RefreshCw, CheckCircle, Layers
} from "lucide-react";

// ─── tiny helpers ────────────────────────────────────────────────────────────
const field = (dark) => ({
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  border: `1px solid ${dark ? "#1e2535" : "#e2e8f0"}`,
  background: dark ? "#0f1117" : "#FFFFFF",
  color: dark ? "#e2e8f0" : "#1e293b",
  fontSize: 14,
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
  transition: "border-color 0.2s, box-shadow 0.2s",
  resize: "none",
});

const label = (dark) => ({
  fontSize: 12,
  fontWeight: 600,
  color: dark ? "#64748b" : "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 6,
  display: "block",
});

const card = (dark) => ({
  background: dark ? "#131720" : "#ffffff",
  border: `1px solid ${dark ? "#1e2535" : "#e2e8f0"}`,
  borderRadius: 16,
  padding: "24px 28px",
  display: "flex",
  flexDirection: "column",
  gap: 20,
});

const sectionTitle = (dark) => ({
  fontSize: 13,
  fontWeight: 700,
  color: dark ? "#e2e8f0" : "#1e293b",
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 4,
});

// ─── Toggle Switch ────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, dark }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 48,
        height: 26,
        borderRadius: 99,
        border: "none",
        background: checked
          ? "linear-gradient(135deg,#22c55e,#16a34a)"
          : dark ? "#1e2535" : "#e2e8f0",
        cursor: "pointer",
        position: "relative",
        transition: "background 0.25s",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 25 : 3,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.25s",
          boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
        }}
      />
    </button>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ icon: Icon, title, subtitle, dark, children }) {
  const muted = dark ? "#64748b" : "#94a3b8";
  return (
    <div style={card(dark)}>
      <div>
        <div style={sectionTitle(dark)}>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "rgba(34,197,94,0.12)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon size={14} color="#22c55e" />
          </span>
          {title}
        </div>
        {subtitle && (
          <p style={{ margin: 0, fontSize: 12, color: muted, paddingLeft: 36 }}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SiteSettings({ dark = true }) {
  const bg   = dark ? "#0f1117" : "#FFFFFF";
  const text  = dark ? "#e2e8f0" : "#1e293b";
  const muted = dark ? "#64748b" : "#94a3b8";
  const border = dark ? "#1e2535" : "#e2e8f0";

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [websiteId, setWebsiteId] = useState(null);

  const [form, setForm] = useState({
    metaTitle:        "",
    metaDescription:  "",
    showmode:         true,   // true = dark mode ON by default
    limit:            20,
    MaintanceMessage: "",
  });

  // ── Fetch on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/admin/site-setting")
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          setWebsiteId(data.id ?? null);
          setForm({
            metaTitle:        data.metaTitle        ?? "",
            metaDescription:  data.metaDescription  ?? "",
            showmode:         data.showmode         ?? true,
            limit:            data.limit            ?? 20,
            MaintanceMessage: data.MaintanceMessage ?? "",
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/site-setting", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id: websiteId, ...form }),
      });
      const data = await res.json();
      if (data?.id) setWebsiteId(data.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        padding: 32, display: "flex", flexDirection: "column", gap: 16,
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{
            height: 120, borderRadius: 16,
            background: dark ? "#131720" : "#f1f5f9",
            animation: "pulse 1.5s ease-in-out infinite",
          }} />
        ))}
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      padding: "28px 32px",
      fontFamily: "'DM Sans', sans-serif",
      background: bg,
      minHeight: "100%",
      color: text,
    }}>
      {/* Page header */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 28,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: text }}>
            Site Settings
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: muted }}>
            Manage global website configuration
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 20px", borderRadius: 10, border: "none",
            background: saved
              ? "linear-gradient(135deg,#16a34a,#15803d)"
              : "linear-gradient(135deg,#22c55e,#16a34a)",
            color: "#fff", fontSize: 13, fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
            transition: "all 0.2s",
            boxShadow: "0 2px 12px rgba(34,197,94,0.3)",
          }}
        >
          {saving ? (
            <RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} />
          ) : saved ? (
            <CheckCircle size={15} />
          ) : (
            <Save size={15} />
          )}
          {saving ? "Saving…" : saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 760 }}>

        {/* ── SEO Metadata ─────────────────────────────────────────────── */}
        <Section
          icon={Globe}
          title="SEO & Metadata"
          subtitle="Shown in browser tabs and search engine results"
          dark={dark}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <span style={label(dark)}>Meta Title</span>
              <input
                value={form.metaTitle}
                onChange={(e) => set("metaTitle", e.target.value)}
                placeholder="My Awesome Logo Site"
                style={field(dark)}
                maxLength={70}
              />
              <div style={{
                fontSize: 11, color: muted, marginTop: 4, textAlign: "right",
              }}>
                {form.metaTitle.length}/70
              </div>
            </div>

            <div>
              <span style={label(dark)}>Meta Description</span>
              <textarea
                rows={3}
                value={form.metaDescription}
                onChange={(e) => set("metaDescription", e.target.value)}
                placeholder="Describe your site in 150–160 characters…"
                style={{ ...field(dark), resize: "vertical" }}
                maxLength={160}
              />
              <div style={{
                fontSize: 11, color: muted, marginTop: 4, textAlign: "right",
              }}>
                {form.metaDescription.length}/160
              </div>
            </div>
          </div>
        </Section>

        {/* ── Dark Mode Default ─────────────────────────────────────────── */}
        <Section
          icon={Moon}
          title="Default Theme"
          subtitle="Controls whether visitors see dark mode by default on first load"
          dark={dark}
        >
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between",
            background: dark ? "#0f1117" : "#FFFFFF",
            borderRadius: 10,
            border: `1px solid ${border}`,
            padding: "14px 16px",
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: text }}>
                Dark Mode
              </div>
              <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>
                {form.showmode ? "Enabled — site defaults to dark theme" : "Disabled — site defaults to light theme"}
              </div>
            </div>
            <Toggle
              checked={form.showmode}
              onChange={(v) => set("showmode", v)}
              dark={dark}
            />
          </div>
        </Section>

        {/* ── Logos Per Page ────────────────────────────────────────────── */}
        <Section
          icon={Layers}
          title="Logos Per Page"
          subtitle="Number of logos shown per page in the public listing"
          dark={dark}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {[12, 20, 24, 36, 48].map((n) => (
              <button
                key={n}
                onClick={() => set("limit", n)}
                style={{
                  width: 52, height: 40, borderRadius: 10,
                  border: `1px solid ${form.limit === n ? "#22c55e" : border}`,
                  background: form.limit === n
                    ? "rgba(34,197,94,0.12)"
                    : dark ? "#0f1117" : "#FFFFFF",
                  color: form.limit === n ? "#22c55e" : muted,
                  fontWeight: form.limit === n ? 700 : 500,
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  transition: "all 0.18s",
                }}
              >
                {n}
              </button>
            ))}

            {/* custom input */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="number"
                min={1}
                max={200}
                value={form.limit}
                onChange={(e) => set("limit", Number(e.target.value))}
                style={{
                  ...field(dark),
                  width: 72,
                  textAlign: "center",
                  padding: "8px 10px",
                }}
              />
              <span style={{ fontSize: 12, color: muted }}>custom</span>
            </div>
          </div>
        </Section>

        {/* ── Maintenance Mode ──────────────────────────────────────────── */}
        <Section
          icon={AlertTriangle}
          title="Maintenance Mode"
          subtitle="When set, this message is shown to all visitors instead of the site"
          dark={dark}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{
              display: "flex", alignItems: "center",
              justifyContent: "space-between",
              background: dark ? "#0f1117" : "#FFFFFF",
              borderRadius: 10,
              border: `1px solid ${form.MaintanceMessage.trim() ? "#f59e0b55" : border}`,
              padding: "14px 16px",
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: text }}>
                  Maintenance Active
                </div>
                <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>
                  {form.MaintanceMessage.trim()
                    ? "⚠️ Maintenance message is set — site may show it to visitors"
                    : "No maintenance message set — site is live"}
                </div>
              </div>
              <div style={{
                width: 10, height: 10, borderRadius: "50%",
                background: form.MaintanceMessage.trim() ? "#f59e0b" : "#22c55e",
                boxShadow: `0 0 8px ${form.MaintanceMessage.trim() ? "#f59e0b88" : "#22c55e88"}`,
              }} />
            </div>

            <div>
              <span style={label(dark)}>Maintenance Message</span>
              <textarea
                rows={4}
                value={form.MaintanceMessage}
                onChange={(e) => set("MaintanceMessage", e.target.value)}
                placeholder="We'll be back shortly. Thanks for your patience!"
                style={{ ...field(dark), resize: "vertical" }}
              />
              <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>
                Leave empty to disable maintenance mode
              </div>
            </div>
          </div>
        </Section>

        {/* ── Meta info ─────────────────────────────────────────────────── */}
        {websiteId && (
          <div style={{
            fontSize: 11, color: muted, textAlign: "right", paddingRight: 2,
          }}>
            Website record ID: <code style={{ opacity: 0.6 }}>{websiteId}</code>
          </div>
        )}
      </div>
    </div>
  );
}