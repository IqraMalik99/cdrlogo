import React from "react";
import Brandsclient from "./Brandsclient";

const PAGE_URL = "https://www.cdrlogo.com/brands";

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://www.cdrlogo.com",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Brands",
      item: PAGE_URL,
    },
  ],
};

const collectionSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Brand Logo Reference Library",
  url: PAGE_URL,
  description:
    "Independent educational library of brand logo references in AI, CDR, SVG, and PNG formats for research and design study.",
  isPartOf: {
    "@type": "WebSite",
    name: "CDRLogo",
    url: "https://www.cdrlogo.com",
  },
};

export async function generateMetadata() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.cdrlogo.com";

  const title = "Brand Logo Reference Library | PNG SVG AI CDR - cdrlogo.com";
  const description =
    "Browse brand logo references in PNG, SVG, AI, and CDR vector formats, organized by category for educational use and research reference on cdrlogo.com.";
  const image = `${baseUrl}/og-image.jpg`;

  return {
    title,
    description,
    alternates: { canonical: PAGE_URL },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
      },
    },
    openGraph: {
      title,
      description,
      url: PAGE_URL,
      siteName: "CDRLogo",
      type: "website",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: "CDRLogo Brand Logo Reference Library",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <Brandsclient />
    </>
  );
}