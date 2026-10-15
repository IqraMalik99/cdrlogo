export const TEMPLATE_PAGE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&family=DM+Sans:wght@400;500&display=swap');
[data-theme="dark"]{--bg:#09090f;--heading:#fff;--sub:rgba(255,255,255,.5);--card-bg:rgba(255,255,255,.04);--card-bdr:rgba(255,255,255,.09);--dot:rgba(255,255,255,.04);--img-bg:#fff}
[data-theme="light"]{--bg:#f4f4f8;--heading:#0a0a14;--sub:rgba(0,0,0,.55);--card-bg:rgba(255,255,255,.95);--card-bdr:rgba(0,0,0,.1);--dot:rgba(0,0,0,.04);--img-bg:#fff}
.tp-root{min-height:100vh;background:var(--bg);font-family:'Sora','Segoe UI',sans-serif;padding:56px 20px 80px;position:relative;overflow-x:hidden}
.tp-dots{position:absolute;inset:0;background-image:radial-gradient(var(--dot) 1px,transparent 1px);background-size:30px 30px;pointer-events:none}
.tp-inner{position:relative;z-index:1;max-width:1000px;margin:0 auto;display:flex;flex-direction:column;gap:26px}
.tp-crumbs{font-family:'DM Sans',sans-serif;font-size:12px;color:var(--sub);display:flex;gap:6px;flex-wrap:wrap}
.tp-crumbs a{color:var(--sub);text-decoration:none}.tp-crumbs a:hover{color:#07A626}
.tp-h1{font-size:clamp(22px,4vw,36px);font-weight:900;letter-spacing:-.8px;color:var(--heading);text-align:center;line-height:1.15}
.tp-sub{font-family:'DM Sans',sans-serif;font-size:13.5px;color:var(--sub);text-align:center;line-height:1.7;max-width:640px;margin:0 auto}
.tp-accent{color:#07A626}
.tp-cats{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.tp-cat{display:flex;flex-direction:column;gap:8px;padding:16px;background:var(--card-bg);border:1px solid var(--card-bdr);border-radius:12px;text-decoration:none;transition:border-color .2s,transform .15s,background .2s}
.tp-cat:hover{border-color:rgba(7,166,38,.45);background:rgba(7,166,38,.06);transform:translateY(-2px)}
.tp-cat-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.tp-cat-name{font-size:14.5px;font-weight:700;color:var(--heading)}
.tp-cat-count{font-size:10.5px;font-weight:700;color:#07A626;border:1px solid rgba(7,166,38,.35);border-radius:100px;padding:2px 8px;white-space:nowrap}
.tp-cat-intro{font-family:'DM Sans',sans-serif;font-size:12.5px;line-height:1.6;color:var(--sub)}
.tp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
.tp-logo{display:flex;flex-direction:column;background:var(--card-bg);border:1px solid var(--card-bdr);border-radius:12px;overflow:hidden;text-decoration:none;transition:border-color .2s,transform .15s}
.tp-logo:hover{border-color:rgba(7,166,38,.5);transform:translateY(-2px)}
.tp-logo-img{aspect-ratio:1/1;background:var(--img-bg);display:flex;align-items:center;justify-content:center}
.tp-logo-img img{width:100%;height:100%;object-fit:contain}
.tp-logo-name{padding:10px 12px;font-size:12.5px;font-weight:600;color:var(--heading);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tp-skel{aspect-ratio:1/1.15;border-radius:12px;background:var(--card-bg);border:1px solid var(--card-bdr);animation:tp-sh 1.4s ease-in-out infinite}
@keyframes tp-sh{0%,100%{opacity:1}50%{opacity:.35}}
.tp-empty{text-align:center;padding:48px 20px;color:var(--sub);font-size:13px}
.tp-empty strong{display:block;font-size:15px;color:var(--heading);margin-bottom:4px}
.tp-pag{display:flex;justify-content:center;gap:6px;flex-wrap:wrap}
.tp-pbtn{min-width:32px;height:32px;padding:0 8px;background:var(--card-bg);border:1px solid var(--card-bdr);border-radius:7px;font-size:12px;font-weight:700;color:var(--sub);cursor:pointer;font-family:'Sora',sans-serif}
.tp-pbtn:hover:not(:disabled){border-color:rgba(7,166,38,.4);color:#07A626}
.tp-pbtn.active{background:rgba(7,166,38,.15);border-color:rgba(7,166,38,.55);color:#07A626}
.tp-pbtn:disabled{opacity:.35;cursor:not-allowed}
.tp-others{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.tp-others a{font-size:12px;font-weight:600;padding:7px 12px;border-radius:100px;border:1px solid var(--card-bdr);background:var(--card-bg);color:var(--sub);text-decoration:none}
.tp-others a:hover{border-color:rgba(7,166,38,.45);color:#07A626}
@media(max-width:480px){.tp-root{padding:40px 14px 60px}.tp-grid{grid-template-columns:repeat(2,1fr)}.tp-cats{grid-template-columns:1fr}}
`;