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
    const [isFavourited, setIsFavourited] = useState(false);
    const [favLoading, setFavLoading] = useState(false);

    const [logo, setLogo] = useState(null);
    const [related, setRelated] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [agreed, setAgreed] = useState(false);
    const [selectedFormat, setSelectedFormat] = useState(null);
    const [downloading, setDownloading] = useState(false);
    const [svgCopied, setSvgCopied] = useState(false);
    const [copiedColor, setCopiedColor] = useState(null);
    const [expandDesc, setExpandDesc] = useState(false);
    const [ready, setReady] = useState(false);
    const [policyOpen, setPolicyOpen] = useState(false);

    const [policyFirstName, setPolicyFirstName] = useState("");
    const [policyLastName, setPolicyLastName] = useState("");
    const [policyEmail, setPolicyEmail] = useState("");
    const [policyMessage, setPolicyMessage] = useState("");
    const [policySubmitting, setPolicySubmitting] = useState(false);
    const [policyDone, setPolicyDone] = useState(false);
    const PANTONE_COLORS = [
        { name: "PANTONE 186 C", hex: "#C8102E" },
        { name: "PANTONE 485 C", hex: "#DA291C" },
        { name: "PANTONE 1655 C", hex: "#FF6720" },
        { name: "PANTONE 021 C", hex: "#FE5000" },
        { name: "PANTONE 1235 C", hex: "#FFC72C" },
        { name: "PANTONE 109 C", hex: "#FFD100" },
        { name: "PANTONE 368 C", hex: "#78BE21" },
        { name: "PANTONE 354 C", hex: "#00B140" },
        { name: "PANTONE 347 C", hex: "#009A44" },
        { name: "PANTONE 3435 C", hex: "#00543C" },
        { name: "PANTONE 3258 C", hex: "#00B294" },
        { name: "PANTONE 320 C", hex: "#00A3AD" },
        { name: "PANTONE 299 C", hex: "#00A9E0" },
        { name: "PANTONE Process Blue C", hex: "#0085CA" },
        { name: "PANTONE 2935 C", hex: "#0057B8" },
        { name: "PANTONE 286 C", hex: "#0033A0" },
        { name: "PANTONE 2758 C", hex: "#00205B" },
        { name: "PANTONE 2685 C", hex: "#330072" },
        { name: "PANTONE 2597 C", hex: "#511778" },
        { name: "PANTONE Purple C", hex: "#7B2D8E" },
        { name: "PANTONE Rubine Red C", hex: "#CE0058" },
        { name: "PANTONE 7425 C", hex: "#A6093D" },
        { name: "PANTONE Rose Red C", hex: "#E40046" },
        { name: "PANTONE Pink C", hex: "#D6006C" },
        { name: "PANTONE Black C", hex: "#2D2926" },
        { name: "PANTONE Cool Gray 11 C", hex: "#53565A" },
        { name: "PANTONE Cool Gray 8 C", hex: "#888B8D" },
        { name: "PANTONE Cool Gray 5 C", hex: "#B1B3B3" },
        { name: "PANTONE 877 C", hex: "#8A8D8F" },
        { name: "PANTONE 8001 C", hex: "#C7C9C7" },
        { name: "PANTONE Warm Gray 11 C", hex: "#6F6259" },
        { name: "PANTONE Warm Gray 8 C", hex: "#97877A" },
        { name: "PANTONE 476 C", hex: "#4A3728" },
        { name: "PANTONE 4695 C", hex: "#5C4033" },
        { name: "PANTONE 4625 C", hex: "#3B2412" },
        { name: "PANTONE 7585 C", hex: "#C5621F" },
        { name: "PANTONE 7597 C", hex: "#A0522D" },
        { name: "PANTONE 7621 C", hex: "#A6192E" },
        { name: "PANTONE 7625 C", hex: "#B13D38" },
        { name: "PANTONE 1795 C", hex: "#DA291C" },
        { name: "PANTONE 1788 C", hex: "#EF3340" },
        { name: "PANTONE 7417 C", hex: "#E1553F" },
        { name: "PANTONE 1585 C", hex: "#FF8200" },
        { name: "PANTONE 1375 C", hex: "#FF9E1B" },
        { name: "PANTONE 7406 C", hex: "#F2A900" },
        { name: "PANTONE 382 C", hex: "#C4D600" },
        { name: "PANTONE 361 C", hex: "#43B02A" },
        { name: "PANTONE 7710 C", hex: "#6CACE4" },
        { name: "PANTONE 7462 C", hex: "#1B365D" },
        { name: "PANTONE 2767 C", hex: "#002554" },
    ];

    useEffect(() => {
        const t = setTimeout(() => setReady(true), 60);
        return () => clearTimeout(t);
    }, []);

    const handleFavourite = async () => {
        if (!session?.user?.id) { alert("Please sign in to save favourites."); return; }
        if (favLoading) return;
        const prev = isFavourited;
        setIsFavourited(!prev);
        setFavLoading(true);
        try {
            const res = await fetch("/api/logo/favourite/toggle", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ logoId: logo.id }),
            });
            const data = await res.json();
            if (res.ok) setIsFavourited(data.favourited);
            else { setIsFavourited(prev); alert(data.error || "Failed to update favourite"); }
        } catch { setIsFavourited(prev); alert("Network error. Try again."); }
        finally { setFavLoading(false); }
    };

    useEffect(() => {
        if (!slug) return;
        async function fetchLogo() {
            setLoading(true); setError(null);
            try {
                const res = await fetch("/api/logo/fetch/slug", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ slug }),
                });
                const data = await res.json();
                console.log(data);
                setLogo(data.data || data);
                setRelated(data.related || []);
            } catch (e) { setError(e.message); }
            finally { setLoading(false); }
        }
        fetchLogo();
    }, [slug]);

    useEffect(() => {
        if (!logo?.id || !session?.user?.id) return;
        fetch("/api/logo/favourite/status", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ logoId: logo.id }),
        }).then(r => r.json()).then(d => setIsFavourited(d.favourited));
    }, [logo?.id, session?.user?.id]);

    const formatBadges = [
        { key: "ai", label: "AI", cls: "fmt-ai", icon: "AI", sizeKey: "aifilesize" },
        { key: "cdr", label: "CDR", cls: "fmt-cdr", icon: "CDR", sizeKey: "cdrfilesize" },
        { key: "svg", label: "SVG", cls: "fmt-svg", icon: "SVG", sizeKey: "svgfilesize" },
        { key: "png", label: "PNG", cls: "fmt-png", icon: "PNG", sizeKey: "pngfilesize" },
    ];

    const handleDownload = async () => {
        if (!agreed || !logo?.id || !selectedFormat) return;
        if (status === "loading") return;
        setDownloading(true);
        try {
            const res = await fetch("/api/logo/download/default", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ logoId: logo.id, format: selectedFormat, user: session?.user?.id || "" }),
            });
            if (!res.ok) {
                const errData = await res.json();
               alert("Try again later");
               console.error("Download failed:", errData?.error || "Unknown error");
                return;
            }
            if ((res.headers.get("Content-Type") || "").includes("application/json")) {
                const errData = await res.json();
                alert(`❌ ${errData?.error || "Unknown error"}`);
                return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `${logo.slug}.${selectedFormat}`;
            document.body.appendChild(a); a.click();
            document.body.removeChild(a); URL.revokeObjectURL(url);
        } catch (e) { alert("❌ Network error. Please try again."); }
        finally { setDownloading(false); }
    };

    const handleCopySvg = () => {
        if (!logo?.svgContent) return;
        navigator.clipboard.writeText(logo.svgContent);
        setSvgCopied(true); setTimeout(() => setSvgCopied(false), 2000);
    };

    const handleCopyColor = (hex) => {
        navigator.clipboard.writeText(hex);
        setCopiedColor(hex); setTimeout(() => setCopiedColor(null), 2000);
    };

    const handlePolicySubmit = async () => {
        if (!policyFirstName.trim() || !policyLastName.trim() || !policyEmail.trim() || !policyMessage.trim()) return;
        setPolicySubmitting(true);
        try {
            await fetch("/api/report/create", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ logoId: logo.id, logoName: logo.logoName, firstName: policyFirstName, lastName: policyLastName, reporterEmail: policyEmail, reason: policyMessage }),
            });
            setPolicyDone(true);
            setTimeout(() => { setPolicyDone(false); setPolicyOpen(false); setPolicyFirstName(""); setPolicyLastName(""); setPolicyEmail(""); setPolicyMessage(""); }, 2500);
        } catch (e) { console.error(e); }
        finally { setPolicySubmitting(false); }
    };

    const formatDate = (d) => {
        if (!d) return "—";
        return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    };

    const parsedColors = (() => {
        if (!logo?.id) return [];
        let seed = 0;
        for (const ch of String(logo.id)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
        const shuffled = [...PANTONE_COLORS];
        for (let i = shuffled.length - 1; i > 0; i--) {
            seed = (seed * 1103515245 + 12345) >>> 0;
            const j = seed % (i + 1);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    })();

    const hexToRgb = (hex) => {
        const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        return `${r}, ${g}, ${b}`;
    };

    const buildEnrichedDescription = (desc, relatedLogos) => {
        if (!desc || relatedLogos.length === 0) return { __html: desc || "" };
        const sentences = desc.split(/(?<=[.!?])\s+/);
        const insertAt = Math.min(2, sentences.length - 1);
        const extra = `<span class="desc-related-hint"> </span>`;
        sentences.splice(insertAt + 1, 0, extra);
        return { __html: sentences.join(" ") };
    };

    const fullDesc = logo?.description || "";
    const shortDesc = fullDesc.length > 200 ? fullDesc.slice(0, 200) + "…" : fullDesc;

    const enrichedFull = buildEnrichedDescription(fullDesc, related);
    const enrichedShort = buildEnrichedDescription(shortDesc, related);

    if (loading) return <LoadingSkeleton dark={dark} />;
    if (error) return <ErrorState dark={dark} message={error} onBack={() => router.back()} />;
    if (!logo) return null;

    // ── parse tags safely ─────────────────────────────────────────────────────
    const logoTags = Array.isArray(logo.tags) ? logo.tags : [];



    // ── parse category safely (string or array) ────────────────────────────────
    const logoCategories = Array.isArray(logo.category)
        ? logo.category.filter(Boolean)
        : (logo.category ? [logo.category] : []);
    const primaryCategory = logoCategories[0] || "";
    const categoryDisplay = logoCategories.join(", ");

    return (
        <>
            <style>{`
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&family=DM+Sans:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  [data-theme="dark"] {
    --bg:#09090f; --surface:#111118; --surface2:#18181f;
    --border:rgba(255,255,255,0.08); --border2:rgba(255,255,255,0.12);
    --heading:#ffffff; --body:rgba(255,255,255,0.7); --muted:rgba(255,255,255,0.4);
    --dot:rgba(255,255,255,0.035); --input-bg:rgba(255,255,255,0.04);
  }
  [data-theme="light"] {
    --bg:#f4f4f8; --surface:#ffffff; --surface2:#f8f8fc;
    --border:rgba(0,0,0,0.08); --border2:rgba(0,0,0,0.12);
    --heading:#0a0a14; --body:rgba(0,0,0,0.65); --muted:rgba(0,0,0,0.4);
    --dot:rgba(0,0,0,0.035); --input-bg:rgba(0,0,0,0.03);
  }

  .page-container { min-height:100vh; display:flex; flex-direction:column; background:var(--bg); }
  .space { height:80px; background:var(--bg); }
  .page { min-height:80vh; background:var(--bg); font-family:'Sora',sans-serif; transition:background .35s; padding-bottom:80px; }

  .fmt-select-size { font-size:8px; font-weight:600; color:var(--muted); opacity:.75; letter-spacing:.3px; }

  .dot-grid {
    position:fixed; inset:0;
    background-image:radial-gradient(var(--dot) 1px,transparent 1px);
    background-size:30px 30px;
    pointer-events:none; z-index:0;
  }

  .breadcrumb {
    position:relative; z-index:1;
    max-width:1100px; margin:0 auto;
    padding:16px 24px 0;
    display:flex; align-items:center; gap:6px;
    font-size:12px; color:var(--muted); font-family:'DM Sans',sans-serif;
  }
  .breadcrumb a { color:var(--muted); text-decoration:none; transition:color .2s; }
  .breadcrumb a:hover { color:#07A626; }
  .breadcrumb-sep { opacity:.4; }
  .breadcrumb-current { color:var(--body); font-weight:600; }

  .layout {
    position:relative; z-index:1;
    max-width:1100px; margin:0 auto;
    padding:20px 24px 0;
    display:grid; grid-template-columns:1fr 1fr;
    gap:20px; align-items:start;
  }

  .left { display:flex; flex-direction:column; gap:16px; position:sticky; top:96px; align-self:start; }

  .preview-card { background:var(--surface); border:1px solid var(--border); border-radius:14px; overflow:hidden; position:relative; width:100%; }

  .preview-img-wrap {
    position:relative; width:100%; aspect-ratio:3/2;
    display:flex; align-items:center; justify-content:center; padding:20px;
    background:repeating-conic-gradient(rgba(128,128,128,0.06) 0% 25%,transparent 0% 50%) 0 0/20px 20px;
  }
  .preview-img-wrap img { width:100%; height:100%; object-fit:contain; user-select:none; pointer-events:none; -webkit-user-drag:none; }
  .preview-img-placeholder { font-size:clamp(22px,4vw,40px); font-weight:900; color:var(--heading); letter-spacing:-2px; opacity:.85; }

  .img-overlay-bar {
    position:absolute; bottom:0; left:0; right:0;
    display:flex; align-items:center; justify-content:space-between;
    padding:20px 10px 8px;
    background:linear-gradient(to top,rgba(0,0,0,0.55) 0%,transparent 100%);
    pointer-events:none;
  }
  .img-fmt-pill { font-size:10px; font-weight:700; color:rgba(255,255,255,0.9); background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.25); border-radius:4px; padding:2px 7px; backdrop-filter:blur(4px); letter-spacing:.4px; }
  .img-dl-count { display:flex; align-items:center; gap:4px; font-size:11px; font-weight:600; color:rgba(255,255,255,0.85); }

  .meta-strip { display:flex; flex-wrap:wrap; gap:0; border-top:1px solid var(--border); flex-shrink:0; }
  .meta-item { flex:1; min-width:100px; padding:12px 14px; border-right:1px solid var(--border); display:flex; align-items:center; gap:8px; }
  .meta-item:last-child { border-right:none; }
  .meta-icon { color:var(--muted); flex-shrink:0; }
  .meta-label { font-size:9px; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:.5px; margin-bottom:2px; }
  .meta-value { font-size:11px; font-weight:600; color:var(--body); }
  .meta-value a { color:#07A626; text-decoration:none; }
  .meta-value a:hover { text-decoration:underline; }
  .license-free { color:#f59e0b !important; }

  .card { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:18px; }
  .card-title { font-size:13px; font-weight:700; color:var(--heading); margin-bottom:12px; }
  .about-text { font-family:'DM Sans',sans-serif; font-size:13px; color:var(--body); line-height:1.75; }

  .about-text .desc-inline-link {
    color:#07A626; font-weight:600; text-decoration:none;
    border-bottom:1px dashed rgba(7,166,38,0.4);
    transition:border-color .2s, color .2s;
  }
  .about-text .desc-inline-link:hover { border-bottom-color:#07A626; }

  .desc-related-hint {
    display:block; margin-top:10px;
    font-size:12px; color:var(--muted);
    font-style:italic;
  }
  .desc-related-hint a.desc-inline-link { font-style:normal; }

  .see-more-btn { background:none; border:none; cursor:pointer; color:#07A626; font-size:12px; font-weight:600; font-family:'Sora',sans-serif; padding:0; margin-top:8px; display:inline-block; }

  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .info-cell { background:var(--surface2); border:1px solid var(--border); border-radius:9px; padding:10px 14px; display:flex; align-items:center; gap:9px; }
  .info-cell-icon { width:28px; height:28px; border-radius:7px; background:rgba(7,166,38,.1); border:1px solid rgba(7,166,38,.2); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#07A626; }
  .info-cell-label { font-size:9px; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:.5px; }
  .info-cell-value { font-size:12px; font-weight:700; color:var(--heading); margin-top:1px; }

  .right { display:flex; flex-direction:column; gap:16px; }

  .dl-card { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:18px; }
  .dl-header { display:flex; align-items:center; gap:8px; margin-bottom:4px; }
  .dl-icon { width:28px; height:28px; border-radius:7px; background:rgba(7,166,38,.12); border:1px solid rgba(7,166,38,.22); display:flex; align-items:center; justify-content:center; color:#07A626; flex-shrink:0; }
  .dl-title { font-size:14px; font-weight:800; color:var(--heading); }
  .dl-sub { font-size:11px; color:var(--muted); font-family:'DM Sans',sans-serif; margin-bottom:16px; margin-top:2px; }

  .fmt-select-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin-bottom:16px; }
  .fmt-select-btn { padding:10px 4px 8px; border-radius:10px; border:1.5px solid; display:flex; flex-direction:column; align-items:center; gap:5px; font-family:'Sora',sans-serif; cursor:pointer; transition:transform .15s,box-shadow .15s,opacity .15s; }
  .fmt-select-btn:hover { transform:translateY(-2px); opacity:.9; }
  .fmt-selected { box-shadow:0 0 0 2px #07A626 !important; }
  .fmt-select-icon { width:36px; height:36px; border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:800; letter-spacing:.2px; }
  .fmt-select-ext { font-size:9px; font-weight:700; letter-spacing:.4px; }

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

  [data-theme="light"] .fmt-ai  { background:rgba(234,179,8,.06);  }
  [data-theme="light"] .fmt-cdr { background:rgba(239,68,68,.06);  }
  [data-theme="light"] .fmt-svg { background:rgba(34,197,94,.06);  }
  [data-theme="light"] .fmt-png { background:rgba(59,130,246,.06); }

  .dl-divider { height:1px; background:var(--border); margin:14px 0; }

  .agree-row { display:flex; align-items:flex-start; gap:8px; margin-bottom:12px; font-family:'DM Sans',sans-serif; }
  .agree-check { width:15px; height:15px; margin-top:1px; flex-shrink:0; accent-color:#07A626; cursor:pointer; }
  .agree-text { font-size:11px; color:var(--muted); line-height:1.5; }
  .agree-text a { color:#07A626; text-decoration:none; }
  .agree-text a:hover { text-decoration:underline; }

  .policy-accordion { margin-bottom:14px; }
  .privacy-note { display:flex; align-items:center; justify-content:space-between; padding:8px 10px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; font-size:10px; color:var(--muted); font-family:'DM Sans',sans-serif; cursor:pointer; transition:border-color .2s,border-radius .2s; width:100%; }
  .privacy-note:hover { border-color:var(--border2); }
  .privacy-note.open { border-radius:8px 8px 0 0; border-bottom-color:transparent; }
  .privacy-note-left { display:flex; align-items:center; gap:6px; }
  .privacy-chevron { color:var(--muted); opacity:.5; transition:transform .22s cubic-bezier(.22,1,.36,1); }
  .privacy-chevron.open { transform:rotate(180deg); opacity:.8; }
  .policy-panel { background:rgba(245,158,11,.04); border:1px solid var(--border); border-top:1px solid rgba(245,158,11,.2); border-radius:0 0 8px 8px; overflow:hidden; animation:policy-slide .22s cubic-bezier(.22,1,.36,1); }
  @keyframes policy-slide { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
  .policy-body { padding:14px; }
  .policy-title { display:flex; align-items:center; gap:7px; font-size:12px; font-weight:800; color:#f59e0b; margin-bottom:10px; }
  .policy-text { font-family:'DM Sans',sans-serif; font-size:11.5px; color:var(--body); line-height:1.65; }
  .policy-text strong { color:var(--heading); font-weight:600; }
  .policy-form-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px; }
  .policy-field { display:flex; flex-direction:column; gap:4px; margin-top:8px; }
  .policy-label { font-size:9px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.5px; }
  .policy-input-wrap { display:flex; align-items:center; gap:7px; background:var(--input-bg); border:1px solid var(--border); border-radius:8px; padding:7px 10px; color:var(--muted); transition:border-color .2s; }
  .policy-input-wrap:focus-within { border-color:rgba(245,158,11,.4); }
  .policy-input { flex:1; background:none; border:none; outline:none; font-family:'DM Sans',sans-serif; font-size:12px; color:var(--heading); }
  .policy-input::placeholder { color:var(--muted); opacity:.55; }
  .policy-textarea { width:100%; background:var(--input-bg); border:1px solid var(--border); border-radius:8px; padding:8px 10px; outline:none; resize:none; font-family:'DM Sans',sans-serif; font-size:12px; color:var(--heading); line-height:1.6; transition:border-color .2s; }
  .policy-textarea::placeholder { color:var(--muted); opacity:.55; }
  .policy-textarea:focus { border-color:rgba(245,158,11,.4); }
  .policy-submit-btn { width:100%; margin-top:12px; padding:11px; border-radius:9px; border:none; cursor:pointer; font-family:'Sora',sans-serif; font-size:12px; font-weight:700; background:linear-gradient(135deg,#ef4444,#dc2626); color:#fff; display:flex; align-items:center; justify-content:center; gap:6px; transition:opacity .2s,transform .15s; }
  .policy-submit-btn:hover { opacity:.9; transform:translateY(-1px); }
  .policy-submit-btn:disabled { opacity:.5; cursor:not-allowed; transform:none; }
  .policy-success { display:flex; flex-direction:column; align-items:center; gap:8px; padding:12px 0 4px; font-size:12px; font-weight:600; color:#22c55e; font-family:'Sora',sans-serif; }

  .dl-btn { width:100%; padding:12px; border-radius:10px; border:none; cursor:pointer; font-family:'Sora',sans-serif; font-size:13px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:7px; transition:opacity .2s,transform .15s; }
  .dl-btn-active { background:linear-gradient(135deg,#07A626,#059c1f); color:#fff; }
  .dl-btn-active:hover { opacity:.9; transform:translateY(-1px); }
  .dl-btn-disabled { background:var(--surface2); color:var(--muted); cursor:not-allowed; border:1px solid var(--border); }

  .svg-card { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:16px; }
  .svg-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
  .svg-title { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:700; color:var(--heading); }
  .svg-title-dot { width:7px; height:7px; border-radius:50%; background:#22c55e; }
  .copy-svg-btn { padding:4px 10px; background:var(--input-bg); border:1px solid var(--border); border-radius:6px; font-size:10px; font-weight:600; color:var(--muted); cursor:pointer; font-family:'Sora',sans-serif; transition:background .2s,color .2s,border-color .2s; display:flex; align-items:center; gap:4px; }
  .copy-svg-btn:hover { background:rgba(7,166,38,.1); border-color:rgba(7,166,38,.3); color:#07A626; }
  .copy-svg-btn.copied { color:#22c55e; border-color:rgba(34,197,94,.4); background:rgba(34,197,94,.08); }
  .svg-code { background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:10px 12px; font-size:10px; font-family:'Courier New',monospace; color:var(--muted); line-height:1.6; max-height:90px; overflow:hidden; white-space:pre-wrap; word-break:break-all; }

  .colors-card { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:16px; max-height:360px; overflow-y:auto; }
  .colors-header { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:700; color:var(--heading); margin-bottom:12px; position:sticky; top:0; background:var(--surface); padding-bottom:4px; z-index:1; }
  .colors-card::-webkit-scrollbar { width:5px; }
  .colors-card::-webkit-scrollbar-track { background:transparent; }
  .colors-card::-webkit-scrollbar-thumb { background:var(--border2); border-radius:10px; }
  .colors-dot { width:7px; height:7px; border-radius:50%; background:#3b82f6; }
  .color-row { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px; border:1px solid var(--border); margin-bottom:6px; background:var(--surface2); transition:border-color .2s; }
  .color-row:last-child { margin-bottom:0; }
  .color-row:hover { border-color:var(--border2); }
  .color-swatch { width:30px; height:30px; border-radius:7px; flex-shrink:0; border:1px solid rgba(255,255,255,0.1); }
  .color-info { flex:1; min-width:0; }
  .color-name { font-size:11px; font-weight:700; color:var(--heading); }
  .color-hex  { font-size:10px; color:var(--muted); font-family:'Courier New',monospace; margin-top:1px; }
  .color-rgb  { font-size:9px; color:var(--muted); opacity:.7; margin-top:1px; }
  .color-copy-btn { width:26px; height:26px; border-radius:6px; background:var(--input-bg); border:1px solid var(--border); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--muted); transition:background .2s,color .2s,border-color .2s; flex-shrink:0; }
  .color-copy-btn:hover { background:rgba(7,166,38,.1); border-color:rgba(7,166,38,.3); color:#07A626; }
  .color-copy-btn.copied { color:#22c55e; border-color:rgba(34,197,94,.4); }

  .ad-card { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; color:var(--muted); font-size:11px; font-family:'DM Sans',sans-serif; min-height:120px; opacity:.5; }

  .fav-btn { position:absolute; top:10px; left:10px; width:30px; height:30px; border-radius:8px; background:rgba(0,0,0,0.45); backdrop-filter:blur(6px); border:1px solid rgba(255,255,255,0.12); display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:15px; transition:transform .2s,background .2s; z-index:5; }
  [data-theme="light"] .fav-btn { background:rgba(255,255,255,0.75); border-color:rgba(0,0,0,0.1); }
  .fav-btn:hover { transform:scale(1.15); }
  .fav-btn.active { background:rgba(239,68,68,0.2); border-color:rgba(239,68,68,0.4); }

  /* ── SEO ADDITION: Clickable Tags Section ─────────────────────────────── */
  .tags-section { position:relative; z-index:1; max-width:1100px; margin:32px auto 0; padding:0 24px; }
  .tags-header { display:flex; align-items:center; gap:8px; margin-bottom:14px; }
  .tags-grid { display:flex; flex-wrap:wrap; gap:8px; }
  .tag-pill {
    display:inline-flex; align-items:center; gap:5px;
    padding:6px 13px; border-radius:100px;
    background:var(--surface); border:1px solid var(--border);
    font-size:11px; font-weight:600; color:var(--body);
    font-family:'DM Sans',sans-serif;
    text-decoration:none; transition:border-color .2s,color .2s,background .2s;
    white-space:nowrap;
  }
  .tag-pill:hover { border-color:rgba(7,166,38,.45); color:#07A626; background:rgba(7,166,38,.06); }
  .tag-hash { color:var(--muted); font-size:10px; }

  .related-section { position:relative; z-index:1; max-width:1100px; margin:40px auto 0; padding:0 24px; }
  .related-header { display:flex; align-items:center; gap:10px; margin-bottom:18px; }
  .related-title { font-size:16px; font-weight:800; color:var(--heading); letter-spacing:-0.3px; }
  .related-badge { padding:2px 8px; border-radius:100px; background:rgba(7,166,38,.1); border:1px solid rgba(7,166,38,.2); font-size:10px; font-weight:700; color:#07A626; }
  .related-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; }
  .related-card { background:var(--surface); border:1px solid var(--border); border-radius:12px; overflow:hidden; cursor:pointer; text-decoration:none; display:block; transition:border-color .2s,transform .2s,box-shadow .2s; }
  .related-card:hover { border-color:var(--border2); transform:translateY(-3px); box-shadow:0 10px 28px rgba(0,0,0,0.18); }
  [data-theme="dark"] .related-card:hover { box-shadow:0 10px 28px rgba(0,0,0,0.45); }
  .related-img-wrap { width:100%; aspect-ratio:1/1; display:flex; align-items:center; justify-content:center; padding:16px; background:repeating-conic-gradient(rgba(128,128,128,0.05) 0% 25%,transparent 0% 50%) 0 0/16px 16px; }
  .related-img-wrap img { width:100%; height:100%; object-fit:contain; }
  .related-initials { font-size:22px; font-weight:900; color:var(--muted); letter-spacing:-1px; }
  .related-body { padding:8px 10px 10px; }
  .related-name { font-size:12px; font-weight:700; color:var(--heading); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:4px; }
  .related-formats { display:flex; gap:3px; flex-wrap:wrap; margin-bottom:5px; }
  .rf-tag { padding:1px 5px; border-radius:3px; font-size:8px; font-weight:700; border:1px solid; letter-spacing:.2px; }
  .rf-ai  { background:rgba(234,179,8,.08);  border-color:rgba(234,179,8,.25); color:#f59e0b; }
  .rf-cdr { background:rgba(239,68,68,.08);  border-color:rgba(239,68,68,.25); color:#ef4444; }
  .rf-svg { background:rgba(34,197,94,.08);  border-color:rgba(34,197,94,.25); color:#22c55e; }
  .rf-png { background:rgba(59,130,246,.08); border-color:rgba(59,130,246,.25); color:#3b82f6; }
  .related-colors { display:flex; gap:3px; }
  .related-color-dot { width:8px; height:8px; border-radius:50%; border:1px solid rgba(255,255,255,0.12); }
  [data-theme="light"] .related-color-dot { border-color:rgba(0,0,0,0.08); }

  .anim { opacity:0; transform:translateY(14px); transition:opacity .5s cubic-bezier(.22,1,.36,1),transform .5s cubic-bezier(.22,1,.36,1); }
  .ready .anim { opacity:1; transform:translateY(0); }
  .d0{transition-delay:0ms;} .d1{transition-delay:60ms;} .d2{transition-delay:120ms;} .d3{transition-delay:180ms;} .d4{transition-delay:240ms;}

  @media (max-width:768px) {
    .layout { grid-template-columns:1fr; padding:16px 16px 0; }
    .left { position:static; }
    .fmt-select-grid { grid-template-columns:repeat(4,1fr); }
    .info-grid { grid-template-columns:1fr 1fr; }
    .meta-strip { flex-direction:row; flex-wrap:wrap; }
    .meta-item { min-width:0; flex:1; border-right:1px solid var(--border); border-bottom:none; }
    .meta-item:last-child { border-right:none; }
    .related-section { padding:0 16px; }
    .tags-section { padding:0 16px; }
    .related-grid { grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); }
  }
  @media (max-width:480px) {
    .preview-img-wrap { padding:16px; }
    .fmt-select-grid { grid-template-columns:repeat(2,1fr); }
    .info-grid { grid-template-columns:1fr; }
    .meta-strip { flex-direction:column; }
    .meta-item { border-right:none; border-bottom:1px solid var(--border); }
    .meta-item:last-child { border-bottom:none; }
    .related-grid { grid-template-columns:repeat(2,1fr); }
    .policy-form-row { grid-template-columns:1fr; }
  }
  @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
`}</style>

            <div className="page-container">
                <Navbar />
                <div className="space" />
                <div className="page">
                    <div className="dot-grid" />

                    <nav className="breadcrumb" aria-label="breadcrumb">
                        <Link href="/">Home</Link>
                        <span className="breadcrumb-sep">/</span>
                        {primaryCategory && (
                            <>
                                <Link href={`/search/${encodeURIComponent(primaryCategory)}`}>{primaryCategory}</Link>
                                <span className="breadcrumb-sep">/</span>
                            </>
                        )}
                        <span className="breadcrumb-current">{logo.logoName}</span>
                    </nav>

                    <div className={`layout${ready ? " ready" : ""}`}>

                        {/* ── LEFT ── */}
                        <div className="left">

                            <div className="preview-card anim d0">
                                <button
                                    className={`fav-btn${isFavourited ? " active" : ""}`}
                                    onClick={handleFavourite} disabled={favLoading}
                                    title={isFavourited ? "Remove from favourites" : "Add to favourites"}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24"
                                        fill={isFavourited ? "#ef4444" : "none"}
                                        stroke={isFavourited ? "#ef4444" : "currentColor"}
                                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                        style={{ transition: "fill .2s,stroke .2s" }}>
                                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                    </svg>
                                </button>

                                <div className="preview-img-wrap">
                                    {logo.webpUrl
                                        ? <img src={logo.webpUrl} alt={logo.altText || `${logo.logoName} logo PNG SVG vector`} draggable={false} onDragStart={e => e.preventDefault()} />
                                        : <div className="preview-img-placeholder" dangerouslySetInnerHTML={{ __html: logo.svgContent || logo.logoName }} />
                                    }
                                    <div className="img-overlay-bar">
                                        <span className="img-fmt-pill">{selectedFormat ? selectedFormat.toUpperCase() : "SVG"}</span>
                                        <span className="img-dl-count">
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                            </svg>
                                            {logo.downloadedNumberByPeople || 0}
                                        </span>
                                    </div>
                                </div>

                                <div className="meta-strip">
                                    <div className="meta-item">
                                        <svg className="meta-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
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
                                                        {logo.website.replace(/^https?:\/\//, "")}
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

                            <div className="card anim d1">
                                <div className="card-title">About This Logo</div>
                                <p
                                    className="about-text"
                                    dangerouslySetInnerHTML={expandDesc ? enrichedFull : enrichedShort}
                                />
                                {fullDesc.length > 200 && (
                                    <button className="see-more-btn" onClick={() => setExpandDesc(v => !v)}>
                                        {expandDesc ? "See Less ↑" : "See More →"}
                                    </button>
                                )}
                            </div>

                            <div className="card anim d2">
                                <div className="info-grid">
                                    {[
                                        { icon: "🏷️", label: "Brand", value: logo.brand },
                                        { icon: "⚙️", label: "Industry", value: logo.industry },
                                        { icon: "🌍", label: "Country", value: logo.country },
                                        { icon: "📁", label: "Category", value: categoryDisplay },
                                    ]
                                        .filter(item => item.value && item.value.trim() !== "")
                                        .map(item => (
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

                            <div className="ad-card anim d3" />
                        </div>

                        {/* ── RIGHT ── */}
                        <div className="right">
                            <div className="dl-card anim d0">
                                <div className="dl-header">
                                    <div className="dl-icon">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                    </div>
                                    <div className="dl-title">Download {logo.logoName}</div>
                                </div>
                                <div className="dl-sub">Choose your preferred format</div>

                                <div className="fmt-select-grid">
                                    {formatBadges.map(fmt => (
                                        <button key={fmt.key}
                                            className={`fmt-select-btn ${fmt.cls}${selectedFormat === fmt.key ? " fmt-selected" : ""}`}
                                            onClick={() => setSelectedFormat(fmt.key)}>
                                            <div className="fmt-select-icon">{fmt.icon}</div>
                                            <div className="fmt-select-ext">.{fmt.key}</div>
                                            <div className="fmt-select-size">
                                                {logo?.[fmt.sizeKey] && logo[fmt.sizeKey] !== "0 KB" ? logo[fmt.sizeKey] : "—"}
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                <div className="dl-divider" />

                                <div className="agree-row">
                                    <input type="checkbox" className="agree-check" id="agree" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
                                    <label htmlFor="agree" className="agree-text">
                                        I agree to the <Link href="/term">Terms of Use</Link>. Logos are for educational and reference purposes only.
                                    </label>
                                </div>

                                <div className="policy-accordion">
                                    <button className={`privacy-note${policyOpen ? " open" : ""}`} onClick={() => setPolicyOpen(v => !v)}>
                                        <div className="privacy-note-left">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                            </svg>
                                            Trademark &amp; Copyright Policy
                                        </div>
                                        <svg className={`privacy-chevron${policyOpen ? " open" : ""}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="6 9 12 15 18 9" />
                                        </svg>
                                    </button>

                                    {policyOpen && (
                                        <div className="policy-panel">
                                            <div className="policy-body">
                                                <div className="policy-title">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                                    </svg>
                                                    Trademark &amp; Copyright Policy
                                                </div>
                                                <p className="policy-text">We respect all trademark and copyright owners. Logos on this site are for <strong>educational and reference purposes only</strong>. All rights belong to their respective owners.</p>
                                                <p className="policy-text" style={{ marginTop: 8 }}>If you are the rightful owner and believe your content is used without permission, please <strong>contact us from your official email</strong> with proof of ownership.</p>
                                                <p className="policy-text" style={{ marginTop: 8 }}>We will review and <strong>remove the content within 24 hours</strong> if verified.</p>

                                                {policyDone ? (
                                                    <div className="policy-success">
                                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <circle cx="12" cy="12" r="10" /><polyline points="9 12 11 14 15 10" />
                                                        </svg>
                                                        Report submitted successfully
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="policy-form-row">
                                                            <div className="policy-field" style={{ marginTop: 12 }}>
                                                                <div className="policy-label">FIRST NAME</div>
                                                                <div className="policy-input-wrap">
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                                                    <input className="policy-input" type="text" placeholder="John" value={policyFirstName} onChange={e => setPolicyFirstName(e.target.value)} />
                                                                </div>
                                                            </div>
                                                            <div className="policy-field" style={{ marginTop: 12 }}>
                                                                <div className="policy-label">LAST NAME</div>
                                                                <div className="policy-input-wrap">
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                                                    <input className="policy-input" type="text" placeholder="Doe" value={policyLastName} onChange={e => setPolicyLastName(e.target.value)} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="policy-field">
                                                            <div className="policy-label">EMAIL ADDRESS</div>
                                                            <div className="policy-input-wrap">
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                                                                <input className="policy-input" type="email" placeholder="you@company.com" value={policyEmail} onChange={e => setPolicyEmail(e.target.value)} />
                                                            </div>
                                                        </div>
                                                        <div className="policy-field">
                                                            <div className="policy-label">MESSAGE</div>
                                                            <textarea className="policy-textarea" placeholder="Please describe the copyright issue…" rows={3} value={policyMessage} onChange={e => setPolicyMessage(e.target.value)} />
                                                        </div>
                                                        <button className="policy-submit-btn" onClick={handlePolicySubmit}
                                                            disabled={!policyFirstName.trim() || !policyLastName.trim() || !policyEmail.trim() || !policyMessage.trim() || policySubmitting}>
                                                            {policySubmitting ? (
                                                                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>Submitting…</>
                                                            ) : (
                                                                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>Submit Report</>
                                                            )}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    className={`dl-btn ${agreed && selectedFormat ? "dl-btn-active" : "dl-btn-disabled"}`}
                                    onClick={handleDownload} disabled={!agreed || !selectedFormat || downloading}>
                                    {downloading ? (
                                        <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>Preparing Download…</>
                                    ) : (
                                        <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>{selectedFormat ? `Download ${selectedFormat.toUpperCase()}` : "Select a Format"}</>
                                    )}
                                </button>
                            </div>

                            {logo.svgContent && (
                                <div className="svg-card anim d1">
                                    <div className="svg-header">
                                        <div className="svg-title"><span className="svg-title-dot" />SVG Code</div>
                                        <button className={`copy-svg-btn${svgCopied ? " copied" : ""}`} onClick={handleCopySvg}>
                                            {svgCopied
                                                ? <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Copied!</>
                                                : <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>Copy SVG</>
                                            }
                                        </button>
                                    </div>
                                    <div className="svg-code">{logo.svgContent.slice(0, 300)}{logo.svgContent.length > 300 ? "…" : ""}</div>
                                </div>
                            )}

                            {parsedColors.length > 0 && (
                                <div className="colors-card anim d2">
                                    <div className="colors-header"><span className="colors-dot" />Official Brand Colors</div>
                                    {parsedColors.map((color, i) => (
                                        <div className="color-row" key={i}>
                                            <div className="color-swatch" style={{ background: color.hex }} />
                                            <div className="color-info">
                                                <div className="color-name">{color.name}</div>
                                                <div className="color-hex">{color.hex.toUpperCase()}</div>
                                                <div className="color-rgb">RGB: {hexToRgb(color.hex)}</div>
                                            </div>
                                            <button className={`color-copy-btn${copiedColor === color.hex ? " copied" : ""}`} onClick={() => handleCopyColor(color.hex)} title="Copy hex">
                                                {copiedColor === color.hex
                                                    ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                    : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                                                }
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="ad-card anim d3" style={{ minHeight: 160 }} />
                        </div>
                    </div>

                    {/* ── SEO ADDITION: Clickable Tags Section ────────────────────────────── */}
                    {logoTags.length > 0 && (
                        <div className="tags-section">
                            <div className="tags-header">
                                <div className="related-title">Tags</div>
                                <span className="related-badge">{logoTags.length}</span>
                            </div>
                            <div className="tags-grid">
                                {logoTags.map((tag, i) => (
                                    <Link
                                        key={i}
                                        href={`/search/${encodeURIComponent(tag)}`}
                                        className="tag-pill"
                                    >
                                        <span className="tag-hash">#</span>{tag}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {related.length > 0 && (
                        <div className="related-section">
                            <div className="related-header">
                                <div className="related-title">Related Logos</div>
                                <span className="related-badge">{related.length}</span>
                            </div>
                            <div className="related-grid">
                                {related.map(rel => {
                                    const relColors = (() => {
                                        try {
                                            if (!rel.brandColors) return [];
                                            return Array.isArray(rel.brandColors) ? rel.brandColors : JSON.parse(rel.brandColors);
                                        } catch { return []; }
                                    })();
                                    return (
                                        <Link key={rel.slug} href={`/logo/${rel.slug}`} className="related-card">
                                            <div className="related-img-wrap">
                                                {rel.webpUrl
                                                    ? <img src={rel.webpUrl} alt={rel.logoName} />
                                                    : <div className="related-initials">{(rel.brand || rel.logoName)?.slice(0, 2).toUpperCase()}</div>
                                                }
                                            </div>
                                            <div className="related-body">
                                                <div className="related-name">{rel.brand || rel.logoName}</div>
                                                <div className="related-formats">
                                                    <span className="rf-tag rf-ai">AI</span>
                                                    <span className="rf-tag rf-cdr">CDR</span>
                                                    <span className="rf-tag rf-svg">SVG</span>
                                                    <span className="rf-tag rf-png">PNG</span>
                                                </div>
                                                {relColors.length > 0 && (
                                                    <div className="related-colors">
                                                        {relColors.slice(0, 4).map((c, i) => (
                                                            <span key={i} className="related-color-dot" style={{ background: c.hex || c }} />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    )}
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
                <div key={i} className="sk" style={{ height: i === 0 ? 280 : 60, marginBottom: 12, background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)", animationDelay: `${i * 120}ms` }} />
            ))}
        </div>
    );
}

function ErrorState({ dark, message, onBack }) {
    return (
        <div style={{ minHeight: "100vh", background: dark ? "#09090f" : "#f4f4f8", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, fontFamily: "Sora, sans-serif", color: dark ? "#fff" : "#0a0a14" }}>
            <div style={{ fontSize: 36 }}>😕</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Logo not found</div>
            <div style={{ color: "rgba(128,128,128,0.7)", fontSize: 13 }}>{message}</div>
            <button onClick={onBack} style={{ marginTop: 8, padding: "8px 20px", borderRadius: 8, background: "#07A626", color: "#fff", border: "none", fontFamily: "Sora, sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>← Go Back</button>
        </div>
    );
}
