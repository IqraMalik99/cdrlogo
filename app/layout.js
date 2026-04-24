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


// ✅ Dynamic SEO from backend
export async function generateMetadata() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/admin/site-setting`,
      {
        cache: "no-store", // always fresh
      }
    );

    const data = await res.json();

    return {
      title:
        data?.metaTitle ||
        "CDRLOGO - Free Logo Maker & Logo Design Templates",

      description:
        data?.metaDescription ||
        "Download high-quality CDR logo files for CorelDRAW. Fully editable vector logos for printing, branding, and design projects.",
    };
  } catch (error) {
    return {
      title: "CDRLOGO",
      description: "Free logo maker and templates",
    };
  }
}


// ✅ Root Layout
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
            {children}
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}