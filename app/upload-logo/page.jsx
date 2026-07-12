"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "../context/ThemeContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../components/Navbar";
import ProfileSubNav from "../components/ProfileSubNav";
import "../profile/profile-glass.css";

export default function UploadLogoPage() {
  const { status } = useSession();
  const { dark } = useTheme();
  const router = useRouter();
  const theme = dark ? "dark" : "light";
  const fileRef = useRef(null);

  const [ready, setReady] = useState(true);
  const [sourceType, setSourceType] = useState("svg"); // "svg" | "ai"
  const [logoName, setLogoName] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status]);

  function slugify(name) {
    return name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    setSelectedFileName(file ? file.name : "");
    setUploadError("");
  }

  function handleTypeChange(next) {
    setSourceType(next);
    setSelectedFileName("");
    if (fileRef.current) fileRef.current.value = "";
    setUploadError("");
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result || "";
        const commaIdx = result.indexOf(",");
        resolve(commaIdx !== -1 ? result.slice(commaIdx + 1) : result);
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  async function handleUpload(e) {
    e.preventDefault();
    setUploadError(""); setUploadSuccess("");

    const file = fileRef.current?.files?.[0];
    if (!file) return setUploadError(`Select ${sourceType === "svg" ? "an .svg" : "an .ai"} file.`);

    const nameLower = file.name.toLowerCase();
    if (sourceType === "svg" && !nameLower.endsWith(".svg")) {
      return setUploadError("File must be an .svg");
    }
    if (sourceType === "ai" && !nameLower.endsWith(".ai") && !nameLower.endsWith(".pdf")) {
      return setUploadError("File must be an .ai");
    }
    if (!logoName.trim()) return setUploadError("Enter a logo name.");

    setUploading(true);
    try {
      const slug = slugify(logoName);
      let convBody;

      if (sourceType === "svg") {
        setStep("Reading SVG…");
        const svgText = await file.text();
        convBody = { type: "svg", svg: svgText, filename: slug };
      } else {
        setStep("Reading AI file…");
        const base64 = await readFileAsBase64(file);
        convBody = { type: "ai", ai: base64, filename: slug };
      }

      setStep(sourceType === "svg" ? "Converting to PNG/AI…" : "Converting to PNG/SVG…");
      const convRes = await fetch("/api/logo/upload/bulk/svg-convo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(convBody),
      });
      if (!convRes.ok) {
        const d = await convRes.json().catch(() => ({}));
        throw new Error(d.error || "File conversion failed");
      }
      const zipBlob = await convRes.blob();

      setStep("Generating SEO content & saving…");
      const fd = new FormData();
      fd.append("files", zipBlob, `${slug}.zip`);
      fd.append("logoName", logoName.trim());
      fd.append("slug", slug);
      fd.append("useAI", "true");

      const upRes = await fetch("/api/logo/upload/single", { method: "POST", body: fd });
      if (!upRes.ok) {
        const d = await upRes.json().catch(() => ({}));
        throw new Error(d.error || "Upload failed");
      }

      setUploadSuccess("Logo uploaded! It's saved as a draft in your library until admin approve.");
      setLogoName("");
      setSelectedFileName("");
      fileRef.current.value = "";
    } catch (err) {
      setUploadError(err.message || "Something went wrong.");
    } finally {
      setUploading(false);
      setStep("");
    }
  }

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="pg-loading-screen" style={{ background: dark ? "#08080e" : "#eef0f4" }}>
        <div className="pg-spinner" />
      </div>
    );
  }

  return (
    <div className="pg-root" data-pg={theme}>
      <Navbar />
      <div className="pg-blob pg-blob-1" />
      <div className="pg-blob pg-blob-2" />
      <div className="h-10" />

      <div className={`pg-layout${ready ? " pg-ready" : ""}`} style={{ maxWidth: 620 }}>
        <div className="pg-page-header pg-anim pg-d0">
          <div className="pg-page-title">Account</div>
          <div className="pg-page-path">cdrlogo.com / <span>upload logo</span></div>
        </div>

        <div className="pg-anim pg-d0">
          <ProfileSubNav />
        </div>

        <div className="pg-glass pg-upload-card pg-anim pg-d1">
          <div className="pg-upload-title">Upload a logo</div>

          <div className="pg-type-toggle">
            <button
              type="button"
              className={`pg-type-btn${sourceType === "svg" ? " active" : ""}`}
              onClick={() => handleTypeChange("svg")}
              disabled={uploading}
            >
              SVG file
            </button>
            <button
              type="button"
              className={`pg-type-btn${sourceType === "ai" ? " active" : ""}`}
              onClick={() => handleTypeChange("ai")}
              disabled={uploading}
            >
              AI file
            </button>
          </div>

          <form onSubmit={handleUpload}>
            <div className="pg-field">
              <label className="pg-label">Logo name</label>
              <input
                className="pg-upload-input"
                placeholder="e.g. Acme Corp"
                value={logoName}
                onChange={(e) => setLogoName(e.target.value)}
                disabled={uploading}
              />
            </div>
            <div className="pg-field">
              <label className="pg-label">{sourceType === "svg" ? "SVG file" : "AI file"}</label>
              <label className={`pg-drop${selectedFileName ? " has-file" : ""}`}>
                {selectedFileName ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    <span className="pg-drop-filename">{selectedFileName}</span>
                    <span className="pg-drop-hint">Click to choose a different file</span>
                  </>
                ) : (
                  <>
                    <span>Click to choose {sourceType === "svg" ? "an .svg" : "an .ai"} file</span>
                    <span className="pg-drop-hint">{sourceType === "svg" ? ".svg only" : ".ai "}</span>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept={sourceType === "svg" ? ".svg,image/svg+xml" : ".ai,application/pdf,application/postscript"}
                  style={{ display: "none" }}
                  disabled={uploading}
                  onChange={handleFileChange}
                />
              </label>
            </div>
            <button className="pg-upload-btn" type="submit" disabled={uploading}>
              {uploading ? "Uploading…" : "Upload logo"}
            </button>
            {step && <div className="pg-upload-step">{step}</div>}
            {uploadError && <div className="pg-upload-err">{uploadError}</div>}
            {uploadSuccess && (
              <div className="pg-upload-ok">
                {uploadSuccess}{" "}
                <Link href="/my-logos" style={{ color: "var(--pg-accent-text)", fontWeight: 600 }}>
                  View in My Logos →
                </Link>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}