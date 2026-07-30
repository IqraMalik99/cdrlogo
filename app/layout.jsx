import Script from "next/script";
import { Geist, Geist_Mono, Sora, DM_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./context/ThemeContext";
import Providers from "./provider";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} ${dmSans.variable} h-full antialiased`}
    >
      <head>
        <meta name="msvalidate.01" content="C969DC98F5B4EA442FF6FF3A941F9C1A" />
        <meta name="yandex-verification" content="2ba291fe8912edc4" />
      </head>
      <body className="min-h-full flex flex-col">
        {/* GTM/GA4 script — lazyOnload strategy: JS execution ko browser idle/load-complete tak defer karta hai */}
        <Script
          id="gtm-script"
          strategy="lazyOnload"
          src={`https://www.googletagmanager.com/gtm.js?id=G-CEG962163M`}
        />

        <Providers>
          <ThemeProvider>{children}</ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}