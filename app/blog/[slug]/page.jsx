import { notFound } from "next/navigation";
import BlogPostClient from "./BlogPostClient";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.cdrlogo.com";

// Strips markdown-ish syntax so excerpts/descriptions read as plain text.
function cleanText(text) {
  if (!text) return "";
  return text
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[#>*`_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Fetched once per request; Next.js dedupes identical fetch calls made
// during the same render, so calling this from both generateMetadata and
// the page component does not trigger two network requests.
async function getBlogBySlug(slug) {
  try {
    const res = await fetch(`${BASE_URL}/api/blogs/slug`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data = await res.json();
    const post = data && data.blog ? data.blog : data;
    if (!post || !post.content) return null;

    return post;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await getBlogBySlug(slug);

  if (!post) {
    return {
      title: "Post Not Found - CDRLogo Blog",
      robots: { index: false, follow: true },
    };
  }

  const title = post.metaTitle
    ? cleanText(post.metaTitle)
    : `${post.title} - CDRLogo Blog`;
  const description = cleanText(post.metaDescription || post.excerpt) ||
    "Read this article on logo design, branding, and vector graphics from the CDRLogo design blog.";
  const image = post.image || `${BASE_URL}/og-image.jpg`;
  const url = `${BASE_URL}/blog/${slug}`;

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
      type: "article",
      publishedTime: post.createdAt,
      modifiedTime: post.updatedAt || post.createdAt,
      section: post.category || "Design",
      images: [{ url: image, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function Page({ params }) {
  const { slug } = await params;
  const post = await getBlogBySlug(slug);

  if (!post) {
    notFound();
  }

  const url = `${BASE_URL}/blog/${slug}`;

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: cleanText(post.metaDescription || post.excerpt),
    image: post.image ? [post.image] : [`${BASE_URL}/og-image.jpg`],
    datePublished: post.createdAt,
    dateModified: post.updatedAt || post.createdAt,
    author: {
      "@type": "Organization",
      name: "CDRLogo",
    },
    publisher: {
      "@type": "Organization",
      name: "CDRLogo",
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/og-image.jpg`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    articleSection: post.category || "Design",
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${BASE_URL}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: url },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <BlogPostClient initialBlog={post} />
    </>
  );
}