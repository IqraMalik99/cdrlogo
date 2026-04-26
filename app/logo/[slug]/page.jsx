"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTheme } from "../../context/ThemeContext";
import Navbar from "../../components/Navbar";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Footer from "../../components/Footer";

export default function LogoDetail() {
    const { slug } = useParams();
    const router = useRouter();
    const { dark } = useTheme();
    const { data: session, status } = useSession();

    const [logo, setLogo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [agreed, setAgreed] = useState(false);
    const [selectedFormat, setSelectedFormat] = useState(null);
    const [downloading, setDownloading] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState(null);
    const [svgCopied, setSvgCopied] = useState(false);
    const [copiedColor, setCopiedColor] = useState(null);
    const [expandDesc, setExpandDesc] = useState(false);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setReady(true), 60);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        if (!slug) return;
        async function fetchLogo() {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch("/api/logo/fetch/slug", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ slug }),
                });
                if (!res.ok) throw new Error("Logo not found");
                const data = await res.json();
                setLogo(data.data || data);
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        }
        fetchLogo();
    }, [slug]);

    // Static display-only format badges — derived from logo data
    // Always show all 4 format boxes regardless of URL availability
const formatBadges = [
    { key: "ai",  label: "AI",  cls: "fmt-ai",  icon: "AI",  sizeKey: "aifilesize"  },
    { key: "cdr", label: "CDR", cls: "fmt-cdr", icon: "CDR", sizeKey: "cdrfilesize" },
    { key: "svg", label: "SVG", cls: "fmt-svg", icon: "SVG", sizeKey: "svgfilesize" },
    { key: "png", label: "PNG", cls: "fmt-png", icon: "PNG", sizeKey: "pngfilesize" },
];
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

    const handleDownload = async () => {
        if (!agreed || !logo?.id || !selectedFormat) return;
        if (status === "loading") return;

        setDownloading(true);
        setDownloadUrl(null);

        try {
            ///request for if use signed url
            const res = await fetch("/api/logo/download/default", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ logoId: logo.id, format: selectedFormat, user: session?.user?.id || "" }),
            });


            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${logo.slug}.${selectedFormat}`;
            a.click();
            URL.revokeObjectURL(url);


            // if signe url  
            // const data = await res.json();

            // // ⏱️ 2 second delay before showing result boot
            // // await sleep(2000);

            // if (data.downloadUrl) {
            //     setDownloadUrl(data.downloadUrl);
            // }

        } catch (e) {
            console.error("Download failed", e);
        } finally {
            setDownloading(false);
        }
    };

    const handleStartDownload = () => {
        if (!downloadUrl) return;
        window.location.href = downloadUrl; // GET request triggers file download
    };

    const handleCopySvg = () => {
        if (!logo?.svgContent) return;
        navigator.clipboard.writeText(logo.svgContent);
        setSvgCopied(true);
        setTimeout(() => setSvgCopied(false), 2000);
    };

    const handleCopyColor = (hex) => {
        navigator.clipboard.writeText(hex);
        setCopiedColor(hex);
        setTimeout(() => setCopiedColor(null), 2000);
    };

    const formatDate = (d) => {
        if (!d) return "—";
        return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    };

    const parsedColors = (() => {
        try {
            if (!logo?.brandColors) return [];
            return Array.isArray(logo.brandColors) ? logo.brandColors : JSON.parse(logo.brandColors);
        } catch { return []; }
    })();

    const hexToRgb = (hex) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `${r}, ${g}, ${b}`;
    };

    if (loading) return <LoadingSkeleton dark={dark} />;
    if (error) return <ErrorState dark={dark} message={error} onBack={() => router.back()} />;
    if (!logo) return null;

    const shortDesc = logo.description?.length > 200
        ? logo.description.slice(0, 200) + "…"
        : logo.description;

    return (
        <>
            <style>{`
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&family=DM+Sans:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  [data-theme="dark"] {
    --bg:         #09090f;
    --surface:    #111118;
    --surface2:   #18181f;
    --border:     rgba(255,255,255,0.08);
    --border2:    rgba(255,255,255,0.12);
    --heading:    #ffffff;
    --body:       rgba(255,255,255,0.7);
    --muted:      rgba(255,255,255,0.4);
    --dot:        rgba(255,255,255,0.035);
    --input-bg:   rgba(255,255,255,0.04);
  }
  [data-theme="light"] {
    --bg:         #f4f4f8;
    --surface:    #ffffff;
    --surface2:   #f8f8fc;
    --border:     rgba(0,0,0,0.08);
    --border2:    rgba(0,0,0,0.12);
    --heading:    #0a0a14;
    --body:       rgba(0,0,0,0.65);
    --muted:      rgba(0,0,0,0.4);
    --dot:        rgba(0,0,0,0.035);
    --input-bg:   rgba(0,0,0,0.03);
  }

  .page-container {
    min-height: 100vh;
    display: flex; flex-direction: column;
    background: var(--bg);
  }
  .space { height: 80px; background: var(--bg); }

  .page {
    min-height: 80vh;
    background: var(--bg);
    font-family: 'Sora', sans-serif;
    transition: background 0.35s;
    padding-bottom: 80px;
  }
    .fmt-select-size {
    font-size: 8px;
    font-weight: 600;
    color: var(--muted);
    opacity: 0.75;
    letter-spacing: .3px;
}
  .dot-grid {
    position: fixed; inset: 0;
    background-image: radial-gradient(var(--dot) 1px, transparent 1px);
    background-size: 30px 30px;
    pointer-events: none; z-index: 0;
  }

  .breadcrumb {
    position: relative; z-index: 1;
    max-width: 1100px; margin: 0 auto;
    padding: 16px 24px 0;
    display: flex; align-items: center; gap: 6px;
    font-size: 12px; color: var(--muted);
    font-family: 'DM Sans', sans-serif;
  }
  .breadcrumb a { color: var(--muted); text-decoration: none; transition: color .2s; }
  .breadcrumb a:hover { color: #07A626; }
  .breadcrumb-sep { opacity: 0.4; }
  .breadcrumb-current { color: var(--body); font-weight: 600; }

 .layout {
  position: relative; z-index: 1;
  max-width: 1100px; margin: 0 auto;
  padding: 20px 24px 0;
  display: grid;
  grid-template-columns: 420px 1fr 300px;
  gap: 20px;
  align-items: start;
}

  /* ── LEFT: sticky, scrollable content below square preview ── */
  .left {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: sticky;
  top: 96px;
  align-self: start;
}

  /* ── Preview card: only the image area is 1:1 ── */
  .preview-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    overflow: hidden;
    position: relative;
    width: 100%;
  }

 .preview-img-wrap {
  width: 100%;
  aspect-ratio: 1 / 1;
  max-height: 380px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background: repeating-conic-gradient(rgba(128,128,128,0.06) 0% 25%, transparent 0% 50%) 0 0 / 20px 20px;
}

.mid {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: sticky;
  top: 96px;
  align-self: start;
}

  .preview-img-wrap img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    user-select: none;
    pointer-events: none;
    -webkit-user-drag: none;
  }

  .preview-img-placeholder {
    font-size: clamp(28px, 6vw, 52px);
    font-weight: 900; color: var(--heading);
    letter-spacing: -2px; opacity: 0.85;
  }

  .meta-strip {
    display: flex; flex-wrap: wrap; gap: 0;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }
  .meta-item {
    flex: 1; min-width: 100px;
    padding: 12px 14px;
    border-right: 1px solid var(--border);
    display: flex; align-items: center; gap: 8px;
  }
  .meta-item:last-child { border-right: none; }
  .meta-icon { color: var(--muted); flex-shrink: 0; }
  .meta-label { font-size: 9px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 2px; }
  .meta-value { font-size: 11px; font-weight: 600; color: var(--body); }
  .meta-value a { color: #07A626; text-decoration: none; }
  .meta-value a:hover { text-decoration: underline; }
  .license-free { color: #f59e0b !important; }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 18px;
  }
  .card-title { font-size: 13px; font-weight: 700; color: var(--heading); margin-bottom: 12px; }
  .about-text {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px; color: var(--body); line-height: 1.7;
  }
  .see-more-btn {
    background: none; border: none; cursor: pointer;
    color: #07A626; font-size: 12px; font-weight: 600;
    font-family: 'Sora', sans-serif;
    padding: 0; margin-top: 6px; display: inline-block;
  }

  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .info-cell {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 9px;
    padding: 10px 14px;
    display: flex; align-items: center; gap: 9px;
  }
  .info-cell-icon {
    width: 28px; height: 28px; border-radius: 7px;
    background: rgba(7,166,38,.1);
    border: 1px solid rgba(7,166,38,.2);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; color: #07A626;
  }
  .info-cell-label { font-size: 9px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: .5px; }
  .info-cell-value { font-size: 12px; font-weight: 700; color: var(--heading); margin-top: 1px; }

  /* ── RIGHT COLUMN ── */
  .right { display: flex; flex-direction: column; gap: 16px; }

  .dl-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 18px;
  }
  .dl-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .dl-icon {
    width: 28px; height: 28px; border-radius: 7px;
    background: rgba(7,166,38,.12);
    border: 1px solid rgba(7,166,38,.22);
    display: flex; align-items: center; justify-content: center;
    color: #07A626; flex-shrink: 0;
  }
  .dl-title { font-size: 14px; font-weight: 800; color: var(--heading); }
  .dl-sub {
    font-size: 11px; color: var(--muted);
    font-family: 'DM Sans', sans-serif;
    margin-bottom: 16px; margin-top: 2px;
  }

  .fmt-select-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin-bottom: 16px;
  }
  .fmt-select-btn {
    padding: 10px 4px 8px;
    border-radius: 10px;
    border: 1.5px solid;
    display: flex; flex-direction: column; align-items: center; gap: 5px;
    font-family: 'Sora', sans-serif;
    cursor: pointer;
    transition: transform .15s, box-shadow .15s, opacity .15s;
    position: relative;
  }
  .fmt-select-btn:hover { transform: translateY(-2px); opacity: .9; }
  .fmt-selected { box-shadow: 0 0 0 2px #07A626 !important; }
  .fmt-select-icon {
    width: 36px; height: 36px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 800; letter-spacing: .2px;
  }
  .fmt-select-ext { font-size: 9px; font-weight: 700; letter-spacing: .4px; }

  .fmt-ai  { background:rgba(234,179,8,.08);  border-color:rgba(234,179,8,.25); }
  .fmt-ai  .fmt-select-icon { background:rgba(234,179,8,.18); color:#f59e0b; }
  .fmt-ai  .fmt-select-ext  { color:#f59e0b; }
  .fmt-cdr { background:rgba(239,68,68,.08);  border-color:rgba(239,68,68,.25); }
  .fmt-cdr .fmt-select-icon { background:rgba(239,68,68,.18); color:#ef4444; }
  .fmt-cdr .fmt-select-ext  { color:#ef4444; }
  .fmt-svg { background:rgba(34,197,94,.08);  border-color:rgba(34,197,94,.25); }
  .fmt-svg .fmt-select-icon { background:rgba(34,197,94,.18); color:#22c55e; }
  .fmt-svg .fmt-select-ext  { color:#22c55e; }
  .fmt-png { background:rgba(59,130,246,.08); border-color:rgba(59,130,246,.25); }
  .fmt-png .fmt-select-icon { background:rgba(59,130,246,.18); color:#3b82f6; }
  .fmt-png .fmt-select-ext  { color:#3b82f6; }
  .fmt-all { background:rgba(139,92,246,.08); border-color:rgba(139,92,246,.25); }
  .fmt-all .fmt-select-icon { background:rgba(139,92,246,.18); color:#a78bfa; font-size:9px; }
  .fmt-all .fmt-select-ext  { color:#a78bfa; }

  [data-theme="light"] .fmt-ai  { background:rgba(234,179,8,.06);  }
  [data-theme="light"] .fmt-cdr { background:rgba(239,68,68,.06);  }
  [data-theme="light"] .fmt-svg { background:rgba(34,197,94,.06);  }
  [data-theme="light"] .fmt-png { background:rgba(59,130,246,.06); }
  [data-theme="light"] .fmt-all { background:rgba(139,92,246,.06); }

  .dl-divider { height: 1px; background: var(--border); margin: 14px 0; }

  .agree-row {
    display: flex; align-items: flex-start; gap: 8px;
    margin-bottom: 12px;
    font-family: 'DM Sans', sans-serif;
  }
  .agree-check {
    width: 15px; height: 15px; margin-top: 1px; flex-shrink: 0;
    accent-color: #07A626; cursor: pointer;
  }
  .agree-text { font-size: 11px; color: var(--muted); line-height: 1.5; }
  .agree-text a { color: #07A626; text-decoration: none; }
  .agree-text a:hover { text-decoration: underline; }

  .privacy-note {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 10px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 10px; color: var(--muted);
    margin-bottom: 14px;
    font-family: 'DM Sans', sans-serif;
    cursor: pointer;
    transition: border-color .2s;
  }
  .privacy-note:hover { border-color: var(--border2); }
  .privacy-note-left { display: flex; align-items: center; gap: 6px; }
  .privacy-chevron { color: var(--muted); opacity: .5; }

  .dl-btn {
    width: 100%; padding: 12px;
    border-radius: 10px;
    border: none; cursor: pointer;
    font-family: 'Sora', sans-serif;
    font-size: 13px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; gap: 7px;
    transition: opacity .2s, transform .15s;
  }
  .dl-btn-active { background: linear-gradient(135deg, #07A626, #059c1f); color: #fff; }
  .dl-btn-active:hover { opacity: .9; transform: translateY(-1px); }
  .dl-btn-disabled {
    background: var(--surface2); color: var(--muted);
    cursor: not-allowed; border: 1px solid var(--border);
  }

  .dl-ready-box {
    margin-top: 12px; padding: 14px;
    background: rgba(7,166,38,.06);
    border: 1px solid rgba(7,166,38,.2);
    border-radius: 11px;
    display: flex; flex-direction: column; gap: 10px;
    animation: fadeSlideUp .3s cubic-bezier(.22,1,.36,1);
  }
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .dl-ready-btn {
    width: 100%; padding: 10px 14px;
    background: rgba(7,166,38,.12);
    border: 1.5px solid rgba(7,166,38,.35);
    border-radius: 9px;
    color: #07A626; font-family: 'Sora', sans-serif;
    font-size: 12px; font-weight: 700; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 6px;
    transition: background .2s, border-color .2s, transform .15s;
  }
  .dl-ready-btn:hover {
    background: rgba(7,166,38,.2); border-color: rgba(7,166,38,.55);
    transform: translateY(-1px);
  }
  [data-theme="light"] .dl-ready-btn { color: #059c1f; }

  .svg-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; padding: 16px;
  }
  .svg-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 10px;
  }
  .svg-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--heading); }
  .svg-title-dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; }
  .copy-svg-btn {
    padding: 4px 10px; background: var(--input-bg);
    border: 1px solid var(--border); border-radius: 6px;
    font-size: 10px; font-weight: 600; color: var(--muted);
    cursor: pointer; font-family: 'Sora', sans-serif;
    transition: background .2s, color .2s, border-color .2s;
    display: flex; align-items: center; gap: 4px;
  }
  .copy-svg-btn:hover { background: rgba(7,166,38,.1); border-color: rgba(7,166,38,.3); color: #07A626; }
  .copy-svg-btn.copied { color: #22c55e; border-color: rgba(34,197,94,.4); background: rgba(34,197,94,.08); }
  .svg-code {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 8px; padding: 10px 12px;
    font-size: 10px; font-family: 'Courier New', monospace;
    color: var(--muted); line-height: 1.6;
    max-height: 90px; overflow: hidden;
    white-space: pre-wrap; word-break: break-all;
  }

  .colors-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; padding: 16px;
  }
  .colors-header {
    display: flex; align-items: center; gap: 6px;
    font-size: 12px; font-weight: 700; color: var(--heading);
    margin-bottom: 12px;
  }
  .colors-dot { width: 7px; height: 7px; border-radius: 50%; background: #3b82f6; }
  .color-row {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 10px; border-radius: 8px;
    border: 1px solid var(--border); margin-bottom: 6px;
    background: var(--surface2); transition: border-color .2s;
  }
  .color-row:last-child { margin-bottom: 0; }
  .color-row:hover { border-color: var(--border2); }
  .color-swatch {
    width: 30px; height: 30px; border-radius: 7px; flex-shrink: 0;
    border: 1px solid rgba(255,255,255,0.1);
  }
  .color-info { flex: 1; min-width: 0; }
  .color-name { font-size: 11px; font-weight: 700; color: var(--heading); }
  .color-hex  { font-size: 10px; color: var(--muted); font-family: 'Courier New', monospace; margin-top: 1px; }
  .color-rgb  { font-size: 9px; color: var(--muted); opacity: .7; margin-top: 1px; }
  .color-copy-btn {
    width: 26px; height: 26px; border-radius: 6px;
    background: var(--input-bg); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: var(--muted);
    transition: background .2s, color .2s, border-color .2s; flex-shrink: 0;
  }
  .color-copy-btn:hover { background: rgba(7,166,38,.1); border-color: rgba(7,166,38,.3); color: #07A626; }
  .color-copy-btn.copied { color: #22c55e; border-color: rgba(34,197,94,.4); }

  .ad-card {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 6px; color: var(--muted); font-size: 11px;
    font-family: 'DM Sans', sans-serif;
    min-height: 120px; opacity: .5;
  }
  .ad-label { font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }

  /* Anim */
  .anim {
    opacity: 0; transform: translateY(14px);
    transition: opacity .5s cubic-bezier(.22,1,.36,1), transform .5s cubic-bezier(.22,1,.36,1);
  }
  .ready .anim { opacity: 1; transform: translateY(0); }
  .d0{transition-delay:0ms;} .d1{transition-delay:60ms;} .d2{transition-delay:120ms;}
  .d3{transition-delay:180ms;} .d4{transition-delay:240ms;}

  /* ── RESPONSIVE ── */
  @media (max-width: 900px) {
    .layout { grid-template-columns: 1fr; }
    .left { position: static; }
    .fmt-select-grid { grid-template-columns: repeat(4, 1fr); }
  }

@media (max-width: 1024px) {
  .layout { grid-template-columns: 380px 1fr; }
  .mid { display: none; }
}

@media (max-width: 768px) {
  .layout { grid-template-columns: 1fr; padding: 16px 16px 0; }
  .left { position: static; }
  .preview-img-wrap { padding: 20px; }
  .fmt-select-grid { grid-template-columns: repeat(4, 1fr); }
  .info-grid { grid-template-columns: 1fr 1fr; }
  .meta-strip { flex-direction: row; flex-wrap: wrap; }
  .meta-item { min-width: 0; flex: 1; border-right: 1px solid var(--border); border-bottom: none; }
  .meta-item:last-child { border-right: none; }
}

@media (max-width: 480px) {
  .preview-img-wrap { padding: 16px; }
  .fmt-select-grid { grid-template-columns: repeat(2, 1fr); }
  .info-grid { grid-template-columns: 1fr; }
  .meta-strip { flex-direction: column; }
  .meta-item { border-right: none; border-bottom: 1px solid var(--border); }
  .meta-item:last-child { border-bottom: none; }
}

  @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
`}</style>

            <div className="page-container">
                <Navbar />
                <div className="space"></div>
                <div className="page">
                    <div className="dot-grid" />

                    {/* Breadcrumb */}
                    <nav className="breadcrumb">
                        <Link href="/">Home</Link>
                        <span className="breadcrumb-sep">/</span>
                        {logo.category && (
                            <>
                                <Link href={`/search/${logo.category}`}>{logo.category}</Link>
                                <span className="breadcrumb-sep">/</span>
                            </>
                        )}
                        <span className="breadcrumb-current">{logo.logoName}</span>
                    </nav>

                    <div className={`layout${ready ? " ready" : ""}`}>
                        {/* ── LEFT ── */}
                        <div className="left">

                            {/* Preview */}
                            <div className="preview-card anim d0">
                                <div className="preview-img-wrap">
                                    {logo.webpUrl ? (
                                        <img
                                            src={logo.webpUrl}
                                            alt={logo.altText || logo.logoName}
                                            draggable={false}
                                            onDragStart={(e) => e.preventDefault()}
                                        />
                                    ) : (
                                        <div
                                            className="preview-img-placeholder"
                                            dangerouslySetInnerHTML={{ __html: logo.svgContent || logo.logoName }}
                                        />
                                    )}
                                </div>

                                <div className="meta-strip">
                                    <div className="meta-item">
                                        <svg className="meta-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                                        </svg>
                                        <div>
                                            <div className="meta-label">Added</div>
                                            <div className="meta-value">{formatDate(logo.createdAt)}</div>
                                        </div>
                                    </div>
                                    {logo.website && (
                                        <div className="meta-item">
                                            <svg className="meta-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
                                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                            </svg>
                                            <div>
                                                <div className="meta-label">Website</div>
                                                <div className="meta-value">
                                                    <a href={logo.website} target="_blank" rel="noopener noreferrer">
                                                        {logo.website.replace(/^https?:\/\//, '')}
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="meta-item">
                                        <svg className="meta-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                        </svg>
                                        <div>
                                            <div className="meta-label">License</div>
                                            <div className="meta-value license-free">{logo.license || "Free For Personal Use"}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* About */}
                            <div className="card anim d1">
                                <div className="card-title">About This Logo</div>
                                <p className="about-text">
                                    {expandDesc ? logo.description : shortDesc}
                                </p>
                                {logo.description?.length > 200 && (
                                    <button className="see-more-btn" onClick={() => setExpandDesc(v => !v)}>
                                        {expandDesc ? "See Less ↑" : "See More →"}
                                    </button>
                                )}
                            </div>

                            {/* Info grid */}
                            <div className="card anim d2">
                                <div className="info-grid">
                                    {[
                                        { icon: "🏷️", label: "Brand", value: logo.brand || "—" },
                                        { icon: "⚙️", label: "Industry", value: logo.industry || "—" },
                                        { icon: "🌍", label: "Country", value: logo.country || "—" },
                                        { icon: "📁", label: "Category", value: logo.category || "—" },
                                    ].map(item => (
                                        <div key={item.label} className="info-cell">
                                            <div className="info-cell-icon" style={{ fontSize: 14 }}>{item.icon}</div>
                                            <div>
                                                <div className="info-cell-label">{item.label}</div>
                                                <div className="info-cell-value">{item.value}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Ad space — left column */}
                            <div className="ad-card anim d3">
                                
                               
                            </div>
                        </div>

                        {/* ── MIDDLE: Ad column ── */}
                        <div className="mid">
                            <div className="ad-card" style={{ minHeight: 400 }}>
                               
                            </div>
                        </div>

                        {/* ── RIGHT ── */}
                        <div className="right">

                            {/* ── Download card ── */}
                            <div className="dl-card anim d0">

                                {/* Header */}
                                <div className="dl-header">
                                    <div className="dl-icon">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                    </div>
                                    <div className="dl-title">Download {logo.logoName}</div>
                                </div>
                                <div className="dl-sub">Choose your preferred format</div>

                                {/* ── Format selector ── */}

                             <div className="fmt-select-grid">
    {formatBadges.map(fmt => (
        <button
            key={fmt.key}
            className={`fmt-select-btn ${fmt.cls}${selectedFormat === fmt.key ? " fmt-selected" : ""}`}
            onClick={() => setSelectedFormat(fmt.key)}
        >
            <div className="fmt-select-icon">{fmt.icon}</div>
            <div className="fmt-select-ext">.{fmt.key}</div>
            <div className="fmt-select-size">
                {logo?.[fmt.sizeKey] && logo[fmt.sizeKey] !== "0 KB" ? logo[fmt.sizeKey] : "—"}
            </div>
        </button>
    ))}
</div>

                                <div className="dl-divider" />

                                {/* Agree checkbox */}
                                <div className="agree-row">
                                    <input
                                        type="checkbox"
                                        className="agree-check"
                                        id="agree"
                                        checked={agreed}
                                        onChange={e => setAgreed(e.target.checked)}
                                    />
                                    <label htmlFor="agree" className="agree-text">
                                        I agree to the <Link href="/term">Terms of Use</Link>. Logos are for educational and reference purposes only.
                                    </label>
                                </div>

                                {/* Privacy / copyright note */}
                                <div className="privacy-note">
                                    <div className="privacy-note-left">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                        </svg>
                                        Trademark &amp; Copyright Policy
                                    </div>
                                    <svg className="privacy-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                </div>

                                {/* Download button */}
                                <button
                                    className={`dl-btn ${agreed && selectedFormat ? "dl-btn-active" : "dl-btn-disabled"}`}
                                    onClick={handleDownload}
                                    disabled={!agreed || !selectedFormat || downloading}
                                >
                                    {downloading ? (
                                        <>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
                                                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                            </svg>
                                            Preparing Download…
                                        </>
                                    ) : (
                                        <>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                            </svg>
                                            {selectedFormat ? `Download ${selectedFormat.toUpperCase()}${selectedFormat === "all" ? " (.zip)" : ""}` : "Select a Format"}
                                        </>
                                    )}
                                </button>

                                {/* Download ready box — appears after API responds */}
                                {/* {downloadUrl && (
                                    <div className="dl-ready-box">
                                        <div className="dl-ready-icon">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                            </svg>
                                        </div>
                                        <div className="dl-ready-text">
                                            <div className="dl-ready-title">Your file is ready!</div>
                                            <div className="dl-ready-sub">Click the button below to save it to your device</div>
                                        </div>
                                        <button className="dl-ready-btn" onClick={handleStartDownload}>
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                            </svg>
                                            Click to Download on Device
                                        </button>
                                    </div>
                                )} */}
                            </div>

                            {/* SVG Code */}
                            {logo.svgContent && (
                                <div className="svg-card anim d1">
                                    <div className="svg-header">
                                        <div className="svg-title">
                                            <span className="svg-title-dot" />
                                            SVG Code
                                        </div>
                                        <button className={`copy-svg-btn${svgCopied ? " copied" : ""}`} onClick={handleCopySvg}>
                                            {svgCopied ? (
                                                <>
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                    Copied!
                                                </>
                                            ) : (
                                                <>
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                    </svg>
                                                    Copy SVG
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <div className="svg-code">{logo.svgContent.slice(0, 300)}{logo.svgContent.length > 300 ? "…" : ""}</div>
                                </div>
                            )}

                            {/* Brand Colors */}
                            {parsedColors.length > 0 && (
                                <div className="colors-card anim d2">
                                    <div className="colors-header">
                                        <span className="colors-dot" />
                                        Official Brand Colors
                                    </div>
                                    {parsedColors.map((color, i) => {
                                        const hex = color.hex || color;
                                        const name = color.name || `Color ${i + 1}`;
                                        return (
                                            <div className="color-row" key={i}>
                                                <div className="color-swatch" style={{ background: hex }} />
                                                <div className="color-info">
                                                    <div className="color-name">{name}</div>
                                                    <div className="color-hex">{hex.toUpperCase()}</div>
                                                    {hex.length === 7 && (
                                                        <div className="color-rgb">RGB: {hexToRgb(hex)}</div>
                                                    )}
                                                </div>
                                                <button
                                                    className={`color-copy-btn${copiedColor === hex ? " copied" : ""}`}
                                                    onClick={() => handleCopyColor(hex)}
                                                    title="Copy hex"
                                                >
                                                    {copiedColor === hex ? (
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="20 6 9 17 4 12" />
                                                        </svg>
                                                    ) : (
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Ad space — right column */}
                            <div className="ad-card anim d3" style={{ minHeight: 160 }}>
                             
                            </div>
                        </div>
                    </div>

                    <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
                </div>
                <Footer />
            </div>
        </>
    );
}

function LoadingSkeleton({ dark }) {
    return (
        <div style={{ minHeight: "100vh", background: dark ? "#09090f" : "#f4f4f8", padding: "20px 24px", fontFamily: "Sora, sans-serif" }}>
            <style>{`.sk{border-radius:8px;animation:sk-shimmer 1.4s ease-in-out infinite;}@keyframes sk-shimmer{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
            {[...Array(4)].map((_, i) => (
                <div key={i} className="sk" style={{
                    height: i === 0 ? 280 : 60, marginBottom: 12,
                    background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)",
                    animationDelay: `${i * 120}ms`
                }} />
            ))}
        </div>
    );
}

function ErrorState({ dark, message, onBack }) {
    return (
        <div style={{
            minHeight: "100vh", background: dark ? "#09090f" : "#f4f4f8",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 12, fontFamily: "Sora, sans-serif", color: dark ? "#fff" : "#0a0a14"
        }}>
            <div style={{ fontSize: 36 }}>😕</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Logo not found</div>
            <div style={{ color: "rgba(128,128,128,0.7)", fontSize: 13 }}>{message}</div>
            <button onClick={onBack} style={{
                marginTop: 8, padding: "8px 20px", borderRadius: 8,
                background: "#07A626", color: "#fff", border: "none",
                fontFamily: "Sora, sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer"
            }}>← Go Back</button>
        </div>
    );
}