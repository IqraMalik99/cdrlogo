/** @type {import('next').NextConfig} */
const nextConfig = {
 serverExternalPackages: ["pdfkit", "svg-to-pdfkit","sharp"],
 images: {
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
  },
};

export default nextConfig;
