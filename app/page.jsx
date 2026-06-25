import React from 'react'

import Navbar from './components/Navbar'
import Home from './components/Home'
import LogosPage from './components/LogoHome'
import HomeCatageory from './components/HomeTemplateCategories'
import BrandCategories from './components/HomeBrandsCatageory'
import TrendingLogos from './components/HomeTrendingLogo'
import TopBrands from './components/HomeTopBrand'
import Footer from './components/Footer'
import PantoneColorPicker from './components/Pantone'

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "CDRLogo",
  url: "https://cdrlogo.com",
  description: "Logo library for educational and design reference use.",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://cdrlogo.com/search?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://cdrlogo.com",
    },
  ],
};

export async function generateMetadata() {
  const baseUrl = "https://cdrlogo.com";

  try {
    const res = await fetch(`${baseUrl}/api/admin/site-setting`, {
      cache: "no-store",
    });

    const data = await res.json();

    const title =
      data?.metaTitle ||
      "Vector Logo Downloads | CDR, SVG, AI & PNG Files - CDRLogo";

    const description =
      data?.metaDescription ||
      "Vector logo downloads in CDR, SVG, AI, EPS and PNG formats for graphic designers, students and print professionals. Design reference library at cdrlogo.com.";

    const image = `${baseUrl}/og-image.jpg`;

    return {
      title,
      description,
      alternates: { canonical: baseUrl },
      openGraph: {
        title,
        description,
        url: baseUrl,
        siteName: "CDRLOGO",
        type: "website",
        images: [{ url: image, width: 1200, height: 630, alt: "CDRLOGO - Vector Logo Downloads" }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [image],
      },
    };
  } catch (error) {
    return {
      title: "Vector Logo Downloads | CDR, SVG, AI & PNG Files - CDRLogo",
      description: "Vector logo downloads in CDR, SVG, AI, EPS and PNG formats for graphic designers, students and print professionals. Design reference library at cdrlogo.com.",
      alternates: { canonical: "https://cdrlogo.com" },
      openGraph: {
        title: "Vector Logo Downloads | CDR, SVG, AI & PNG Files - CDRLogo",
        description: "Vector logo downloads in CDR, SVG, AI, EPS and PNG formats for graphic designers, students and print professionals. Design reference library at cdrlogo.com.",
        url: "https://cdrlogo.com",
        siteName: "CDRLOGO",
        type: "website",
        images: [{ url: "https://cdrlogo.com/og-image.jpg", width: 1200, height: 630 }],
      },
      twitter: {
        card: "summary_large_image",
        title: "Vector Logo Downloads | CDR, SVG, AI & PNG Files - CDRLogo",
        description: "Vector logo downloads in CDR, SVG, AI, EPS and PNG formats for graphic designers, students and print professionals. Design reference library at cdrlogo.com.",
        images: ["https://cdrlogo.com/og-image.jpg"],
      },
    };
  }
}

export default function page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <Navbar />
      <Home />
      <PantoneColorPicker />
      <LogosPage />
      <BrandCategories />
      <HomeCatageory />
      <TrendingLogos />
      <TopBrands />
      <Footer />
    </>
  )
}