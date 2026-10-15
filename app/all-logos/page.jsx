import Link from "next/link";
import { prisma } from "../lib/prisma";
import "./logos.css";

const SITE_URL = "https://www.cdrlogo.com";
const PAGE_SIZE = 24;

// Shared image licensing metadata — kept in sync with app/logo/[slug]/page.js
const DEFAULT_IMAGE_LICENSE_META = {
  copyrightNotice: "Copyright 2026 CDRLogo",
  creditText: "CDRLogo Reference Library",
  license: `${SITE_URL}/terms-of-service`,
  acquireLicensePage: `${SITE_URL}/terms-of-service`,
};

async function getTotalCount() {
  return prisma.logo.count({ where: { publishStatus: "Published" } });
}

export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params?.page ?? "1", 10) || 1);
  const totalCount = await getTotalCount();
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const title =
    page > 1
      ? `All Logos — Page ${page} of ${totalPages} | CDRLogo`
      : `All Logos — Browse ${totalCount.toLocaleString()}+ Logos | CDRLogo`;

  const description =
    page > 1
      ? `Browse page ${page} of ${totalPages} in CDRLogo's complete logo index — ${totalCount.toLocaleString()} logos total, sorted alphabetically.`
      : `Explore the complete index of ${totalCount.toLocaleString()} logos on CDRLogo, sorted alphabetically from A to Z. Find any logo instantly.`;

  const canonicalUrl =
    page > 1 ? `${SITE_URL}/logos?page=${page}` : `${SITE_URL}/logos`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "CDRLogo",
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    other: {
      copyright: DEFAULT_IMAGE_LICENSE_META.copyrightNotice,
    },
  };
}

// Fetch a page of published logos, ordered alphabetically.
async function getLogos(page) {
  const skip = (page - 1) * PAGE_SIZE;

  const [logos, totalCount] = await Promise.all([
    prisma.logo.findMany({
      where: { publishStatus: "Published" },
      orderBy: { logoName: "asc" },
      select: { slug: true, logoName: true },
      skip,
      take: PAGE_SIZE,
    }),
    getTotalCount(),
  ]);

  return { logos, totalCount };
}

export default async function LogosPage({ searchParams }) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params?.page ?? "1", 10) || 1);
  const { logos, totalCount } = await getLogos(page);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "All Logos",
    description: "Complete index of every logo on CDRLogo.",
    numberOfItems: logos.length,
    itemListElement: logos.map((logo, i) => ({
      "@type": "ListItem",
      position: (page - 1) * PAGE_SIZE + i + 1,
      url: `${SITE_URL}/logo/${logo.slug}`,
      name: logo.logoName,
    })),
  };

  return (
    <main className="logos-index-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />

      <h1>All Logos</h1>
      <p className="count">{totalCount.toLocaleString()} logos total</p>

      <ul className="index-list">
        {logos.map((logo) => (
          <li key={logo.slug}>
            <Link href={`/logo/${logo.slug}`} prefetch={false}>
              {logo.logoName}
            </Link>
          </li>
        ))}
      </ul>

      <nav className="pagination" aria-label="Pagination">
        {page > 1 && (
          <Link href={page - 1 === 1 ? "/logos" : `/logos?page=${page - 1}`}>
            ← Previous
          </Link>
        )}
        <span className="pagination-status">
          Page {page} of {totalPages}
        </span>
        {page < totalPages && (
          <Link href={`/logos?page=${page + 1}`}>Next →</Link>
        )}
      </nav>
    </main>
  );
}