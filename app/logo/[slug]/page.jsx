import LogoDetail from "./LogoDetail";

export async function generateMetadata({ params }) {
  const { slug } = await params;

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/logo/fetch/slug`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
      next: { revalidate: 3600 },
    });

    const data = await res.json();
    console.log("data",data);
    const logo = data.data || data;

    console.log("logo",logo);

    const title = logo.metaTitle || `${logo.logoName} Logo – Free Download (SVG, PNG, AI, CDR)`;
    const description = logo.metaDescription || (logo.description || "").slice(0, 160);
    const canonicalUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/logo/${logo.slug}`;

    return {
      title,
      description,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        title,
        description,
        url: canonicalUrl,
        images: logo.webpUrl ? [{ url: logo.webpUrl }] : [],
      },
    };
  } catch {
    return {
      title: "Logo – Free Download",
      description: "Download free vector logos in SVG, PNG, AI, CDR formats.",
    };
  }
}

export default function Page() {
  return <LogoDetail />;
}