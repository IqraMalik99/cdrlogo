import React from 'react'

import Navbar from './components/Navbar'
import Home from './components/Home'
import LogosPage from './components/LogoHome'
import HomeCatageory from './components/HomeTemplateCategories'
import BrandCategories from './components/HomeBrandsCatageory'
import TrendingLogos from './components/HomeTrendingLogo'
import TopBrands from './components/HomeTopBrand'
import Footer from './components/Footer'
import PantoneColorPicker from './components/Pantone'
import Recent from "./components/Recent"

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "CDRLogo",
  url: "https://www.cdrlogo.com",
  description: "Logo library for educational and design reference use.",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://www.cdrlogo.com/search?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};



let OrganizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "CDRLogo",
  url: "https://www.cdrlogo.com",
  logo: "https://www.cdrlogo.com/og-image.jpg",
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
  ],
};

export async function generateMetadata() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.cdrlogo.com";

  try {
    const cleanText = (text) =>
      text ? text.replace(/[\r\n\t\u200B]+/g, " ").replace(/\s+/g, " ").trim() : "";
    const res = await fetch(`${baseUrl}/api/admin/site-setting`, {
      cache: "no-store",
    });

    const data = await res.json();

    const title =
      cleanText(data?.metaTitle) ||
      "Vector Logo Downloads | CDR, SVG, AI & PNG Files - CDRLogo";

    const description =
      cleanText(data?.metaDescription) ||
      "Vector logo downloads in CDR, SVG, AI, EPS and PNG formats for graphic designers, students and print professionals. Design reference library at cdrlogo.com.";

    const image = `${baseUrl}/og-image.jpg`;
    console.log(JSON.stringify(data?.metaDescription));

    return {
      title,
      description,
      alternates: { canonical: baseUrl },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
        },
      },
      verification: {
        google: "8XIFTI2Ell1-5-651AsIKaLVjgPfSCjLLhHim_LxE1k",   // ← yeh line add karo
      },
      openGraph: {
        title,
        description,
        url: "https://www.cdrlogo.com",
        siteName: "CDRLogo",
        type: "website",
        images: [{ url: image, width: 1200, height: 630, alt: "CDRLogo - Vector Logo Downloads" }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [image],
      },
    };
  } catch (error) {
    return {
      title: "Vector Logo Downloads | CDR, SVG, AI & PNG Files - CDRLogo",
      description: "Vector logo downloads in CDR, SVG, AI, EPS and PNG formats for graphic designers, students and print professionals. Design reference library at cdrlogo.com.",
      alternates: { canonical: "https://www.cdrlogo.com" },
       verification: {
        google: "8XIFTI2Ell1-5-651AsIKaLVjgPfSCjLLhHim_LxE1k",   // ← yeh line add karo
      },
      robots: {
        index: true,
        follow: true,
      },
      openGraph: {
        title: "Vector Logo Downloads | CDR, SVG, AI & PNG Files - CDRLogo",
        description: "Vector logo downloads in CDR, SVG, AI, EPS and PNG formats for graphic designers, students and print professionals. Design reference library at cdrlogo.com.",
        url: "https://www.cdrlogo.com",
        siteName: "CDRLogo",
        type: "website",
        images: [{ url: "https://www.cdrlogo.com/og-image.jpg", width: 1200, height: 630 }],
      },
      twitter: {
        card: "summary_large_image",
        title: "Vector Logo Downloads | CDR, SVG, AI & PNG Files - CDRLogo",
        description: "Vector logo downloads in CDR, SVG, AI, EPS and PNG formats for graphic designers, students and print professionals. Design reference library at cdrlogo.com.",
        images: ["https://www.cdrlogo.com/og-image.jpg"],
      },
    };
  }
}

export default function page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <Navbar />
      <h1
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          clipPath: "inset(50%)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {`Free Vector Logo Downloads — CDR, SVG, AI & PNG Files`}
      </h1>
      <Home />
      <PantoneColorPicker />
      <LogosPage />
      <Recent/>
      <BrandCategories />
      <HomeCatageory />
      <TrendingLogos />
      <TopBrands />
      <Footer />
    </>
  )
}