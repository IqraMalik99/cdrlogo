import { NextResponse } from "next/server";

export async function middleware(req) {
  const { pathname, origin } = req.nextUrl;

  if (pathname === "/sitemap.xml") {
    const res = await fetch(`${origin}/api/sitemap-data`);
    const routes = await res.json();

    const urlEntries = routes.map(r => `
  <url>
    <loc>${r.url}</loc>
    <lastmod>${new Date(r.lastModified).toISOString()}</lastmod>
    <changefreq>${r.changeFrequency}</changefreq>
    <priority>${r.priority}</priority>
  </url>`).join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlEntries}
</urlset>`;

    return new NextResponse(xml, {
      headers: { "Content-Type": "application/xml" },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/sitemap.xml"],
};