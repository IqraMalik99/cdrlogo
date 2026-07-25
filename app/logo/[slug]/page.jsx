// app/logo/[slug]/page.js
import LogoDetail from "./LogoDetail";

const SITE_URL = "https://www.cdrlogo.com";

// Global defaults for image licensing metadata — required on every
// logo page's ImageObject schema to satisfy Google Search Console's
// image licensing structured data checks.
const DEFAULT_IMAGE_LICENSE_META = {
  copyrightNotice: "Copyright 2026 CDRLogo",
  creditText: "CDRLogo Reference Library",
  license: `${SITE_URL}/terms-of-service`,
  acquireLicensePage: `${SITE_URL}/terms-of-service`,
};

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

// Merge global licensing defaults into any ImageObject schema, letting
// per-logo values from the API take precedence when present.
function withImageLicenseMeta(schema) {
  if (!schema) return schema;
  return { ...DEFAULT_IMAGE_LICENSE_META, ...schema };
}

export async function generateMetadata({ params }) {
  const { slug } = await params;

  try {
    const logo = await fetchLogo(slug);

    if (!logo) {
      return {
        title: "Logo – Download",
        description: "Download vector logos in SVG, PNG, AI, CDR formats.",
        robots: { index: false, follow: false },
      };
    }


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
    const ogType = "article";
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
          ? { images: [{ url: ogImage, width: 1200, height: 630, alt: `${logo.logoName} — PNG SVG vector file on cdrlogo.com` }] }
          : {}),
      },

      twitter: {
        card: twitterCard,
        title: twitterTitle,
        description: twitterDescription,
        ...(twitterImage ? { images: [twitterImage] } : {}),
      },

      other: {
        "copyright": DEFAULT_IMAGE_LICENSE_META.copyrightNotice,
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
  let logo = null;
  let imageObjectSchema = null;
  let breadcrumbSchema = null;
  let faqSchema = null;

  try {
    logo = await fetchLogo(slug);
    if (logo) {
      // Always build an ImageObject schema — merging in the global
      // licensing defaults — even if the API didn't return one, since
      // every published logo page needs this metadata.
      const baseImageSchema =
        logo.imageObjectSchema && Object.keys(logo.imageObjectSchema).length
          ? logo.imageObjectSchema
          : logo.webpUrl
          ? {
              "@context": "https://schema.org",
              "@type": "ImageObject",
              contentUrl: logo.webpUrl,
              name: `${logo.logoName} Logo`,
            }
          : null;

      imageObjectSchema = withImageLicenseMeta(baseImageSchema);

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
      {
        logo && <h1
          style={{
            position: "absolute",
            width: "1px",
            height: "1px",
            padding: 0,
            margin: "-1px",
            overflow: "hidden",
            clip: "rect(0, 0, 0, 0)",
            clipPath: "inset(50%)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        >
          {`${logo.logoName} – PNG SVG Vector | cdrlogo.com`}
        </h1>
      }
      <LogoDetail />

    </>
  );
}