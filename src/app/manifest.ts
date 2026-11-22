import type { MetadataRoute } from "next";
import { BRAND } from "@/config/brand";

/** Web app manifest: lets people install SpendWise Auto to their home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: "SpendWise",
    description: BRAND.tagline,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#065f46",
    background_color: "#f7f9f8",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/icon-192", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
