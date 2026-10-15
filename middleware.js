import { NextResponse } from "next/server";

// Old singular pattern → /category/football
const OLD_CATEGORY_SINGULAR = /^\/category\/([^/]+)\/?$/;


export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // ---- 301 redirects for legacy category URLs ----
  const singularMatch = pathname.match(OLD_CATEGORY_SINGULAR);
  if (singularMatch) {
    const url = req.nextUrl.clone();
    url.pathname = `/categories/logos/${singularMatch[1].toLowerCase()}`;
    return NextResponse.redirect(url, 301);
  }

  if (pathname === "/category" || pathname.startsWith("/category/")) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.replace(/^\/category/, "/categories");
    return NextResponse.redirect(url, 301);
  }

  // const pluralMatch = pathname.match(OLD_CATEGORY_PLURAL);
  // if (pluralMatch && pluralMatch[1] !== "logos") {
  //   const url = req.nextUrl.clone();
  //   url.pathname = `/categories/logos/${pluralMatch[1].toLowerCase()}`;
  //   return NextResponse.redirect(url, 301);
  // }

  // ---- 301 redirect: /template → /logo-templates (keeps sub-paths + query string) ----
  if (pathname === "/template" || pathname.startsWith("/template/")) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.replace(/^\/template/, "/logo-templates");
    return NextResponse.redirect(url, 301);
  }
  // ---- END redirect block ----

  // ---- 301 redirect: /logos → /all-logos (query string is kept by clone()) ----
  if (pathname === "/logos" || pathname === "/logos/") {
    const url = req.nextUrl.clone();
    url.pathname = "/all-logos";
    return NextResponse.redirect(url, 301);
  }

  // ---- 301 redirect: /request → /Request-Logo ----
  if (pathname === "/request" || pathname === "/request/") {
    const url = req.nextUrl.clone();
    url.pathname = "/Request-Logo";
    return NextResponse.redirect(url, 301);
  }

  if (pathname === "/sitemap.xml") {
    const res = await fetch(`https://www.cdrlogo.com/api/sitemap-data`);
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
- [All Logos](https://www.cdrlogo.com/all-logos)
- [Sports & Athletics](https://www.cdrlogo.com/categories/logos/sports-athletics)
- [Corporate & Finance](https://www.cdrlogo.com/categories/logos/corporate-finance)
- [Technology & Media](https://www.cdrlogo.com/categories/logos/technology-media)
- [Automotive & Transport](https://www.cdrlogo.com/categories/logos/automotive-transport)
- [Food & Beverages](https://www.cdrlogo.com/categories/logos/food-beverages)
- [Fashion & Retail](https://www.cdrlogo.com/categories/logos/fashion-retail)
- [Industry, Energy & Construction](https://www.cdrlogo.com/categories/logos/industry-energy-construction)
- [Government & Politics](https://www.cdrlogo.com/categories/logos/government-politics)
- [Education & Science](https://www.cdrlogo.com/categories/logos/education-science)
- [Entertainment & Lifestyle](https://www.cdrlogo.com/categories/logos/entertainment-lifestyle)
- [Healthcare & Pharma](https://www.cdrlogo.com/categories/logos/healthcare-pharma)
- [Travel & Hospitality](https://www.cdrlogo.com/categories/logos/travel-hospitality)
- [Non-Profit & Culture](https://www.cdrlogo.com/categories/logos/non-profit-culture)

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
  matcher: [
    "/sitemap.xml",
    "/llms.txt",
    "/category/:path*",
    "/categories/:path*",
    "/template/:path*",
    "/logos",
    "/logos/",
    "/request",
    "/request/",
  ],
};