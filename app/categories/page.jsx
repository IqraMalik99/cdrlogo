
import BrandsClient from "./client.jsx";

const baseUrl = (
  process.env.NEXT_PUBLIC_BASE_URL || "https://www.cdrlogo.com"
).replace(/\/$/, "");

const title = "Browse Logo Categories | CDRLogo";

const description =
  "Explore logo categories across different industries. Find brand logos organized by category for designers and print professionals.";

const pageUrl = `${baseUrl}/categories`;

export async function generateMetadata() {
  const image = `${baseUrl}/og-image.jpg`;

  return {
    title,
    description,

    alternates: {
      canonical: pageUrl,
    },

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
      url: pageUrl,
      siteName: "CDRLogo",
      type: "website",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: "CDRLogo Logo Categories",
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

const collectionSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Browse Logo Categories",
  description,
  url: pageUrl,
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: baseUrl,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Categories",
      item: pageUrl,
    },
  ],
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(collectionSchema),
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema),
        }}
      />

      <h1 className="cat-heading-seo">
        Browse Logo Categories
      </h1>

      <BrandsClient />
    </>
  );
}
