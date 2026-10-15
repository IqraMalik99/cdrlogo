import TemplatesClient from "./TemplatesPageClient";
import { getTemplateCategoryCounts } from "../lib/templateQueries";

const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "https://www.cdrlogo.com").replace(/\/$/, "");
const title = "Logo Templates by Category – CDRLogo";
const description =
  "Browse logo templates by category, from food and fitness to tech, health and abstract marks. Pick a category to see its templates.";
const pageUrl = `${baseUrl}/logo-templates`;

export const revalidate = 3600;

export async function generateMetadata() {
  const image = `${baseUrl}/og-image.jpg`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: pageUrl },
    robots: { index: true, follow: true },
    openGraph: { title, description, url: pageUrl, siteName: "CDRLogo", type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: "CDRLogo Logo Templates" }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function Page() {
  const categories = await getTemplateCategoryCounts();

  const collectionSchema = {
    "@context": "https://schema.org", "@type": "CollectionPage",
    name: "Logo Templates by Category", description, url: pageUrl,
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      { "@type": "ListItem", position: 2, name: "Logo Templates", item: pageUrl },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <TemplatesClient categories={categories} />
    </>
  );
}