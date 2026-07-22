"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "../context/ThemeContext";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Image from "next/image";

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
  if (!catColorCache[name]) {
    catColorCache[name] = CATEGORY_PALETTE[catColorIdx % CATEGORY_PALETTE.length];
    catColorIdx++;
  }
  const s = catColorCache[name];
  return { background: s.bg, border: `1px solid ${s.border}`, color: dark ? s.color : s.light };
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function BlogCard({ blog, dark, index, ready }) {
  const router = useRouter();
  const catStyle = getCatColor(blog.category, dark);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const showImage = !!blog.image && !imgError;

  return (
    <article
      className="blog-card"
      style={{ transitionDelay: ready ? `${index * 55}ms` : "0ms" }}
      onClick={() => router.push(`/blog/${blog.slug}`)}
      role="button" tabIndex={0}
      onKeyDown={e => e.key === "Enter" && router.push(`/blog/${blog.slug}`)}
    >
      <div className="card-cover">
        {showImage ? (
          <>
            <Image
              className={`card-image${imgLoaded ? " loaded" : ""}`}
              src={blog.image}
              alt={blog.title}
              loading="lazy"
              decoding="async"
              onLoad={() => setImgLoaded(true)}
             fill
              onError={() => setImgError(true)}
            />
            {!imgLoaded && <div className="card-image-skel skel-block" />}
          </>
        ) : (
          <div className="card-image-fallback" style={catStyle}>
            {blog.category?.[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <div className="card-cover-glow" />
      </div>
      <div className="card-body">
        <span className="card-cat" style={catStyle}>{blog.category.toUpperCase()}</span>
        <h2 className="card-title">{blog.title}</h2>
        <p className="card-excerpt">{blog.excerpt}</p>
        <div className="card-footer">
          <span className="card-meta">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            {formatDate(blog.createdAt)}
          </span>
          <span className="card-meta">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            {blog.readTime} min read
          </span>
          <span className="card-arrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
          </span>
        </div>
      </div>
    </article>
  );
}

function SkeletonCard() {
  return (
    <div className="blog-card skel-card">
      <div className="card-cover skel-block" />
      <div className="card-body" style={{ gap: 8 }}>
        <div className="skel skel-cat" /><div className="skel skel-t1" /><div className="skel skel-t2" />
        <div className="skel skel-e1" /><div className="skel skel-e2" /><div className="skel skel-ft" />
      </div>
    </div>
  );
}

export default function Blogpageclient() {
  const { dark } = useTheme();
  const theme = dark ? "dark" : "light";

  const [blogs, setBlogs] = useState([]);
  // categories is now a plain string[]
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCat] = useState("All");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [catLoading, setCatLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const [searchQuery, setSearchQuery] = useState("");


  // ── Fetch blogs ──
  const fetchBlogs = useCallback(async () => {
    setLoading(true); setError(null); setReady(false);
    try {
      const p = new URLSearchParams({ page, limit: "9" });
      if (activeCategory !== "All") p.set("category", activeCategory);
      if (searchQuery) p.set("search", searchQuery);
      console.log("pyyt", p)
      const res = await fetch(`/api/blogs?${p}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      console.log(data);
      setBlogs(data.blogs || []);
      setPagination(data.pagination || null);
    } catch {
      setError("Could not load blog posts. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page, activeCategory, searchQuery]);

  useEffect(() => { fetchBlogs(); }, [fetchBlogs]);

  useEffect(() => {
    if (!loading) { const t = setTimeout(() => setReady(true), 40); return () => clearTimeout(t); }
  }, [loading]);

  const handleCat = (cat) => { setActiveCat(cat); setPage(1); };
  const handleSearch = () => { setSearchQuery(searchVal.trim()); setPage(1); };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&family=DM+Sans:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        [data-theme="dark"]{--bg:#09090f;--sf:rgba(255,255,255,.03);--sfh:rgba(255,255,255,.06);--bd:rgba(255,255,255,.08);--bdh:rgba(7,166,38,.5);--hd:#fff;--bo:rgba(255,255,255,.65);--mt:rgba(255,255,255,.3);--dot:rgba(255,255,255,.035);--ibg:rgba(255,255,255,.04);--ibd:rgba(255,255,255,.1);--ic:#fff;--ip:rgba(255,255,255,.3);--tbg:rgba(255,255,255,.04);--tbd:rgba(255,255,255,.08);--tc:rgba(255,255,255,.4);--sk:rgba(255,255,255,.05);--ss:rgba(255,255,255,.09);--pbg:rgba(255,255,255,.05);--pbd:rgba(255,255,255,.1);--pc:rgba(255,255,255,.5)}
        [data-theme="light"]{--bg:#f4f4f8;--sf:rgba(255,255,255,.85);--sfh:#fff;--bd:rgba(0,0,0,.09);--bdh:rgba(7,166,38,.5);--hd:#0a0a14;--bo:rgba(0,0,0,.6);--mt:rgba(0,0,0,.35);--dot:rgba(0,0,0,.035);--ibg:rgba(255,255,255,.9);--ibd:rgba(0,0,0,.12);--ic:#0a0a14;--ip:rgba(0,0,0,.3);--tbg:rgba(255,255,255,.7);--tbd:rgba(0,0,0,.1);--tc:rgba(0,0,0,.45);--sk:rgba(0,0,0,.05);--ss:rgba(0,0,0,.09);--pbg:rgba(255,255,255,.7);--pbd:rgba(0,0,0,.1);--pc:rgba(0,0,0,.5)}
        .blog-root{min-height:100vh;background:var(--bg);font-family:'Sora',sans-serif;padding:60px 20px 80px;position:relative;overflow:hidden;transition:background .35s}
        .bg-glow{position:absolute;inset:0;pointer-events:none;z-index:0}
        .bg-glow::before{content:'';position:absolute;top:-6%;left:50%;transform:translateX(-50%);width:700px;height:350px;background:radial-gradient(ellipse,rgba(7,166,38,.1) 0%,transparent 68%);border-radius:50%;animation:glow 6s ease-in-out infinite}
        [data-theme="light"] .bg-glow::before{background:radial-gradient(ellipse,rgba(7,166,38,.06) 0%,transparent 68%)}
        @keyframes glow{0%,100%{opacity:1;transform:translateX(-50%) scale(1)}50%{opacity:.65;transform:translateX(-50%) scale(1.08)}}
        .dot-grid{position:absolute;inset:0;pointer-events:none;z-index:0;background-image:radial-gradient(var(--dot) 1px,transparent 1px);background-size:30px 30px}
        .inner{position:relative;z-index:1;max-width:1100px;margin:0 auto;display:flex;flex-direction:column;gap:34px}
        .page-header{text-align:center}
        .page-title{font-size:clamp(28px,5vw,48px);font-weight:900;letter-spacing:-1.3px;color:var(--hd);line-height:1.1;transition:color .3s}
        .page-title .accent{background:linear-gradient(135deg,#07A626,#34d058);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .page-sub{font-family:'DM Sans',sans-serif;font-size:13.5px;color:var(--bo);margin-top:8px;transition:color .3s}
        .controls{display:flex;flex-direction:column;gap:14px}
        .search-bar{display:flex;align-items:center;gap:9px;max-width:480px;padding:10px 14px;background:var(--ibg);border:1.5px solid var(--ibd);border-radius:11px;box-shadow:0 2px 16px rgba(0,0,0,.08);transition:border-color .2s,box-shadow .2s,background .35s}
        .search-bar:focus-within{border-color:rgba(7,166,38,.7);box-shadow:0 0 0 3px rgba(7,166,38,.12)}
        .s-icon{color:rgba(128,128,160,.5);flex-shrink:0}
        .s-input{flex:1;background:none;border:none;outline:none;font-size:13px;font-family:'Sora',sans-serif;font-weight:500;color:var(--ic);caret-color:#07A626}
        .s-input::placeholder{color:var(--ip)}
        .s-btn{background:rgba(7,166,38,.14);border:1px solid rgba(7,166,38,.3);color:#4ade80;border-radius:6px;padding:3px 12px;font-size:11px;font-weight:600;font-family:'Sora',sans-serif;cursor:pointer;flex-shrink:0;transition:background .2s,transform .15s}
        .s-btn:hover{background:rgba(7,166,38,.24);transform:translateY(-1px)}
        [data-theme="light"] .s-btn{color:#15803d}
        .cat-tabs{display:flex;flex-wrap:wrap;gap:6px}
        .cat-tab{padding:4px 14px;border-radius:100px;font-size:11px;font-weight:600;letter-spacing:.3px;background:var(--tbg);border:1px solid var(--tbd);color:var(--tc);cursor:pointer;font-family:'Sora',sans-serif;display:flex;align-items:center;gap:5px;transition:background .2s,border-color .2s,color .2s,transform .15s}
        .cat-tab:hover{background:rgba(7,166,38,.08);border-color:rgba(7,166,38,.3);color:#4ade80}
        .cat-tab.active{background:rgba(7,166,38,.15);border-color:rgba(7,166,38,.45);color:#4ade80}
        [data-theme="light"] .cat-tab:hover,[data-theme="light"] .cat-tab.active{color:#15803d}
        .cat-skel{width:80px;height:28px;border-radius:100px}
        .blog-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        .blog-card{background:var(--sf);border:1px solid var(--bd);border-radius:14px;overflow:hidden;cursor:pointer;display:flex;flex-direction:column;opacity:0;transform:translateY(14px);transition:opacity .5s cubic-bezier(.22,1,.36,1),transform .5s cubic-bezier(.22,1,.36,1),background .25s,border-color .25s,box-shadow .25s}
        .ready .blog-card{opacity:1;transform:translateY(0)}
        .skel-card{opacity:1!important;transform:none!important;cursor:default;pointer-events:none}
        .blog-card:not(.skel-card):hover{background:var(--sfh);border-color:var(--bdh);transform:translateY(-3px);box-shadow:0 8px 32px rgba(7,166,38,.1),0 2px 8px rgba(0,0,0,.12)}
        .card-cover{height:100px;position:relative;background:linear-gradient(135deg,rgba(7,166,38,.06),rgba(7,166,38,.02));display:flex;align-items:center;justify-content:center;overflow:hidden}
        .skel-block{background:var(--sk)}
        .card-cover-glow{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 60%,rgba(7,166,38,.08) 0%,transparent 65%);pointer-events:none}
        .card-image{width:100%;height:100%;object-fit:contain;object-position:center;position:relative;z-index:1;opacity:0;transition:opacity .4s ease,transform .3s cubic-bezier(.22,1,.36,1)}
        .card-image.loaded{opacity:1}
        .blog-card:not(.skel-card):hover .card-image{transform:scale(1.04)}
        .card-image-skel{position:absolute;inset:0;animation:shimmer 1.4s ease-in-out infinite;background:linear-gradient(90deg,var(--sk) 0%,var(--ss) 50%,var(--sk) 100%);background-size:200% 100%}
        .card-image-fallback{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;position:relative;z-index:1;font-family:'Sora',sans-serif}
        .card-body{padding:11px 13px 13px;display:flex;flex-direction:column;gap:5px;flex:1}
        .card-cat{display:inline-flex;align-items:center;padding:2px 7px;border-radius:5px;font-size:8.5px;font-weight:700;letter-spacing:.5px;width:fit-content}
        .card-title{font-size:12.5px;font-weight:700;line-height:1.3;color:var(--hd);transition:color .25s}
        .blog-card:not(.skel-card):hover .card-title{color:#4ade80}
        [data-theme="light"] .blog-card:not(.skel-card):hover .card-title{color:#15803d}
        .card-excerpt{font-family:'DM Sans',sans-serif;font-size:11px;line-height:1.45;color:var(--bo);flex:1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .card-footer{display:flex;align-items:center;gap:7px;margin-top:2px}
        .card-meta{display:flex;align-items:center;gap:3px;font-size:9px;color:var(--mt);font-family:'DM Sans',sans-serif}
        .card-arrow{margin-left:auto;color:rgba(7,166,38,.5);transition:transform .2s,color .2s}
        .blog-card:not(.skel-card):hover .card-arrow{transform:translateX(3px);color:#4ade80}
        .skel{background:linear-gradient(90deg,var(--sk) 0%,var(--ss) 50%,var(--sk) 100%);background-size:200% 100%;animation:shimmer 1.4s ease-in-out infinite;border-radius:5px}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        .skel-cat{width:65px;height:16px}.skel-t1{width:90%;height:16px}.skel-t2{width:65%;height:16px}.skel-e1{width:100%;height:12px;margin-top:4px}.skel-e2{width:80%;height:12px}.skel-ft{width:55%;height:11px;margin-top:8px}
        .state-box{grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--bo)}
        .state-icon{font-size:44px;margin-bottom:12px}
        .retry-btn{margin-top:14px;padding:7px 20px;background:rgba(7,166,38,.12);border:1px solid rgba(7,166,38,.3);color:#4ade80;border-radius:8px;font-size:13px;font-family:'Sora',sans-serif;font-weight:600;cursor:pointer;transition:background .2s}
        .retry-btn:hover{background:rgba(7,166,38,.22)}
        [data-theme="light"] .retry-btn{color:#15803d}
        .pagination{display:flex;align-items:center;justify-content:center;gap:7px}
        .pg-btn{min-width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:8px;font-size:12px;font-weight:600;font-family:'Sora',sans-serif;background:var(--pbg);border:1px solid var(--pbd);color:var(--pc);cursor:pointer;transition:background .2s,border-color .2s,color .2s,transform .15s}
        .pg-btn:hover:not(:disabled){background:rgba(7,166,38,.12);border-color:rgba(7,166,38,.35);color:#4ade80;transform:translateY(-1px)}
        .pg-btn.active{background:rgba(7,166,38,.18);border-color:rgba(7,166,38,.5);color:#4ade80}
        .pg-btn:disabled{opacity:.35;cursor:not-allowed}
        [data-theme="light"] .pg-btn:hover:not(:disabled),[data-theme="light"] .pg-btn.active{color:#15803d}
        @media(max-width:860px){.blog-grid{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:560px){.blog-grid{grid-template-columns:1fr}.blog-root{padding:40px 14px 60px}}
      `}</style>

      <div data-theme={theme} className="blog-root">
        <Navbar />
        <div className="h-10" />
        <div className="bg-glow" /><div className="dot-grid" />
        <div className="inner">

          <header className="page-header">
            <h1 className="page-title">Design <span className="accent">Blog</span></h1>
            <p className="page-sub">Explore educational articles, design guides, creative insights, and case studies covering logo design, visual identity, branding, and vector graphics. An independent learning resource created for designers, students, researchers, and creative professionals.</p>
          </header>

          <div className="controls">
            {/* Search */}
            <div className="search-bar">
              <svg className="s-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input className="s-input" type="text" placeholder="Search blog posts…" value={searchVal} onChange={e => setSearchVal(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()} />
              <button className="s-btn" onClick={handleSearch}>Search</button>
            </div>


          </div>

          {/* Grid */}
          {error ? (
            <div className="state-box">
              <div className="state-icon">⚠️</div>
              <p>{error}</p>
              <button className="retry-btn" onClick={fetchBlogs}>Try Again</button>
            </div>
          ) : (
            <div className={`blog-grid${ready ? " ready" : ""}`}>
              {loading
                ? Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)
                : blogs.length === 0
                  ? <div className="state-box"><div className="state-icon">📭</div><p>No posts found. Try a different category or search.</p></div>
                  : blogs.map((blog, i) => <BlogCard key={blog.id} blog={blog} dark={dark} index={i} ready={ready} />)
              }
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && !loading && !error && (
            <nav className="pagination">
              <button className="pg-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} className={`pg-btn${page === p ? " active" : ""}`} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button className="pg-btn" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </nav>
          )}

        </div>
      </div>
      <Footer />
    </>
  );
}