import type { Metadata } from "next";
import "./globals.css";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Style-Edit | Considered Clothing for Everyday Life",
  description:
    "Minimal, premium clothing for everyday life. Shop Women, Men, and Kids collections with considered design and versatile pieces.",
  keywords: "clothing, fashion, women, men, kids, minimal style, essentials",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/*
       * Body: paper background from design tokens.
       * The announcement banner is outside the sticky header intentionally —
       * it scrolls away naturally. Only the Navbar element is sticky.
       */}
      <body style={{ margin: 0, background: "#f6f6f2" }}>
        {/* Announcement banner — NOT sticky, scrolls with the page */}
        <AnnouncementBanner />
        {/* Navbar — sticky at top: 0 via .header CSS class */}
        <Navbar />
        {/* Page content */}
        {children}
        {/* Shared footer */}
        <Footer />
      </body>
    </html>
  );
}
