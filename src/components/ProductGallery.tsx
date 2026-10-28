"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useProductColor } from "@/components/ProductColorContext";
import { areColorsMatching } from "@/lib/products/colors";
import type { ProductGalleryImage } from "@/data/products";
import Icon from "@/components/Icon";
import {
  getOptimizedImageUrl,
  getResponsiveImageSrcSet,
  RESPONSIVE_SIZES,
} from "@/lib/images/responsive";

interface ProductGalleryProps {
  images?: ProductGalleryImage[];
  fallbackImage: string;
  productName: string;
  selectedColor?: string;
  productColors?: string[];
}

export default function ProductGallery({
  images = [],
  fallbackImage,
  productName,
  selectedColor: propSelectedColor,
  productColors = [],
}: ProductGalleryProps) {
  // Normalize valid image list
  const colorContext = useProductColor();
  const activeColor =
    propSelectedColor !== undefined ? propSelectedColor : (colorContext?.selectedColor || "");

  // Normalize valid image list
  const allImages: ProductGalleryImage[] = useMemo(() => {
    return images.length > 0 ? images : [{ url: fallbackImage, alt: productName, is_primary: true }];


  }, [images, fallbackImage, productName]);

  // Colors configured on the product
  const availableColors = useMemo(() => {
    return Array.isArray(productColors) ? productColors.filter(Boolean) : [];
  }, [productColors]);

  // Check how colors are assigned across allImages
  const assignedColors = useMemo(() => {
    const set = new Set<string>();
    allImages.forEach((img) => {
      if (img.color && img.color.trim()) {
        set.add(img.color.trim().toLowerCase());
      }
    });
    return set;
  }, [allImages]);

  // A product has "properly assigned color-specific image groups" if:
  // At least 2 distinct colors have assigned images, OR all images have assigned colors
  const hasProperColorGroups = useMemo(() => {
    if (assignedColors.size >= 2) return true;
    if (allImages.length > 1 && allImages.every((img) => Boolean(img.color && img.color.trim()))) return true;
    return false;
  }, [assignedColors, allImages]);

  // Filter gallery images by active color if properly grouped; otherwise preserve allImages
  const validImages: ProductGalleryImage[] = useMemo(() => {
    if (!activeColor || !activeColor.trim()) {
      return allImages;
    }

    if (!hasProperColorGroups) {
      // Product does not have complete color groups. Do not filter out unassigned images!
      return allImages;
    }

    const matched = allImages.filter((img) =>
      areColorsMatching(img.color, activeColor)
    );

    return matched.length > 0 ? matched : allImages;
  }, [allImages, activeColor, hasProperColorGroups]);

  // Find primary image index (defaulting to 0 if not explicitly designated)
  const initialIndex = validImages.findIndex((img) => img.is_primary);
  const [activeIndex, setActiveIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  const [isLandscape, setIsLandscape] = useState(false);

  // Synchronize activeIndex when activeColor or validImages change
  useEffect(() => {
    if (!activeColor || !activeColor.trim()) return;

    // 1. Direct color match within validImages
    const directColorIdx = validImages.findIndex((img) =>
      areColorsMatching(img.color, activeColor)
    );
    if (directColorIdx >= 0) {
      setActiveIndex(directColorIdx);
      setFailedImages(new Set());
      return;
    }

    // 2. Alt text or URL match
    const fallbackColorIdx = validImages.findIndex((img) => {
      const alt = (img.alt || '').toLowerCase();
      const url = (img.url || '').toLowerCase();
      const col = activeColor.trim().toLowerCase();
      return col.length > 1 && (alt.includes(col) || url.includes(col));
    });
    if (fallbackColorIdx >= 0) {
      setActiveIndex(fallbackColorIdx);
      setFailedImages(new Set());
      return;
    }

    // 3. Positional 1-to-1 correspondence:
    // If the product has N colors and N images in validImages, map by index
    if (availableColors.length > 1 && validImages.length === availableColors.length) {
      const colorPos = availableColors.findIndex((c) =>
        areColorsMatching(c, activeColor)
      );
      if (colorPos >= 0 && colorPos < validImages.length) {
        setActiveIndex(colorPos);
        setFailedImages(new Set());
        return;
      }
    }

    // 4. Default to primary image or 0
    const primaryIdx = validImages.findIndex((img) => img.is_primary);
    setActiveIndex(primaryIdx >= 0 ? primaryIdx : 0);
    setFailedImages(new Set());
  }, [validImages, activeColor, availableColors]);

  const selectIndex = useCallback(
    (newIdx: number) => {
      setActiveIndex(newIdx);
      const img = validImages[newIdx];
      if (img && colorContext?.setSelectedColor) {
        if (img.color) {
          const matchingColor = availableColors.find((c) =>
            areColorsMatching(c, img.color)
          );
          if (matchingColor) {
            colorContext.setSelectedColor(matchingColor);
            return;
          }
        }
        if (availableColors.length > 1 && validImages.length === availableColors.length) {
          const correspondingColor = availableColors[newIdx];
          if (correspondingColor) {
            colorContext.setSelectedColor(correspondingColor);
          }
        }
      }
    },
    [validImages, colorContext, availableColors]
  );

  const hasMultiple = validImages.length > 1;

  const goToNext = useCallback(() => {
    if (!hasMultiple) return;
    const nextIdx = (activeIndex + 1) % validImages.length;
    selectIndex(nextIdx);
  }, [hasMultiple, activeIndex, validImages.length, selectIndex]);

  const goToPrev = useCallback(() => {
    if (!hasMultiple) return;
    const prevIdx = (activeIndex - 1 + validImages.length) % validImages.length;
    selectIndex(prevIdx);
  }, [hasMultiple, activeIndex, validImages.length, selectIndex]);

  // Touch Swipe Handling for Mobile Devices
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!hasMultiple) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!hasMultiple || touchStartX.current === null || touchStartY.current === null) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = Math.abs(currentX - touchStartX.current);
    const diffY = Math.abs(currentY - touchStartY.current);

    if (isHorizontalSwipe.current === null) {
      // Determine gesture direction once movement exceeds threshold
      if (diffX > 8 || diffY > 8) {
        isHorizontalSwipe.current = diffX > diffY;
      }
    }

    // If gesture is horizontal swipe, prevent default to ensure smooth swipe without bounce
    if (isHorizontalSwipe.current === true && e.cancelable) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!hasMultiple || touchStartX.current === null || touchStartY.current === null) {
      touchStartX.current = null;
      touchStartY.current = null;
      isHorizontalSwipe.current = null;
      return;
    }

    const currentX = e.changedTouches[0].clientX;
    const currentY = e.changedTouches[0].clientY;
    const deltaX = currentX - touchStartX.current;
    const deltaY = currentY - touchStartY.current;

    // Trigger navigation only if horizontal swipe exceeds vertical delta and minimum threshold (40px)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 40) {
      if (deltaX < 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
    isHorizontalSwipe.current = null;
  };

  // Keyboard Navigation Support
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!hasMultiple) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goToPrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goToNext();
    }
  };

  const currentImage = validImages[activeIndex] || validImages[0];
  const isCurrentFailed = failedImages.has(activeIndex);

  const handleImageError = (index: number) => {
    setFailedImages((prev) => new Set(prev).add(index));
  };

  const mainSrcSet = getResponsiveImageSrcSet(currentImage.url, [360, 480, 640, 800, 1000]);
  const optimizedMainSrc = getOptimizedImageUrl(currentImage.url, 800, 82);

  return (
    <div
      className="product-gallery"
      onKeyDown={handleKeyDown}
      tabIndex={hasMultiple ? 0 : undefined}
      role={hasMultiple ? "region" : undefined}
      aria-label={hasMultiple ? `${productName} image gallery` : undefined}
      aria-roledescription={hasMultiple ? "carousel" : undefined}
    >
      {/* Main Image Frame with Touch Swiping */}
      <div
        className="imagery-frame gallery-main-frame"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isCurrentFailed ? (
          <div className="gallery-fallback-tile" role="img" aria-label="Image unavailable">
            <svg
              className="gallery-fallback-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              width="36"
              height="36"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
              <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5" />
              <path d="M21 15l-5-5L5 21" strokeWidth="1.5" />
            </svg>
            <span className="gallery-fallback-text">Image unavailable</span>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={currentImage.url}
            src={optimizedMainSrc}
            srcSet={mainSrcSet}
            sizes={mainSrcSet ? RESPONSIVE_SIZES.galleryMain : undefined}
            alt={currentImage.alt || `${productName} - Image ${activeIndex + 1}`}
            className={`imagery-main-img gallery-slide-img ${isLandscape ? "is-landscape" : ""}`}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            width={460}
            height={613}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                setIsLandscape(img.naturalWidth > img.naturalHeight * 1.05);
              }
            }}
            onError={() => handleImageError(activeIndex)}
          />
        )}

        {/* Desktop Prev / Next Arrow Controls — Hidden when only 1 image */}
        {hasMultiple && (
          <>
            <button
              type="button"
              className="gallery-nav-btn gallery-nav-btn--prev"
              onClick={goToPrev}
              aria-label="Previous image"
            >
              <span className="gallery-nav-icon" aria-hidden="true">
                <Icon name="chevronLeft" size={14} />
              </span>
            </button>
            <button
              type="button"
              className="gallery-nav-btn gallery-nav-btn--next"
              onClick={goToNext}
              aria-label="Next image"
            >
              <span className="gallery-nav-icon" aria-hidden="true">
                <Icon name="chevron" size={14} />
              </span>
            </button>
          </>
        )}

        {/* Image Counter Badge (e.g. 1 / 4) — Hidden when only 1 image */}
        {hasMultiple && (
          <div className="gallery-counter" aria-live="polite" aria-atomic="true">
            {activeIndex + 1} / {validImages.length}
          </div>
        )}
      </div>

      {/* Synchronized Thumbnail Strip — Rendered when product has multiple images overall or validImages > 1 */}
      {(hasMultiple || allImages.length > 1) && (
        <div
          className="gallery-thumbnails"
          role="tablist"
          aria-label="Product image thumbnails"
        >
          {validImages.map((img, idx) => {
            const isFailed = failedImages.has(idx);
            const isSelected = idx === activeIndex;
            const thumbSrc = getOptimizedImageUrl(img.url, 128, 75);

            return (
              <button
                key={img.id || img.url || idx}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-label={`View image ${idx + 1} of ${validImages.length}`}
                className={`gallery-thumb-btn ${isSelected ? "selected" : ""}`}
                onClick={() => selectIndex(idx)}
              >
                {isFailed ? (
                  <div className="gallery-thumb-fallback">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor">
                      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
                    </svg>
                  </div>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={thumbSrc}
                    alt={img.alt || `${productName} thumbnail ${idx + 1}`}
                    className="gallery-thumb-img"
                    loading="lazy"
                    decoding="async"
                    width={64}
                    height={85}
                    onError={() => handleImageError(idx)}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
