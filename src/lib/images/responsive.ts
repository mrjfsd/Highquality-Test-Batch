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
 * Generates an optimized image URL with tailored width and quality.
 * For Unsplash images, updates w and q query params to avoid downloading oversized originals.
 * Non-Unsplash URLs are returned unchanged.
 */
export function getOptimizedImageUrl(
  url: string,
  width?: number,
  quality: number = 80
): string {
  if (!url || !isUnsplashUrl(url)) {
    return url;
  }

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

/**
 * Generates a responsive srcSet string for Unsplash images across specified breakpoints.
 * Returns undefined for non-Unsplash images so the browser uses the standard src.
 */
export function getResponsiveImageSrcSet(
  url: string,
  widths: number[] = [320, 480, 640, 800, 1000],
  quality: number = 80
): string | undefined {
  if (!url || !isUnsplashUrl(url)) {
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
