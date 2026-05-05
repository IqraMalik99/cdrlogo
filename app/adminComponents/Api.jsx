"use client";

import { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// ONLY endpoints confirmed from source files shared in context
// ─────────────────────────────────────────────────────────────────────────────
const API_GROUPS = [
  {
    group: "Logo",
    color: "#22c55e",
    rgb: "34,197,94",
    endpoints: [
      {
        id: "logo-upload-single",
        method: "POST",
        path: "/api/logo/upload/single",
        title: "Upload Logo",
        source: "UploadLogo.jsx",
        description: "Upload a new logo. Accepts multipart/form-data with ZIP files and metadata fields.",
        request: {
          type: "multipart/form-data",
          fields: {
            files:           "ZIP file(s) — field name must be 'files'",
            logoName:        "string (required)",
            slug:            "string (required)",
            brand:           "string?",
            website:         "string?",
            category:        "string (required)",
            industry:        "string?",
            country:         "string?",
            license:         "string?",
            description:     "string (required)",
            history:         "string?",
            tags:            'JSON string — e.g. ["AI","Brands"]',
            brandColors:     'JSON string — e.g. ["#3B82F6","#1E3A5F"]',
            metaTitle:       "string?",
            metaDescription: "string?",
            altText:         "string?",
            focusKeywords:   "string?",
            publishStatus:   '"Draft" | "Published"',
            downloadCount:   '"unlimited" | numeric string e.g. "500"',
          },
        },
        responses: {
          200: { message: "Logo uploaded successfully!", logoId: "uuid" },
          400: { error: "Missing required field: logoName" },
          409: { error: "Slug already exists" },
          500: { error: "Internal server error" },
        },
      },
      {
        id: "logo-fetch-slug",
        method: "POST",
        path: "/api/logo/fetch/slug",
        title: "Fetch Logo by Slug",
        source: "LogoDetail.jsx",
        description: "Returns full logo data plus related logos in the same category.",
        request: {
          type: "application/json",
          body: { slug: "nike" },
        },
        responses: {
          200: {
            data: {
              id: "uuid",
              logoName: "Nike",
              slug: "nike",
              brand: "Nike Inc.",
              category: "Sports",
              description: "...",
              webpUrl: "https://cdn.example.com/public/nike/nike.webp",
              svgUrl: "https://...",
              pngUrl: "https://...",
              aiUrl: "https://...",
              cdrUrl: "https://...",
              svgContent: "<svg>...</svg>",
              tags: ["Brands", "Sports"],
              brandColors: ["#000000", "#FFFFFF"],
              svgfilesize: "24 kb",
              pngfilesize: "180 kb",
              aifilesize: "340 kb",
              cdrfilesize: "210 kb",
              publishStatus: "Published",
              downloadCount: "unlimited",
              downloadedNumberByPeople: 1240,
              license: "Free for personal use",
              website: "https://nike.com",
              createdAt: "2024-01-01T00:00:00.000Z",
              updatedAt: "2024-06-01T00:00:00.000Z",
            },
            related: [
              { id: "uuid", logoName: "Adidas", slug: "adidas", webpUrl: "https://...", brandColors: [] },
            ],
          },
          404: { error: "Logo not found" },
          500: { error: "Internal server error" },
        },
      },
      {
        id: "logo-download",
        method: "POST",
        path: "/api/logo/download/default",
        title: "Download Logo File",
        source: "LogoDetail.jsx",
        description: "Returns binary file stream for the requested format. Check res.ok and Content-Type before reading as blob — on error the response is JSON not a file.",
        request: {
          type: "application/json",
          body: {
            logoId: "uuid",
            format: "svg",
            user: "userId — empty string for guests",
          },
        },
        responses: {
          200: "Binary file stream — Content-Type: application/octet-stream",
          403: { error: "Download limit reached. Please sign in or upgrade." },
          404: { error: "File not available in svg format." },
          500: { error: "Internal server error" },
        },
      },
    ],
  },
  {
    group: "Tags",
    color: "#60a5fa",
    rgb: "96,165,250",
    endpoints: [
      {
        id: "tags-get",
        method: "GET",
        path: "/api/admin/tags",
        title: "Get All Tags",
        source: "route.js — tags",
        description: "Returns the global tags array stored in Website.tags.",
        request: null,
        responses: {
          200: { tags: ["Brands", "Technology", "AI", "Automotive"] },
          500: { error: "Failed to fetch tags" },
        },
      },
      {
        id: "tags-add",
        method: "POST",
        path: "/api/admin/tags",
        title: "Add Tag",
        source: "route.js — tags",
        description: "Appends a new tag to Website.tags. Case-insensitive duplicate check. Writes a Log entry on success.",
        request: {
          type: "application/json",
          body: { tag: "Gaming" },
        },
        responses: {
          201: { tags: ["Brands", "Technology", "AI", "Gaming"] },
          400: { error: "Invalid tag" },
          409: { error: "Tag already exists" },
          500: { error: "Failed to add tag" },
        },
      },
      {
        id: "tags-delete",
        method: "DELETE",
        path: "/api/admin/tags",
        title: "Delete Tag",
        source: "route.js — tags",
        description: "Removes a tag by name from Website.tags. Case-insensitive match. Writes a Log entry on success.",
        request: {
          type: "application/json",
          body: { tag: "Gaming" },
        },
        responses: {
          200: { tags: ["Brands", "Technology", "AI"] },
          400: { error: "Invalid tag" },
          404: { error: "No site config found" },
          500: { error: "Failed to delete tag" },
        },
      },
    ],
  },
  {
    group: "Categories",
    color: "#fbbf24",
    rgb: "251,191,36",
    endpoints: [
      {
        id: "categories-all",
        method: "GET",
        path: "/api/catageory",
        title: "Get Categories with Counts",
        source: "BrandCategories.jsx · TemplateCategories.jsx",
        description: "Returns all unique logo categories with their logo counts. Each item is a single-key object.",
        request: null,
        responses: {
          200: {
            categories: [
              { Technology: 142 },
              { Sports: 87 },
              { Automotive: 65 },
            ],
          },
          500: { error: "Internal server error" },
        },
      },
      {
        id: "categories-letter",
        method: "POST",
        path: "/api/website/catageory-letter",
        title: "Get Categories by Letter",
        source: "Categories.jsx",
        description: 'Returns Website.categories grouped by their first letter. Pass letter "all" to get everything.',
        request: {
          type: "application/json",
          body: { letter: "t" },
        },
        responses: {
          200: {
            T: [
              { name: "Technology", slug: "technology" },
              { name: "Travel", slug: "travel" },
            ],
          },
          500: { error: "Internal server error" },
        },
      },
    ],
  },
  {
    group: "Blog",
    color: "#f472b6",
    rgb: "244,114,182",
    endpoints: [
      {
        id: "blog-slug",
        method: "POST",
        path: "/api/blogs/slug",
        title: "Get Blog Post by Slug",
        source: "BlogPostPage.jsx",
        description: "Returns a single published blog post by slug. Returns 404 if not found or unpublished.",
        request: {
          type: "application/json",
          body: { slug: "top-10-logo-trends-2024" },
        },
        responses: {
          200: {
            blog: {
              id: "cuid",
              title: "Top 10 Logo Trends 2024",
              slug: "top-10-logo-trends-2024",
              excerpt: "A look at the biggest logo design trends...",
              content: "# Full markdown content\n\n## Section One\n\nParagraph...",
              category: "Design",
              coverEmoji: "🎨",
              readTime: 5,
              published: true,
              createdAt: "2024-01-01T00:00:00.000Z",
              updatedAt: "2024-06-01T00:00:00.000Z",
            },
          },
          404: { error: "Blog post not found" },
          500: { error: "Internal server error" },
        },
      },
    ],
  },
  {
    group: "Reports",
    color: "#f87171",
    rgb: "248,113,113",
    endpoints: [
      {
        id: "report-create",
        method: "POST",
        path: "/api/report/create",
        title: "Submit Logo Report",
        source: "LogoDetail.jsx",
        description: "Creates a DMCA / abuse report for a logo. Stored in the Report model with status 'open'.",
        request: {
          type: "application/json",
          body: {
            logoId: "uuid",
            logoName: "Nike",
            reason: "Trademark infringement — not authorized by Nike Inc.",
            reporterEmail: "legal@yourcompany.com",
          },
        },
        responses: {
          200: { success: true },
          400: { error: "Missing required fields" },
          500: { error: "Internal server error" },
        },
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────

const METHOD_META = {
  GET:    { bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.3)",   text: "#22c55e" },
  POST:   { bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.3)",  text: "#60a5fa" },
  PUT:    { bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.3)",  text: "#fbbf24" },
  PATCH:  { bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.3)", text: "#a78bfa" },
  DELETE: { bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)", text: "#f87171" },
};

const statusColor = (code) => {
  const n = parseInt(code);
  if (n < 300) return "#22c55e";
  if (n < 500) return "#fbbf24";
  return "#f87171";
};

function JsonBlock({ data, codeBg, border }) {
  const raw  = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const html = raw.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (m) => {
      let c = "j-num";
      if (/^"/.test(m))              c = /:$/.test(m) ? "j-key" : "j-str";
      else if (/true|false/.test(m)) c = "j-bool";
      else if (/null/.test(m))       c = "j-null";
      return `<span class="${c}">${m}</span>`;
    }
  );
  return (
    <div style={{
      background: codeBg, border: `1px solid ${border}`,
      borderRadius: 8, padding: "12px 14px",
      overflowX: "auto", maxHeight: 280,
    }}>
      <pre
        style={{ margin: 0, fontSize: 11.5, lineHeight: 1.75, fontFamily: "'JetBrains Mono','Fira Code',monospace", whiteSpace: "pre-wrap", wordBreak: "break-all" }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

export default function ApiReference({ dark = true }) {
  const [activeGroup, setActiveGroup] = useState(API_GROUPS[0].group);
  const [openId,      setOpenId]      = useState(null);
  const [tabMap,      setTabMap]      = useState({});
  const [statusMap,   setStatusMap]   = useState({});

  const bg     = dark ? "#0f1117" : "#f8fafc";
  const card   = dark ? "#151b27" : "#ffffff";
  const card2  = dark ? "#0d1117" : "#f1f5f9";
  const border = dark ? "#1e2535" : "#e2e8f0";
  const text   = dark ? "#e2e8f0" : "#1e293b";
  const muted  = dark ? "#64748b" : "#94a3b8";
  const codeBg = dark ? "#090e18" : "#f8fafc";

  const group   = API_GROUPS.find(g => g.group === activeGroup);
  const getTab  = (id) => tabMap[id]    ?? "request";
  const getStat = (id, ep) => statusMap[id] ?? Object.keys(ep.responses)[0];

  const totalEp = API_GROUPS.reduce((a, g) => a + g.endpoints.length, 0);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .ar { font-family: 'DM Sans', sans-serif; }

        .grp-btn {
          width: 100%; padding: 7px 10px; border: none; background: none;
          cursor: pointer; border-radius: 7px; font-size: 12px; font-weight: 600;
          font-family: 'DM Sans', sans-serif; text-align: left;
          display: flex; align-items: center; justify-content: space-between;
          transition: background .14s, color .14s;
        }

        .ep-row {
          display: grid; grid-template-columns: 54px 1fr auto;
          align-items: center; gap: 12px;
          padding: 10px 14px; border-radius: 8px; border: 1px solid;
          cursor: pointer; margin-bottom: 5px;
          transition: border-color .14s, background .14s;
        }

        .method-badge {
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px; font-weight: 700;
          padding: 3px 6px; border-radius: 4px;
          letter-spacing: 0.5px; text-align: center; border: 1px solid;
        }

        .tab-btn {
          padding: 4px 12px; border-radius: 6px; border: 1px solid;
          cursor: pointer; font-size: 11px; font-weight: 600;
          font-family: 'DM Sans', sans-serif; transition: all .14s;
        }

        .stat-chip {
          padding: 2px 8px; border-radius: 4px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px; font-weight: 700; cursor: pointer;
          border: 1px solid; transition: all .14s;
        }

        .expand {
          border: 1px solid; border-top: none;
          border-radius: 0 0 8px 8px;
          padding: 14px 16px; margin-bottom: 5px;
          animation: expandIn .15s cubic-bezier(.22,1,.36,1);
        }
        @keyframes expandIn {
          from { opacity: 0; transform: translateY(-5px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .j-key  { color: #60a5fa; }
        .j-str  { color: #4ade80; }
        .j-num  { color: #fb923c; }
        .j-bool { color: #f472b6; }
        .j-null { color: #94a3b8; }

        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-thumb { background: #22c55e33; border-radius: 99px; }
        ::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      <div className="ar" style={{ background: bg, minHeight: "100%", padding: "28px 24px 60px" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: text }}>API Reference</h1>
          <p style={{ margin: "3px 0 0", fontSize: 11.5, color: muted }}>
            {totalEp} endpoints — sourced directly from component files
          </p>
        </div>

        <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>

          {/* Sidebar */}
          <div style={{
            width: 188, flexShrink: 0, position: "sticky", top: 20,
            background: card, border: `1px solid ${border}`,
            borderRadius: 12, padding: 8,
          }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.7px", padding: "3px 6px 8px" }}>
              Groups
            </p>
            {API_GROUPS.map(g => {
              const on = activeGroup === g.group;
              return (
                <button
                  key={g.group}
                  className="grp-btn"
                  onClick={() => { setActiveGroup(g.group); setOpenId(null); }}
                  style={{
                    background: on ? `rgba(${g.rgb},0.1)` : "transparent",
                    color: on ? g.color : muted,
                    marginBottom: 1,
                  }}
                >
                  <span>{g.group}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 800,
                    background: on ? `rgba(${g.rgb},0.18)` : (dark ? "#1e2535" : "#e2e8f0"),
                    color: on ? g.color : muted,
                    borderRadius: 3, padding: "1px 5px",
                  }}>
                    {g.endpoints.length}
                  </span>
                </button>
              );
            })}

           
          </div>

          {/* Main */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Group header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 14, paddingBottom: 11,
              borderBottom: `1px solid ${border}`,
            }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: text }}>{group.group}</span>
                <span style={{ fontSize: 11, color: muted }}>
                  {group.endpoints.length} endpoint{group.endpoints.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {[...new Set(group.endpoints.map(e => e.method))].map(m => {
                  const mc = METHOD_META[m];
                  return (
                    <span key={m} className="method-badge" style={{ background: mc.bg, borderColor: mc.border, color: mc.text }}>
                      {m}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Endpoint rows */}
            {group.endpoints.map(ep => {
              const mc     = METHOD_META[ep.method];
              const isOpen = openId === ep.id;
              const tab    = getTab(ep.id);
              const stat   = getStat(ep.id, ep);
              const resData = ep.responses[stat] ?? ep.responses[parseInt(stat)];

              return (
                <div key={ep.id}>
                  <div
                    className="ep-row"
                    onClick={() => setOpenId(isOpen ? null : ep.id)}
                    style={{
                      background: isOpen ? (dark ? "#151b27" : "#f0fdf4") : card,
                      borderColor: isOpen ? `rgba(${group.rgb},0.4)` : border,
                      borderRadius: isOpen ? "8px 8px 0 0" : 8,
                      marginBottom: isOpen ? 0 : 5,
                    }}
                  >
                    <span className="method-badge" style={{ background: mc.bg, borderColor: mc.border, color: mc.text }}>
                      {ep.method}
                    </span>

                    <div style={{ minWidth: 0 }}>
                      <code style={{
                        fontSize: 12, fontWeight: 600, color: text,
                        fontFamily: "'JetBrains Mono', monospace",
                        display: "block", overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {ep.path}
                      </code>
                      <span style={{ fontSize: 10.5, color: muted, display: "block", marginTop: 1 }}>
                        {ep.title}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <div style={{ display: "flex", gap: 3 }}>
                        {Object.keys(ep.responses).map(c => (
                          <div key={c} style={{ width: 5, height: 5, borderRadius: "50%", background: statusColor(c) }} />
                        ))}
                      </div>
                      <svg
                        width="10" height="10" viewBox="0 0 24 24" fill="none"
                        stroke={muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .17s" }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>

                  {isOpen && (
                    <div
                      className="expand"
                      style={{ background: card2, borderColor: `rgba(${group.rgb},0.3)` }}
                    >
                      {/* Description + meta */}
                      <div style={{
                        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                        gap: 16, marginBottom: 14, paddingBottom: 12,
                        borderBottom: `1px solid ${border}`, flexWrap: "wrap",
                      }}>
                        <div style={{ flex: 1, minWidth: 180 }}>
                          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: text }}>{ep.title}</p>
                          <p style={{ margin: "4px 0 0", fontSize: 11.5, color: muted, lineHeight: 1.6 }}>
                            {ep.description}
                          </p>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end", flexShrink: 0 }}>
                          <span style={{
                            fontSize: 9.5, color: muted,
                            fontFamily: "'JetBrains Mono', monospace",
                            background: dark ? "#1e2535" : "#e2e8f0",
                            borderRadius: 4, padding: "2px 7px",
                          }}>
                            {ep.source}
                          </span>
                          {ep.request?.type && (
                            <span style={{
                              fontSize: 9.5, color: "#fbbf24",
                              fontFamily: "'JetBrains Mono', monospace",
                              background: "rgba(251,191,36,0.08)",
                              border: "1px solid rgba(251,191,36,0.2)",
                              borderRadius: 4, padding: "2px 7px",
                            }}>
                              {ep.request.type}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Tabs */}
                      <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
                        {["request", "response"].map(t => (
                          <button
                            key={t}
                            className="tab-btn"
                            onClick={() => setTabMap(p => ({ ...p, [ep.id]: t }))}
                            style={{
                              background: tab === t ? `rgba(${group.rgb},0.1)` : "transparent",
                              borderColor: tab === t ? `rgba(${group.rgb},0.4)` : border,
                              color: tab === t ? group.color : muted,
                            }}
                          >
                            {t === "request" ? "Request" : "Response"}
                          </button>
                        ))}
                      </div>

                      {/* REQUEST */}
                      {tab === "request" && (
                        <>
                          {!ep.request ? (
                            <div style={{
                              padding: "9px 13px", background: card,
                              border: `1px solid ${border}`, borderRadius: 7,
                              fontSize: 11.5, color: muted,
                            }}>
                              No request body — this endpoint takes no parameters.
                            </div>
                          ) : ep.request.type === "multipart/form-data" ? (
                            <div style={{
                              background: codeBg, border: `1px solid ${border}`,
                              borderRadius: 8, overflow: "hidden",
                            }}>
                              <div style={{
                                display: "grid", gridTemplateColumns: "175px 1fr",
                                padding: "6px 13px",
                                background: dark ? "#111827" : "#e8edf3",
                                borderBottom: `1px solid ${border}`,
                              }}>
                                {["Field", "Type / Description"].map(h => (
                                  <span key={h} style={{ fontSize: 9, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                    {h}
                                  </span>
                                ))}
                              </div>
                              {Object.entries(ep.request.fields).map(([k, v], i, arr) => (
                                <div key={k} style={{
                                  display: "grid", gridTemplateColumns: "175px 1fr",
                                  padding: "6px 13px",
                                  borderBottom: i < arr.length - 1 ? `1px solid ${border}` : "none",
                                  background: i % 2 === 0 ? "transparent" : (dark ? "rgba(255,255,255,0.015)" : "rgba(0,0,0,0.015)"),
                                }}>
                                  <code style={{ fontSize: 10.5, color: "#60a5fa", fontFamily: "'JetBrains Mono', monospace", paddingRight: 10 }}>
                                    {k}
                                  </code>
                                  <span style={{ fontSize: 11, color: muted, lineHeight: 1.5 }}>{v}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <JsonBlock data={ep.request.body} codeBg={codeBg} border={border} />
                          )}
                        </>
                      )}

                      {/* RESPONSE */}
                      {tab === "response" && (
                        <>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
                            {Object.keys(ep.responses).map(code => {
                              const col = statusColor(code);
                              const on  = stat === code || stat === parseInt(code).toString();
                              return (
                                <button
                                  key={code}
                                  className="stat-chip"
                                  onClick={() => setStatusMap(p => ({ ...p, [ep.id]: code }))}
                                  style={{
                                    background: on ? `${col}18` : "transparent",
                                    borderColor: on ? `${col}55` : border,
                                    color: on ? col : muted,
                                  }}
                                >
                                  {code}
                                </button>
                              );
                            })}
                          </div>
                          <JsonBlock data={resData} codeBg={codeBg} border={border} />
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}