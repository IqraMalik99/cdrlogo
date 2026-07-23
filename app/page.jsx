import React from 'react'
import dynamic from 'next/dynamic'

import Navbar from './components/Navbar'
import Home from './components/Home'

// Below-the-fold components — lazy-loaded so they don't block initial
// page render / LCP. Home stays as a normal import since it's the
// hero section visible without scrolling.
const LogosPage = dynamic(() => import('./components/LogoHome'))
const HomeCatageory = dynamic(() => import('./components/HomeTemplateCategories'))
const BrandCategories = dynamic(() => import('./components/HomeBrandsCatageory'))
const TrendingLogos = dynamic(() => import('./components/HomeTrendingLogo'))
const TopBrands = dynamic(() => import('./components/HomeTopBrand'))
const Footer = dynamic(() => import('./components/Footer'))
const Recent = dynamic(() => import('./components/Recent'))

// Client-side-only interactive tool. The ssr:false + dynamic() logic
// lives inside PantoneClientOnly.jsx, which is a Client Component —
// that's required because ssr:false isn't allowed directly inside a
// Server Component like this page.
import PantoneColorPicker from './components/Pantoneclientonly'

const SITE_URL = "https://www.cdrlogo.com"

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "CDRLogo",
  url: SITE_URL,
  description: "Logo library for educational and design reference use.",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://www.cdrlogo.com/search?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

let OrganizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "CDRLogo",
  url: SITE_URL,
  logo: "https://www.cdrlogo.com/og-image.jpg",
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: SITE_URL,
    },
  ],
};

// ── Static metadata ────────────────────────────────────────────────
// Previously this was fetched at request-time from
// /api/admin/site-setting via generateMetadata(). That self-referencing
// fetch (the page calling its own site's API while rendering) is fragile
// on serverless — it can hang or fail cold-start, which risks Lighthouse
// crawling a page whose <head> hasn't finished streaming its meta tags.
// Static export removes that dependency entirely and guarantees the
// description/title are present in the HTML immediately.
const TITLE = "Vector Logo Downloads | CDR, SVG, AI & PNG Files - CDRLogo";
const DESCRIPTION =
  "Download vector logos in CDR, SVG, AI, EPS and PNG formats for graphic designers, students and print professionals. Design reference library at cdrlogo.com";
const OG_IMAGE = `${SITE_URL}/og-image.jpg`;

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: SITE_URL },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  verification: {
    google: "8XIFTI2Ell1-5-651AsIKaLVjgPfSCjLLhHim_LxE1k",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "CDRLogo",
    type: "website",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "CDRLogo - Vector Logo Downloads" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

// If you still want the meta title/description to be editable from an
// admin panel later, do it at build/ISR time (e.g. revalidate every N
// minutes) rather than per-request inside generateMetadata — that keeps
// it fast and avoids the self-fetch-during-render problem above.

export default function page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(OrganizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <Navbar />
      <h1
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
        {`Free Vector Logo Downloads — CDR, SVG, AI & PNG Files`}
      </h1>
      <Home />
      <PantoneColorPicker />
      <LogosPage />
      <Recent/>
      <BrandCategories />
      <HomeCatageory />
      <TrendingLogos />
      <TopBrands />
      <Footer />
    </>
  )
}