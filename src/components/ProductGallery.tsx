"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface GalleryImage {
  id: string;
  productId: string;
  storagePath: string;
  proxyUrl: string;
  altText: string;
  displayOrder: number;
  isPrimary: boolean;
  color: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
}

interface ProductGalleryProps {
  productId: string;
  productName: string;
  initialPrimaryImage?: {
    id?: string;
    storagePath?: string;
    proxyUrl: string;
    altText: string;
    displayOrder?: number;
    isPrimary?: boolean;
  } | null;
}

const PAGE_SIZE = 20;

export default function ProductGallery({
  productId,
  productName,
  initialPrimaryImage,
}: ProductGalleryProps) {
  // Gallery metadata state
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Active selection state
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isMainImageLoading, setIsMainImageLoading] = useState<boolean>(true);
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());

  // References for observer and scroll
  const thumbnailSentinelRef = useRef<HTMLDivElement | null>(null);
  const thumbnailContainerRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initial load on mount or productId change
  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    async function loadInitial() {
      try {
        const response = await fetch(
          `/api/products/${productId}/gallery?page=1&limit=${PAGE_SIZE}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Server returned ${response.status}`);
        }

        const data = await response.json();
        if (!ignore) {
          const incomingImages: GalleryImage[] = data.images || [];
          setImages(incomingImages);
          setTotalCount(data.total || 0);
          setHasMore(Boolean(data.hasMore));
          setCurrentPage(1);

          if (incomingImages.length > 0) {
            const primaryIdx = incomingImages.findIndex((img) => img.isPrimary);
            setSelectedIndex(primaryIdx !== -1 ? primaryIdx : 0);
          }
          setIsLoadingInitial(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          if (err instanceof Error && err.name === "AbortError") {
            return;
          }
          const msg =
            err instanceof Error ? err.message : "Failed to load gallery images.";
          setLoadError(msg);
          setIsLoadingInitial(false);
        }
      }
    }

    loadInitial();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [productId]);

  // Fetch subsequent pages of 20 gallery images
  const fetchNextPage = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoadingMore(true);
    setLoadError(null);

    const nextPage = currentPage + 1;

    try {
      const response = await fetch(
        `/api/products/${productId}/gallery?page=${nextPage}&limit=${PAGE_SIZE}`,
        { signal: controller.signal }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned ${response.status}`);
      }

      const data = await response.json();
      const incomingImages: GalleryImage[] = data.images || [];

      setImages((prev) => {
        // Stable deduplication by unique image ID
        const existingIds = new Set(prev.map((img) => img.id));
        const fresh = incomingImages.filter((img) => !existingIds.has(img.id));
        return [...prev, ...fresh];
      });

      setTotalCount(data.total || 0);
      setHasMore(Boolean(data.hasMore));
      setCurrentPage(nextPage);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return; // Ignore canceled requests
      }
      const msg =
        err instanceof Error ? err.message : "Failed to load more gallery images.";
      setLoadError(msg);
    } finally {
      setIsLoadingMore(false);
    }
  }, [productId, currentPage, hasMore, isLoadingMore]);

  // Infinite scroll trigger for thumbnails
  useEffect(() => {
    if (isLoadingInitial || isLoadingMore || !hasMore) return;

    const sentinel = thumbnailSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target && target.isIntersecting) {
          fetchNextPage();
        }
      },
      {
        root: thumbnailContainerRef.current,
        rootMargin: "150px",
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [fetchNextPage, hasMore, isLoadingInitial, isLoadingMore]);

  // Active image derivation
  const currentImage: GalleryImage | null = images[selectedIndex] || null;

  // Previous navigation
  function handlePrev() {
    if (selectedIndex > 0) {
      setSelectedIndex((prev) => prev - 1);
      setIsMainImageLoading(true);
    }
  }

  // Next navigation with progressive loading at batch boundary
  async function handleNext() {
    if (selectedIndex < images.length - 1) {
      setSelectedIndex((prev) => prev + 1);
      setIsMainImageLoading(true);
    } else if (hasMore && !isLoadingMore) {
      // Reached end of currently loaded batch — fetch next batch and advance
      const nextIndex = images.length;
      await fetchNextPage();
      setSelectedIndex(nextIndex);
      setIsMainImageLoading(true);
    }
  }

  // Handle keyboard arrow navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function handleThumbnailClick(index: number) {
    setSelectedIndex(index);
    setIsMainImageLoading(true);
  }

  function handleImageError(imageId: string) {
    setFailedImageIds((prev) => new Set(prev).add(imageId));
    setIsMainImageLoading(false);
  }

  // Render initial loading state
  if (isLoadingInitial && images.length === 0) {
    return (
      <div className="space-y-4">
        {/* Main image skeleton */}
        <div className="w-full aspect-4/3 sm:aspect-square bg-neutral-200 rounded-2xl animate-pulse flex items-center justify-center">
          <svg className="w-12 h-12 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        {/* Thumbnails skeleton */}
        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="aspect-square bg-neutral-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Render empty state if product has no images at all
  if (!isLoadingInitial && images.length === 0 && !loadError) {
    return (
      <div className="w-full aspect-square bg-neutral-100 rounded-2xl flex flex-col items-center justify-center text-center p-8 border border-neutral-200 space-y-2">
        <svg className="w-12 h-12 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm font-semibold text-neutral-700">No Gallery Images Available</p>
        <p className="text-xs text-neutral-500">This product has no image assets registered.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 select-none">
      {/* 1. Main Display Stage */}
      <div className="relative w-full aspect-4/3 sm:aspect-square bg-neutral-100 rounded-2xl overflow-hidden border border-neutral-200 shadow-xs flex items-center justify-center">
        {currentImage ? (
          failedImageIds.has(currentImage.id) ? (
            <div className="flex flex-col items-center justify-center p-8 text-neutral-400 text-center gap-2">
              <svg className="w-12 h-12 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-xs font-semibold text-neutral-600">Image Preview Unavailable</span>
              <span className="text-[11px] text-neutral-400 font-mono">
                {currentImage.storagePath}
              </span>
            </div>
          ) : (
            <>
              {/* Spinner while main image resolves */}
              {isMainImageLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-100/60 z-10">
                  <div className="w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentImage.proxyUrl}
                alt={currentImage.altText || productName}
                onLoad={() => setIsMainImageLoading(false)}
                onError={() => handleImageError(currentImage.id)}
                className={`w-full h-full object-contain transition-opacity duration-300 ${
                  isMainImageLoading ? "opacity-0" : "opacity-100"
                }`}
              />
            </>
          )
        ) : initialPrimaryImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={initialPrimaryImage.proxyUrl}
            alt={initialPrimaryImage.altText || productName}
            className="w-full h-full object-contain"
          />
        ) : null}

        {/* Counter Badge */}
        {totalCount > 0 && (
          <div className="absolute top-3 left-3 bg-neutral-900/80 backdrop-blur-md text-white text-[11px] font-medium px-2.5 py-1 rounded-full shadow-xs">
            {selectedIndex + 1} / {totalCount}
          </div>
        )}

        {/* Primary Image Badge */}
        {currentImage?.isPrimary && (
          <div className="absolute top-3 right-3 bg-emerald-600/90 backdrop-blur-md text-white text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded shadow-xs">
            Designated Primary
          </div>
        )}

        {/* Previous Navigation Control */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={selectedIndex === 0}
          aria-label="Previous image"
          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 backdrop-blur-xs text-neutral-800 flex items-center justify-center shadow-md hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Next Navigation Control */}
        <button
          type="button"
          onClick={handleNext}
          disabled={selectedIndex >= totalCount - 1}
          aria-label="Next image"
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 backdrop-blur-xs text-neutral-800 flex items-center justify-center shadow-md hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 2. Progressive Thumbnail Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-neutral-500 font-medium">
          <span>
            Gallery Thumbnails (<strong>{images.length}</strong> of <strong>{totalCount}</strong> loaded)
          </span>
          {hasMore && (
            <span className="text-[11px] text-neutral-400">
              Scroll thumbnails to load more
            </span>
          )}
        </div>

        {/* Thumbnail Scroll Container */}
        <div
          ref={thumbnailContainerRef}
          className="flex items-center gap-2 overflow-x-auto p-1 border border-neutral-200 rounded-xl bg-neutral-50/70 scrollbar-thin"
        >
          {images.map((img, idx) => {
            const isSelected = selectedIndex === idx;
            const isFailed = failedImageIds.has(img.id);

            return (
              <button
                key={img.id}
                type="button"
                onClick={() => handleThumbnailClick(idx)}
                aria-label={`Select image ${idx + 1}`}
                className={`relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 bg-white transition-all ${
                  isSelected
                    ? "border-neutral-900 ring-2 ring-neutral-900/20 shadow-xs"
                    : "border-transparent hover:border-neutral-300 opacity-80 hover:opacity-100"
                }`}
              >
                {isFailed ? (
                  <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-[10px]">
                    ✕
                  </div>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={img.proxyUrl}
                    alt={img.altText || `${productName} thumbnail ${idx + 1}`}
                    loading="lazy"
                    onError={() => handleImageError(img.id)}
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Primary indicator dot */}
                {img.isPrimary && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-600 ring-1 ring-white" />
                )}

                {/* Display order index label */}
                <span className="absolute bottom-0.5 right-0.5 bg-neutral-900/70 text-white font-mono text-[9px] px-1 rounded-xs">
                  {idx + 1}
                </span>
              </button>
            );
          })}

          {/* Sentinel for IntersectionObserver to trigger loading next 20 images */}
          {hasMore && (
            <div
              ref={thumbnailSentinelRef}
              className="shrink-0 w-8 h-16 flex items-center justify-center"
            >
              {isLoadingMore && (
                <div className="w-5 h-5 border-2 border-neutral-800 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          )}
        </div>

        {/* Load More Button & Status Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
          {hasMore ? (
            <button
              type="button"
              onClick={fetchNextPage}
              disabled={isLoadingMore}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-neutral-300 text-neutral-700 rounded-lg text-xs font-medium hover:bg-neutral-100 disabled:opacity-50 transition-colors"
            >
              {isLoadingMore ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-neutral-700 border-t-transparent rounded-full animate-spin" />
                  Loading batch {currentPage + 1}...
                </>
              ) : (
                `Load next 20 images (${totalCount - images.length} remaining) ↓`
              )}
            </button>
          ) : (
            <span className="text-[11px] text-neutral-400">
              ✓ All {totalCount} images loaded
            </span>
          )}

          {/* Error Message with Retry */}
          {loadError && (
            <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
              <span>{loadError}</span>
              <button
                type="button"
                onClick={fetchNextPage}
                className="underline font-semibold hover:text-rose-900"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
