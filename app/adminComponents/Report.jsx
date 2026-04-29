"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const STATUS_FILTERS = ["all", "open", "review", "resolved"];

const STATUS_META = {
  open:     { label: "Open",     bg: "rgba(239,68,68,.1)",  border: "rgba(239,68,68,.22)",  color: "#ef4444" },
  review:   { label: "Review",   bg: "rgba(234,179,8,.1)",  border: "rgba(234,179,8,.22)",  color: "#f59e0b" },
  resolved: { label: "Resolved", bg: "rgba(34,197,94,.1)",  border: "rgba(34,197,94,.22)",  color: "#22c55e" },
};

export default function AdminReports({ dark }) {
  const [reports, setReports]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("all");
  const [selected, setSelected] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [search, setSearch]     = useState("");

  const fetchReports = async (status) => {
    setLoading(true);
    try {
      const url = status && status !== "all"
        ? `/api/report/create?status=${status}`
        : "/api/report/create";
      const res  = await fetch(url);
      const data = await res.json();
      setReports(data.reports || []);
    } catch (e) { console.error(e); }
    finally     { setLoading(false); }
  };

  useEffect(() => { fetchReports(filter); }, [filter]);

  const handleStatusChange = async (id, newStatus) => {
    setUpdating(id);
    try {
      await fetch("/api/report/create", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      setReports(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
      if (selected?.id === id) setSelected(prev => ({ ...prev, status: newStatus }));
    } catch (e) { console.error(e); }
    finally     { setUpdating(null); }
  };

  const fmt = (d) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });

  const filtered = reports.filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.reporterEmail.toLowerCase().includes(q) ||
      r.logoName.toLowerCase().includes(q) ||
      r.reason.toLowerCase().includes(q)
    );
  });

  const counts = {
    all:      reports.length,
    open:     reports.filter(r => r.status === "open").length,
    review:   reports.filter(r => r.status === "review").length,
    resolved: reports.filter(r => r.status === "resolved").length,
  };

  const t = dark ? "dark" : "light";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:ital,wght@0,400;0,500;1,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .ar[data-t="dark"] {
          --bg:    #000000;
          --sur:   #0d0d0d;
          --sur2:  #141414;
          --sur3:  #1c1c1c;
          --b1:    rgba(255,255,255,0.07);
          --b2:    rgba(255,255,255,0.13);
          --h:     #f0f0fa;
          --bod:   rgba(240,240,250,0.60);
          --mu:    rgba(240,240,250,0.30);
          --acc:   #07A626;
          --accd:  rgba(7,166,38,0.09);
          --accr:  rgba(7,166,38,0.22);
          --ibg:   rgba(255,255,255,0.04);
          --ibg2:  rgba(255,255,255,0.07);
          --rh:    rgba(255,255,255,0.02);
          --dot:   rgba(255,255,255,0.025);
          --sh:    0 1px 3px rgba(0,0,0,.45);
          --shl:   0 8px 32px rgba(0,0,0,.65);
        }
        .ar[data-t="light"] {
          --bg:    #ffffff;
          --sur:   #ffffff;
          --sur2:  #f5f5f5;
          --sur3:  #ebebeb;
          --b1:    rgba(0,0,0,0.08);
          --b2:    rgba(0,0,0,0.15);
          --h:     #0a0a0a;
          --bod:   rgba(10,10,10,0.65);
          --mu:    rgba(10,10,10,0.38);
          --acc:   #0d6b22;
          --accd:  rgba(13,107,34,0.09);
          --accr:  rgba(13,107,34,0.20);
          --ibg:   rgba(0,0,0,0.03);
          --ibg2:  #ffffff;
          --rh:    rgba(0,0,0,0.02);
          --dot:   rgba(0,0,0,0.045);
          --sh:    0 1px 3px rgba(0,0,0,.08);
          --shl:   0 12px 40px rgba(0,0,0,.15);
        }

        .ar {
          min-height: 100vh;
          background: var(--bg);
          font-family: 'Sora', sans-serif;
          transition: background .25s;
          position: relative;
        }
        .ar-grid {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image: radial-gradient(var(--dot) 1px, transparent 1px);
          background-size: 26px 26px;
        }
        .ar[data-t="light"] .ar-grid {
          background-image: radial-gradient(var(--dot) 1px, transparent 1px);
        }
        .ar-wrap {
          position: relative; z-index: 1;
          max-width: 1080px; margin: 0 auto;
          padding: 24px 20px 60px;
        }

        /* topbar */
        .ar-top { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
        .ar-back {
          width: 30px; height: 30px; border-radius: 8px;
          background: var(--ibg); border: 1px solid var(--b1);
          box-shadow: var(--sh); color: var(--mu);
          display: flex; align-items: center; justify-content: center;
          text-decoration: none; flex-shrink: 0;
          transition: border-color .15s, color .15s;
        }
        .ar-back:hover { border-color: var(--b2); color: var(--h); }
        .ar-ttl { font-size: 17px; font-weight: 800; color: var(--h); letter-spacing: -.4px; line-height: 1; }
        .ar-sub { font-size: 11px; color: var(--mu); font-family: 'DM Sans',sans-serif; font-style: italic; margin-top: 2px; }
        .ar-badge {
          padding: 2px 7px; border-radius: 5px;
          background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.2);
          font-size: 9px; font-weight: 800; color: #ef4444;
          letter-spacing: .5px; text-transform: uppercase;
        }
        .ar[data-t="light"] .ar-badge { color: #b91c1c; background: rgba(185,28,28,.07); border-color: rgba(185,28,28,.16); }

        /* stats */
        .ar-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 16px; }
        .ar-sc {
          background: var(--sur); border: 1px solid var(--b1);
          border-radius: 11px; padding: 11px 13px;
          display: flex; align-items: center; gap: 10px; box-shadow: var(--sh);
        }
        .ar-si { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
        .ar-sn { font-size: 18px; font-weight: 800; color: var(--h); line-height: 1; letter-spacing: -.4px; }
        .ar-sl { font-size: 9px; font-weight: 700; color: var(--mu); text-transform: uppercase; letter-spacing: .6px; margin-top: 2px; }

        /* toolbar */
        .ar-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
        .ar-filters { display: flex; gap: 4px; flex-wrap: wrap; }
        .ar-fb {
          padding: 4px 10px; border-radius: 7px;
          font-size: 10.5px; font-weight: 700;
          border: 1px solid var(--b1); background: var(--ibg); color: var(--mu);
          cursor: pointer; font-family: 'Sora',sans-serif;
          transition: all .15s; display: flex; align-items: center; gap: 5px; box-shadow: var(--sh);
        }
        .ar-fb:hover { border-color: var(--b2); color: var(--bod); background: var(--sur2); }
        .ar-fb.on { background: var(--accd); border-color: var(--accr); color: var(--acc); }
        .ar-fc { padding: 1px 5px; border-radius: 4px; background: var(--sur2); font-size: 8.5px; font-weight: 800; color: var(--mu); min-width: 16px; text-align: center; }
        .ar-fb.on .ar-fc { background: var(--accd); color: var(--acc); }

        .ar-sw { position: relative; display: flex; align-items: center; }
        .ar-si2 { position: absolute; left: 9px; color: var(--mu); pointer-events: none; }
        .ar-s {
          padding: 6px 10px 6px 28px;
          background: var(--ibg2); border: 1px solid var(--b1);
          border-radius: 8px; color: var(--h);
          font-family: 'Sora',sans-serif; font-size: 11.5px;
          outline: none; width: 200px; box-shadow: var(--sh);
          transition: border-color .2s, box-shadow .2s;
        }
        .ar-s::placeholder { color: var(--mu); }
        .ar-s:focus { border-color: var(--accr); box-shadow: 0 0 0 3px var(--accd); }

        /* table */
        .ar-card { background: var(--sur); border: 1px solid var(--b1); border-radius: 13px; overflow: hidden; box-shadow: var(--sh); }
        .ar-tbl { width: 100%; border-collapse: collapse; }
        .ar-th { padding: 9px 14px; text-align: left; font-size: 9px; font-weight: 800; color: var(--mu); text-transform: uppercase; letter-spacing: .7px; border-bottom: 1px solid var(--b1); background: var(--sur2); white-space: nowrap; }
        .ar-th:first-child { padding-left: 16px; }
        .ar-tr { border-bottom: 1px solid var(--b1); transition: background .1s; }
        .ar-tr:last-child { border-bottom: none; }
        .ar-tr:hover { background: var(--rh); }
        .ar-td { padding: 10px 14px; font-size: 11.5px; color: var(--bod); vertical-align: middle; }
        .ar-td:first-child { padding-left: 16px; }

        .ar-em { color: var(--acc); font-weight: 700; font-size: 11px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; text-decoration: none; }
        .ar-em:hover { text-decoration: underline; }
        .ar-ln { font-weight: 700; color: var(--h); font-size: 11.5px; }
        .ar-lid { font-size: 9px; color: var(--mu); font-family: monospace; margin-top: 1px; }
        .ar-re { max-width: 190px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
        .ar-dt { font-size: 10.5px; color: var(--mu); white-space: nowrap; font-family: 'DM Sans',sans-serif; }

        .ar-pill { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 5px; font-size: 9.5px; font-weight: 800; border: 1px solid; white-space: nowrap; }
        .ar-dot2 { width: 4px; height: 4px; border-radius: 50%; flex-shrink: 0; }

        .ar-acts { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
        .ar-ab { padding: 3px 8px; border-radius: 6px; font-size: 9.5px; font-weight: 700; border: 1px solid var(--b1); background: var(--ibg); color: var(--mu); cursor: pointer; font-family: 'Sora',sans-serif; transition: all .15s; display: flex; align-items: center; gap: 3px; white-space: nowrap; box-shadow: var(--sh); }
        .ar-ab:hover { border-color: var(--b2); color: var(--h); background: var(--sur2); }
        .ar-ab.vw:hover { border-color: rgba(99,102,241,.35); color: #818cf8; background: rgba(99,102,241,.07); }
        .ar[data-t="light"] .ar-ab.vw:hover { color: #4338ca; background: rgba(67,56,202,.06); border-color: rgba(67,56,202,.3); }
        .ar-ab.rv:hover { border-color: rgba(234,179,8,.35); color: #f59e0b; background: rgba(234,179,8,.07); }
        .ar-ab.rs:hover { border-color: rgba(34,197,94,.35); color: #22c55e; background: rgba(34,197,94,.07); }
        .ar-ab:disabled { opacity: .35; cursor: not-allowed; }

        /* empty */
        .ar-emp { padding: 52px 16px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .ar-emp-ic { font-size: 32px; opacity: .4; }
        .ar-emp-t { font-size: 13px; font-weight: 800; color: var(--h); }
        .ar-emp-s { font-size: 11px; color: var(--mu); font-family: 'DM Sans',sans-serif; }

        /* skeleton */
        .ar-sk { border-radius: 5px; display: inline-block; background: var(--sur3); animation: ar-sh 1.4s ease-in-out infinite; }
        @keyframes ar-sh { 0%,100%{opacity:1} 50%{opacity:.28} }

        /* modal */
        .ar-ov { position: fixed; inset: 0; z-index: 3000; backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; padding: 16px; animation: ar-fi .14s ease; }
        @keyframes ar-fi { from{opacity:0} to{opacity:1} }

        .ar-mo { width: 100%; max-width: 460px; border: 1px solid var(--b2); border-radius: 16px; padding: 20px; font-family: 'Sora',sans-serif; box-shadow: var(--shl); animation: ar-mi .18s cubic-bezier(.22,1,.36,1); max-height: 86vh; display: flex; flex-direction: column; overflow: hidden; background: var(--sur); }
        @keyframes ar-mi { from{opacity:0;transform:scale(.95) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }

        .ar-mh { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 16px; flex-shrink: 0; }
        .ar-mt { font-size: 14px; font-weight: 800; color: var(--h); letter-spacing: -.3px; }
        .ar-ms { font-size: 10.5px; color: var(--mu); font-family: 'DM Sans',sans-serif; font-style: italic; margin-top: 2px; }
        .ar-mc { width: 26px; height: 26px; border-radius: 7px; border: 1px solid var(--b1); background: var(--ibg); cursor: pointer; color: var(--mu); flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: all .15s; }
        .ar-mc:hover { background: var(--sur2); color: var(--h); border-color: var(--b2); }

        .ar-mb { flex: 1; overflow-y: auto; padding-right: 2px; scrollbar-width: thin; scrollbar-color: var(--b2) transparent; }
        .ar-mb::-webkit-scrollbar { width: 3px; }
        .ar-mb::-webkit-scrollbar-thumb { background: var(--b2); border-radius: 3px; }

        .ar-mr { display: flex; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--b1); }
        .ar-mr:last-child { border-bottom: none; }
        .ar-ml { font-size: 9px; font-weight: 800; color: var(--mu); text-transform: uppercase; letter-spacing: .6px; min-width: 80px; padding-top: 1px; flex-shrink: 0; }
        .ar-mv { font-size: 12px; color: var(--bod); line-height: 1.6; flex: 1; word-break: break-word; }
        .ar-mv.em { color: var(--acc); font-weight: 700; }
        .ar-mv.hd { color: var(--h); font-weight: 600; }
        .ar-mv.mn { font-family: monospace; font-size: 11px; color: var(--mu); letter-spacing: .3px; }

        .ar-rsb { flex: 1; max-height: 160px; overflow-y: auto; background: var(--sur2); border: 1px solid var(--b1); border-radius: 8px; padding: 8px 10px; font-size: 12px; color: var(--bod); line-height: 1.7; white-space: pre-wrap; word-break: break-word; scrollbar-width: thin; scrollbar-color: var(--b2) transparent; }
        .ar-rsb::-webkit-scrollbar { width: 3px; }
        .ar-rsb::-webkit-scrollbar-thumb { background: var(--b2); border-radius: 3px; }
        .ar[data-t="light"] .ar-rsb { background: #f5f5f5; border-color: rgba(0,0,0,.08); }

        .ar-ma { display: flex; gap: 7px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--b1); flex-shrink: 0; }
        .ar-mab { flex: 1; padding: 8px 10px; border-radius: 9px; font-family: 'Sora',sans-serif; font-size: 11px; font-weight: 800; cursor: pointer; transition: opacity .15s, transform .12s; display: flex; align-items: center; justify-content: center; gap: 5px; }
        .ar-mab:hover { opacity: .86; transform: translateY(-1px); }
        .ar-mab:disabled { opacity: .32; cursor: not-allowed; transform: none; }
        .ar-mab.rv { background: rgba(234,179,8,.11); color: #d97706; border: 1px solid rgba(234,179,8,.26); }
        .ar[data-t="light"] .ar-mab.rv { color: #b45309; }
        .ar-mab.rs { background: rgba(34,197,94,.1); color: #16a34a; border: 1px solid rgba(34,197,94,.26); }
        .ar-mab.ro { background: rgba(239,68,68,.09); color: #dc2626; border: 1px solid rgba(239,68,68,.22); }

        /* responsive — hide columns progressively */
        @media (max-width: 860px) {
          .ar-stats { grid-template-columns: repeat(2,1fr); }
          .hide-m { display: none; }
        }
        @media (max-width: 560px) {
          .ar-wrap { padding: 14px 12px 50px; }
          .ar-stats { grid-template-columns: repeat(2,1fr); gap: 6px; }
          .ar-sc { padding: 9px 10px; gap: 8px; }
          .ar-s { width: 140px; }
          .ar-tbl { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .ar-ttl { font-size: 15px; }
          .hide-s { display: none; }
          .ar-mo { padding: 16px; }
        }
      `}</style>

      <div data-t={t} className="ar">
        <div className="ar-grid" />
        <div className="ar-wrap">

          {/* topbar */}
          <div className="ar-top">
            <Link href="/admin" className="ar-back">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </Link>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                <div className="ar-ttl">DMCA Reports</div>
                <span className="ar-badge">DMCA</span>
              </div>
              <div className="ar-sub">Manage logo copyright &amp; trademark reports</div>
            </div>
          </div>

          {/* stats */}
          <div className="ar-stats">
            {[
              { label:"Total",     key:"all",      icon:"📋", bg:"rgba(99,102,241,.1)"  },
              { label:"Open",      key:"open",     icon:"🚨", bg:"rgba(239,68,68,.1)"   },
              { label:"In Review", key:"review",   icon:"🔍", bg:"rgba(234,179,8,.1)"   },
              { label:"Resolved",  key:"resolved", icon:"✅", bg:"rgba(34,197,94,.1)"   },
            ].map(s => (
              <div className="ar-sc" key={s.key}>
                <div className="ar-si" style={{ background: s.bg }}>{s.icon}</div>
                <div>
                  <div className="ar-sn">{loading ? "—" : counts[s.key]}</div>
                  <div className="ar-sl">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* toolbar */}
          <div className="ar-bar">
            <div className="ar-filters">
              {STATUS_FILTERS.map(f => (
                <button
                  key={f}
                  className={`ar-fb${filter === f ? " on" : ""}`}
                  onClick={() => setFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  <span className="ar-fc">{counts[f] ?? 0}</span>
                </button>
              ))}
            </div>
            <div className="ar-sw">
              <svg className="ar-si2" width="12" height="12" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="ar-s" type="text"
                placeholder="Search…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* table */}
          <div className="ar-card">
            <table className="ar-tbl">
              <thead>
                <tr>
                  <th className="ar-th">Reporter</th>
                  <th className="ar-th">Logo</th>
                  <th className="ar-th hide-m">Reason</th>
                  <th className="ar-th hide-s">Date</th>
                  <th className="ar-th">Status</th>
                  <th className="ar-th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr className="ar-tr" key={i}>
                      {[130,100,170,72,65,120].map((w,j) => (
                        <td className="ar-td" key={j}>
                          <span className="ar-sk" style={{ width:w, height:11 }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6}>
                    <div className="ar-emp">
                      <div className="ar-emp-ic">📭</div>
                      <div className="ar-emp-t">No reports found</div>
                      <div className="ar-emp-s">
                        {search ? "Try a different search term" : "No reports match this filter"}
                      </div>
                    </div>
                  </td></tr>
                ) : filtered.map(r => {
                  const s = STATUS_META[r.status] || STATUS_META.open;
                  const busy = updating === r.id;
                  return (
                    <tr className="ar-tr" key={r.id}>
                      <td className="ar-td">
                        <a href={`mailto:${r.reporterEmail}`} className="ar-em">
                          {r.reporterEmail}
                        </a>
                      </td>
                      <td className="ar-td">
                        <div className="ar-ln">{r.logoName}</div>
                        <div className="ar-lid">{r.logoId}</div>
                      </td>
                      <td className="ar-td hide-m">
                        <div className="ar-re" title={r.reason}>{r.reason}</div>
                      </td>
                      <td className="ar-td hide-s">
                        <div className="ar-dt">{fmt(r.createdAt)}</div>
                      </td>
                      <td className="ar-td">
                        <span className="ar-pill" style={{
                          background: s.bg, borderColor: s.border, color: s.color,
                        }}>
                          <span className="ar-dot2" style={{ background: s.color }} />
                          {s.label}
                        </span>
                      </td>
                      <td className="ar-td">
                        <div className="ar-acts">
                          <button className="ar-ab vw" onClick={() => setSelected(r)}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                            View
                          </button>
                          {r.status !== "review" && r.status !== "resolved" && (
                            <button className="ar-ab rv" title="Mark as Review"
                              onClick={() => handleStatusChange(r.id, "review")}
                              disabled={busy}>🔍</button>
                          )}
                          {r.status !== "resolved" && (
                            <button className="ar-ab rs" title="Resolve"
                              onClick={() => handleStatusChange(r.id, "resolved")}
                              disabled={busy}>
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            </button>
                          )}
                          {r.status === "resolved" && (
                            <button className="ar-ab" title="Reopen"
                              onClick={() => handleStatusChange(r.id, "open")}
                              disabled={busy}>↺</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {/* modal */}
      {selected && (
        <div
          className="ar-ov"
          style={{ background: dark ? "rgba(0,0,0,.58)" : "rgba(22,17,10,.38)" }}
          onClick={() => setSelected(null)}
        >
          <div
            data-t={t}
            className="ar ar-mo"
            onClick={e => e.stopPropagation()}
          >
            <div className="ar-mh">
              <div>
                <div className="ar-mt">Report Details</div>
                <div className="ar-ms">Filed {fmt(selected.createdAt)}</div>
              </div>
              <button className="ar-mc" onClick={() => setSelected(null)}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="ar-mb">
              <div className="ar-mr">
                <div className="ar-ml">Reporter</div>
                <div className="ar-mv em">{selected.reporterEmail}</div>
              </div>
              <div className="ar-mr">
                <div className="ar-ml">Logo</div>
                <div className="ar-mv hd">{selected.logoName}</div>
              </div>
              <div className="ar-mr">
                <div className="ar-ml">Logo ID</div>
                <div className="ar-mv mn">{selected.logoId}</div>
              </div>
              <div className="ar-mr" style={{ alignItems:"flex-start" }}>
                <div className="ar-ml" style={{ paddingTop:8 }}>Reason</div>
                <div className="ar-rsb">{selected.reason}</div>
              </div>
              <div className="ar-mr">
                <div className="ar-ml">Status</div>
                <div className="ar-mv">
                  <span className="ar-pill" style={{
                    background: STATUS_META[selected.status]?.bg,
                    borderColor: STATUS_META[selected.status]?.border,
                    color: STATUS_META[selected.status]?.color,
                  }}>
                    <span className="ar-dot2" style={{ background: STATUS_META[selected.status]?.color }} />
                    {STATUS_META[selected.status]?.label}
                  </span>
                </div>
              </div>
            </div>

            <div className="ar-ma">
              {selected.status !== "review" && selected.status !== "resolved" && (
                <button className="ar-mab rv"
                  disabled={updating === selected.id}
                  onClick={() => handleStatusChange(selected.id, "review")}>
                  🔍 Review
                </button>
              )}
              {selected.status !== "resolved" && (
                <button className="ar-mab rs"
                  disabled={updating === selected.id}
                  onClick={() => handleStatusChange(selected.id, "resolved")}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Resolve
                </button>
              )}
              {selected.status === "resolved" && (
                <button className="ar-mab ro"
                  disabled={updating === selected.id}
                  onClick={() => handleStatusChange(selected.id, "open")}>
                  ↺ Reopen
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}