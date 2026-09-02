import { NextResponse } from "next/server";

export async function middleware(req) {
  const { pathname, origin } = req.nextUrl;

  if (pathname === "/sitemap.xml") {
    const res = await fetch(`${origin}/api/sitemap-data`);
    const routes = await res.json();

    const escapeXml = (str) =>
      String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

    const urlEntries = routes.map(r => `
  <url>
    <loc>${escapeXml(r.url)}</loc>
    <lastmod>${new Date(r.lastModified).toISOString()}</lastmod>
    <changefreq>${r.changeFrequency}</changefreq>
    <priority>${r.priority}</priority>${r.image ? `
    <image:image>
      <image:loc>${escapeXml(r.image)}</image:loc>
      <image:title>${escapeXml(r.imageTitle || "")}</image:title>
    </image:image>` : ""}
  </url>`).join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urlEntries}
</urlset>`;

    return new NextResponse(xml, {
      headers: { "Content-Type": "application/xml" },
    });
  }

  if (pathname === "/llms.txt") {
    const content = `# CDRLogo

> Vector logo downloads in CDR, SVG, AI, EPS and PNG formats for designers and students.

## Main Pages
- [All Logos](https://www.cdrlogo.com/logos)
- [Sports & Athletics](https://www.cdrlogo.com/categories/sports-athletics)
- [Corporate & Finance](https://www.cdrlogo.com/categories/corporate-finance)
- [Technology & Media](https://www.cdrlogo.com/categories/technology-media)
- [Automotive & Transport](https://www.cdrlogo.com/categories/automotive-transport)
- [Food & Beverages](https://www.cdrlogo.com/categories/food-beverages)
- [Fashion & Retail](https://www.cdrlogo.com/categories/fashion-retail)
- [Industry, Energy & Construction](https://www.cdrlogo.com/categories/industry-energy-construction)
- [Government & Politics](https://www.cdrlogo.com/categories/government-politics)
- [Education & Science](https://www.cdrlogo.com/categories/education-science)
- [Entertainment & Lifestyle](https://www.cdrlogo.com/categories/entertainment-lifestyle)
- [Healthcare & Pharma](https://www.cdrlogo.com/categories/healthcare-pharma)
- [Travel & Hospitality](https://www.cdrlogo.com/categories/travel-hospitality)
- [Non-Profit & Culture](https://www.cdrlogo.com/categories/non-profit-culture)

## Optional
- [About Us](https://www.cdrlogo.com/about-us)
- [Blog](https://www.cdrlogo.com/blog)
- [Privacy Policy](https://www.cdrlogo.com/privacy-policy)
- [Terms of Service](https://www.cdrlogo.com/terms-of-service)
- [DMCA & Copyright Policy](https://www.cdrlogo.com/dmca-copyright-policy)

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