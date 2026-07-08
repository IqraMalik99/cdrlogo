import CategoryClient from "./Client.jsx";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.cdrlogo.com";

async function getCategoryData(slug) {
  try {
    const res = await fetch(`${baseUrl}/api/catageory/${encodeURIComponent(slug)}?page=1`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const data = await getCategoryData(slug);
  const name = data?.categoryName || slug.replace(/-/g, " ");
  const prettyName = name.charAt(0).toUpperCase() + name.slice(1);

  const title = `${prettyName} Logo Vector Files — Free CDR SVG PNG Download | CDRLogo`;
  const description = `Download ${prettyName} brand logos in CDR, SVG, AI and PNG formats. Free vector files for designers and print professionals.`;
  const url = `${baseUrl}/category/${slug}`;
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
      images: [{ url: image, width: 1200, height: 630, alt: `${prettyName} Logo` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function CategoryPage({ params }) {
  const { slug } = await params;
  const data = await getCategoryData(slug);
  const name = data?.categoryName || slug.replace(/-/g, " ");
  const prettyName = name.charAt(0).toUpperCase() + name.slice(1);
  const url = `${baseUrl}/category/${slug}`;

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${prettyName} Logo Vector Files`,
    description: `Download ${prettyName} brand logos in CDR, SVG, AI and PNG formats.`,
    url,
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      { "@type": "ListItem", position: 2, name: prettyName, item: url },
    ],
  };

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
       <h1 className="page-title-seo">{prettyName} Logo Vector Files</h1>
      <CategoryClient slug={slug} initialCategoryName={prettyName} />
    </>
  );
}