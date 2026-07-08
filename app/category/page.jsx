import CategoriesClient from "./client.jsx";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.cdrlogo.com";

export async function generateMetadata() {
  const title = "Browse Logo Categories A-Z | Free Vector Logo Downloads - CDRLogo";
  const description = "Browse logo categories from A to Z. Find CDR, SVG, AI and PNG vector logo files organized by brand, industry and category for designers and print professionals.";
  const url = `${baseUrl}/category`;
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
      images: [{ url: image, width: 1200, height: 630, alt: "CDRLogo Categories" }],
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
  name: "Browse Logo Categories A-Z",
  description: "Browse logo categories from A to Z. Find CDR, SVG, AI and PNG vector logo files organized by brand and industry.",
  url: `${baseUrl}/category`,
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
    { "@type": "ListItem", position: 2, name: "Categories", item: `${baseUrl}/category` },
  ],
};

export default function CategoryPage() {
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
        Browse Design Categories &amp; Visual Archives
      </h1>
      <CategoriesClient />
    </>
  );
}