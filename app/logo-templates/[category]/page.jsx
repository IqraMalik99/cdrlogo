// app/logo-templates/[category]/page.js
import { notFound } from "next/navigation";
import CategoryClient from "./client.jsx";
import { TEMPLATE_CATEGORIES, getTemplateCategory } from "../../lib/templateCategories";
import { getTemplateLogos } from "../../lib/templateQueries";

const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "https://www.cdrlogo.com").replace(/\/$/, "");
const LIMIT = 48;

export const revalidate = 3600;
export const dynamicParams = true;

// Return an empty list so no pages (and no Prisma queries) run at build time.
// Each category page is generated on first visit, then cached and revalidated hourly.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  const { category } = await params;
  const cat = getTemplateCategory(category);
  if (!cat) return {};

  const title = `${cat.name} Logo Templates – CDRLogo`;
  const description = cat.intro;
  const url = `${baseUrl}/logo-templates/${cat.id}`;
  const image = `${baseUrl}/og-image.jpg`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: { title, description, url, siteName: "CDRLogo", type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function Page({ params }) {
  const { category } = await params;
  const cat = getTemplateCategory(category);
  if (!cat) notFound();

  const initial = await getTemplateLogos({ categoryId: cat.id, page: 1, limit: LIMIT });
  const url = `${baseUrl}/logo-templates/${cat.id}`;

  const collectionSchema = {
    "@context": "https://schema.org", "@type": "CollectionPage",
    name: `${cat.name} Logo Templates`, description: cat.intro, url,
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      { "@type": "ListItem", position: 2, name: "Logo Templates", item: `${baseUrl}/logo-templates` },
      { "@type": "ListItem", position: 3, name: cat.name, item: url },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <CategoryClient
        category={{ id: cat.id, name: cat.name, intro: cat.intro }}
        otherCategories={TEMPLATE_CATEGORIES.filter((c) => c.id !== cat.id).map((c) => ({ id: c.id, name: c.name }))}
        initialLogos={initial.logos}
        initialTotal={initial.total}
        initialTotalPages={initial.totalPages}
        limit={LIMIT}
      />
    </>
  );
}