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

  if (pathname === "/llms.txt") {
    const content = `# CDRLogo

> Vector logo downloads in CDR, SVG, AI, EPS and PNG formats for designers and students.

## Main Pages
- [All Logos](${origin}/logos)
- [Brand Categories](${origin}/category)
- [About](${origin}/about-us)

## Guidelines
Educational reference library. Logos provided for design reference and learning purposes only.
`;

    return new NextResponse(content, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/sitemap.xml", "/llms.txt"],
};