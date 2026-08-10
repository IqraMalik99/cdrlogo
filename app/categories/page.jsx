import BrandsClient from "./client.jsx";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.cdrlogo.com";

export async function generateMetadata() {
  const title = "Browse Logo Brands A-Z | Free Vector Logo Downloads - CDRLogo";
  const description =
    "Browse every logo brand from A to Z. Find CDR, SVG, AI and PNG vector logo files organized alphabetically by brand for designers and print professionals.";
  const url = `${baseUrl}/brands`;
  const image = `${baseUrl}/og-image.jpg`;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: "CDRLogo",
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: "CDRLogo Brands" }],
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
  name: "Browse Logo Brands A-Z",
  description:
    "Browse every logo brand from A to Z. Find CDR, SVG, AI and PNG vector logo files organized alphabetically by brand.",
  url: `${baseUrl}/brands`,
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
    { "@type": "ListItem", position: 2, name: "Brands", item: `${baseUrl}/brands` },
  ],
};

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
      <h1 className="cat-heading-seo">
        Browse Logo Brands A-Z
      </h1>
      <BrandsClient />
    </>
  );
}