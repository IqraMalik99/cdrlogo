
import CategoryGroupClient from "./Client.jsx";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.cdrlogo.com";

async function getGroupData(slug) {
  try {
    console.log("enter")
    const res = await fetch(`/api/catageory/group/${encodeURIComponent(slug)}`, {
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
  const data = await getGroupData(slug);
  const name = data?.categoryName || slug.replace(/-/g, " ");
  const prettyName = name.charAt(0).toUpperCase() + name.slice(1);

  const title = `${prettyName} Logos — Browse All Sub-Categories | CDRLogo`;
  const description = `Browse all ${prettyName} sub-categories and download brand logos in CDR, SVG, AI and PNG formats.`;
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
      images: [{ url: image, width: 1200, height: 630, alt: `${prettyName} Logos` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function CategoryGroupPage({ params }) {
  const { slug } = await params;
  const data = await getGroupData(slug);
  const name = data?.categoryName || slug.replace(/-/g, " ");
  const prettyName = name.charAt(0).toUpperCase() + name.slice(1);
  const url = `${baseUrl}/category/${slug}`;

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${prettyName} Logos`,
    description: `Browse all ${prettyName} sub-categories and logos.`,
    url,
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      { "@type": "ListItem", position: 2, name: "Categories", item: `${baseUrl}/categories` },
      { "@type": "ListItem", position: 3, name: prettyName, item: url },
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
      <h1 className="page-title-seo">{prettyName} Logos — Sub-Categories</h1>
      <CategoryGroupClient
        slug={slug}
        initialCategoryName={data?.categoryName || prettyName}
        initialData={data}
      />
    </>
  );
}