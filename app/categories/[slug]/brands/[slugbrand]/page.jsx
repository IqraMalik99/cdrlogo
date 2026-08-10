import SubCatClient from "./Client.jsx";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.cdrlogo.com";

async function getBrandData(slugbrand, page = 1) {
  try {
    console.log(`Fetching brand data for slugbrand: ${slugbrand}, page: ${page}`);
    const res = await fetch(
      `${baseUrl}/api/catageory/get-brands/${encodeURIComponent(slugbrand)}?page=${page}`,
      { cache: "no-store" }
    );
    console.log("Fetched brand data");
    let data = await res.json();
    console.log("Fetched brand data:", data); 
    return data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { slugbrand } = await params;
  const data = await getBrandData(slugbrand);
  const name = data?.categoryName || slugbrand.replace(/-/g, " ");
  const prettyName = name.charAt(0).toUpperCase() + name.slice(1);

  const title = `${prettyName} Logos — Download Free | CDRLogo`;
  const description = `Download ${prettyName} brand logos in CDR, SVG, AI and PNG formats.`;
  const url = `${baseUrl}/category/sub-cat/${slugbrand}`;
  const image = `${baseUrl}/og-image.jpg`;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
    openGraph: {
      title,
      description,
      url,
      siteName: "CDRLogo",
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: `${prettyName} Logos` }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function SubCatPage({ params, searchParams }) {
  const { slugbrand } = await params;
  const sp = await searchParams;
  const page = parseInt(sp?.page || "1", 10);
  const data = await getBrandData(slugbrand, page);
  const name = data?.categoryName || slugbrand.replace(/-/g, " ");
  const prettyName = name.charAt(0).toUpperCase() + name.slice(1);
  const url = `${baseUrl}/category/sub-cat/${slugbrand}`;

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${prettyName} Logos`,
    description: `Download ${prettyName} brand logos.`,
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <h1 className="page-title-seo">{prettyName} Logos</h1>
      <SubCatClient slugbrand={slugbrand} initialCategoryName={data?.categoryName || prettyName} initialData={data} initialPage={page} />
    </>
  );
}