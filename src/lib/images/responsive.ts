/**
 * Responsive image utilities for Style Edit storefront.
 * Handles right-sizing Unsplash URLs, generating responsive srcSet, and standard sizes attributes.
 */

/**
 * Checks if a URL is an Unsplash image CDN URL.
 */
export function isUnsplashUrl(url?: string): boolean {
  if (!url) return false;
  return url.includes("images.unsplash.com");
}

/**
 * Checks if a URL is a Cloudflare R2 image proxy URL (/api/images/...).
 */
export function isR2ImageUrl(url?: string): boolean {
  if (!url) return false;
  if (url.includes("raw=true") || url.includes("raw=1")) return false;
  return url.startsWith("/api/images/") || url.includes("/api/images/");
}

/**
 * Checks if a URL can be dynamically resized and optimized.
 */
export function isOptimizableImageUrl(url?: string): boolean {
  return isUnsplashUrl(url) || isR2ImageUrl(url);
}

/**
 * Generates an optimized image URL with tailored width and quality.
 * Supports:
 * 1. Unsplash images (updates w, q, auto=format, fit=crop)
 * 2. Cloudflare R2 proxy images (/api/images/[...key], updates w and q)
 * Non-optimizable URLs are returned unchanged.
 */
export function getOptimizedImageUrl(
  url: string,
  width?: number,
  quality: number = 80
): string {
  if (!url) return url;

  if (isUnsplashUrl(url)) {
    try {
      const urlObj = new URL(url);
      if (width) {
        urlObj.searchParams.set("w", width.toString());
      }
      urlObj.searchParams.set("q", quality.toString());
      urlObj.searchParams.set("auto", "format");
      if (!urlObj.searchParams.has("fit")) {
        urlObj.searchParams.set("fit", "crop");
      }
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  if (isR2ImageUrl(url)) {
    try {
      const isRelative = url.startsWith("/");
      const dummyBase = "https://style-edit.local";
      const urlObj = new URL(url, dummyBase);

      if (width) {
        urlObj.searchParams.set("w", width.toString());
      }
      urlObj.searchParams.set("q", quality.toString());

      return isRelative ? `${urlObj.pathname}${urlObj.search}` : urlObj.toString();
    } catch {
      return url;
    }
  }

  return url;
}

/**
 * Generates a responsive srcSet string for Unsplash and R2 images across specified breakpoints.
 * Returns undefined for non-optimizable images so the browser uses the standard src.
 */
export function getResponsiveImageSrcSet(
  url: string,
  widths: number[] = [320, 480, 640, 800, 1000],
  quality: number = 80
): string | undefined {
  if (!url || (!isUnsplashUrl(url) && !isR2ImageUrl(url))) {
    return undefined;
  }

  return widths
    .map((w) => `${getOptimizedImageUrl(url, w, quality)} ${w}w`)
    .join(", ");
}

/**
 * Standard responsive sizes attributes for layout types across the storefront.
 */
export const RESPONSIVE_SIZES = {
  // Product cards in catalogue (2 cols on mobile, 3-4 cols on tablet/desktop)
  productCard: "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px",
  // Department cards on homepage (1 col on mobile, 3 cols on desktop)
  departmentCard: "(max-width: 768px) 100vw, 33vw",
  // Homepage favourites cards
  favouriteCard: "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px",
  // Editorial feature banner
  editorial: "(max-width: 768px) 100vw, 50vw",
  // Full-width banners
  fullBanner: "100vw",
  // Product detail gallery main image
  galleryMain: "(max-width: 768px) 100vw, 460px",
  // Product gallery thumbnail
  galleryThumbnail: "64px",
} as const;
