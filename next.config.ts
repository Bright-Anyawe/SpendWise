import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Rendered with Node in the PDF export route; keep it out of the server bundle.
  serverExternalPackages: ["@react-pdf/renderer"],
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
