import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./context/ThemeContext";
import Providers from "./provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ---------------------------
// SEO METADATA (FULL FIX)
// ---------------------------
export async function generateMetadata() {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://cdrlogo.com";

  try {
    const res = await fetch(`${baseUrl}/api/admin/site-setting`, {
      cache: "no-store",
    });

    const data = await res.json();

    const title =
      data?.metaTitle ||
      "CDRLOGO - Free Logo Maker & Logo Design Templates";

    const description =
      data?.metaDescription ||
      "Download high-quality CDR logo files for CorelDRAW. Fully editable vector logos for branding and design projects.";

    const image = `${baseUrl}/og-image.jpg`;

    return {
      title,
      description,

      // ✅ Canonical URL
      alternates: {
        canonical: baseUrl,
      },

      // ✅ Open Graph (Facebook / WhatsApp / LinkedIn)
      openGraph: {
        title,
        description,
        url: baseUrl,
        siteName: "CDRLOGO",
        type: "website",
        images: [
          {
            url: image,
            width: 1200,
            height: 630,
            alt: "CDRLOGO - Free Logo Templates",
          },
        ],
      },

      // ✅ Twitter Card
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [image],
      },
    };
  } catch (error) {
    return {
      title: "CDRLOGO",
      description: "Free logo maker and templates",

      alternates: {
        canonical: "https://cdrlogo.com",
      },

      openGraph: {
        title: "CDRLOGO",
        description: "Free logo maker and templates",
        url: "https://cdrlogo.com",
        siteName: "CDRLOGO",
        type: "website",
        images: [
          {
            url: "https://cdrlogo.com/og-image.jpg",
            width: 1200,
            height: 630,
          },
        ],
      },

      twitter: {
        card: "summary_large_image",
        title: "CDRLOGO",
        description: "Free logo maker and templates",
        images: ["https://cdrlogo.com/og-image.jpg"],
      },
    };
  }
}

// ---------------------------
// ROOT LAYOUT
// ---------------------------
export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <ThemeProvider>
            {/* ✅ IMPORTANT: H1 should be inside homepage page.tsx */}
            {children}
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}