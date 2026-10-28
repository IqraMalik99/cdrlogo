// app/logo/[slug]/page.js
import LogoDetail from "./LogoDetail";

// Global fallback values for ImageObject licensing metadata.
// These are fixed site-wide and applied to every logo page's schema.
const GLOBAL_IMAGE_LICENSE_META = {
  copyrightNotice: "All trademarks belong to their respective owners",
  creditText: "CDRLogo Reference Library",
  license: "https://www.cdrlogo.com/terms-of-service",
  acquireLicensePage: "https://www.cdrlogo.com/terms-of-service",
};

// ---------------------------------------------------------------------------
// Text sanitizing (display-side safety net)
// ---------------------------------------------------------------------------

// Sentences that are internal/generator notes and must never be shown to users.
const INTERNAL_NOTE_PATTERNS = [
  /research notes/i,
  /no specific information/i,
  /not available from/i,
  /no information (is )?available/i,
  /as an ai/i,
];

// "Vector" is not a file format (SVG, AI, CDR are). Replace it with CDR,
// or drop it if CDR is already listed.
function fixVectorFormat(text) {
  const hasCdr = /\bCDR\b/.test(text);
  return text.replace(
    /,?\s*(?:and\s+)?Vector(?=\s+formats?\b)/gi,
    hasCdr ? "" : ", and CDR"
  );
}

function cleanText(text) {
  if (!text || typeof text !== "string") return text;
  const sentences = text.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter(
    (s) => !INTERNAL_NOTE_PATTERNS.some((re) => re.test(s))
  );
  return fixVectorFormat(kept.join(" ")).trim();
}

function sanitizeLogo(logo) {
  if (!logo) return logo;
  const out = { ...logo };
  for (const key of [
    "description",
    "metaDescription",
    "ogDescription",
    "twitterDescription",
  ]) {
    if (out[key]) out[key] = cleanText(out[key]);
  }
  if (out.imageObjectSchema?.description) {
    out.imageObjectSchema = {
      ...out.imageObjectSchema,
      description: cleanText(out.imageObjectSchema.description),
    };
  }
  return out;
}

// Single source of truth for the page title — used by BOTH
// generateMetadata() (<title>, og:title, twitter:title fallback) and the
// on-page <h1>.
function buildPageTitle(logo) {
  if (!logo) return "";
  return logo.metaTitle || `${logo.logoName} Logo – Download (SVG, PNG, AI, CDR)`;
}

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

    if (!res.ok) return { logo: null, related: [] };

    const json = await res.json();
    const logo = json.data || json;
    const related = Array.isArray(json.related) ? json.related : [];

    console.log("[fetchLogo]", slug, "logo:", !!logo, "related:", related.length);

    // If API returned an error object, return null
    if (!logo || logo.error || !logo.slug) return { logo: null, related: [] };

    // Sanitized once here, so metadata, schema and on-page text all read clean data.
    return { logo: sanitizeLogo(logo), related };
  } catch {
    return { logo: null, related: [] };
  }
}

// Category list + the "template" exclusion rule are shared between the
// server-rendered SEO block below and the client-rendered detail page —
// logos filed under the "template" category never surface Brand / Country /
// Category / Website details anywhere on the page.
function getCategoryInfo(logo) {
  const categories = Array.isArray(logo?.category)
    ? logo.category.filter(Boolean)
    : logo?.category
    ? [logo.category]
    : [];
  const isTemplate = categories.some(
    (c) => String(c).trim().toLowerCase() === "template"
  );
  return { categories, isTemplate };
}

export async function generateMetadata({ params }) {
  const { slug } = await params;

  try {
    const { logo } = await fetchLogo(slug);

    if (!logo) {
      return {
        title: buildPageTitle(null),
        description: "Download logos in SVG, PNG, AI, CDR formats.",
        robots: { index: false, follow: false },
        other: { title: buildPageTitle(null) },
      };
    }

    const canonicalUrl =
      logo.canonicalUrl ||
      `${process.env.NEXT_PUBLIC_BASE_URL}/logo/${logo.slug}`;

    const metaTitle = buildPageTitle(logo);

    // Fallback chain: metaDescription -> description (160 chars) -> generic line.
    // The generic line guards against the case where cleanText() removed
    // every sentence and left an empty string.
    const metaDescription =
      logo.metaDescription ||
      (logo.description || "").slice(0, 160) ||
      `Download ${logo.logoName} logo in SVG, PNG, AI, CDR formats.`;

    const ogTitle = logo.ogTitle || metaTitle;
    const ogDescription = logo.ogDescription || metaDescription;

    // og:type is "article" for logo reference pages (intentional).
    // Static value, so every current + future logo page inherits it.
    const ogType = "article";
    const ogImage = logo.ogImageUrl || logo.webpUrl || null;

    const twitterCard = logo.twitterCardType || "summary_large_image";
    const twitterTitle = logo.twitterTitle || ogTitle;
    const twitterDescription = logo.twitterDescription || ogDescription;
    const twitterImage = logo.twitterImage || ogImage;

    const isPublished = logo.publishStatus === "Published";
    const robots = isPublished
      ? { index: true, follow: true, googleBot: { index: true, follow: true } }
      : { index: false, follow: false, googleBot: { index: false, follow: false } };

    return {
      title: metaTitle,
      description: metaDescription,

      // Explicit <meta name="title"> mirroring the h1 / <title>.
      other: { title: metaTitle },

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
    };

  } catch (err) {
    console.error("[generateMetadata]", err);
    return {
      title: buildPageTitle(null),
      description: "Download logos in SVG, PNG, AI, CDR formats.",
      robots: { index: false, follow: false },
      other: { title: buildPageTitle(null) },
    };
  }
}

export default async function Page({ params }) {
  const { slug } = await params;
  let logo = null;
  let related = [];
  let imageObjectSchema = null;
  let breadcrumbSchema = null;
  let faqSchema = null;

  try {
    const result = await fetchLogo(slug);
    logo = result.logo;
    related = result.related;
    if (logo) {
      if (logo.imageObjectSchema && Object.keys(logo.imageObjectSchema).length) {
        // copyrightNotice etc. are spread LAST so they always override any
        // stale/wrong value stored in logo.imageObjectSchema in the database.
        imageObjectSchema = {
          ...logo.imageObjectSchema,
          ...GLOBAL_IMAGE_LICENSE_META,
        };
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

  const { categories: logoCategories, isTemplate: categoryIsTemplate } =
    getCategoryInfo(logo);

  // altText override (systemic bug fix): recompute from logoName so alt text
  // is correct regardless of what's stored in the DB. The DB value itself
  // should also be fixed at the source (generation script).
  const correctedLogo = logo
    ? {
        ...logo,
        altText: `${logo.logoName} — PNG SVG vector file on cdrlogo.com`,
      }
    : logo;

  // Strip Brand/Website/Country/Industry keys entirely for template logos so
  // they never reach the serialized hydration payload in the page source.
  if (correctedLogo && categoryIsTemplate) {
    delete correctedLogo.brand;
    delete correctedLogo.website;
    delete correctedLogo.country;
    delete correctedLogo.industry;
  }

  // Same buildPageTitle() used in generateMetadata, so the h1 and
  // <title>/og:title always say the same thing.
  const pageTitle = buildPageTitle(correctedLogo);

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

      {/* Rendered directly by the server component so it's present in the
          initial HTML (view-source, crawlers) regardless of what LogoDetail
          does client-side. */}
      <h1 className="text-2xl md:text-3xl font-bold">
        {pageTitle}
      </h1>

      <LogoDetail
        logo={correctedLogo}
        initialRelated={related}
        pageTitle={pageTitle}
        showH1={true}
      />
    </>
  );
}