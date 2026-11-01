"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * ProductScrollReset
 *
 * Ensures that whenever a user navigates or redirects to a product detail page,
 * the window starts cleanly at the very top (scrollY = 0).
 *
 * Prevents:
 * 1. Opening at the bottom when navigating from a scrolled catalog or home page.
 * 2. Opening at the bottom when clicking related products at the footer of another product page.
 * 3. Browser automatic scroll restoration retaining previous scroll offsets on client-side route transitions.
 */
export default function ProductScrollReset() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Temporarily set manual scroll restoration for this page transition
    if ("scrollRestoration" in window.history) {
      try {
        window.history.scrollRestoration = "manual";
      } catch {
        // ignore
      }
    }

    // 1. Immediate instant scroll reset to top
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });

    // 2. Double-check on next animation frame after DOM nodes mount
    const rId = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });

    // 3. Fallback tick in case of image / font hydration layout changes
    const tId = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }, 50);

    return () => {
      cancelAnimationFrame(rId);
      clearTimeout(tId);
    };
  }, [pathname]);

  return null;
}
