import { Geist, Geist_Mono, Sora, DM_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./context/ThemeContext";
import Providers from "./provider";
import DeferredGTM from "./components/Defergtm";

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
        {/* ✅ Bing + Yandex — ENV se aayega, Git mein visible nahi hoga */}
        <meta name="msvalidate.01" content="C969DC98F5B4EA442FF6FF3A941F9C1A" />
        <meta name="yandex-verification" content="2ba291fe8912edc4" />
      </head>
      <body className="min-h-full flex flex-col">
      
        <DeferredGTM gtmId="G-CEG962163M" />
        <Providers>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}