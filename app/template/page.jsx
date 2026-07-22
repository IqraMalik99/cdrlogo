import TemplatesPageClient from "./TemplatesPageClient";

const collectionSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Creative Logo Concept & Template Library",
  url: "https://www.cdrlogo.com/templates",
  description:
    "An independent educational library of original logo concepts, design templates, and creative experiments in AI, CDR, SVG, and PNG formats for design research and learning.",
  isPartOf: {
    "@type": "WebSite",
    name: "CDRLogo",
    url: "https://www.cdrlogo.com",
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.cdrlogo.com" },
    { "@type": "ListItem", position: 2, name: "Templates", item: "https://www.cdrlogo.com/templates" },
  ],
};

export async function generateMetadata() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.cdrlogo.com";
  const title = "Logo Templates & Design Concepts | AI, CDR, SVG, PNG - CDRLogo";
  const description =
    "Browse an educational library of original logo concepts and design templates. Download AI, CDR, SVG, and PNG reference files for design research, learning, and visual inspiration.";
  const image = `${baseUrl}/og-image.jpg`;

  return {
    title,
    description,
    alternates: { canonical: `${baseUrl}/templates` },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/templates`,
      siteName: "CDRLogo",
      type: "website",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: "CDRLogo Logo Template Library",
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <TemplatesPageClient />
    </>
  );
}