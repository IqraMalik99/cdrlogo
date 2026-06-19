"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const slugify = (str) =>
  str.toLowerCase().trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

const EMPTY_FORM = {
  title: "", slug: "", excerpt: "", content: "",
  category: "", readTime: 5, published: true,
};

function MiniPreview({ content, dark }) {
  const text    = dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.65)";
  const head    = dark ? "#fff"                 : "#0a0a14";
  const codeBg  = dark ? "rgba(255,255,255,.06)": "rgba(0,0,0,.05)";
  const quoteBg = dark ? "rgba(7,166,38,.06)"   : "rgba(7,166,38,.04)";
  if (!content) return (
    <div style={{ color:dark?"rgba(255,255,255,.2)":"rgba(0,0,0,.2)", fontStyle:"italic", fontSize:13, padding:"40px 0", textAlign:"center" }}>
      Preview will appear here…
    </div>
  );
  const lines = content.split("\n"); const els = []; let i = 0, k = 0;
  const inline = (t) => {
    const parts = []; let rem = t;
    const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g; let last = 0, m;
    while ((m = re.exec(rem)) !== null) {
      if (m.index > last) parts.push(rem.slice(last, m.index));
      if (m[2]) parts.push(<strong key={k++}>{m[2]}</strong>);
      else if (m[3]) parts.push(<em key={k++}>{m[3]}</em>);
      else if (m[4]) parts.push(<code key={k++} style={{ fontFamily:"monospace", fontSize:12, background:codeBg, padding:"1px 5px", borderRadius:4 }}>{m[4]}</code>);
      last = m.index + m[0].length;
    }
    if (last < rem.length) parts.push(rem.slice(last));
    return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : parts;
  };
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith("```")) { const code=[]; i++; while(i<lines.length&&!lines[i].startsWith("```")){code.push(lines[i]);i++;} els.push(<pre key={k++} style={{background:codeBg,borderRadius:8,padding:"12px 14px",fontSize:12,fontFamily:"monospace",overflowX:"auto",margin:"12px 0",color:dark?"#a5f3c0":"#0f5132"}}><code>{code.join("\n")}</code></pre>); i++; continue; }
    if (l.startsWith("### ")) { els.push(<h4 key={k++} style={{color:head,fontSize:14,fontWeight:700,margin:"16px 0 6px"}}>{inline(l.slice(4))}</h4>); i++; continue; }
    if (l.startsWith("## "))  { els.push(<h3 key={k++} style={{color:head,fontSize:16,fontWeight:800,margin:"20px 0 8px"}}>{inline(l.slice(3))}</h3>); i++; continue; }
    if (l.startsWith("# "))   { els.push(<h2 key={k++} style={{color:head,fontSize:18,fontWeight:900,margin:"20px 0 8px"}}>{inline(l.slice(2))}</h2>); i++; continue; }
    if (l.startsWith("> ")) { els.push(<blockquote key={k++} style={{borderLeft:"3px solid rgba(7,166,38,.4)",background:quoteBg,padding:"10px 14px",borderRadius:"0 8px 8px 0",fontStyle:"italic",fontSize:13,color:text,margin:"12px 0"}}>{inline(l.slice(2))}</blockquote>); i++; continue; }
    if (l.startsWith("- ")||l.startsWith("* ")) { const items=[]; while(i<lines.length&&(lines[i].startsWith("- ")||lines[i].startsWith("* "))){items.push(<li key={k++}>{inline(lines[i].slice(2))}</li>);i++;} els.push(<ul key={k++} style={{color:text,fontSize:13.5,lineHeight:1.7,paddingLeft:20,margin:"10px 0"}}>{items}</ul>); continue; }
    if (/^\d+\. /.test(l)) { const items=[]; while(i<lines.length&&/^\d+\. /.test(lines[i])){items.push(<li key={k++}>{inline(lines[i].replace(/^\d+\. /,""))}</li>);i++;} els.push(<ol key={k++} style={{color:text,fontSize:13.5,lineHeight:1.7,paddingLeft:20,margin:"10px 0"}}>{items}</ol>); continue; }
    if (l.trim()==="---") { els.push(<hr key={k++} style={{border:"none",borderTop:dark?"1px solid rgba(255,255,255,.08)":"1px solid rgba(0,0,0,.1)",margin:"20px 0"}}/>); i++; continue; }
    if (l.trim()==="") { i++; continue; }
    const para=[]; while(i<lines.length&&lines[i].trim()!==""&&!lines[i].startsWith("#")&&!lines[i].startsWith(">")&&!lines[i].startsWith("- ")&&!lines[i].startsWith("* ")&&!/^\d+\. /.test(lines[i])&&!lines[i].startsWith("```")){para.push(lines[i]);i++;}
    if (para.length) els.push(<p key={k++} style={{color:text,fontSize:14,lineHeight:1.75,margin:"0 0 14px"}}>{inline(para.join(" "))}</p>);
  }
  return <>{els}</>;
}

export default function BlogManager({ dark }) {
  const bg       = dark ? "#0f1117"               : "#FFFFFF";
  const card     = dark ? "#131720"               : "#ffffff";
  const border   = dark ? "#1e2535"               : "#e2e8f0";
  const text     = dark ? "#e2e8f0"               : "#1e293b";
  const muted    = dark ? "#64748b"               : "#94a3b8";
  const inputBg  = dark ? "rgba(255,255,255,.04)" : "#FFFFFF";
  const inputBdr = dark ? "rgba(255,255,255,.1)"  : "#e2e8f0";
  const labelClr = dark ? "rgba(255,255,255,.55)" : "#64748b";
  const green    = "#22c55e";
  const greenDim = "rgba(34,197,94,.12)";
  const greenBdr = "rgba(34,197,94,.3)";
  const danger   = "#ef4444";
  const dangerDim= "rgba(239,68,68,.1)";

  const [view, setView]               = useState("list");
  const [blogs, setBlogs]             = useState([]);
  const [pagination, setPagination]   = useState({ total:0, page:1, totalPages:1 });
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch]           = useState("");
  const [filterCat, setFilterCat]     = useState("");
  const [form, setForm]               = useState(EMPTY_FORM);
  const [editId, setEditId]           = useState(null);
  const [saving, setSaving]           = useState(false);
  const [deleting, setDeleting]       = useState(null);
  const [toast, setToast]             = useState(null);
  const [tab, setTab]                 = useState("write");
  const [slugManual, setSlugManual]   = useState(false);
  const [page, setPage]               = useState(1);
  const [categories, setCategories]   = useState([]);
  const [catOpen, setCatOpen]         = useState(false);
  const [loadingCats, setLoadingCats] = useState(false);

  // ── image upload state ────────────────────────────────────────────────
  // Image can only be set on CREATE. On EDIT, the existing image is locked
  // and never sent to the backend — imageFile stays null the whole time.
  const [imageFile, setImageFile]     = useState(null);   // File object, pending upload (create only)
  const [imagePreview, setImagePreview] = useState(null); // local object URL (create) or existing remote URL (edit, read-only)
  const fileInputRef = useRef(null);
  const isEditView = view === "edit";

  useEffect(() => {
    setLoadingCats(true);
    fetch("/api/catageory/home")
      .then(r => r.json())
      .then(d => { if (d.success) setCategories(d.data); })
      .catch(() => {})
      .finally(() => setLoadingCats(false));
  }, []);

  useEffect(() => {
    if (!catOpen) return;
    const close = () => setCatOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [catOpen]);

  // Revoke local object URLs when replaced/unmounted to avoid memory leaks
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  // GET /api/blogs/all?page=&limit=&category=&search=
  const fetchBlogs = useCallback(async (p = 1) => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams({
        page: p, limit: 10,
        ...(filterCat && { category: filterCat }),
        ...(search    && { search }),
      });
      const res  = await fetch(`/api/blogs/all?${params}`);
      const data = await res.json();
      setBlogs(data.blogs || []);
      setPagination(data.pagination || { total:0, page:1, totalPages:1 });
    } catch {
      showToast("Failed to load blogs", "error");
    } finally {
      setLoadingList(false);
    }
  }, [filterCat, search]);

  useEffect(() => { fetchBlogs(page); }, [fetchBlogs, page]);

  useEffect(() => {
    if (!slugManual && view === "create") {
      setForm(f => ({ ...f, slug: slugify(f.title) }));
    }
  }, [form.title, slugManual, view]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const resetImageState = () => {
    if (imagePreview && imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setSlugManual(false);
    setTab("write");
    resetImageState();
    setView("create");
  };

  const handleImageSelect = (file) => {
    // Image picking is disabled entirely in edit mode — guard in case this
    // is ever called programmatically while editing.
    if (isEditView) return;
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      showToast("Use JPG, PNG, WEBP, or GIF", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("Image must be under 5MB", "error");
      return;
    }
    if (imagePreview && imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // POST /api/blogs/by-slug  →  fills edit form with full content
  const openEdit = async (blog) => {
    setForm({
      title: blog.title, slug: blog.slug, excerpt: blog.excerpt,
      content: blog.content ?? "", category: blog.category,
      readTime: blog.readTime ?? 5, published: blog.published ?? true,
    });
    setEditId(blog.id);
    setSlugManual(true);
    setTab("write");
    resetImageState();
    setImagePreview(blog.image || null); // display-only existing image, never re-sent
    setView("edit");

    try {
      const res = await fetch("/api/blogs/by-slug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: blog.slug }),
      });
      if (res.ok) {
        const { blog: b } = await res.json();
        setForm({
          title: b.title, slug: b.slug, excerpt: b.excerpt,
          content: b.content ?? "", category: b.category,
          readTime: b.readTime ?? 5, published: b.published ?? true,
        });
        setImagePreview(b.image || null);
      }
    } catch { /* keep optimistic data */ }
  };

  const handleSave = async () => {
    const { title, slug, excerpt, content, category } = form;
    if (!title.trim() || !slug.trim() || !excerpt.trim() || !content.trim() || !category.trim()) {
      showToast("Please fill in all required fields", "error"); return;
    }
    // Image required only on create; edit never touches the image field at all
    if (view === "create" && !imageFile) {
      showToast("Please upload a cover image", "error"); return;
    }

    setSaving(true);
    try {
      const isEdit = view === "edit" && editId;
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("slug", form.slug);
      fd.append("excerpt", form.excerpt);
      fd.append("content", form.content);
      fd.append("category", form.category);
      fd.append("readTime", String(Number(form.readTime)));
      fd.append("published", String(Boolean(form.published)));
      // Image is only ever appended on create. In edit mode imageFile is
      // always null (picker is disabled), so the field is simply omitted
      // and the backend should leave the existing image untouched.
      if (!isEdit && imageFile) fd.append("image", imageFile);
       
      const res = await fetch(isEdit ? `/api/blogs/${editId}` : "/api/blogs", {
        method: isEdit ? "PATCH" : "POST",
        body: fd, // no Content-Type header — browser sets multipart boundary
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      showToast(isEdit ? "Post updated!" : "Post created!");
      setView("list");
      fetchBlogs(1); setPage(1);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/blogs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast("Post deleted");
      fetchBlogs(page);
    } catch {
      showToast("Failed to delete", "error");
    } finally {
      setDeleting(null);
    }
  };

  // Optimistic toggle — PATCH /api/blogs/[id] with just { published }
  const togglePublish = async (blog) => {
    const next = !blog.published;
    setBlogs(prev => prev.map(b => b.id === blog.id ? { ...b, published: next } : b));
    try {
      const res = await fetch(`/api/blogs/${blog.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: next }),
      });
      if (!res.ok) throw new Error();
      showToast(next ? "Post published" : "Post moved to draft");
    } catch {
      setBlogs(prev => prev.map(b => b.id === blog.id ? { ...b, published: blog.published } : b));
      showToast("Failed to update status", "error");
    }
  };

  const inp = (extra = {}) => ({
    width:"100%", padding:"9px 13px", borderRadius:9,
    background:inputBg, border:`1px solid ${inputBdr}`,
    color:text, fontSize:13.5, fontFamily:"'DM Sans',sans-serif",
    outline:"none", transition:"border-color .2s,box-shadow .2s", ...extra,
  });

  const lbl = (txt, required) => (
    <label style={{ display:"block", fontSize:11.5, fontWeight:600, color:labelClr, marginBottom:5, letterSpacing:".4px", textTransform:"uppercase" }}>
      {txt}{required && <span style={{ color:danger, marginLeft:3 }}>*</span>}
    </label>
  );

  const CategoryDropdown = () => (
    <div style={{ position:"relative" }} onClick={e => e.stopPropagation()}>
      {lbl("Category", true)}
      <button type="button" onClick={() => setCatOpen(o => !o)}
        style={{ ...inp({ cursor:"pointer" }), display:"flex", alignItems:"center", justifyContent:"space-between", color: form.category ? text : muted }}>
        <span>{form.category || (loadingCats ? "Loading categories…" : "Select a category…")}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink:0, transform:catOpen?"rotate(180deg)":"rotate(0deg)", transition:"transform .2s" }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {catOpen && (
        <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, right:0, zIndex:300, background:dark?"#1a2030":"#fff", border:`1px solid ${border}`, borderRadius:10, boxShadow:"0 8px 32px rgba(0,0,0,.25)", maxHeight:240, overflowY:"auto" }}>
          <div style={{ padding:"8px 10px", borderBottom:`1px solid ${border}` }}>
            <input autoFocus placeholder="Type custom category + Enter"
              style={{ ...inp({ padding:"6px 10px", fontSize:12.5 }) }}
              onKeyDown={e => { if (e.key === "Enter" && e.target.value.trim()) { set("category", e.target.value.trim()); setCatOpen(false); } }} />
          </div>
          {categories.length === 0 && !loadingCats && (
            <div style={{ padding:"12px 14px", fontSize:12.5, color:muted }}>No categories found</div>
          )}
          {categories.map(cat => (
            <button key={cat} type="button" onClick={() => { set("category", cat); setCatOpen(false); }}
              style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"10px 14px", background:form.category===cat?greenDim:"transparent", border:"none", textAlign:"left", fontSize:13.5, cursor:"pointer", color:form.category===cat?green:text, fontFamily:"'DM Sans',sans-serif", transition:"background .15s" }}
              onMouseEnter={e => { if (form.category!==cat) e.currentTarget.style.background=dark?"rgba(255,255,255,.04)":"#f1f5f9"; }}
              onMouseLeave={e => { if (form.category!==cat) e.currentTarget.style.background="transparent"; }}>
              {form.category===cat
                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                : <span style={{ width:12 }}/>}
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  if (view === "list") return (
    <div style={{ padding:"28px 24px", fontFamily:"'DM Sans',sans-serif", minHeight:"100%", background:bg }}>
      {toast && <Toast msg={toast.msg} type={toast.type} danger={danger} green={green} />}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div>
          <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:text }}>Blog Posts</h2>
          <p style={{ margin:"3px 0 0", fontSize:12.5, color:muted }}>{pagination.total} total posts</p>
        </div>
        <button onClick={openCreate}
          style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 18px", background:green, border:"none", borderRadius:10, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}
          onMouseEnter={e=>e.currentTarget.style.opacity=".85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
          <span style={{ fontSize:16 }}>+</span> New Post
        </button>
      </div>

      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
        <input placeholder="Search posts…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} style={{ ...inp(), width:240 }} />
        <select value={filterCat} onChange={e=>{setFilterCat(e.target.value);setPage(1);}} style={{ ...inp(), width:200, cursor:"pointer" }}>
          <option value="">All categories</option>
          {categories.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div style={{ background:card, border:`1px solid ${border}`, borderRadius:14, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 80px 110px 130px", borderBottom:`1px solid ${border}`, padding:"10px 18px" }}>
          {["Title","Category","Read","Status","Actions"].map(h=>(
            <div key={h} style={{ fontSize:11, fontWeight:700, color:muted, letterSpacing:".5px", textTransform:"uppercase" }}>{h}</div>
          ))}
        </div>
        {loadingList ? (
          <div style={{ padding:"48px 0", textAlign:"center", color:muted, fontSize:13 }}>Loading…</div>
        ) : blogs.length === 0 ? (
          <div style={{ padding:"48px 0", textAlign:"center", color:muted }}>
            <div style={{ fontSize:36, marginBottom:10 }}>📭</div>
            <p style={{ margin:0, fontSize:14, fontWeight:600, color:text }}>No posts found</p>
            <p style={{ margin:"4px 0 0", fontSize:12.5 }}>Create your first blog post above.</p>
          </div>
        ) : blogs.map((b, idx) => (
          <div key={b.id}
            style={{ display:"grid", gridTemplateColumns:"2fr 1fr 80px 110px 130px", padding:"13px 18px", borderBottom:idx<blogs.length-1?`1px solid ${border}`:"none", alignItems:"center", transition:"background .15s" }}
            onMouseEnter={e=>e.currentTarget.style.background=dark?"rgba(255,255,255,.02)":"rgba(0,0,0,.015)"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
              {b.image
                ? <img src={b.image} alt="" style={{ width:32, height:32, borderRadius:7, objectFit:"cover", flexShrink:0 }} />
                : <span style={{ width:32, height:32, borderRadius:7, background:dark?"rgba(255,255,255,.06)":"#f1f5f9", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>🖼️</span>}
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:13.5, fontWeight:600, color:text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{b.title}</div>
                <div style={{ fontSize:11, color:muted, marginTop:1 }}>{b.slug}</div>
              </div>
            </div>
            <div style={{ fontSize:12, color:muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.category}</div>
            <div style={{ fontSize:12, color:muted }}>{b.readTime} min</div>
            <div>
              <button onClick={() => togglePublish(b)}
                style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:6, fontSize:11, fontWeight:700, border:"none", cursor:"pointer", background:b.published?greenDim:dangerDim, color:b.published?green:danger, transition:"background .2s" }}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:b.published?green:danger, display:"inline-block" }}/>
                {b.published ? "Published" : "Draft"}
              </button>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={()=>openEdit(b)}
                style={{ padding:"5px 12px", borderRadius:7, fontSize:12, fontWeight:600, background:dark?"rgba(255,255,255,.06)":"#f1f5f9", border:`1px solid ${border}`, color:text, cursor:"pointer" }}>
                Edit
              </button>
              <button onClick={()=>handleDelete(b.id)} disabled={deleting===b.id}
                style={{ padding:"5px 10px", borderRadius:7, fontSize:12, fontWeight:600, background:dangerDim, border:`1px solid rgba(239,68,68,.2)`, color:danger, cursor:"pointer", opacity:deleting===b.id?.5:1 }}>
                {deleting===b.id?"…":"Del"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {pagination.totalPages > 1 && (
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:20, justifyContent:"center" }}>
          <button onClick={()=>{const p=Math.max(1,page-1);setPage(p);fetchBlogs(p);}} disabled={page===1}
            style={{ padding:"6px 14px", borderRadius:8, background:card, border:`1px solid ${border}`, color:text, fontSize:12, fontWeight:600, cursor:page===1?"not-allowed":"pointer", opacity:page===1?.4:1 }}>← Prev</button>
          {Array.from({length:pagination.totalPages},(_,i)=>i+1).map(p=>(
            <button key={p} onClick={()=>{setPage(p);fetchBlogs(p);}}
              style={{ width:32, height:32, borderRadius:8, border:`1px solid ${page===p?green:border}`, background:page===p?greenDim:card, color:page===p?green:text, fontSize:12, fontWeight:700, cursor:"pointer" }}>{p}</button>
          ))}
          <button onClick={()=>{const p=Math.min(pagination.totalPages,page+1);setPage(p);fetchBlogs(p);}} disabled={page===pagination.totalPages}
            style={{ padding:"6px 14px", borderRadius:8, background:card, border:`1px solid ${border}`, color:text, fontSize:12, fontWeight:600, cursor:page===pagination.totalPages?"not-allowed":"pointer", opacity:page===pagination.totalPages?.4:1 }}>Next →</button>
        </div>
      )}
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );

  // ── CREATE / EDIT VIEW ────────────────────────────────────────────────────
  return (
    <div style={{ padding:"24px", fontFamily:"'DM Sans',sans-serif", background:bg, minHeight:"100%" }}>
      {toast && <Toast msg={toast.msg} type={toast.type} danger={danger} green={green} />}

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={()=>setView("list")}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", background:dark?"rgba(255,255,255,.05)":"#f1f5f9", border:`1px solid ${border}`, borderRadius:9, color:muted, fontSize:12, fontWeight:600, cursor:"pointer" }}>
            ← Back
          </button>
          <h2 style={{ margin:0, fontSize:18, fontWeight:800, color:text }}>{view==="edit"?"Edit Post":"New Post"}</h2>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>set("published", !form.published)}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:9, border:`1px solid ${form.published?greenBdr:border}`, background:form.published?greenDim:"transparent", color:form.published?green:muted, fontSize:12.5, fontWeight:700, cursor:"pointer" }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:form.published?green:muted, display:"inline-block" }}/>
            {form.published ? "Published" : "Draft"}
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding:"8px 22px", background:saving?"rgba(34,197,94,.5)":green, border:"none", borderRadius:9, color:"#fff", fontSize:13, fontWeight:700, cursor:saving?"not-allowed":"pointer" }}>
            {saving?"Saving…":view==="edit"?"Update Post":"Publish Post"}
          </button>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:20, alignItems:"start" }}>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ background:card, border:`1px solid ${border}`, borderRadius:14, padding:20 }}>
            {lbl("Title", true)}
            <input value={form.title} onChange={e=>set("title",e.target.value)} placeholder="Your blog post title…" style={{ ...inp(), fontSize:16, fontWeight:700 }} />
          </div>
          <div style={{ background:card, border:`1px solid ${border}`, borderRadius:14, padding:20 }}>
            {lbl("Slug (URL)", true)}
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <span style={{ fontSize:12.5, color:muted, whiteSpace:"nowrap" }}>/blog/</span>
              <input value={form.slug} onChange={e=>{setSlugManual(true);set("slug",slugify(e.target.value));}} placeholder="auto-generated" style={inp()} />
              <button onClick={()=>{setSlugManual(false);set("slug",slugify(form.title));}}
                style={{ whiteSpace:"nowrap", padding:"8px 12px", borderRadius:8, background:dark?"rgba(255,255,255,.06)":"#f1f5f9", border:`1px solid ${border}`, color:muted, fontSize:11.5, fontWeight:600, cursor:"pointer" }}>
                Auto
              </button>
            </div>
          </div>
          <div style={{ background:card, border:`1px solid ${border}`, borderRadius:14, padding:20 }}>
            {lbl("Excerpt", true)}
            <textarea value={form.excerpt} onChange={e=>set("excerpt",e.target.value)} placeholder="Short summary shown in blog list…" rows={3} style={{ ...inp(), resize:"vertical", lineHeight:1.6 }} />
          </div>
          <div style={{ background:card, border:`1px solid ${border}`, borderRadius:14, overflow:"hidden" }}>
            <div style={{ display:"flex", borderBottom:`1px solid ${border}`, padding:"0 16px" }}>
              {["write","preview"].map(t=>(
                <button key={t} onClick={()=>setTab(t)}
                  style={{ padding:"12px 16px", background:"none", border:"none", borderBottom:tab===t?`2px solid ${green}`:"2px solid transparent", color:tab===t?green:muted, fontSize:13, fontWeight:600, cursor:"pointer", marginBottom:-1 }}>
                  {t==="write"?"✏️ Write":"👁 Preview"}
                </button>
              ))}
              <span style={{ marginLeft:"auto", display:"flex", alignItems:"center", fontSize:11, color:muted, padding:"0 8px" }}>Markdown supported</span>
            </div>
            {tab==="write" ? (
              <div style={{ padding:16 }}>
                {lbl("Content", true)}
                <textarea value={form.content} onChange={e=>set("content",e.target.value)}
                  placeholder={"# Heading\n\nWrite in **markdown**…\n\n- item\n\n```js\nconst x = 1;\n```"}
                  rows={22} style={{ ...inp(), resize:"vertical", lineHeight:1.75, fontFamily:"'JetBrains Mono','Courier New',monospace", fontSize:13 }} />
              </div>
            ) : (
              <div style={{ padding:"16px 20px", minHeight:400, maxHeight:600, overflowY:"auto" }}>
                <MiniPreview content={form.content} dark={dark} />
              </div>
            )}
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:16, position:"sticky", top:16 }}>
          {/* ── Cover Image ────────────────────────────────────────────── */}
          <div style={{ background:card, border:`1px solid ${border}`, borderRadius:14, padding:18 }}>
            {lbl("Cover Image", !isEditView)}

            {isEditView ? (
              // Edit mode: image is locked — display only, no upload/replace/remove.
              <>
                <div style={{
                  position:"relative", width:"100%", aspectRatio:"16/9", borderRadius:10,
                  border:`1px solid ${border}`, overflow:"hidden",
                  background: imagePreview ? "transparent" : (dark?"rgba(255,255,255,.03)":"#f8fafc"),
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  {imagePreview ? (
                    <img src={imagePreview} alt="Cover" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  ) : (
                    <div style={{ textAlign:"center", color:muted, fontSize:12.5, padding:"0 16px" }}>
                      <div style={{ fontSize:26, marginBottom:6 }}>🖼️</div>
                      No cover image
                    </div>
                  )}
                </div>
                <div style={{ marginTop:8, fontSize:11.5, color:muted, display:"flex", alignItems:"center", gap:5 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Image can't be changed when editing a post
                </div>
              </>
            ) : (
              // Create mode: full upload/replace/remove UI.
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display:"none" }}
                  onChange={e => handleImageSelect(e.target.files?.[0])}
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); handleImageSelect(e.dataTransfer.files?.[0]); }}
                  style={{
                    position:"relative", width:"100%", aspectRatio:"16/9", borderRadius:10,
                    border:`1.5px dashed ${imagePreview ? "transparent" : inputBdr}`,
                    background: imagePreview ? "transparent" : (dark?"rgba(255,255,255,.03)":"#f8fafc"),
                    cursor:"pointer", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center",
                  }}>
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="Cover preview" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); resetImageState(); }}
                        style={{ position:"absolute", top:8, right:8, width:26, height:26, borderRadius:7, background:"rgba(0,0,0,.55)", border:"none", color:"#fff", fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        ✕
                      </button>
                    </>
                  ) : (
                    <div style={{ textAlign:"center", color:muted, fontSize:12.5, padding:"0 16px" }}>
                      <div style={{ fontSize:26, marginBottom:6 }}>🖼️</div>
                      Click or drop an image<br/>JPG, PNG, WEBP, GIF · max 5MB
                    </div>
                  )}
                </div>
                {imageFile && (
                  <div style={{ marginTop:8, fontSize:11.5, color:muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {imageFile.name}
                  </div>
                )}
              </>
            )}
          </div>

          <div style={{ background:card, border:`1px solid ${border}`, borderRadius:14, padding:18 }}>
            <div style={{ marginBottom:14 }}><CategoryDropdown /></div>
            <div>
              {lbl("Read Time (minutes)")}
              <input type="number" min={1} max={120} value={form.readTime} onChange={e=>set("readTime",e.target.value)} style={{ ...inp(), width:110 }} />
            </div>
          </div>

          <div style={{ background:card, border:`1px solid ${border}`, borderRadius:14, padding:18 }}>
            {lbl("Post Summary")}
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:4 }}>
              {[
                ["Title",    form.title    ||"—",  !!form.title],
                ["Slug",     form.slug     ||"—",  !!form.slug],
                ["Category", form.category ||"—",  !!form.category],
                ["Image",    isEditView ? (imagePreview ? "Locked (unchanged)" : "None") : (imageFile ? imageFile.name : "Not set"), isEditView ? true : !!imageFile],
                ["Content",  form.content  ? `${form.content.length} chars` : "Empty", !!form.content],
                ["Status",   form.published ? "Published" : "Draft", true],
              ].map(([k,v,ok])=>(
                <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:12.5 }}>
                  <span style={{ color:muted }}>{k}</span>
                  <span style={{
                    color: k==="Status" ? (form.published?green:danger) : (ok?text:danger),
                    fontWeight: ok?400:600, maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"
                  }}>{v}</span>
                </div>
              ))}
            </div>
            <button onClick={handleSave} disabled={saving}
              style={{ marginTop:16, width:"100%", padding:"10px 0", background:saving?"rgba(34,197,94,.5)":green, border:"none", borderRadius:10, color:"#fff", fontSize:13.5, fontWeight:700, cursor:saving?"not-allowed":"pointer" }}>
              {saving?"Saving…":view==="edit"?"Update Post":"Publish Post"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        textarea,input{outline:none!important}
        textarea:focus,input:focus{border-color:${green}!important;box-shadow:0 0 0 3px rgba(34,197,94,.1)!important}
      `}</style>
    </div>
  );
}

function Toast({ msg, type, danger, green }) {
  return (
    <div style={{ position:"fixed", top:20, right:24, zIndex:9999, padding:"10px 18px", borderRadius:10, background:type==="error"?danger:green, color:"#fff", fontSize:13, fontWeight:600, boxShadow:"0 4px 20px rgba(0,0,0,.25)", animation:"fadeIn .25s ease" }}>
      {msg}
    </div>
  );
}