"use client";

import { useState, useEffect } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useRouter, useParams } from "next/navigation";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import Image from "next/image";

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

const CATEGORY_PALETTE = [
  { bg: "rgba(239,68,68,.12)", border: "rgba(239,68,68,.28)", color: "#fca5a5", light: "#dc2626" },
  { bg: "rgba(234,179,8,.12)", border: "rgba(234,179,8,.28)", color: "#fde68a", light: "#b45309" },
  { bg: "rgba(59,130,246,.12)", border: "rgba(59,130,246,.28)", color: "#93c5fd", light: "#1d4ed8" },
  { bg: "rgba(168,85,247,.12)", border: "rgba(168,85,247,.28)", color: "#d8b4fe", light: "#7e22ce" },
  { bg: "rgba(7,166,38,.12)", border: "rgba(7,166,38,.28)", color: "#4ade80", light: "#15803d" },
  { bg: "rgba(236,72,153,.12)", border: "rgba(236,72,153,.28)", color: "#f9a8d4", light: "#be185d" },
  { bg: "rgba(20,184,166,.12)", border: "rgba(20,184,166,.28)", color: "#5eead4", light: "#0f766e" },
];
const catColorCache = {};
let catColorIdx = 0;
function getCatColor(name, dark) {
  const key = name || "General";
  if (!catColorCache[key]) {
    catColorCache[key] = CATEGORY_PALETTE[catColorIdx % CATEGORY_PALETTE.length];
    catColorIdx++;
  }
  const s = catColorCache[key];
  return { background: s.bg, border: `1px solid ${s.border}`, color: dark ? s.color : s.light };
}

// Simple markdown-like renderer for content
// Supports: # headings, **bold**, *italic*, `code`, ``` codeblock, > blockquote, - lists, blank lines = paragraphs
function renderContent(content) {
  if (!content || typeof content !== "string") return null;
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const elements = [];
  let i = 0;
  let key = 0;

  const parseInline = (text) => {
    const parts = [];
    let remaining = text;
    const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
    let last = 0, m;
    while ((m = re.exec(remaining)) !== null) {
      if (m.index > last) parts.push(remaining.slice(last, m.index));
      if (m[2]) parts.push(<strong key={key++}>{m[2]}</strong>);
      else if (m[3]) parts.push(<em key={key++}>{m[3]}</em>);
      else if (m[4]) parts.push(<code key={key++} className="inline-code">{m[4]}</code>);
      last = m.index + m[0].length;
    }
    if (last < remaining.length) parts.push(remaining.slice(last));
    return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : parts;
  };

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <div key={key++} className="code-block">
          {lang && <span className="code-lang">{lang}</span>}
          <pre><code>{codeLines.join("\n")}</code></pre>
        </div>
      );
      i++;
      continue;
    }

    // Headings
    if (line.startsWith("### ")) { elements.push(<h3 key={key++} className="c-h3">{parseInline(line.slice(4))}</h3>); i++; continue; }
    if (line.startsWith("## ")) { elements.push(<h2 key={key++} className="c-h2">{parseInline(line.slice(3))}</h2>); i++; continue; }
    if (line.startsWith("# ")) { elements.push(<h2 key={key++} className="c-h2">{parseInline(line.slice(2))}</h2>); i++; continue; }

    // Blockquote
    if (line.startsWith("> ")) { elements.push(<blockquote key={key++} className="c-quote">{parseInline(line.slice(2))}</blockquote>); i++; continue; }

    // List items
    if (line.startsWith("- ") || line.startsWith("* ")) {
      const listItems = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        listItems.push(<li key={key++}>{parseInline(lines[i].slice(2))}</li>);
        i++;
      }
      elements.push(<ul key={key++} className="c-list">{listItems}</ul>);
      continue;
    }

    // Numbered list
    if (/^\d+\. /.test(line)) {
      const listItems = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        listItems.push(<li key={key++}>{parseInline(lines[i].replace(/^\d+\. /, ""))}</li>);
        i++;
      }
      elements.push(<ol key={key++} className="c-olist">{listItems}</ol>);
      continue;
    }

    // Horizontal rule
    if (line.trim() === "---" || line.trim() === "***") { elements.push(<hr key={key++} className="c-hr" />); i++; continue; }

    // Empty line / paragraph break
    if (line.trim() === "") { i++; continue; }

    // Paragraph
    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("#") && !lines[i].startsWith(">") && !lines[i].startsWith("- ") && !lines[i].startsWith("* ") && !/^\d+\. /.test(lines[i]) && !lines[i].startsWith("```")) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      elements.push(<p key={key++} className="c-p">{parseInline(paraLines.join(" "))}</p>);
    } else {
      // Safety net: avoid an infinite loop if a line matched none of the
      // branches above and produced zero paragraph lines (e.g. a bare "#"
      // or "*" with no trailing space). Just skip it.
      i++;
    }
  }

  return elements;
}

export default function BlogPostClient({ initialBlog = null }) {
  const { dark } = useTheme();
  const router = useRouter();
  const { slug } = useParams();
  const theme = dark ? "dark" : "light";

  const [blog, setBlog] = useState(initialBlog);
  const [loading, setLoading] = useState(!initialBlog);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [heroError, setHeroError] = useState(false);

  useEffect(() => {
    // Server already fetched this post for metadata/JSON-LD — skip the
    // redundant client fetch and just fade the content in.
    if (initialBlog) return;
    if (!slug) return;

    const getBlog = async () => {
      try {
        setLoading(true);

        const r = await fetch("/api/blogs/slug", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        });

        if (!r.ok) {
          setError(r.status === 404 ? "not_found" : "error");
          setBlog(null);
          return;
        }

        const d = await r.json();
        console.log(d);

        // Handle either a raw blog object or a wrapper like { blog: {...} }
        const post = d && d.blog ? d.blog : d;

        if (!post || !post.content) {
          setError("not_found");
          setBlog(null);
          return;
        }

        setBlog(post);
        setError(null);
      } catch (e) {
        setError(e && e.message === "not_found" ? "not_found" : "error");
      } finally {
        setLoading(false);
      }
    };

    getBlog();
  }, [slug, initialBlog]);

  useEffect(() => {
    if (!loading && blog) { const t = setTimeout(() => setReady(true), 50); return () => clearTimeout(t); }
  }, [loading, blog]);

  const catStyle = blog ? getCatColor(blog.category || "General", dark) : {};
  const showHeroImage = !!(blog && blog.image) && !heroError;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        [data-theme="dark"]{--bg:#09090f;--sf:rgba(255,255,255,.03);--bd:rgba(255,255,255,.08);--hd:#fff;--bo:rgba(255,255,255,.7);--mt:rgba(255,255,255,.35);--dot:rgba(255,255,255,.035);--code-bg:rgba(255,255,255,.06);--code-bdr:rgba(255,255,255,.1);--code-clr:#a5f3c0;--quote-bd:rgba(7,166,38,.4);--quote-bg:rgba(7,166,38,.06);--hr:rgba(255,255,255,.08);--back-bg:rgba(255,255,255,.05);--back-bdr:rgba(255,255,255,.1);--back-clr:rgba(255,255,255,.5);--sk:rgba(255,255,255,.05);--ss:rgba(255,255,255,.09)}
        [data-theme="light"]{--bg:#f4f4f8;--sf:rgba(255,255,255,.9);--bd:rgba(0,0,0,.09);--hd:#0a0a14;--bo:rgba(0,0,0,.65);--mt:rgba(0,0,0,.4);--dot:rgba(0,0,0,.035);--code-bg:rgba(0,0,0,.05);--code-bdr:rgba(0,0,0,.1);--code-clr:#0f5132;--quote-bd:rgba(7,166,38,.4);--quote-bg:rgba(7,166,38,.04);--hr:rgba(0,0,0,.1);--back-bg:rgba(255,255,255,.7);--back-bdr:rgba(0,0,0,.1);--back-clr:rgba(0,0,0,.5);--sk:rgba(0,0,0,.05);--ss:rgba(0,0,0,.09)}
        .post-root{min-height:100vh;background:var(--bg);font-family:'Sora',sans-serif;padding:0 20px 100px;position:relative;overflow:hidden;transition:background .35s}
        .bg-glow{position:absolute;inset:0;pointer-events:none;z-index:0}
        .bg-glow::before{content:'';position:absolute;top:-4%;left:50%;transform:translateX(-50%);width:700px;height:300px;background:radial-gradient(ellipse,rgba(7,166,38,.09) 0%,transparent 68%);border-radius:50%;animation:glow 7s ease-in-out infinite}
        [data-theme="light"] .bg-glow::before{background:radial-gradient(ellipse,rgba(7,166,38,.05) 0%,transparent 68%)}
        @keyframes glow{0%,100%{opacity:1;transform:translateX(-50%) scale(1)}50%{opacity:.6;transform:translateX(-50%) scale(1.09)}}
        .dot-grid{position:absolute;inset:0;pointer-events:none;z-index:0;background-image:radial-gradient(var(--dot) 1px,transparent 1px);background-size:30px 30px}
        .inner{position:relative;z-index:1;max-width:760px;margin:0 auto}

        /* Back button */
        .back-btn{display:inline-flex;align-items:center;gap:7px;padding:8px 16px;background:var(--back-bg);border:1px solid var(--back-bdr);color:var(--back-clr);border-radius:9px;font-size:12px;font-weight:600;font-family:'Sora',sans-serif;cursor:pointer;margin:28px 0 0;transition:background .2s,border-color .2s,color .2s,transform .15s}
        .back-btn:hover{background:rgba(7,166,38,.1);border-color:rgba(7,166,38,.35);color:#4ade80;transform:translateX(-2px)}
        [data-theme="light"] .back-btn:hover{color:#15803d}

        /* Hero */
        .hero{opacity:0;transform:translateY(20px);transition:opacity .6s cubic-bezier(.22,1,.36,1),transform .6s cubic-bezier(.22,1,.36,1)}
        .hero.ready{opacity:1;transform:translateY(0)}
        .hero-cover{margin-top:32px;border-radius:18px;background:linear-gradient(135deg,rgba(7,166,38,.07),rgba(7,166,38,.02));border:1px solid var(--bd);height:340px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
        .hero-cover-glow{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 60%,rgba(7,166,38,.1) 0%,transparent 60%);pointer-events:none;z-index:2}
        .hero-img{width:100%;height:100%;object-fit:cover;object-position:center;position:absolute;inset:0;z-index:1;opacity:0;transition:opacity .45s ease}
        .hero-img.loaded{opacity:1}
        .hero-img-skel{position:absolute;inset:0;z-index:1;background:linear-gradient(90deg,var(--sk) 0%,var(--ss) 50%,var(--sk) 100%);background-size:200% 100%;animation:shimmer 1.4s ease-in-out infinite}
        .hero-fallback{font-size:64px;font-weight:800;position:relative;z-index:1;font-family:'Sora',sans-serif}
        .hero-meta{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:28px}
        .hero-cat{display:inline-flex;align-items:center;padding:3px 11px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:.6px}
        .hero-dot{width:3px;height:3px;border-radius:50%;background:var(--mt)}
        .hero-date,.hero-read{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--mt);font-family:'DM Sans',sans-serif}
        .hero-title{font-size:clamp(24px,4.5vw,40px);font-weight:900;letter-spacing:-1px;color:var(--hd);line-height:1.15;margin-top:16px;transition:color .3s}
        .hero-excerpt{font-family:'DM Sans',sans-serif;font-size:15px;line-height:1.65;color:var(--bo);margin-top:12px;padding-bottom:28px;border-bottom:1px solid var(--bd);transition:color .3s}

        /* Article content */
        .article{margin-top:36px;opacity:0;transform:translateY(16px);transition:opacity .6s .1s cubic-bezier(.22,1,.36,1),transform .6s .1s cubic-bezier(.22,1,.36,1)}
        .article.ready{opacity:1;transform:translateY(0)}
        .c-p{font-family:'DM Sans',sans-serif;font-size:15.5px;line-height:1.78;color:var(--bo);margin-bottom:20px;transition:color .3s}
        .c-h2{font-size:clamp(18px,3vw,24px);font-weight:800;letter-spacing:-.5px;color:var(--hd);margin:40px 0 16px;transition:color .3s}
        .c-h3{font-size:clamp(15px,2.5vw,18px);font-weight:700;letter-spacing:-.3px;color:var(--hd);margin:28px 0 12px;transition:color .3s}
        .c-quote{border-left:3px solid var(--quote-bd);background:var(--quote-bg);padding:14px 20px;border-radius:0 10px 10px 0;font-family:'DM Sans',sans-serif;font-size:15px;color:var(--bo);font-style:italic;margin:20px 0;transition:background .3s,color .3s}
        .c-list,.c-olist{font-family:'DM Sans',sans-serif;font-size:15px;line-height:1.7;color:var(--bo);padding-left:22px;margin-bottom:20px;transition:color .3s}
        .c-list li,.c-olist li{margin-bottom:6px}
        .c-hr{border:none;border-top:1px solid var(--hr);margin:36px 0}
        .inline-code{font-family:'JetBrains Mono',monospace;font-size:13px;background:var(--code-bg);border:1px solid var(--code-bdr);color:var(--code-clr);padding:1px 7px;border-radius:5px}
        .code-block{position:relative;background:var(--code-bg);border:1px solid var(--code-bdr);border-radius:12px;overflow:hidden;margin:24px 0}
        .code-lang{position:absolute;top:10px;right:14px;font-size:10px;font-weight:700;font-family:'JetBrains Mono',monospace;color:var(--mt);letter-spacing:.5px;text-transform:uppercase}
        .code-block pre{padding:20px;overflow-x:auto}
        .code-block code{font-family:'JetBrains Mono',monospace;font-size:13px;line-height:1.7;color:var(--code-clr)}

        /* Skeleton */
        .skel{background:linear-gradient(90deg,rgba(255,255,255,.05) 0%,rgba(255,255,255,.09) 50%,rgba(255,255,255,.05) 100%);background-size:200% 100%;animation:shimmer 1.4s ease-in-out infinite;border-radius:8px}
        [data-theme="light"] .skel{background:linear-gradient(90deg,rgba(0,0,0,.05) 0%,rgba(0,0,0,.09) 50%,rgba(0,0,0,.05) 100%);background-size:200% 100%}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        .skel-hero-img{height:260px;border-radius:18px;margin-top:32px}
        .skel-line{height:14px;margin-bottom:10px;border-radius:5px}

        /* Error / Not found */
        .err-box{text-align:center;padding:80px 20px;color:var(--bo)}
        .err-icon{font-size:54px;margin-bottom:16px}
        .err-title{font-size:20px;font-weight:800;color:var(--hd);margin-bottom:8px}
        .err-sub{font-size:13.5px;font-family:'DM Sans',sans-serif;margin-bottom:20px}
        .go-back-btn{padding:8px 22px;background:rgba(7,166,38,.14);border:1px solid rgba(7,166,38,.3);color:#4ade80;border-radius:9px;font-size:13px;font-weight:600;font-family:'Sora',sans-serif;cursor:pointer;transition:background .2s}
        .go-back-btn:hover{background:rgba(7,166,38,.24)}
        [data-theme="light"] .go-back-btn{color:#15803d}

        @media(max-width:560px){.post-root{padding:0 14px 80px}.hero-cover{height:220px}.hero-fallback{font-size:48px}}
      `}</style>

      <div data-theme={theme} className="post-root">
        <Navbar />

        <div className="bg-glow" /><div className="dot-grid" />
        <div className="h-10" />
        <div className="inner">

          <button className="back-btn" onClick={() => router.push("/blog")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back to Blog
          </button>

          {/* Loading skeleton */}
          {loading && (
            <div>
              <div className="skel skel-hero-img" />
              <div style={{ marginTop: 28 }}>
                {[40, 90, 60, 100, 75, 85, 55].map((w, i) => (
                  <div key={i} className="skel skel-line" style={{ width: `${w}%`, marginBottom: i === 2 ? 24 : 10 }} />
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="err-box">
              <div className="err-icon">{error === "not_found" ? "🔍" : "⚠️"}</div>
              <div className="err-title">{error === "not_found" ? "Post Not Found" : "Something went wrong"}</div>
              <p className="err-sub">{error === "not_found" ? "The blog post you're looking for doesn't exist or has been removed." : "Could not load this post. Please try again."}</p>
              <button className="go-back-btn" onClick={() => router.push("/blog")}>← Back to Blog</button>
            </div>
          )}

          {/* Post */}
          {!loading && !error && blog && (
            <>
              <div className={`hero${ready ? " ready" : ""}`}>
                <div className="hero-cover">
                  {showHeroImage ? (
                    <>
                      <Image
                        className={`hero-img${heroLoaded ? " loaded" : ""}`}
                        src={blog.image}
                        alt={blog.title}
                        decoding="async"
                        onLoad={() => setHeroLoaded(true)}
                        onError={() => setHeroError(true)}
                        fill
                      />
                      {!heroLoaded && <div className="hero-img-skel" />}
                    </>
                  ) : (
                    <div className="hero-fallback" style={catStyle}>
                      {(blog.category || "G")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="hero-cover-glow" />
                </div>

                <div className="hero-meta">
                  <span className="hero-cat" style={catStyle}>{(blog.category || "General").toUpperCase()}</span>
                  <span className="hero-dot" />
                  <span className="hero-date">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    {formatDate(blog.createdAt)}
                  </span>
                  <span className="hero-dot" />
                  <span className="hero-read">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    {blog.readTime || "—"} min read
                  </span>
                </div>

                <h1 className="hero-title">{blog.title}</h1>
                {blog.excerpt && <p className="hero-excerpt">{blog.excerpt}</p>}
              </div>

              <article className={`article${ready ? " ready" : ""}`}>
                {renderContent(blog.content)}
              </article>
            </>
          )}

        </div>
      </div>
      <Footer />
    </>
  );
}