import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Partytown } from "@builder.io/partytown/react";
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
        <meta name="msvalidate.01" content="C969DC98F5B4EA442FF6FF3A941F9C1A" />
        <meta name="yandex-verification" content="2ba291fe8912edc4" />

        {/*
          ✅ Partytown: GTM ko main thread se hata kar web worker mein
          chalata hai, taake ye TBT/LCP ko block na kare.
          forward: jo bhi global function GTM/gtag call karta hai
          (dataLayer.push, gtag), Partytown usay worker se main thread
          tak proxy karta hai.
        */}
        <Partytown forward={["dataLayer.push", "gtag"]} />

        <Script
          type="text/partytown"
          src="https://www.googletagmanager.com/gtag/js?id=G-CEG962163M"
        />
        <Script type="text/partytown" id="ga-gtag-init">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-CEG962163M');
          `}
        </Script>
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