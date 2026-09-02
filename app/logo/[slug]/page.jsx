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

// Flip to false to make the SEO h1 visible on the page instead of hidden.
const HIDE_H1 = true;

// Standard "visually-hidden" pattern: invisible on screen, but still
// present for screen readers and search engine crawlers. More robust
// than color:transparent + font-size:0, which some browsers/assistive
// tech can treat inconsistently.
const VISUALLY_HIDDEN_STYLE = {
  color: "transparent",
  userSelect: "none",
};

// Single source of truth for the page title — used by BOTH
// generateMetadata() (<title>, og:title, twitter:title fallback) and the
// on-page <h1>. Previously these were built separately in two places with
// the same-looking template string, which meant editing one didn't
// guarantee the other stayed in sync. Now there's exactly one place that
// decides what "the title" is.
function buildPageTitle(logo) {
  if (!logo) return "Logo – Download";
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
        title: buildPageTitle(null),
        description: "Download vector logos in SVG, PNG, AI, CDR formats.",
        robots: { index: false, follow: false },
        other: { title: buildPageTitle(null) },
      };
    }

    const canonicalUrl =
      logo.canonicalUrl ||
      `${process.env.NEXT_PUBLIC_BASE_URL}/logo/${logo.slug}`;

    const metaTitle = buildPageTitle(logo);

    const metaDescription = logo.metaDescription ||
      (logo.description || "").slice(0, 160);

    const ogTitle = logo.ogTitle || metaTitle;
    const ogDescription = logo.ogDescription || metaDescription;
    // FIX #1 — og:type
    // Logo/image reference page, not a news/blog article — "website" is the
    // correct og:type. This is a static value, so every current + future
    // logo page inherits the fix from this one line. (If a product-style
    // schema is added later, this can become conditional, e.g.
    // ogType = someCondition ? "product" : "website".)
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

      // Explicit <meta name="title"> mirroring the h1 / <title>. Some SEO
      // tools and crawlers read this tag separately from <title>, so it's
      // kept in sync via the same buildPageTitle() call rather than a
      // second hardcoded string.
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
      description: "Download vector logos in SVG, PNG, AI, CDR formats.",
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
        // FIX #4 — copyrightNotice
        // GLOBAL_IMAGE_LICENSE_META.copyrightNotice is statically set to
        // "All trademarks belong to their respective owners" above, and is
        // spread LAST here so it always overrides any stale/wrong value
        // ("Copyright 2026 CDRLogo") that might be stored in
        // logo.imageObjectSchema in the database. One static value, applied
        // to every page's ImageObject schema.
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

  // FIX #2 — altText override (systemic bug fix)
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

  // FIX #5 — strip Brand/Website/Country/Industry keys entirely for template
  // logos, not just hide them in the UI. Without this, the full logo object
  // (including empty "brand":"", "website":"", "country":"" etc.) still gets
  // serialized into the page's embedded JSON payload used for client
  // hydration (the self.__next_f.push(...) script blobs in page source),
  // even though LogoDetail never visually renders them. Deleting the keys
  // here — before the object is handed to the client component — means
  // they never reach the HTML source at all for template logos.
  if (correctedLogo && categoryIsTemplate) {
    delete correctedLogo.brand;
    delete correctedLogo.website;
    delete correctedLogo.country;
    delete correctedLogo.industry;
  }

  // Same buildPageTitle() used in generateMetadata — the h1 and the
  // <title>/og:title are now guaranteed to say the same thing.
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

      {/*
        Server-rendered SEO h1 — always present in the raw HTML (good for
        crawlers, no client fetch delay) whenever the fetch actually
        succeeded (correctedLogo is non-null). Its text comes from the
        exact same buildPageTitle() call that generateMetadata() uses, so
        it can't drift from <title>/og:title.
        Controlled by HIDE_H1 above:
        true  -> invisible to users but still readable by screen readers
                 and search engines (standard "visually-hidden" pattern).
        false -> renders normally, visible on the page.
      */}
      {correctedLogo && (
        <h1 style={HIDE_H1 ? VISUALLY_HIDDEN_STYLE : undefined}>
          {pageTitle}
        </h1>
      )}

      <LogoDetail logo={correctedLogo} initialRelated={related} />
    </>
  );
}