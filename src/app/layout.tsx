import type { Metadata } from "next";
import "./globals.css";
import StorefrontChrome from "@/components/StorefrontChrome";
import { getNavbarConfig } from "@/lib/settings/site-settings";

export const metadata: Metadata = {
  title: "Style-Edit | Considered Everyday Fashion",
  description:
    "Curated everyday fashion, chosen in Mysuru. Shop Men, Women, and Kids collections with considered design and versatile pieces.",
  keywords: "clothing, fashion, women, men, kids, minimal style, essentials, mysuru",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navbarConfig = await getNavbarConfig();

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#06110C", color: "#F7F3EE" }}>
        <StorefrontChrome initialShowSaleLink={navbarConfig.showSaleLink}>
          {children}
        </StorefrontChrome>
      </body>
    </html>
  );
}

