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

// Visually-hidden (but present in the raw HTML) style — same "clip" technique
// already used for the H1 below. Screen readers and crawlers still read this
// content; it's just not shown twice on screen since the client component
// renders the visible version once it hydrates.
const SR_ONLY_STYLE = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  clipPath: "inset(50%)",
  border: 0,
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

    if (!res.ok) return { logo: null, related: [] };

    const json = await res.json();
    const logo = json.data || json;
    const related = Array.isArray(json.related) ? json.related : [];

    console.log("[fetchLogo]", slug, "logo:", !!logo, "related:", related.length);

    // If API returned an error object, return null
    if (!logo || logo.error || !logo.slug) return { logo: null, related: [] };

    return { logo, related };
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
        title: "Logo – Download",
        description: "Download vector logos in SVG, PNG, AI, CDR formats.",
        robots: { index: false, follow: false },
      };
    }

    const canonicalUrl =
      logo.canonicalUrl ||
      `${process.env.NEXT_PUBLIC_BASE_URL}/logo/${logo.slug}`;

    const metaTitle = logo.metaTitle ||
      `${logo.logoName} Logo – Download (SVG, PNG, AI, CDR)`;

    const metaDescription = logo.metaDescription ||
      (logo.description || "").slice(0, 160);

    const ogTitle = logo.ogTitle || metaTitle;
    const ogDescription = logo.ogDescription || metaDescription;
    // Logo/image reference page, not a news/blog article — "website" is the
    // correct og:type. (If a product-style schema is added later, this can
    // become conditional, e.g. ogType = someCondition ? "product" : "website".)
    const ogType = "website";
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
      title: "Logo – Download",
      description: "Download vector logos in SVG, PNG, AI, CDR formats.",
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
        // Merge fixed global licensing metadata into every logo page's ImageObject schema.
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

  // ── altText override ──────────────────────────────────────────────────
  // The upload/generation pipeline built altText from `brand` (and for some
  // logos, a fallback value like "Other Football") instead of the actual
  // `logoName`, producing wrong alt text such as
  //   "Other Football logo — PNG SVG vector file on cdrlogo.com"
  // instead of
  //   "Atletico Madrid Logo — PNG SVG vector file on cdrlogo.com"
  // Recomputing it here from logoName guarantees every current + future
  // logo page shows correct alt text regardless of what's stored in the DB.
  // NOTE: this only fixes what's *displayed* on this page template. The
  // raw `altText` field saved in the database is still wrong and should
  // also be corrected at the source (the upload generation script's
  // altText prompt/rule), otherwise anything reading `logo.altText`
  // directly from the API/DB elsewhere will still see the old value.
  const correctedLogo = logo
    ? {
        ...logo,
        altText: `${logo.logoName} — PNG SVG vector file on cdrlogo.com`,
      }
    : logo;

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

      {/* SEO-critical content, rendered directly on the server so it's
          present in the initial HTML response regardless of client-side
          hydration/fetch timing. This mirrors (and never contradicts) what
          the client component below shows once it mounts. Brand / Country /
          Category / Website are intentionally omitted for logos in the
          "template" category. */}
      {logo && (
        <div style={SR_ONLY_STYLE} aria-hidden="false">
          {logo.description && <p>{logo.description}</p>}
          {!categoryIsTemplate && logo.brand && <p>Brand: {logo.brand}</p>}
          {!categoryIsTemplate && logo.country && <p>Country: {logo.country}</p>}
          {!categoryIsTemplate && logoCategories.length > 0 && (
            <p>Category: {logoCategories.join(", ")}</p>
          )}
          {!categoryIsTemplate && logo.website && <p>Website: {logo.website}</p>}
          <p>License: {logo.license || "Free For Personal Use"}</p>
          {Array.isArray(logo.tags) && logo.tags.length > 0 && (
            <p>Tags: {logo.tags.join(", ")}</p>
          )}
        </div>
      )}

    <LogoDetail logo={correctedLogo} initialRelated={related} />
    </>
  );
}