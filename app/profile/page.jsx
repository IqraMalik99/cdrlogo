"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "../context/ThemeContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../components/Navbar";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const { dark } = useTheme();
  const router = useRouter();
  const theme = dark ? "dark" : "light";
  const fileRef = useRef(null);

  // ── Favorites ──────────────────────────────────────────────────────────
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(null);
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState(0);
  const [join, setJoin] = useState(null);

  // ── My uploads ────────────────────────────────────────────────────────
  const [tab, setTab] = useState("saved"); // "saved" | "uploads"
  const [myLogos, setMyLogos] = useState([]);
  const [loadingMyLogos, setLoadingMyLogos] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

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

  useEffect(() => {
    if (status === "authenticated") {
      fetchFavorites();
      fetchMyLogos();
      const t = setTimeout(() => setReady(true), 80);
      return () => clearTimeout(t);
    }
  }, [status]);

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/favorites");
      const data = await res.json();
      setJoin(new Date(data.joined));
      setCount(data.downloadCountUsed);
      setFavorites(data.favorites ?? []);
    } catch {
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyLogos = async () => {
    setLoadingMyLogos(true);
    try {
      const res = await fetch("/api/logo/mine");
      const data = await res.json();
      setMyLogos(data.logos ?? []);
    } catch {
      setMyLogos([]);
    } finally {
      setLoadingMyLogos(false);
    }
  };

  const handleUnfavorite = async (logoId) => {
    setRemoving(logoId);
    try {
      await fetch("/api/logo/favourite/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoId }),
      });
      setFavorites((prev) => prev.filter((l) => l.id !== logoId));
    } catch { }
    setRemoving(null);
  };

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

  // reads a File as a base64 string (no data: prefix)
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
      return setUploadError("File must be an .ai (or .pdf) file");
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
      // owner + publishStatus are enforced server-side from your session

      const upRes = await fetch("/api/logo/upload/single", { method: "POST", body: fd });
      if (!upRes.ok) {
        const d = await upRes.json().catch(() => ({}));
        throw new Error(d.error || "Upload failed");
      }

      setUploadSuccess("Logo uploaded! It's saved as a draft in your library until admin approve.");
      setLogoName("");
      setSelectedFileName("");
      fileRef.current.value = "";
      fetchMyLogos();
    } catch (err) {
      setUploadError(err.message || "Something went wrong.");
    } finally {
      setUploading(false);
      setStep("");
    }
  }

  async function handleDeleteMyLogo(logo) {
    if (!window.confirm(`Delete "${logo.logoName}"? This can't be undone.`)) return;
    setDeletingId(logo.id);
    try {
      const res = await fetch("/api/logo/admin", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: logo.id }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.error) throw new Error(d.error || "Delete failed");
      setMyLogos((prev) => prev.filter((l) => l.id !== logo.id));
    } catch (err) {
      alert(err.message || "Failed to delete logo.");
    } finally {
      setDeletingId(null);
    }
  }

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: dark ? "#08080e" : "#f2f2f7"
      }}>
        <div className="pr-spinner" />
      </div>
    );
  }

  const user = session?.user;
  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        [data-pr="dark"] {
          --bg:          #08080e;
          --surface:     #0f0f18;
          --surface2:    #13131f;
          --border:      rgba(255,255,255,0.07);
          --border2:     rgba(255,255,255,0.04);
          --text:        rgba(255,255,255,0.88);
          --text2:       rgba(255,255,255,0.45);
          --text3:       rgba(255,255,255,0.22);
          --accent:      #07A626;
          --accent-dim:  rgba(7,166,38,0.08);
          --accent-mid:  rgba(7,166,38,0.18);
          --accent-text: #4ade80;
          --danger:      rgba(239,68,68,0.75);
          --danger-dim:  rgba(239,68,68,0.08);
          --danger-mid:  rgba(239,68,68,0.16);
          --img-bg:      rgba(255,255,255,0.03);
          --mono-bg:     rgba(255,255,255,0.04);
        }
        [data-pr="light"] {
          --bg:          #f2f2f7;
          --surface:     #ffffff;
          --surface2:    #f7f7fc;
          --border:      rgba(0,0,0,0.08);
          --border2:     rgba(0,0,0,0.05);
          --text:        #0d0d1a;
          --text2:       rgba(0,0,0,0.48);
          --text3:       rgba(0,0,0,0.25);
          --accent:      #07A626;
          --accent-dim:  rgba(7,166,38,0.06);
          --accent-mid:  rgba(7,166,38,0.14);
          --accent-text: #15803d;
          --danger:      rgba(220,38,38,0.8);
          --danger-dim:  rgba(220,38,38,0.06);
          --danger-mid:  rgba(220,38,38,0.12);
          --img-bg:      rgba(0,0,0,0.03);
          --mono-bg:     rgba(0,0,0,0.04);
        }

        *, *::before, *::after { box-sizing: border-box; }

        .pr-root {
          min-height: 100vh;
          background: var(--bg);
          font-family: 'Sora', system-ui, sans-serif;
          transition: background 0.3s;
        }

        .pr-layout {
          max-width: 1020px;
          margin: 0 auto;
          padding: 48px 24px 96px;
        }

        .pr-page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 32px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--border);
        }
        .pr-page-title {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: var(--text3);
        }
        .pr-page-path {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: var(--text3);
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .pr-page-path span { color: var(--accent-text); }

        .pr-body {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 20px;
          align-items: start;
        }

        .pr-sidebar {
          display: flex;
          flex-direction: column;
          gap: 10px;
          position: sticky;
          top: 24px;
        }

        .pr-id-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
        }
        .pr-id-top {
          padding: 22px 18px 18px;
          border-bottom: 1px solid var(--border2);
        }
        .pr-avatar {
          width: 44px; height: 44px;
          border-radius: 9px;
          background: var(--accent-dim);
          border: 1px solid var(--accent-mid);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700;
          color: var(--accent-text);
          letter-spacing: -0.5px;
          margin-bottom: 13px;
          font-family: 'JetBrains Mono', monospace;
        }
        .pr-user-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--text);
          letter-spacing: -0.3px;
          margin-bottom: 3px;
          line-height: 1.3;
          word-break: break-word;
        }
        .pr-user-email {
          font-size: 11px;
          color: var(--text3);
          word-break: break-all;
          font-family: 'JetBrains Mono', monospace;
        }

        .pr-id-meta { padding: 0; }
        .pr-meta-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 9px 18px;
          border-bottom: 1px solid var(--border2);
          font-size: 11px;
        }
        .pr-meta-row:last-child { border-bottom: none; }
        .pr-meta-key { color: var(--text3); font-weight: 500; }
        .pr-meta-val {
          color: var(--text2);
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
        }
        .pr-status-dot {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11px; color: var(--accent-text);
        }
        .pr-status-dot::before {
          content: '';
          width: 5px; height: 5px;
          border-radius: 50%;
          background: var(--accent);
          display: block;
          flex-shrink: 0;
        }
        .pr-role-tag {
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 9.5px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          font-family: 'JetBrains Mono', monospace;
          background: var(--mono-bg);
          color: var(--text3);
          border: 1px solid var(--border);
        }
        .pr-role-tag.admin {
          background: rgba(234,179,8,0.08);
          color: #ca8a04;
          border-color: rgba(234,179,8,0.2);
        }

        .pr-stat-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .pr-stat-box {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 14px 14px 11px;
        }
        .pr-stat-n {
          font-size: 22px;
          font-weight: 700;
          color: var(--text);
          letter-spacing: -1px;
          line-height: 1;
          margin-bottom: 5px;
        }
        .pr-stat-n.green { color: var(--accent-text); }
        .pr-stat-lbl {
          font-size: 9.5px;
          font-weight: 600;
          color: var(--text3);
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }

        .pr-signout {
          width: 100%;
          display: flex; align-items: center; justify-content: center; gap: 7px;
          padding: 9px;
          background: none;
          border: 1px solid var(--border);
          border-radius: 9px;
          font-family: 'Sora', sans-serif;
          font-size: 11.5px;
          font-weight: 500;
          color: var(--text3);
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s, background 0.15s;
        }
        .pr-signout:hover {
          border-color: var(--danger-mid);
          color: var(--danger);
          background: var(--danger-dim);
        }

        .pr-main { }

        /* Tabs */
        .pr-tabs {
          display: flex;
          gap: 4px;
          margin-bottom: 16px;
          border-bottom: 1px solid var(--border);
        }
        .pr-tab {
          padding: 9px 4px;
          margin-bottom: -1px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text3);
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 7px;
          transition: color 0.15s;
        }
        .pr-tab.active {
          color: var(--text);
          border-bottom-color: var(--accent);
        }
        .pr-tab .pr-count {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          padding: 1px 6px;
          border-radius: 4px;
          background: var(--accent-dim);
          border: 1px solid var(--accent-mid);
          color: var(--accent-text);
        }

        .pr-section-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 14px;
          margin-bottom: 16px;
        }
        .pr-section-label {
          display: flex; align-items: center; gap: 9px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text);
        }
        .pr-browse-link {
          font-size: 11px;
          font-weight: 500;
          color: var(--text3);
          text-decoration: none;
          display: flex; align-items: center; gap: 4px;
          transition: color 0.15s;
        }
        .pr-browse-link:hover { color: var(--accent-text); }

        .pr-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 12px;
        }

        /* ── Redesigned logo card ─────────────────────────────────────── */
        .pr-logo {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
          position: relative;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
          animation: pr-fadein 0.35s cubic-bezier(.22,1,.36,1) both;
        }
        @keyframes pr-fadein {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to   { opacity: 1; transform: none; }
        }
        .pr-logo:hover {
          border-color: rgba(7,166,38,0.28);
          box-shadow: 0 8px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06);
          transform: translateY(-2px);
        }
        .pr-logo-img {
          aspect-ratio: 4/3;
          position: relative;
          background:
            radial-gradient(circle at 50% 42%, var(--surface2) 0%, var(--img-bg) 72%);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          border-bottom: 1px solid var(--border2);
          overflow: hidden;
        }
        .pr-logo-img img {
          width: 100%; height: 100%;
          object-fit: contain;
          filter: drop-shadow(0 2px 6px rgba(0,0,0,0.10));
          transition: transform 0.25s ease;
        }
        .pr-logo:hover .pr-logo-img img { transform: scale(1.05); }
        .pr-no-img {
          width: 30px; height: 30px;
          border-radius: 7px;
          background: var(--border);
        }

        /* view overlay on hover */
        .pr-view-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.08) 100%);
          opacity: 0;
          transition: opacity 0.2s ease;
          pointer-events: none;
        }
        .pr-logo:hover .pr-view-overlay { opacity: 1; }
        .pr-view-pill {
          display: flex; align-items: center; gap: 5px;
          padding: 5px 10px;
          border-radius: 999px;
          background: var(--surface);
          border: 1px solid var(--border);
          font-size: 9.5px;
          font-weight: 600;
          color: var(--text2);
          box-shadow: 0 4px 12px rgba(0,0,0,0.12);
          transform: translateY(4px);
          transition: transform 0.2s ease;
        }
        .pr-logo:hover .pr-view-pill { transform: translateY(0); }

        .pr-logo-foot {
          padding: 10px 12px 12px;
        }
        .pr-logo-name {
          font-size: 11.5px;
          font-weight: 700;
          color: var(--text);
          letter-spacing: -0.1px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          margin-bottom: 5px;
        }
        .pr-logo-cat {
          font-size: 10px;
          color: var(--text3);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .pr-status-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 9px;
          font-weight: 700;
          padding: 3px 7px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: .4px;
        }
        .pr-status-tag::before {
          content: '';
          width: 4.5px; height: 4.5px;
          border-radius: 50%;
          display: block;
        }
        .pr-status-tag.draft { background: rgba(234,179,8,0.1); color: #ca8a04; }
        .pr-status-tag.draft::before { background: #ca8a04; }
        .pr-status-tag.published { background: var(--accent-dim); color: var(--accent-text); }
        .pr-status-tag.published::before { background: var(--accent); }

        .pr-remove {
          position: absolute;
          top: 8px; right: 8px;
          width: 24px; height: 24px;
          border-radius: 7px;
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--danger);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          opacity: 0;
          transform: translateY(-3px);
          box-shadow: 0 3px 10px rgba(0,0,0,0.12);
          transition: opacity 0.15s ease, transform 0.15s ease, background 0.15s ease;
          z-index: 2;
        }
        .pr-logo:hover .pr-remove { opacity: 1; transform: none; }
        .pr-remove:hover { background: var(--danger-dim); border-color: var(--danger-mid); }
        .pr-remove.busy {
          opacity: 1;
          transform: none;
          animation: pr-spin 0.7s linear infinite;
        }
        @keyframes pr-spin { to { transform: rotate(360deg); } }

        .pr-empty {
          grid-column: 1/-1;
          padding: 52px 20px;
          border: 1px dashed var(--border);
          border-radius: 14px;
          text-align: center;
        }
        .pr-empty-title {
          font-size: 13px; font-weight: 600;
          color: var(--text2); margin-bottom: 5px;
        }
        .pr-empty-sub {
          font-size: 11.5px; color: var(--text3); margin-bottom: 16px;
        }
        .pr-empty-link {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 8px 15px;
          border: 1px solid var(--border);
          border-radius: 7px;
          font-size: 11.5px; font-weight: 500;
          color: var(--text2); text-decoration: none;
          transition: border-color 0.15s, color 0.15s;
        }
        .pr-empty-link:hover { border-color: var(--accent-mid); color: var(--accent-text); }

        .pr-skel {
          border-radius: 14px; overflow: hidden;
          border: 1px solid var(--border);
        }
        .pr-skel-img {
          aspect-ratio: 4/3;
          background: linear-gradient(90deg, var(--surface) 25%, var(--surface2) 50%, var(--surface) 75%);
          background-size: 300% 100%;
          animation: skel-anim 1.5s infinite;
        }
        .pr-skel-foot {
          padding: 10px 12px 12px;
          background: var(--surface);
          border-top: 1px solid var(--border2);
          display: flex; flex-direction: column; gap: 5px;
        }
        .pr-skel-line {
          height: 8px; border-radius: 3px;
          background: linear-gradient(90deg, var(--surface) 25%, var(--surface2) 50%, var(--surface) 75%);
          background-size: 300% 100%;
          animation: skel-anim 1.5s infinite;
        }
        .pr-skel-line.s { width: 50%; }
        @keyframes skel-anim {
          0%   { background-position: 300% 0; }
          100% { background-position: -300% 0; }
        }

        .pr-spinner {
          width: 26px; height: 26px;
          border: 1.5px solid rgba(255,255,255,0.08);
          border-top-color: #07A626;
          border-radius: 50%;
          animation: pr-spin 0.7s linear infinite;
        }

        .pr-anim {
          opacity: 0; transform: translateY(10px);
          transition: opacity .42s cubic-bezier(.22,1,.36,1),
                      transform .42s cubic-bezier(.22,1,.36,1);
        }
        .pr-ready .pr-anim { opacity: 1; transform: none; }
        .pr-d0{transition-delay:0ms} .pr-d1{transition-delay:55ms}
        .pr-d2{transition-delay:110ms} .pr-d3{transition-delay:165ms}

        /* Upload card */
        .pr-upload-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 20px;
          margin-bottom: 22px;
        }
        .pr-upload-title {
          font-size: 12.5px; font-weight: 600; color: var(--text);
          margin-bottom: 14px; display: flex; align-items: center; gap: 8px;
        }

        /* type toggle */
        .pr-type-toggle {
          display: inline-flex;
          padding: 3px;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 9px;
          margin-bottom: 14px;
        }
        .pr-type-btn {
          padding: 7px 16px;
          border: none;
          background: none;
          border-radius: 7px;
          font-family: inherit;
          font-size: 11.5px;
          font-weight: 600;
          color: var(--text3);
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .pr-type-btn.active {
          background: var(--accent);
          color: #fff;
        }

        .pr-field { margin-bottom: 12px; }
        .pr-label {
          display: block; font-size: 11px; font-weight: 500;
          color: var(--text2); margin-bottom: 6px;
        }
        .pr-upload-input {
          width: 100%; padding: 9px 11px; border-radius: 8px;
          border: 1px solid var(--border); background: var(--bg);
          color: var(--text); font-family: inherit; font-size: 12.5px; outline: none;
        }
        .pr-upload-input:focus { border-color: var(--accent-mid); }

        .pr-drop {
          border: 1.5px dashed var(--border); border-radius: 9px;
          padding: 18px; text-align: center; cursor: pointer;
          font-size: 12px; color: var(--text2); transition: border-color .15s, background .15s;
          display: flex; flex-direction: column; align-items: center; gap: 6px;
        }
        .pr-drop:hover { border-color: var(--accent-mid); }
        .pr-drop.has-file {
          border-style: solid;
          border-color: var(--accent-mid);
          background: var(--accent-dim);
        }
        .pr-drop-filename {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: var(--accent-text);
          font-weight: 600;
          word-break: break-all;
        }
        .pr-drop-hint {
          font-size: 10.5px;
          color: var(--text3);
        }

        .pr-upload-btn {
          width: 100%; margin-top: 12px; padding: 10px; border-radius: 8px;
          border: none; background: var(--accent); color: #fff;
          font-family: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer;
        }
        .pr-upload-btn:disabled { opacity: .55; cursor: not-allowed; }
        .pr-upload-step { font-size: 11px; color: var(--accent-text); margin-top: 9px; }
        .pr-upload-err {
          font-size: 11px; color: var(--danger); margin-top: 9px;
          background: var(--danger-dim); padding: 8px 11px; border-radius: 7px;
        }
        .pr-upload-ok {
          font-size: 11px; color: var(--accent-text); margin-top: 9px;
          background: var(--accent-dim); padding: 8px 11px; border-radius: 7px;
        }

        @media (max-width: 720px) {
          .pr-body { grid-template-columns: 1fr; }
          .pr-sidebar { position: static; }
          .pr-layout { padding: 28px 16px 72px; }
        }
        @media (max-width: 480px) {
          .pr-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

      <div className="pr-root" data-pr={theme}>
        <Navbar />
        <div className="h-10" />

        <div className={`pr-layout${ready ? " pr-ready" : ""}`}>

          {/* Page header */}
          <div className="pr-page-header pr-anim pr-d0">
            <div className="pr-page-title">Account</div>
            <div className="pr-page-path">
              cdrlogo.com / <span>profile</span>
            </div>
          </div>

          <div className="pr-body">

            {/* ── Sidebar ── */}
            <div className="pr-sidebar">

              <div className="pr-id-card pr-anim pr-d1">
                <div className="pr-id-top">
                  <div className="pr-avatar">{initials}</div>
                  <div className="pr-user-name">{user?.name || "Anonymous"}</div>
                  <div className="pr-user-email">{user?.email}</div>
                </div>
                <div className="pr-id-meta">
                  <div className="pr-meta-row">
                    <span className="pr-meta-key">Status</span>
                    <span className="pr-status-dot">Active</span>
                  </div>
                  <div className="pr-meta-row">
                    <span className="pr-meta-key">Role</span>
                    <span className={`pr-role-tag${user?.role === "admin" ? " admin" : ""}`}>
                      {user?.role === "admin" ? "Admin" : "Member"}
                    </span>
                  </div>
                  <div className="pr-meta-row">
                    <span className="pr-meta-key">Joined</span>
                    <span className="pr-meta-val">
                      {join ? join.toLocaleDateString("en-GB") : "-"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pr-stat-row pr-anim pr-d2">
                <div className="pr-stat-box">
                  <div className="pr-stat-n green">{favorites.length}</div>
                  <div className="pr-stat-lbl">Saved</div>
                </div>
                <div className="pr-stat-box">
                  <div className="pr-stat-n">{count ?? 0}</div>
                  <div className="pr-stat-lbl">Downloads</div>
                </div>
              </div>

              <div className="pr-anim pr-d3">
                <button className="pr-signout" onClick={() => signOut({ callbackUrl: "/" })}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sign out
                </button>
              </div>
            </div>

            {/* ── Main panel ── */}
            <div className="pr-main pr-anim pr-d2">

              {/* Tabs */}
              <div className="pr-tabs">
                <button
                  className={`pr-tab${tab === "saved" ? " active" : ""}`}
                  onClick={() => setTab("saved")}
                >
                  Saved logos <span className="pr-count">{favorites.length}</span>
                </button>
                <button
                  className={`pr-tab${tab === "uploads" ? " active" : ""}`}
                  onClick={() => setTab("uploads")}
                >
                  My uploads <span className="pr-count">{myLogos.length}</span>
                </button>
              </div>

              {tab === "saved" && (
                <>
                  <div className="pr-section-bar">
                    <div className="pr-section-label">Collection / Liked logos</div>
                    <Link href="/brands" className="pr-browse-link">
                      Browse library
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </Link>
                  </div>

                  <div className="pr-grid">
                    {loading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="pr-skel" style={{ animationDelay: `${i * 25}ms` }}>
                          <div className="pr-skel-img" />
                          <div className="pr-skel-foot">
                            <div className="pr-skel-line" />
                            <div className="pr-skel-line s" />
                          </div>
                        </div>
                      ))
                    ) : favorites.length === 0 ? (
                      <div className="pr-empty">
                        <div className="pr-empty-title">No saved logos</div>
                        <div className="pr-empty-sub">Logos you save will appear here for quick access.</div>
                        <Link href="/brands" className="pr-empty-link">
                          Browse logos
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                          </svg>
                        </Link>
                      </div>
                    ) : (
                      favorites.map((logo, i) => (
                        <div
                          key={logo.id}
                          className="pr-logo"
                          style={{ animationDelay: `${i * 25}ms` }}
                        >
                          <Link href={`/logo/${logo.slug}`} style={{ textDecoration: "none" }}>
                            <div className="pr-logo-img">
                              {logo.webpUrl
                                ? <img src={logo.webpUrl} alt={logo.logoName} />
                                : <div className="pr-no-img" />
                              }
                              <div className="pr-view-overlay">
                                <span className="pr-view-pill">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                  View
                                </span>
                              </div>
                            </div>
                            <div className="pr-logo-foot">
                              <div className="pr-logo-name">{logo.logoName}</div>
                              <div className="pr-logo-cat">{logo.category}</div>
                            </div>
                          </Link>

                          <button
                            className={`pr-remove${removing === logo.id ? " busy" : ""}`}
                            title="Remove from saved"
                            onClick={(e) => { e.preventDefault(); handleUnfavorite(logo.id); }}
                          >
                            {removing === logo.id ? (
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M21 12a9 9 0 1 1-9-9" />
                              </svg>
                            ) : (
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            )}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

              {tab === "uploads" && (
                <>
                  {/* Upload form */}
                  <div className="pr-upload-card">
                    <div className="pr-upload-title">Upload a logo</div>

                    <div className="pr-type-toggle">
                      <button
                        type="button"
                        className={`pr-type-btn${sourceType === "svg" ? " active" : ""}`}
                        onClick={() => handleTypeChange("svg")}
                        disabled={uploading}
                      >
                        SVG file
                      </button>
                      <button
                        type="button"
                        className={`pr-type-btn${sourceType === "ai" ? " active" : ""}`}
                        onClick={() => handleTypeChange("ai")}
                        disabled={uploading}
                      >
                        AI file
                      </button>
                    </div>

                    <form onSubmit={handleUpload}>
                      <div className="pr-field">
                        <label className="pr-label">Logo name</label>
                        <input
                          className="pr-upload-input"
                          placeholder="e.g. Acme Corp"
                          value={logoName}
                          onChange={(e) => setLogoName(e.target.value)}
                          disabled={uploading}
                        />
                      </div>
                      <div className="pr-field">
                        <label className="pr-label">
                          {sourceType === "svg" ? "SVG file" : "AI file"}
                        </label>
                        <label className={`pr-drop${selectedFileName ? " has-file" : ""}`}>
                          {selectedFileName ? (
                            <>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                              <span className="pr-drop-filename">{selectedFileName}</span>
                              <span className="pr-drop-hint">Click to choose a different file</span>
                            </>
                          ) : (
                            <>
                              <span>Click to choose {sourceType === "svg" ? "an .svg" : "an .ai"} file</span>
                              <span className="pr-drop-hint">
                                {sourceType === "svg" ? ".svg only" : ".ai or .pdf"}
                              </span>
                            </>
                          )}
                          <input
                            ref={fileRef}
                            type="file"
                            accept={sourceType === "svg" ? ".svg,image/svg+xml" : ".ai,.pdf,application/pdf,application/postscript"}
                            style={{ display: "none" }}
                            disabled={uploading}
                            onChange={handleFileChange}
                          />
                        </label>
                      </div>
                      <button className="pr-upload-btn" type="submit" disabled={uploading}>
                        {uploading ? "Uploading…" : "Upload logo"}
                      </button>
                      {step && <div className="pr-upload-step">{step}</div>}
                      {uploadError && <div className="pr-upload-err">{uploadError}</div>}
                      {uploadSuccess && <div className="pr-upload-ok">{uploadSuccess}</div>}
                    </form>
                  </div>

                  {/* My uploads grid */}
                  <div className="pr-section-bar">
                    <div className="pr-section-label">
                      My library
                      <span className="pr-count">{myLogos.length}</span>
                    </div>
                  </div>

                  <div className="pr-grid">
                    {loadingMyLogos ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="pr-skel" style={{ animationDelay: `${i * 25}ms` }}>
                          <div className="pr-skel-img" />
                          <div className="pr-skel-foot">
                            <div className="pr-skel-line" />
                            <div className="pr-skel-line s" />
                          </div>
                        </div>
                      ))
                    ) : myLogos.length === 0 ? (
                      <div className="pr-empty">
                        <div className="pr-empty-title">You haven't uploaded any logos yet</div>
                        <div className="pr-empty-sub">Use the form above to add your first one.</div>
                      </div>
                    ) : (
                      myLogos.map((logo, i) => (
                        <div
                          key={logo.id}
                          className="pr-logo"
                          style={{ animationDelay: `${i * 25}ms` }}
                        >
                          <Link href={`/logo/${logo.slug}`} style={{ textDecoration: "none" }}>
                            <div className="pr-logo-img">
                              {logo.webpUrl
                                ? <img src={logo.webpUrl} alt={logo.logoName} />
                                : <div className="pr-no-img" />
                              }
                              <div className="pr-view-overlay">
                                <span className="pr-view-pill">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                  View
                                </span>
                              </div>
                            </div>
                            <div className="pr-logo-foot">
                              <div className="pr-logo-name">{logo.logoName}</div>
                              <span className={`pr-status-tag ${logo.publishStatus === "Published" ? "published" : "draft"}`}>
                                {logo.publishStatus}
                              </span>
                            </div>
                          </Link>

                          <button
                            className={`pr-remove${deletingId === logo.id ? " busy" : ""}`}
                            title="Delete logo"
                            onClick={(e) => { e.preventDefault(); handleDeleteMyLogo(logo); }}
                          >
                            {deletingId === logo.id ? (
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M21 12a9 9 0 1 1-9-9" />
                              </svg>
                            ) : (
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            )}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  );
}