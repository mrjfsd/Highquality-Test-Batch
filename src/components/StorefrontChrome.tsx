"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

function StorefrontChromeInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  if (isAdmin) {
    // Admin section: render children directly, no storefront chrome
    return <>{children}</>;
  }

  return (
    <>
      <AnnouncementBanner />
      <Navbar />
      {children}
      <Footer />
    </>
  );
}

export default function StorefrontChrome({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<>{children}</>}>
      <StorefrontChromeInner>{children}</StorefrontChromeInner>
    </Suspense>
  );
}
