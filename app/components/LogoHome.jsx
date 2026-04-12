"use client";

import { useState, useEffect, useCallback } from "react";

const ALPHABET = ["All","A","B","C","D","E","F","G","H","I","J","K","L","M",
                  "N","O","P","Q","R","S","T","U","V","W","X","Y","Z","0-9"];

const CATEGORIES = ["All","Technology","Social Media","Sports","Automotive",
                    "Food & Beverage","Fashion","Finance","Entertainment",
                    "Gaming","Airline","E-commerce"];

const SORT_OPTIONS = [
  { key: "newest",  label: "Newest",  icon: "🕐" },
  { key: "popular", label: "Popular", icon: "🔥" },
  { key: "az",      label: "A–Z",     icon: "↕" },
];

const ALL_LOGOS = [
  { id:1,  name:"Apple",       category:"Technology",    downloads:84200, trending:true,  colors:["#1d1d1f","#ffffff","#a3a3a3"], formats:["AI","SVG","PNG"],     imageUrl:"https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" },
  { id:2,  name:"Google",      category:"Technology",    downloads:72100, trending:true,  colors:["#4285f4","#34a853","#fbbc05","#ea4335"], formats:["AI","SVG","PNG"], imageUrl:"https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg" },
  { id:3,  name:"Nike",        category:"Sports",        downloads:61000, trending:false, colors:["#000000","#ffffff"],           formats:["AI","SVG","PNG"], imageUrl:"https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg" },
  { id:4,  name:"Meta",        category:"Social Media",  downloads:55300, trending:true,  colors:["#0866ff","#ffffff"],           formats:["AI","SVG","PNG"],       imageUrl:"https://upload.wikimedia.org/wikipedia/commons/7/7b/Meta_Platforms_Inc._logo.svg" },
  { id:5,  name:"Tesla",       category:"Automotive",    downloads:48900, trending:false, colors:["#cc0000","#ffffff"],           formats:["AI","SVG","PNG"], imageUrl:"https://upload.wikimedia.org/wikipedia/commons/b/bd/Tesla_Motors.svg" },
  { id:6,  name:"McDonald's",  category:"Food & Beverage",downloads:43100,trending:false, colors:["#FFC72C","#DA291C"],           formats:["AI","SVG","PNG"], imageUrl:"https://upload.wikimedia.org/wikipedia/commons/3/36/McDonald%27s_Golden_Arches.svg" },
  { id:7,  name:"Adidas",      category:"Sports",        downloads:39800, trending:false, colors:["#000000","#ffffff"],           formats:["AI","SVG","PNG"],       imageUrl:"https://upload.wikimedia.org/wikipedia/commons/2/20/Adidas_Logo.svg" },
  { id:8,  name:"Amazon",      category:"E-commerce",    downloads:38500, trending:false, colors:["#FF9900","#232F3E"],           formats:["AI","SVG","PNG"], imageUrl:"https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg" },
  { id:9,  name:"Netflix",     category:"Entertainment", downloads:36200, trending:true,  colors:["#e50914","#141414"],           formats:["AI","SVG","PNG"],       imageUrl:"https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg" },
  { id:10, name:"Spotify",     category:"Entertainment", downloads:33700, trending:false, colors:["#1DB954","#191414"],           formats:["AI","SVG","PNG"], imageUrl:"https://upload.wikimedia.org/wikipedia/commons/2/26/Spotify_logo_with_text.svg" },
  { id:11, name:"BMW",         category:"Automotive",    downloads:30100, trending:false, colors:["#0066B1","#ffffff","#000000"], formats:["AI","SVG","PNG"], imageUrl:"https://upload.wikimedia.org/wikipedia/commons/4/44/BMW.svg" },
  { id:12, name:"Samsung",     category:"Technology",    downloads:29400, trending:false, colors:["#1428A0","#ffffff"],           formats:["AI","SVG","PNG"],       imageUrl:"https://upload.wikimedia.org/wikipedia/commons/2/24/Samsung_Logo.svg" },
  { id:13, name:"Coca-Cola",   category:"Food & Beverage",downloads:27800,trending:false, colors:["#F40009","#ffffff"],           formats:["AI","SVG","PNG"], imageUrl:"https://upload.wikimedia.org/wikipedia/commons/c/ce/Coca-Cola_logo.svg" },
  { id:14, name:"Visa",        category:"Finance",       downloads:26300, trending:false, colors:["#1A1F71","#F7A600"],           formats:["AI","SVG","PNG"], imageUrl:"https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" },
  { id:15, name:"PlayStation", category:"Gaming",        downloads:25600, trending:true,  colors:["#003087","#ffffff"],           formats:["AI","SVG","PNG"],       imageUrl:"https://upload.wikimedia.org/wikipedia/commons/4/4e/Playstation_logo_colour.svg" },
  { id:16, name:"Twitter/X",   category:"Social Media",  downloads:24100, trending:false, colors:["#000000","#ffffff"],           formats:["AI","SVG","PNG"],       imageUrl:"https://upload.wikimedia.org/wikipedia/commons/5/5a/X_icon_2.svg" },
  { id:17, name:"Emirates",    category:"Airline",       downloads:22700, trending:false, colors:["#D4153C","#ffffff","#C8A84B"], formats:["AI","SVG","PNG"], imageUrl:"https://upload.wikimedia.org/wikipedia/commons/d/d0/Emirates_logo.svg" },
  { id:18, name:"Gucci",       category:"Fashion",       downloads:21500, trending:true,  colors:["#1e1e1e","#B69A54"],           formats:["AI","SVG","PNG"], imageUrl:"https://upload.wikimedia.org/wikipedia/commons/5/55/Gucci_logo.svg" },
  { id:19, name:"Xbox",        category:"Gaming",        downloads:20300, trending:false, colors:["#107C10","#ffffff"],           formats:["AI","SVG","PNG"],       imageUrl:"https://upload.wikimedia.org/wikipedia/commons/f/f9/Xbox_one_logo.svg" },
  { id:20, name:"Mastercard",  category:"Finance",       downloads:19800, trending:false, colors:["#EB001B","#F79E1B"],           formats:["AI","SVG","PNG"], imageUrl:"https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" },
  { id:21, name:"Airbnb",      category:"E-commerce",    downloads:18600, trending:false, colors:["#FF5A5F","#ffffff"],           formats:["AI","SVG","PNG"],       imageUrl:"https://upload.wikimedia.org/wikipedia/commons/6/69/Airbnb_Logo_Bélo.svg" },
  { id:22, name:"Snapchat",    category:"Social Media",  downloads:17400, trending:false, colors:["#FFFC00","#000000"],           formats:["AI","SVG","PNG"], imageUrl:"https://upload.wikimedia.org/wikipedia/en/a/ad/Snapchat_logo.svg" },
  { id:23, name:"Ferrari",     category:"Automotive",    downloads:16200, trending:false, colors:["#CC0000","#FFD700"],           formats:["AI","SVG","PNG"], imageUrl:"https://upload.wikimedia.org/wikipedia/en/d/d1/Ferrari-Logo.svg" },
  { id:24, name:"Puma",        category:"Sports",        downloads:15300, trending:false, colors:["#000000","#ffffff"],           formats:["AI","SVG","PNG"],       imageUrl:"https://upload.wikimedia.org/wikipedia/commons/4/4c/Puma_Logo.svg" },
];

const PAGE_SIZE = 12;

function mockFetch({ page, sort, letter, category }) {
  return new Promise(resolve => {
    setTimeout(() => {
      let results = [...ALL_LOGOS];
      if (letter && letter !== "All") {
        const isNumeric = letter === "0-9";
        results = results.filter(l =>
          isNumeric ? /^[0-9]/.test(l.name) : l.name.toUpperCase().startsWith(letter)
        );
      }
      if (category && category !== "All") {
        results = results.filter(l => l.category === category);
      }
      if (sort === "popular") results.sort((a, b) => b.downloads - a.downloads);
      else if (sort === "az")  results.sort((a, b) => a.name.localeCompare(b.name));
      else                     results.sort((a, b) => b.id - a.id);
      const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
      const logos = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
      resolve({ logos, totalPages });
    }, 420);
  });
}

function SkeletonCard() {
  return (
    <div className="logo-card skeleton-card">
      <div className="card-image skeleton-img" />
      <div className="card-body">
        <div className="skeleton-line w60" />
        <div className="skeleton-line w40 mt4" />
        <div className="card-formats" style={{marginTop:8}}>
          {[1,2,3].map(i => <div key={i} className="skeleton-badge" />)}
        </div>
      </div>
    </div>
  );
}

function LogoCard({ logo }) {
  const [imgErr, setImgErr] = useState(false);
  const fmts = (logo.formats || ["AI","SVG","PNG"]).slice(0, 3);

  return (
    <div className="logo-card">
      {logo.trending && (
        <div className="trending-badge">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
            <polyline points="17 6 23 6 23 12"/>
          </svg>
          TRENDING
        </div>
      )}

      <div className="card-image">
        {!imgErr && logo.imageUrl ? (
          <img src={logo.imageUrl} alt={logo.name}
            onError={() => setImgErr(true)} className="card-img" />
        ) : (
          <span className="card-initials">{logo.name?.slice(0,2).toUpperCase()}</span>
        )}
      </div>

      <div className="card-body">
        <div className="card-name">{logo.name}</div>
        <span className="card-category">{logo.category}</span>

        <div className="card-colors">
          {(logo.colors || []).slice(0, 3).map((c, i) => (
            <span key={i} className="color-dot" style={{ background: c }} />
          ))}
        </div>

        <div className="card-formats">
          {fmts.map(f => (
            <span key={f} className={`fmt-tag fmt-${f.toLowerCase()}`}>{f}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LogosPage() {
  const [logos,          setLogos]       = useState([]);
  const [loading,        setLoading]     = useState(true);
  const [error,          setError]       = useState(null);
  const [page,           setPage]        = useState(1);
  const [totalPages,     setTotalPages]  = useState(1);
  const [activeLetter,   setActiveLetter]= useState("All");
  const [activeCategory, setActiveCat]  = useState("All");
  const [sort,           setSort]        = useState("newest");

  const fetchLogos = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = {
        page, sort,
        ...(activeLetter   !== "All" && { letter: activeLetter }),
        ...(activeCategory !== "All" && { category: activeCategory }),
      };
      const data = await mockFetch(params);
      setLogos(data.logos ?? []);
      setTotalPages(data.totalPages ?? 1);
    } catch (err) {
      setError(err.message); setLogos([]);
    } finally {
      setLoading(false);
    }
  }, [page, sort, activeLetter, activeCategory]);

  useEffect(() => { fetchLogos(); }, [fetchLogos]);
  useEffect(() => { setPage(1); }, [activeLetter, activeCategory, sort]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        [data-theme="dark"] {
          --page-bg:        #09090f;
          --surface:        #111118;
          --surface-hover:  #17171f;
          --border:         rgba(255,255,255,0.07);
          --border-hover:   rgba(255,255,255,0.14);
          --text-primary:   #ffffff;
          --text-secondary: rgba(255,255,255,0.45);
          --text-muted:     rgba(255,255,255,0.25);
          --pill-bg:        rgba(255,255,255,0.06);
          --pill-border:    rgba(255,255,255,0.1);
          --pill-color:     rgba(255,255,255,0.6);
          --pill-active-bg:     rgba(7,166,38,0.18);
          --pill-active-border: rgba(7,166,38,0.45);
          --pill-active-color:  #4ade80;
          --sort-bg:        rgba(255,255,255,0.05);
          --sort-border:    rgba(255,255,255,0.08);
          --sort-color:     rgba(255,255,255,0.5);
          --sort-active-bg: rgba(255,255,255,0.1);
          --sort-active-color: #fff;
          --card-img-bg:    #1a1a24;
          --skeleton:       rgba(255,255,255,0.06);
          --page-btn-bg:    rgba(255,255,255,0.06);
          --page-btn-color: rgba(255,255,255,0.5);
          --page-btn-hover: rgba(255,255,255,0.1);
          --page-active-bg: rgba(7,166,38,0.2);
          --page-active-color: #4ade80;
          --page-active-border: rgba(7,166,38,0.45);
          --error-color:    #f87171;
        }
        [data-theme="light"] {
          --page-bg:        #f4f4f8;
          --surface:        #ffffff;
          --surface-hover:  #fafafc;
          --border:         rgba(0,0,0,0.07);
          --border-hover:   rgba(0,0,0,0.14);
          --text-primary:   #0a0a14;
          --text-secondary: rgba(0,0,0,0.5);
          --text-muted:     rgba(0,0,0,0.3);
          --pill-bg:        rgba(0,0,0,0.05);
          --pill-border:    rgba(0,0,0,0.09);
          --pill-color:     rgba(0,0,0,0.6);
          --pill-active-bg:     rgba(7,166,38,0.1);
          --pill-active-border: rgba(7,166,38,0.35);
          --pill-active-color:  #15803d;
          --sort-bg:        rgba(0,0,0,0.04);
          --sort-border:    rgba(0,0,0,0.08);
          --sort-color:     rgba(0,0,0,0.5);
          --sort-active-bg: rgba(0,0,0,0.08);
          --sort-active-color: #0a0a14;
          --card-img-bg:    #f0f0f5;
          --skeleton:       rgba(0,0,0,0.06);
          --page-btn-bg:    rgba(0,0,0,0.05);
          --page-btn-color: rgba(0,0,0,0.5);
          --page-btn-hover: rgba(0,0,0,0.09);
          --page-active-bg: rgba(7,166,38,0.1);
          --page-active-color: #15803d;
          --page-active-border: rgba(7,166,38,0.35);
          --error-color:    #dc2626;
        }

        .logos-page {
          min-height: 100vh;
          background: var(--page-bg);
          font-family: 'Sora', sans-serif;
          padding: 0px 0 60px;
          transition: background 0.35s;
        }
        .logos-container { max-width: 1200px; margin: 0 auto; padding: 24px 24px 0; }

        .page-header {
          display: flex; align-items: flex-start;
          justify-content: space-between;
          gap: 16px; margin-bottom: 20px; flex-wrap: wrap;
        }
        .page-title { font-size: 24px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.5px; line-height: 1; transition: color 0.3s; }
        .page-subtitle { font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--text-secondary); margin-top: 4px; transition: color 0.3s; }

        .sort-group {
          display: flex; align-items: center; gap: 6px;
          background: var(--sort-bg); border: 1px solid var(--sort-border);
          border-radius: 10px; padding: 4px;
          transition: background 0.3s, border-color 0.3s;
        }
        .sort-btn {
          display: flex; align-items: center; gap: 5px;
          padding: 5px 12px; border: none; border-radius: 7px;
          background: transparent; font-family: 'Sora', sans-serif;
          font-size: 12px; font-weight: 600; color: var(--sort-color);
          cursor: pointer; transition: background 0.2s, color 0.2s; white-space: nowrap;
        }
        .sort-btn.active { background: var(--sort-active-bg); color: var(--sort-active-color); }

        .alpha-row { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px; }
        .alpha-btn {
          min-width: 32px; height: 32px; padding: 0 8px;
          border-radius: 8px; border: 1px solid var(--pill-border);
          background: var(--pill-bg); font-family: 'Sora', sans-serif;
          font-size: 12px; font-weight: 600; color: var(--pill-color);
          cursor: pointer; transition: background 0.15s, border-color 0.15s, color 0.15s;
        }
        .alpha-btn:hover:not(.active), .alpha-btn.active {
          background: var(--pill-active-bg); border-color: var(--pill-active-border); color: var(--pill-active-color);
        }

        .cat-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 24px; }
        .cat-btn {
          padding: 5px 14px; border-radius: 100px;
          border: 1px solid var(--pill-border); background: var(--pill-bg);
          font-family: 'Sora', sans-serif; font-size: 12.5px; font-weight: 500;
          color: var(--pill-color); cursor: pointer;
          transition: background 0.15s, border-color 0.15s, color 0.15s; white-space: nowrap;
        }
        .cat-btn:hover:not(.active), .cat-btn.active {
          background: var(--pill-active-bg); border-color: var(--pill-active-border); color: var(--pill-active-color);
        }

        .logos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; margin-bottom: 36px; }

        .logo-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 14px; overflow: hidden; cursor: pointer; position: relative;
          transition: background 0.2s, border-color 0.2s, transform 0.2s, box-shadow 0.2s;
        }
        .logo-card:hover {
          background: var(--surface-hover); border-color: var(--border-hover);
          transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.15);
        }
        [data-theme="dark"] .logo-card:hover { box-shadow: 0 12px 32px rgba(0,0,0,0.5); }

        .trending-badge {
          position: absolute; top: 10px; left: 10px; z-index: 2;
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 8px; background: rgba(7,166,38,0.85);
          border-radius: 6px; font-size: 9px; font-weight: 700;
          letter-spacing: 0.5px; color: #fff; backdrop-filter: blur(4px);
        }

        .card-image {
          width: 100%; height: 130px; background: var(--card-img-bg);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; transition: background 0.3s;
        }
        .card-img { width: 100%; height: 100%; object-fit: contain; padding: 16px; }
        .card-initials { font-size: 30px; font-weight: 900; color: var(--text-secondary); letter-spacing: -1px; font-family: 'Sora', sans-serif; }

        .card-body { padding: 10px 12px 12px; }
        .card-name { font-size: 15px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.3px; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color 0.3s; }
        .card-category { font-family: 'DM Sans', sans-serif; font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 8px; transition: color 0.3s; }
        .card-colors { display: flex; gap: 4px; margin-bottom: 8px; }
        .color-dot { width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.15); }
        [data-theme="light"] .color-dot { border-color: rgba(0,0,0,0.1); }

        .card-formats { display: flex; flex-wrap: wrap; gap: 4px; }
        .fmt-tag { padding: 2px 6px; border-radius: 4px; font-size: 9.5px; font-weight: 700; letter-spacing: 0.3px; border: 1px solid; }
        .fmt-ai  { background:rgba(234,179,8,.1);  border-color:rgba(234,179,8,.25);  color:#fde68a; }
        .fmt-svg { background:rgba(34,197,94,.1);  border-color:rgba(34,197,94,.25);  color:#86efac; }
        .fmt-png { background:rgba(59,130,246,.1); border-color:rgba(59,130,246,.25); color:#93c5fd; }
        [data-theme="light"] .fmt-ai  { color:#92400e; }
        [data-theme="light"] .fmt-svg { color:#166534; }
        [data-theme="light"] .fmt-png { color:#1e40af; }

        .skeleton-card { pointer-events: none; }
        .skeleton-img { width: 100%; height: 130px; background: var(--skeleton); animation: shimmer 1.6s infinite linear; }
        .skeleton-line { height: 10px; border-radius: 5px; background: var(--skeleton); animation: shimmer 1.6s infinite linear; }
        .w60{width:60%} .w40{width:40%} .mt4{margin-top:4px}
        .skeleton-badge { width:28px; height:16px; border-radius:4px; background:var(--skeleton); animation:shimmer 1.6s infinite linear; }
        @keyframes shimmer { 0%{opacity:1} 50%{opacity:0.4} 100%{opacity:1} }

        .error-state { text-align:center; padding:60px 24px; color:var(--error-color); font-size:14px; }
        .error-state button { margin-top:12px; padding:8px 20px; border-radius:8px; border:1px solid var(--error-color); background:transparent; color:var(--error-color); font-family:'Sora',sans-serif; font-size:13px; font-weight:600; cursor:pointer; }

        .empty-state { grid-column:1/-1; text-align:center; padding:60px 24px; color:var(--text-secondary); font-size:14px; }

        .pagination { display:flex; align-items:center; justify-content:center; gap:6px; }
        .page-btn { min-width:36px; height:36px; padding:0 10px; border-radius:9px; border:1px solid var(--pill-border); background:var(--page-btn-bg); font-family:'Sora',sans-serif; font-size:13px; font-weight:600; color:var(--page-btn-color); cursor:pointer; transition:background 0.15s,color 0.15s,border-color 0.15s; display:flex; align-items:center; justify-content:center; }
        .page-btn:hover:not(.active):not(:disabled) { background:var(--page-btn-hover); color:var(--text-primary); }
        .page-btn.active { background:var(--page-active-bg); border-color:var(--page-active-border); color:var(--page-active-color); }
        .page-btn:disabled { opacity:0.35; cursor:not-allowed; }
        .page-ellipsis { color:var(--text-muted); font-size:13px; padding:0 4px; }

        @media (max-width:640px) {
          .logos-page { padding: 12px 0 40px; }
          .logos-container { padding: 14px 12px 0; }
          .page-header { flex-direction: column; gap: 10px; margin-bottom: 14px; }
          .page-title { font-size: 20px; }
          .sort-group { align-self: stretch; justify-content: stretch; }
          .sort-btn { flex: 1; justify-content: center; font-size: 11px; padding: 6px 8px; }
          .alpha-row { flex-wrap: nowrap; overflow-x: auto; gap: 4px; margin-bottom: 8px; padding-bottom: 4px; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
          .alpha-row::-webkit-scrollbar { display: none; }
          .alpha-btn { min-width: 30px; height: 30px; flex-shrink: 0; font-size: 11px; }
          .cat-row { flex-wrap: nowrap; overflow-x: auto; gap: 6px; margin-bottom: 14px; padding-bottom: 4px; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
          .cat-row::-webkit-scrollbar { display: none; }
          .cat-btn { flex-shrink: 0; font-size: 11.5px; padding: 4px 12px; }
          .logos-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 24px; }
          .card-image { height: 105px; }
          .card-name { font-size: 13px; }
          .card-formats { gap: 3px; }
          .pagination { gap: 4px; }
          .page-btn { min-width: 32px; height: 32px; font-size: 12px; }
        }
      `}</style>

      <div className="logos-page">
        <div className="logos-container">

          <div className="page-header">
            <div>
              <h1 className="page-title">All Logos</h1>
              <p className="page-subtitle">Browse our complete collection</p>
            </div>
            <div className="sort-group">
              {SORT_OPTIONS.map(s => (
                <button key={s.key} className={`sort-btn${sort === s.key ? " active" : ""}`} onClick={() => setSort(s.key)}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="alpha-row">
            {ALPHABET.map(l => (
              <button key={l} className={`alpha-btn${activeLetter === l ? " active" : ""}`} onClick={() => setActiveLetter(l)}>{l}</button>
            ))}
          </div>

          <div className="cat-row">
            {CATEGORIES.map(c => (
              <button key={c} className={`cat-btn${activeCategory === c ? " active" : ""}`} onClick={() => setActiveCat(c)}>{c}</button>
            ))}
          </div>

          {error ? (
            <div className="error-state">
              <p>Failed to load logos: {error}</p>
              <button onClick={fetchLogos}>Try again</button>
            </div>
          ) : (
            <div className="logos-grid">
              {loading
                ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
                : logos.length === 0
                  ? <div className="empty-state">No logos found for this filter.</div>
                  : logos.map(logo => <LogoCard key={logo.id} logo={logo} />)
              }
            </div>
          )}

          {!error && !loading && logos.length > 0 && (
            <div className="pagination">
              <button className="page-btn" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                .reduce((acc, n, idx, arr) => {
                  if (idx > 0 && n - arr[idx-1] > 1) acc.push("…");
                  acc.push(n);
                  return acc;
                }, [])
                .map((n, i) =>
                  n === "…"
                    ? <span key={`e${i}`} className="page-ellipsis">…</span>
                    : <button key={n} className={`page-btn${page === n ? " active" : ""}`} onClick={() => setPage(n)}>{n}</button>
                )
              }
              <button className="page-btn" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}>›</button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}