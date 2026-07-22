import Blogpageclient from "./Blogpageclient";

const blogListSchema = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: "CDRLogo Design Blog",
  url: "https://www.cdrlogo.com/blog",
  description:
    "Educational articles, design guides, and case studies covering logo design, visual identity, branding, and vector graphics.",
  publisher: {
    "@type": "Organization",
    name: "CDRLogo",
    logo: "https://www.cdrlogo.com/og-image.jpg",
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://www.cdrlogo.com",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Blog",
      item: "https://www.cdrlogo.com/blog",
    },
  ],
};

export async function generateMetadata() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.cdrlogo.com";

  const title = "Design Blog | Logo, Branding & Vector Graphics Guides - CDRLogo";
  const description =
    "Explore educational articles, design guides, creative insights, and case studies covering logo design, visual identity, branding, and vector graphics. An independent learning resource for designers, students, researchers, and creative professionals.";
  const image = `${baseUrl}/og-image.jpg`;

  return {
    title,
    description,
    alternates: { canonical: `${baseUrl}/blog` },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
      },
    },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/blog`,
      siteName: "CDRLogo",
      type: "website",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: "CDRLogo Design Blog",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogListSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <Blogpageclient />
    </>
  );
}