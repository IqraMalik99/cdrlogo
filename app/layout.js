import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./context/ThemeContext";
import Providers from "./provider";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* ✅ Bing + Yandex — ENV se aayega, Git mein visible nahi hoga */}
        <meta name="msvalidate.01" content={process.env.BING_VERIFICATION_CODE} />
        <meta name="yandex-verification" content={process.env.YANDEX_VERIFICATION_CODE} />
      </head>
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