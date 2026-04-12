import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./context/ThemeContext";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "CDRLOGO - Free Logo Maker & Logo Design Templates",
  description: "Download high-quality CDR logo files for CorelDRAW. Fully editable vector logos for printing, branding, and design projects. Easy to customize and ready to use.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
     <body className="min-h-full flex flex-col">  <ThemeProvider> {children}</ThemeProvider></body>
    </html>
  );
}
