// app/logo/[slug]/page.js
import LogoDetail from "./LogoDetail";

async function fetchLogo(slug) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/logo/fetch/slug`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
        next: { revalidate: 3600 },
      }
    );

    if (!res.ok) return null;

    const json = await res.json();
    const logo = json.data || json;

    // If API returned an error object, return null
    if (!logo || logo.error || !logo.slug) return null;

    return logo;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;

  try {
    const logo = await fetchLogo(slug);

    // ── 1. Canonical ─────────────────────────────────────────────────────────
    const canonicalUrl =
      logo.canonicalUrl ||
      `${process.env.NEXT_PUBLIC_BASE_URL}/logo/${logo.slug}`;

    // ── 2. Core meta ─────────────────────────────────────────────────────────
    const metaTitle = logo.metaTitle ||
      `${logo.logoName} Logo – Download (SVG, PNG, AI, CDR)`;

    const metaDescription = logo.metaDescription ||
      (logo.description || "").slice(0, 160);

    // ── 3. Open Graph ────────────────────────────────────────────────────────
    const ogTitle = logo.ogTitle || metaTitle;
    const ogDescription = logo.ogDescription || metaDescription;
    const ogType = logo.ogType || "website";
    const ogImage = logo.ogImageUrl || logo.webpUrl || null;

    // ── 4. Twitter / X card ──────────────────────────────────────────────────
    const twitterCard = logo.twitterCardType || "summary_large_image";
    const twitterTitle = logo.twitterTitle || ogTitle;
    const twitterDescription = logo.twitterDescription || ogDescription;
    const twitterImage = logo.twitterImage || ogImage;

    // ── 5. Robots / indexing ─────────────────────────────────────────────────
    const isPublished = logo.publishStatus === "Published";
    const robots = isPublished
      ? { index: true, follow: true, googleBot: { index: true, follow: true } }
      : { index: false, follow: false, googleBot: { index: false, follow: false } };

    // ── 6. Assemble — NO keywords ─────────────────────────────────────────────
    return {
      title: metaTitle,
      description: metaDescription,

      alternates: { canonical: canonicalUrl },
      robots,

      openGraph: {
        title: ogTitle,
        description: ogDescription,
        url: canonicalUrl,
        type: ogType,
        siteName: "cdrlogo.com",
        ...(ogImage
          ? { images: [{ url: ogImage, width: 1200, height: 630, alt: logo.altText || ogTitle }] }
          : {}),
      },

      twitter: {
        card: twitterCard,
        title: twitterTitle,
        description: twitterDescription,
        ...(twitterImage ? { images: [twitterImage] } : {}),
      },
    };

  } catch (err) {
    console.error("[generateMetadata]", err);
    return {
      title: "Logo – Download",
      description: "Download vector logos in SVG, PNG, AI, CDR formats.",
      robots: { index: false, follow: false },
    };
  }
}

export default async function Page({ params }) {
  const { slug } = await params;

  let imageObjectSchema = null;
  let breadcrumbSchema = null;
  let faqSchema = null;

  try {
    const logo = await fetchLogo(slug);
    if (logo) {
      if (logo.imageObjectSchema && Object.keys(logo.imageObjectSchema).length) {
        imageObjectSchema = logo.imageObjectSchema;
      }
      if (logo.breadcrumbSchema && Object.keys(logo.breadcrumbSchema).length) {
        breadcrumbSchema = logo.breadcrumbSchema;
      }
      if (logo.faqSchema && Object.keys(logo.faqSchema).length) {
        faqSchema = logo.faqSchema;
      }
    }
  } catch (err) {
    console.error("[Page schema fetch]", err);
  }

  return (
    <>
      {imageObjectSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(imageObjectSchema) }}
        />
      )}
      {breadcrumbSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />
      )}
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
      <LogoDetail />
    </>
  );
}