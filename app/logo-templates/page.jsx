// app/logo-templates/page.js — NO database access, NO caching logic.
// Counts are fetched live in the browser by TemplatesPageClient.
import TemplatesClient from "./TemplatesPageClient";
import { TEMPLATE_CATEGORIES } from "../lib/templateCategories";

const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "https://www.cdrlogo.com").replace(/\/$/, "");
const title = "Logo Templates by Category – CDRLogo";
const description =
  "Browse logo templates by category, from food and fitness to tech, health and abstract marks. Pick a category to see its templates.";
const pageUrl = `${baseUrl}/logo-templates`;

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

export default function Page() {
  // count: null = "not loaded yet" (client fills it in)
  const categories = TEMPLATE_CATEGORIES.map((c) => ({ id: c.id, name: c.name, count: null }));

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