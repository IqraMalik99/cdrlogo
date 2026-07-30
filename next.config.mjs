import withBundleAnalyzer from "@next/bundle-analyzer";

const bundleAnalyzer = withBundleAnalyzer({
  enabled:"true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdfkit", "svg-to-pdfkit", "sharp"],
  images: {
    imageSizes: [16, 32, 48, 64, 96, 110, 128, 150, 256],
    deviceSizes: [640, 750, 828, 1080, 1200],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.cdrlogo.com",
      },
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
    ],
  }
};


export default bundleAnalyzer(nextConfig);
