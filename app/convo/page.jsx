"use client";
import { useState } from "react";

export default function SvgConverter() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    setError("");
    setLoading(true);

    try {
      const svgText = await file.text();
      const filename = file.name.replace(/\.svg$/i, "");

      const res = await fetch("/api/logo/upload/bulk/svg-convo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ svg: svgText, filename }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Conversion failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}-converted.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      e.target.value = ""; // allow re-uploading the same file
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "40px auto", textAlign: "center" }}>
      <label
        style={{
          display: "inline-block",
          padding: "12px 24px",
          borderRadius: 10,
          border: "1.5px solid #D1D5DB",
          background: loading ? "#f3f4f6" : "#fff",
          color: "#374151",
          fontWeight: 600,
          fontSize: 14,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Converting…" : "Upload SVG"}
        <input
          type="file"
          accept=".svg,image/svg+xml"
          onChange={handleFileChange}
          disabled={loading}
          style={{ display: "none" }}
        />
      </label>

      {error && (
        <p style={{ color: "#dc2626", fontSize: 13, marginTop: 12 }}>{error}</p>
      )}
    </div>
  );
}