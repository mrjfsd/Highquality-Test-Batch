"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CartProvider } from "@/context/CartContext";

interface StorefrontChromeProps {
  children: React.ReactNode;
  initialShowSaleLink?: boolean;
}

function StorefrontChromeInner({
  children,
  initialShowSaleLink,
}: {
  children: React.ReactNode;
  initialShowSaleLink?: boolean;
}) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  if (isAdmin) {
    // Admin section: render children directly, no storefront chrome
    return <>{children}</>;
  }

  return (
    <>
      <AnnouncementBanner />
      <Navbar initialShowSaleLink={initialShowSaleLink} />
      {children}
      <Footer />
    </>
  );
}

export default function StorefrontChrome({
  children,
  initialShowSaleLink,
}: StorefrontChromeProps) {
  return (
    <CartProvider>
      <Suspense fallback={<>{children}</>}>
        <StorefrontChromeInner initialShowSaleLink={initialShowSaleLink}>
          {children}
        </StorefrontChromeInner>
      </Suspense>
    </CartProvider>
  );
}
