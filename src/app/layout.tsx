import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { BRAND } from "@/config/brand";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.tagline,
  applicationName: BRAND.name,
  appleWebApp: { capable: true, title: "SpendWise", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon-192", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#065f46",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: browser extensions add attributes to <html> before React loads.
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
