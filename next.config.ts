import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pdfmake",
    "@foliojs-fork/pdfkit",
    "@foliojs-fork/fontkit",
    "@foliojs-fork/linebreak",
    "fontkit",
    "pdfkit",
  ],
};

export default nextConfig;