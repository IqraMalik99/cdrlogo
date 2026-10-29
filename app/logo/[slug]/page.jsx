// app/logo/[slug]/page.js
import { cache } from "react";
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
  /research notes?/i,
  /research (data|findings|results)/i,
  /no specific (information|details|data)/i,
  /no (further |additional )?(information|details|data) (is |are |was |were )?(available|found|provided)/i,
  /(not|isn'?t|aren'?t|unavailable) (publicly )?available (from|in) (the )?(research|provided|given|source)/i,
  /\bis not available from\b/i,
  /\bnot available from\b/i,
  /as an ai\b/i,
  /i (could not|couldn'?t|was unable to) (find|verify|locate)/i,
];

function isInternalNote(sentence) {
  return INTERNAL_NOTE_PATTERNS.some((re) => re.test(sentence));
}

const FMT = "(?:PNG|SVG|AI|CDR|EPS|PDF|WEBP|JPG|JPEG)";

// "Vector" is not a file format (SVG, AI, CDR are). Replace it with CDR,
// or drop it if CDR is already listed.
// Only the capitalised list-item form ("PNG, SVG, AI, and Vector formats",
// "SVG, Vector, and AI") is touched, so legitimate prose such as
// "available in vector formats" stays intact.
function fixVectorFormat(text) {
  if (!/Vector/.test(text)) return text;
  const hasCdr = /\bCDR\b/i.test(text);

  // "<FMT>, and Vector" / "<FMT>, Vector" / "<FMT> and Vector"
  let out = text.replace(
    new RegExp(`(\\b${FMT}\\b)(\\s*,)?(\\s+(?:and|or|&)\\s+|\\s*[,/]\\s*|\\s+)Vector\\b`, "gi"),
    (m, fmt, comma, joiner) => {
      // "Vector" must be capitalised to be treated as a fake format
      if (!/Vector/.test(m)) return m;
      return hasCdr ? fmt : `${fmt}${comma || ""}${joiner}CDR`;
    }
  );

  // Leading position: "Vector, PNG, SVG ..."
  out = out.replace(new RegExp(`\\bVector\\s*,\\s*(?=${FMT}\\b)`, "g"), hasCdr ? "" : "CDR, ");

  return out;
}

function cleanText(text) {
  if (!text || typeof text !== "string") return text;
  // Walk sentence by sentence but keep original whitespace / line breaks.
  const kept = text.replace(/[^.!?]+[.!?]+\s*|[^.!?]+$/g, (s) =>
    isInternalNote(s) ? "" : s
  );
  return fixVectorFormat(kept).trim();
}

// Recursively clean every string in the logo payload (description, meta,
// OG, Twitter, FAQ answers, schema descriptions, any field LogoDetail reads).
// URLs are left alone.
function deepClean(value) {
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) return value;
    return cleanText(value);
  }
  if (Array.isArray(value)) return value.map(deepClean);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepClean(v);
    return out;
  }
  return value;
}

// Drop FAQ entries whose answer was emptied by the cleaner, so the FAQ
// schema never contains a Question with a blank answer.
function pruneFaqSchema(schema) {
  if (!schema || !Array.isArray(schema.mainEntity)) return schema;
  const mainEntity = schema.mainEntity.filter(
    (q) => q?.name && q?.acceptedAnswer?.text
  );
  return mainEntity.length ? { ...schema, mainEntity } : null;
}

function sanitizeLogo(logo) {
  if (!logo) return logo;
  const out = deepClean(logo);
  if (out.faqSchema) out.faqSchema = pruneFaqSchema(out.faqSchema);
  return out;
}

// <title> / og:title. Built from the clean logo name instead of the stored
// metaTitle (which contained filler like "Vector AI PNG Edition").
function buildPageTitle(logo) {
  if (!logo) return "Logo Download | CDRLogo";
  return `${logo.logoName} – PNG, SVG, AI, CDR | CDRLogo`;
}

// Cut text at a word boundary instead of mid-word.
function truncateAtWord(text, max) {
  if (!text || text.length <= max) return text || "";
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim();
}

// cache() de-duplicates the call between generateMetadata() and Page()
// within one request, so the API is hit once instead of twice.
const fetchLogo = cache(async (slug) => {
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

    // If API returned an error object, return null
    if (!logo || logo.error || !logo.slug) return { logo: null, related: [] };

    // Sanitized once here, so metadata, schema and on-page text all read clean data.
    return { logo: sanitizeLogo(logo), related: deepClean(related) };
  } catch {
    return { logo: null, related: [] };
  }
});

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
      };
    }

    const canonicalUrl =
      logo.canonicalUrl ||
      `${process.env.NEXT_PUBLIC_BASE_URL}/logo/${logo.slug}`;

    const metaTitle = buildPageTitle(logo);

    // Fallback chain: metaDescription -> description (160 chars, cut at a
    // word boundary) -> generic line. The generic line guards against the
    // case where cleanText() removed every sentence and left an empty string.
    // cleanText() is applied once more on the final strings as a last guard.
    const metaDescription =
      cleanText(
        logo.metaDescription ||
          truncateAtWord(logo.description || "", 160)
      ) || `Download ${logo.logoName} in SVG, PNG, AI, CDR formats.`;

    const ogTitle = metaTitle;
    const ogDescription = cleanText(logo.ogDescription) || metaDescription;

    // og:type is "article" for logo reference pages (intentional).
    // Static value, so every current + future logo page inherits it.
    const ogType = "article";

    // Use the clean square PNG (falls back to webp) so the shared/indexed
    // image is the logo itself, not a cropped social card.
    const ogImage = logo.pngUrl || logo.webpUrl || null;

    const twitterCard = logo.twitterCardType || "summary_large_image";
    const twitterTitle = metaTitle;
    const twitterDescription =
      cleanText(logo.twitterDescription) || ogDescription;
    const twitterImage = ogImage;

    const isPublished = logo.publishStatus === "Published";
    const robots = isPublished
      ? { index: true, follow: true, googleBot: { index: true, follow: true } }
      : { index: false, follow: false, googleBot: { index: false, follow: false } };

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
          ? { images: [{ url: ogImage, width: 1200, height: 1200, alt: logo.logoName }] }
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
        // Licensing meta and the image fields are spread LAST so they always
        // override any stale/wrong value stored in logo.imageObjectSchema.
        imageObjectSchema = {
          ...logo.imageObjectSchema,
          ...GLOBAL_IMAGE_LICENSE_META,
          contentUrl: logo.pngUrl || logo.webpUrl,
          thumbnailUrl: logo.webpUrl || logo.pngUrl,
          name: logo.logoName,
          caption: logo.logoName,
          width: 1200,
          height: 1200,
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

  const { isTemplate: categoryIsTemplate } = getCategoryInfo(logo);

  // altText override (systemic bug fix): recompute from logoName so alt text
  // is correct regardless of what's stored in the DB. logoName already ends
  // in "Logo", so it is used as-is.
  const correctedLogo = logo
    ? {
        ...logo,
        altText: logo.logoName,
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

  // The h1 uses the clean logo name; <title> uses buildPageTitle().
  const h1Text = correctedLogo?.logoName || "";
  const pageTitle = h1Text;

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
        {h1Text}
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