// Same-origin image proxy so the canvas in useTrimmedSrc is never tainted by CORS.
const ALLOWED = ["your-image-host.com"]; // put the hostname(s) used in logo.webpUrl

export async function GET(req) {
  const u = new URL(req.url).searchParams.get("u");
  if (!u) return new Response("missing", { status: 400 });
  let host;
  try { host = new URL(u).hostname; } catch { return new Response("bad url", { status: 400 }); }
  if (!ALLOWED.includes(host)) return new Response("forbidden", { status: 403 });

  const r = await fetch(u);
  if (!r.ok) return new Response("fail", { status: 502 });
  return new Response(r.body, {
    headers: {
      "Content-Type": r.headers.get("content-type") || "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}