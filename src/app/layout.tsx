import type { Metadata } from "next";
import "./globals.css";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

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
        {/* Announcement banner — scrolls naturally with page */}
        <AnnouncementBanner />
        {/* Navbar — sticky at top of viewport */}
        <Navbar />
        {/* Page content */}
        {children}
        {/* Shared footer */}
        <Footer />
      </body>
    </html>
  );
}
