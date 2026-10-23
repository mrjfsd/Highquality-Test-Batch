import type { Metadata } from "next";
import "./globals.css";
import StorefrontChrome from "@/components/StorefrontChrome";

export const metadata: Metadata = {
  title: "Style-Edit | Considered Everyday Fashion",
  description:
    "Curated everyday fashion, chosen in Mysuru. Shop Men, Women, and Kids collections with considered design and versatile pieces.",
  keywords: "clothing, fashion, women, men, kids, minimal style, essentials, mysuru",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f8f5f0" }}>
        <StorefrontChrome>{children}</StorefrontChrome>
      </body>
    </html>
  );
}

