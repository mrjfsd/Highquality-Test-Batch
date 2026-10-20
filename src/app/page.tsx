"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";

const BATCH_SIZE = 12;

interface ProductVariantSummary {
  id: string;
  size: string;
  color: string;
  stock_quantity: number;
  is_available: boolean;
}

interface ImageParentProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  sale_price: number | null;
  category: string;
  status: "draft" | "published" | "archived";
  product_variants?: ProductVariantSummary[];
}

interface ImageCardItem {
  id: string;
  storage_path: string;
  alt_text: string | null;
  display_order: number;
  is_primary: boolean;
  color: string | null;
  created_at: string;
  proxyUrl: string;
  product: ImageParentProduct;
}

interface BatchMetric {
  batchNumber: number;
  imageCount: number;
  metaDurationMs: number;
  preloadDurationMs: number;
  totalDurationMs: number;
  successfulCount: number;
  failedCount: number;
  timestamp: string;
}

interface PrefetchedBatch {
  page: number;
  items: ImageCardItem[];
  totalCount: number;
  metaDurationMs: number;
}

/**
 * Proactively preloads images into browser HTTP/disk cache in the background.
 * Uses bounded concurrency (4 parallel workers) so it doesn't saturate the network
 * or block the main thread, prioritizing cards closest to entering the viewport.
 */
function preloadBatchImagesInBackground(items: ImageCardItem[]) {
  if (typeof window === "undefined" || items.length === 0) return;

  const concurrency = 4;
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      const item = items[currentIndex];
      if (!item) break;

      try {
        const img = new Image();
        img.src = item.proxyUrl;
        if (typeof img.decode === "function") {
          await Promise.race([
            img.decode(),
            new Promise((resolve) => setTimeout(resolve, 500)),
          ]);
        }
      } catch {
        // Non-blocking: <img> tag will still load normally on mount
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  Promise.all(workers).catch(() => {});
}

interface CatalogueImageCardProps {
  item: ImageCardItem;
  isImageBroken: boolean;
  onImageError: (id: string) => void;
  onRetryImage: (id: string) => void;
}

/**
 * Individual catalogue image card with reserved 3:4 aspect ratio,
 * subtle skeleton placeholder, and smooth image fade-in.
 */
function CatalogueImageCard({
  item,
  isImageBroken,
  onImageError,
  onRetryImage,
}: CatalogueImageCardProps) {
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // If the image was already preloaded into memory/disk cache, check img.complete on mount
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, []);

  const hasDiscount =
    item.product.sale_price !== null &&
    item.product.price > 0 &&
    item.product.sale_price < item.product.price;

  const discountPercentage = hasDiscount
    ? Math.round(((item.product.price - item.product.sale_price!) / item.product.price) * 100)
    : null;

  const totalStock = (item.product.product_variants || []).reduce(
    (acc, v) => acc + (v.stock_quantity || 0),
    0
  );
  const inStock = totalStock > 0;

  return (
    <article className="group bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-2xs hover:shadow-md transition-shadow duration-200 flex flex-col">
      {/* Image Container with Rigidly Reserved 3:4 Aspect Ratio (CLS = 0) */}
      <div className="relative w-full aspect-3/4 bg-neutral-100 overflow-hidden flex items-center justify-center">
        {/* Subtle Skeleton Placeholder while image is loading */}
        {!isLoaded && !isImageBroken && (
          <div className="absolute inset-0 bg-neutral-200/60 animate-pulse pointer-events-none" />
        )}

        {isImageBroken ? (
          <div className="flex flex-col items-center justify-center p-6 text-neutral-400 text-center gap-2">
            <svg className="w-10 h-10 stroke-current text-neutral-300" fill="none" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-[11px] font-medium text-neutral-500">
              Image Unavailable
            </span>
            <button
              type="button"
              onClick={() => onRetryImage(item.id)}
              className="text-[11px] text-neutral-900 font-semibold underline hover:text-black mt-1 cursor-pointer"
            >
              Retry Image
            </button>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            ref={imgRef}
            src={item.proxyUrl}
            alt={item.alt_text || `${item.product.name} image ${item.display_order + 1}`}
            loading="eager"
            decoding="async"
            onLoad={() => setIsLoaded(true)}
            onError={() => onImageError(item.id)}
            className={`w-full h-full object-cover object-center group-hover:scale-105 transition-all duration-300 ${
              isLoaded ? "opacity-100" : "opacity-0"
            }`}
          />
        )}

        {/* Left Badges (Primary / Discount) */}
        <div className="absolute top-3 left-3 flex flex-col gap-1 z-10 pointer-events-none">
          {item.is_primary && (
            <span className="bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-xs">
              Primary
            </span>
          )}
          {hasDiscount && discountPercentage && (
            <span className="bg-rose-600 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-xs">
              Save {discountPercentage}%
            </span>
          )}
        </div>

        {/* Category Pill */}
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-xs text-neutral-800 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded shadow-2xs border border-neutral-100 z-10 pointer-events-none">
          {item.product.category}
        </div>

        {/* Display Order Sequence Label */}
        <div className="absolute bottom-2.5 right-2.5 bg-neutral-900/70 backdrop-blur-xs text-white text-[9px] font-mono px-1.5 py-0.5 rounded z-10 pointer-events-none">
          #{item.display_order + 1}
        </div>
      </div>

      {/* Card Content with Product Name, Description, Pricing and Stock */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 line-clamp-1">
            {item.product.name}
          </h3>
          {item.product.description && (
            <p className="text-xs text-neutral-500 mt-1 line-clamp-2 leading-relaxed">
              {item.product.description}
            </p>
          )}
        </div>

        {/* Pricing & Stock Block */}
        <div className="pt-2 border-t border-neutral-100 flex items-baseline justify-between">
          {hasDiscount ? (
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold text-neutral-900">
                ${item.product.sale_price!.toFixed(2)}
              </span>
              <span className="text-xs text-neutral-400 line-through">
                ${item.product.price.toFixed(2)}
              </span>
            </div>
          ) : (
            <span className="text-base font-bold text-neutral-900">
              ${item.product.price.toFixed(2)}
            </span>
          )}

          <span
            className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${
              inStock
                ? "text-emerald-700 bg-emerald-50"
                : "text-neutral-500 bg-neutral-100"
            }`}
          >
            {inStock ? "In Stock" : "Out of Stock"}
          </span>
        </div>
      </div>
    </article>
  );
}

export default function StorefrontPage() {
  // Rendered cards & pagination
  const [images, setImages] = useState<ImageCardItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);

  // Loading States
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);
  const [isCommittingBatch, setIsCommittingBatch] = useState<boolean>(false);
  const [isPrefetching, setIsPrefetching] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  // Filters & Search
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());

  // Diagnostics & Queue UI State
  const [metrics, setMetrics] = useState<BatchMetric[]>([]);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [prefetchedBatchInfo, setPrefetchedBatchInfo] = useState<{ page: number; count: number } | null>(null);

  // Refs for continuous rolling preload queue & observer control
  const isMountedRef = useRef<boolean>(true);
  const isFetchingInitialRef = useRef<boolean>(false);
  const isPrefetchingRef = useRef<boolean>(false);
  const isCommittingRef = useRef<boolean>(false);
  const userRequestedNextBatchRef = useRef<boolean>(false);
  const prefetchedBatchRef = useRef<PrefetchedBatch | null>(null);
  const currentPrefetchPromiseRef = useRef<Promise<PrefetchedBatch | null> | null>(null);
  const commitNextBatchRef = useRef<(() => Promise<void>) | null>(null);
  const pageRef = useRef<number>(1);
  const hasMoreRef = useRef<boolean>(false);
  const observerSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Sync state refs to avoid stale closures in IntersectionObserver
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  /**
   * Proactively prefetch the next batch of 12 images in the background.
   * Runs Supabase query and triggers background image preloading so cards are ready
   * in memory before the user scrolls to them.
   */
  const prefetchBatch = useCallback(
    async (targetPage: number) => {
      if (
        !hasMoreRef.current ||
        isPrefetchingRef.current ||
        prefetchedBatchRef.current?.page === targetPage
      ) {
        return;
      }

      isPrefetchingRef.current = true;
      if (isMountedRef.current) {
        setIsPrefetching(true);
      }

      const from = (targetPage - 1) * BATCH_SIZE;
      const to = from + BATCH_SIZE - 1;

      const promise = (async () => {
        try {
          const client = getSupabaseClient();
          let query = client
            .from("product_images")
            .select(
              `
              id,
              storage_path,
              alt_text,
              display_order,
              is_primary,
              color,
              created_at,
              product:products!inner (
                id,
                name,
                slug,
                description,
                price,
                sale_price,
                category,
                status,
                product_variants (
                  id,
                  size,
                  color,
                  stock_quantity,
                  is_available
                )
              )
            `,
              { count: "exact" }
            )
            .eq("product.status", "published")
            .order("created_at", { ascending: false })
            .order("display_order", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to);

          if (selectedCategory !== "All") {
            query = query.eq("product.category", selectedCategory);
          }

          if (searchQuery.trim() !== "") {
            query = query.ilike("product.name", `%${searchQuery.trim()}%`);
          }

          const tMetaStart = performance.now();
          const { data, count, error } = await query;
          const metaDurationMs = Math.round(performance.now() - tMetaStart);

          if (error) {
            throw new Error(error.message || "Failed to prefetch next batch.");
          }

          if (!isMountedRef.current) return null;

          type RawImageRow = {
            id: string;
            storage_path: string;
            alt_text: string | null;
            display_order: number;
            is_primary: boolean;
            color: string | null;
            created_at: string;
            product: ImageParentProduct | ImageParentProduct[];
          };

          const formatted: ImageCardItem[] = ((data as unknown as RawImageRow[]) || []).map((item) => {
            const rawProd = Array.isArray(item.product) ? item.product[0] : item.product;
            const parentProduct: ImageParentProduct = {
              id: rawProd.id,
              name: rawProd.name,
              slug: rawProd.slug,
              description: rawProd.description,
              price: Number(rawProd.price),
              sale_price: rawProd.sale_price !== null ? Number(rawProd.sale_price) : null,
              category: rawProd.category,
              status: rawProd.status,
              product_variants: rawProd.product_variants,
            };

            return {
              id: item.id,
              storage_path: item.storage_path,
              alt_text: item.alt_text,
              display_order: item.display_order,
              is_primary: item.is_primary,
              color: item.color,
              created_at: item.created_at,
              proxyUrl: `/api/images/${item.storage_path}`,
              product: parentProduct,
            };
          });

          const total = count ?? 0;
          const batchResult: PrefetchedBatch = {
            page: targetPage,
            items: formatted,
            totalCount: total,
            metaDurationMs,
          };

          prefetchedBatchRef.current = batchResult;
          if (isMountedRef.current) {
            setPrefetchedBatchInfo({ page: targetPage, count: formatted.length });
          }

          // Start bounded background image preloading for this batch
          preloadBatchImagesInBackground(formatted);

          return batchResult;
        } catch (err: unknown) {
          if (isMountedRef.current) {
            console.warn("[prefetchBatch] Error prefetching batch:", err);
          }
          return null;
        } finally {
          isPrefetchingRef.current = false;
          if (isMountedRef.current) {
            setIsPrefetching(false);
          }
          currentPrefetchPromiseRef.current = null;
        }
      })();

      currentPrefetchPromiseRef.current = promise;
      const result = await promise;

      // If the user's scroll position reached the sentinel while fetching was in flight, commit immediately!
      if (
        userRequestedNextBatchRef.current &&
        result &&
        result.items.length > 0 &&
        isMountedRef.current
      ) {
        commitNextBatchRef.current?.();
      }
    },
    [selectedCategory, searchQuery]
  );

  /**
   * Appends the prepared next batch of cards to the grid and immediately
   * triggers prefetching of the following batch to maintain a continuous cycle.
   */
  const commitNextBatch = useCallback(async () => {
    if (isCommittingRef.current || !hasMoreRef.current) return;

    // 1. FAST PATH: If batch is already prefetched and ready in memory, commit instantly with 0ms wait!
    if (prefetchedBatchRef.current) {
      const batch = prefetchedBatchRef.current;
      prefetchedBatchRef.current = null;
      setPrefetchedBatchInfo(null);
      userRequestedNextBatchRef.current = false;
      isCommittingRef.current = true;

      setImages((prev) => {
        const existingIds = new Set(prev.map((img) => img.id));
        const fresh = batch.items.filter((img) => !existingIds.has(img.id));
        return [...prev, ...fresh];
      });

      const newPage = batch.page;
      const moreAvailable =
        newPage * BATCH_SIZE < batch.totalCount && batch.items.length === BATCH_SIZE;

      setPage(newPage);
      pageRef.current = newPage;
      setHasMore(moreAvailable);
      hasMoreRef.current = moreAvailable;
      setTotalCount(batch.totalCount);
      setIsCommittingBatch(false);
      setLoadMoreError(null);
      isCommittingRef.current = false;

      // Record performance metric
      const metric: BatchMetric = {
        batchNumber: newPage,
        imageCount: batch.items.length,
        metaDurationMs: batch.metaDurationMs,
        preloadDurationMs: 0,
        totalDurationMs: 0,
        successfulCount: batch.items.length,
        failedCount: 0,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMetrics((prev) => [...prev, metric]);

      // CONTINUOUS CYCLE: Immediately trigger background prefetch of next batch!
      if (moreAvailable) {
        prefetchBatch(newPage + 1);
      }
      return;
    }

    // 2. IN-FLIGHT PATH: If prefetch is currently resolving, await it and show subtle indicator
    if (currentPrefetchPromiseRef.current) {
      userRequestedNextBatchRef.current = true;
      setIsCommittingBatch(true);
      setLoadMoreError(null);

      const batch = await currentPrefetchPromiseRef.current;
      if (batch && batch.items.length > 0 && isMountedRef.current) {
        prefetchedBatchRef.current = null;
        setPrefetchedBatchInfo(null);
        userRequestedNextBatchRef.current = false;
        isCommittingRef.current = true;

        setImages((prev) => {
          const existingIds = new Set(prev.map((img) => img.id));
          const fresh = batch.items.filter((img) => !existingIds.has(img.id));
          return [...prev, ...fresh];
        });

        const newPage = batch.page;
        const moreAvailable =
          newPage * BATCH_SIZE < batch.totalCount && batch.items.length === BATCH_SIZE;

        setPage(newPage);
        pageRef.current = newPage;
        setHasMore(moreAvailable);
        hasMoreRef.current = moreAvailable;
        setTotalCount(batch.totalCount);
        setIsCommittingBatch(false);
        isCommittingRef.current = false;

        const metric: BatchMetric = {
          batchNumber: newPage,
          imageCount: batch.items.length,
          metaDurationMs: batch.metaDurationMs,
          preloadDurationMs: 0,
          totalDurationMs: 0,
          successfulCount: batch.items.length,
          failedCount: 0,
          timestamp: new Date().toLocaleTimeString(),
        };
        setMetrics((prev) => [...prev, metric]);

        // CONTINUOUS CYCLE: Immediately trigger background prefetch of following batch!
        if (moreAvailable) {
          prefetchBatch(newPage + 1);
        }
      } else {
        setIsCommittingBatch(false);
      }
      return;
    }

    // 3. IDLE PATH: If neither prefetched nor in-flight, initiate prefetch and commit when done
    userRequestedNextBatchRef.current = true;
    setIsCommittingBatch(true);
    setLoadMoreError(null);
    prefetchBatch(pageRef.current + 1);
  }, [prefetchBatch]);

  useEffect(() => {
    commitNextBatchRef.current = commitNextBatch;
  }, [commitNextBatch]);

  // Initial load: queries first 12 images, reveals them, and immediately triggers background prefetch of batch #2
  useEffect(() => {
    let ignore = false;
    isFetchingInitialRef.current = true;
    userRequestedNextBatchRef.current = false;
    prefetchedBatchRef.current = null;
    currentPrefetchPromiseRef.current = null;

    async function loadInitial() {
      setIsLoadingInitial(true);
      setErrorMessage(null);
      setLoadMoreError(null);

      const tStart = performance.now();

      try {
        const client = getSupabaseClient();
        let query = client
          .from("product_images")
          .select(
            `
            id,
            storage_path,
            alt_text,
            display_order,
            is_primary,
            color,
            created_at,
            product:products!inner (
              id,
              name,
              slug,
              description,
              price,
              sale_price,
              category,
              status,
              product_variants (
                id,
                size,
                color,
                stock_quantity,
                is_available
              )
            )
          `,
            { count: "exact" }
          )
          .eq("product.status", "published")
          .order("created_at", { ascending: false })
          .order("display_order", { ascending: true })
          .order("id", { ascending: true })
          .range(0, BATCH_SIZE - 1);

        if (selectedCategory !== "All") {
          query = query.eq("product.category", selectedCategory);
        }

        if (searchQuery.trim() !== "") {
          query = query.ilike("product.name", `%${searchQuery.trim()}%`);
        }

        const tMetaStart = performance.now();
        const { data, count, error } = await query;
        const metaDurationMs = Math.round(performance.now() - tMetaStart);

        if (error) {
          throw new Error(error.message || "Failed to retrieve image catalogue.");
        }

        if (ignore) return;

        type RawImageRow = {
          id: string;
          storage_path: string;
          alt_text: string | null;
          display_order: number;
          is_primary: boolean;
          color: string | null;
          created_at: string;
          product: ImageParentProduct | ImageParentProduct[];
        };

        const formatted: ImageCardItem[] = ((data as unknown as RawImageRow[]) || []).map((item) => {
          const rawProd = Array.isArray(item.product) ? item.product[0] : item.product;
          const parentProduct: ImageParentProduct = {
            id: rawProd.id,
            name: rawProd.name,
            slug: rawProd.slug,
            description: rawProd.description,
            price: Number(rawProd.price),
            sale_price: rawProd.sale_price !== null ? Number(rawProd.sale_price) : null,
            category: rawProd.category,
            status: rawProd.status,
            product_variants: rawProd.product_variants,
          };

          return {
            id: item.id,
            storage_path: item.storage_path,
            alt_text: item.alt_text,
            display_order: item.display_order,
            is_primary: item.is_primary,
            color: item.color,
            created_at: item.created_at,
            proxyUrl: `/api/images/${item.storage_path}`,
            product: parentProduct,
          };
        });

        const total = count || 0;
        const moreAvailable = BATCH_SIZE < total && formatted.length === BATCH_SIZE;

        setTotalCount(total);
        setHasMore(moreAvailable);
        hasMoreRef.current = moreAvailable;
        setPage(1);
        pageRef.current = 1;

        // Reveal initial 12 cards together
        setImages(formatted);
        setIsLoadingInitial(false);

        // Record initial metric
        const totalDurationMs = Math.round(performance.now() - tStart);
        const metric: BatchMetric = {
          batchNumber: 1,
          imageCount: formatted.length,
          metaDurationMs,
          preloadDurationMs: 0,
          totalDurationMs,
          successfulCount: formatted.length,
          failedCount: 0,
          timestamp: new Date().toLocaleTimeString(),
        };
        setMetrics([metric]);

        // Background preload initial images for instant render
        preloadBatchImagesInBackground(formatted);

        // CONTINUOUS CYCLE: Immediately trigger background prefetch of batch #2!
        if (moreAvailable) {
          prefetchBatch(2);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg =
            err instanceof Error
              ? err.message
              : "An unexpected error occurred while loading images.";
          setErrorMessage(msg);
          setIsLoadingInitial(false);
        }
      } finally {
        isFetchingInitialRef.current = false;
      }
    }

    loadInitial();

    return () => {
      ignore = true;
    };
  }, [selectedCategory, searchQuery, prefetchBatch]);

  // Infinite scroll IntersectionObserver with generous 1000px rootMargin
  useEffect(() => {
    if (isLoadingInitial || !hasMore) return;

    const sentinel = observerSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first && first.isIntersecting) {
          commitNextBatch();
        }
      },
      { rootMargin: "1000px", threshold: 0 }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [commitNextBatch, hasMore, isLoadingInitial]);

  function handleImageError(imageId: string) {
    setFailedImageIds((prev) => new Set(prev).add(imageId));
  }

  function handleRetryImage(imageId: string) {
    setFailedImageIds((prev) => {
      const next = new Set(prev);
      next.delete(imageId);
      return next;
    });
  }

  const categories = ["All", "Men", "Women", "Unisex", "Accessories"];

  return (
    <div className="space-y-10">
      {/* Editorial Collection Banner */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 text-white p-8 sm:p-12 shadow-sm">
        <div className="max-w-2xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-neutral-200 text-xs tracking-wider uppercase font-medium">
            Visual Catalogue Feed
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Curated Clothing Collection
          </h1>
          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            Browse our complete visual archive of individual garment imagery. Every image card is
            delivered privately through Cloudflare R2 with live product inventory, background prefetching, and continuous infinite scrolling.
          </p>
        </div>

        {/* Subtle decorative geometric background shape */}
        <div className="absolute -right-16 -bottom-24 w-80 h-80 rounded-full bg-white/5 blur-2xl pointer-events-none" />
      </section>

      {/* Main Image Catalogue Feed Section */}
      <section className="space-y-6">
        {/* Section Header, Search, Diagnostics Toggle & Filter Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">
                Image Feed
              </h2>
              <button
                type="button"
                onClick={() => setShowDiagnostics((prev) => !prev)}
                className="text-[11px] font-mono font-medium px-2.5 py-1 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-300 transition-colors cursor-pointer"
                title="Toggle Batch Loading & Cloudflare Optimization Diagnostics"
              >
                {showDiagnostics ? "Hide Diagnostics" : "📊 Feed Diagnostics"}
              </button>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              {totalCount > 0
                ? `Showing ${images.length} of ${totalCount} styles (12 per batch • proactive preloading)`
                : "Continuous catalogue feed"}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <input
                type="text"
                placeholder="Search styles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-white border border-neutral-300 rounded-lg pl-8 pr-3 py-2 text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
              />
              <svg
                className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-neutral-900 text-white shadow-xs"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Diagnostics Drawer */}
        {showDiagnostics && (
          <div className="p-4 rounded-xl bg-neutral-900 text-neutral-100 space-y-3 shadow-md font-mono text-xs">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="font-bold text-emerald-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Rolling Preload Diagnostics
              </span>
              <span className="text-[10px] text-neutral-400">
                Storage: Private Cloudflare R2 • Background Prefetching Active
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
              <div className="bg-neutral-800/80 p-2.5 rounded-lg">
                <span className="text-neutral-400 block text-[10px]">Delivered Cards</span>
                <span className="text-base font-bold text-white">{images.length} / {totalCount}</span>
              </div>
              <div className="bg-neutral-800/80 p-2.5 rounded-lg">
                <span className="text-neutral-400 block text-[10px]">Rolling Preload Queue</span>
                <span className="text-base font-bold text-sky-400">
                  {hasMore
                    ? isPrefetching
                      ? "Fetching Next Batch..."
                      : prefetchedBatchInfo
                      ? `Batch #${prefetchedBatchInfo.page} Ready`
                      : "Queued"
                    : "Catalogue Complete"}
                </span>
              </div>
              <div className="bg-neutral-800/80 p-2.5 rounded-lg">
                <span className="text-neutral-400 block text-[10px]">Trigger Margin</span>
                <span className="text-base font-bold text-emerald-400">1000px (Early)</span>
              </div>
              <div className="bg-neutral-800/80 p-2.5 rounded-lg">
                <span className="text-neutral-400 block text-[10px]">Cache Strategy</span>
                <span className="text-base font-bold text-emerald-400">Immutable (1yr)</span>
              </div>
            </div>

            {metrics.length > 0 && (
              <div className="overflow-x-auto pt-1">
                <table className="w-full text-left text-[11px] text-neutral-300">
                  <thead className="text-[10px] uppercase text-neutral-500 border-b border-neutral-800">
                    <tr>
                      <th className="py-1">Batch</th>
                      <th className="py-1">Cards</th>
                      <th className="py-1">Metadata Duration</th>
                      <th className="py-1">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/50">
                    {metrics.map((m) => (
                      <tr key={m.batchNumber}>
                        <td className="py-1 font-semibold text-white">#{m.batchNumber}</td>
                        <td className="py-1">{m.imageCount}</td>
                        <td className="py-1">{m.metaDurationMs}ms</td>
                        <td className="py-1 text-emerald-400">
                          {m.batchNumber === 1 ? "✓ Initial batch" : "✓ Seamless prefetch commit"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Initial Loading State: spinner for first 12 cards */}
        {isLoadingInitial && (
          <div className="py-24 flex flex-col items-center justify-center text-center space-y-4">
            <div className="relative flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-neutral-900/10 motion-safe:animate-ping opacity-30" />
              <div className="absolute w-12 h-12 border-3 border-neutral-200 border-t-neutral-900 rounded-full motion-safe:animate-spin" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-neutral-900 tracking-tight">
                Preparing Curated Catalogue...
              </p>
              <p className="text-xs text-neutral-500">
                Fetching initial collection from Supabase & Cloudflare R2
              </p>
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {errorMessage && !isLoadingInitial && (
          <div className="p-6 rounded-2xl border border-rose-200 bg-rose-50 text-center space-y-3">
            <div className="inline-flex items-center gap-2 text-rose-800 font-semibold text-sm">
              <span className="w-2 h-2 rounded-full bg-rose-600" />
              Failed to load catalogue feed
            </div>
            <p className="text-xs text-rose-700 max-w-md mx-auto">{errorMessage}</p>
            <button
              type="button"
              onClick={() => {
                setIsLoadingInitial(true);
                setErrorMessage(null);
                setPage(1);
              }}
              className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Retry Loading Feed
            </button>
          </div>
        )}

        {/* Empty Search / Filter State */}
        {!isLoadingInitial && !errorMessage && images.length === 0 && (
          <div className="py-20 text-center space-y-3 border border-neutral-200 rounded-2xl bg-neutral-50/50">
            <p className="text-sm font-semibold text-neutral-700">No images match your filter.</p>
            <p className="text-xs text-neutral-500">
              Try selecting a different category or clearing your search query.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("All");
                setSearchQuery("");
              }}
              className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg text-xs font-semibold hover:bg-white transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Responsive Image Feed Grid */}
        {!isLoadingInitial && images.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {images.map((item) => (
              <CatalogueImageCard
                key={item.id}
                item={item}
                isImageBroken={failedImageIds.has(item.id)}
                onImageError={handleImageError}
                onRetryImage={handleRetryImage}
              />
            ))}
          </div>
        )}

        {/* Subtle Fallback Loading Indicator (only visible if user outpaces network) */}
        {isCommittingBatch && (
          <div
            role="status"
            aria-live="polite"
            className="py-8 flex flex-col items-center justify-center text-center space-y-2.5 transition-opacity duration-200"
          >
            <div className="relative flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-neutral-900/10 motion-safe:animate-ping opacity-25" />
              <div className="absolute w-7 h-7 border-2 border-neutral-200 border-t-neutral-900 rounded-full motion-safe:animate-spin" />
            </div>
            <p className="text-xs font-medium text-neutral-600">
              Loading next styles...
            </p>
          </div>
        )}

        {/* Load More Error State with Retry Button */}
        {loadMoreError && (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-center space-y-2">
            <p className="text-xs text-rose-800 font-medium">{loadMoreError}</p>
            <button
              type="button"
              onClick={() => commitNextBatch()}
              className="px-3.5 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Retry Loading Next Batch
            </button>
          </div>
        )}

        {/* Sentinel element for infinite scroll observer (1000px rootMargin triggers 2 viewports ahead) */}
        {hasMore && (
          <div
            ref={observerSentinelRef}
            className="h-4 w-full pointer-events-none"
            aria-hidden="true"
          />
        )}

        {/* End of Feed Message */}
        {!isLoadingInitial && !hasMore && images.length > 0 && (
          <div className="text-center py-8 border-t border-neutral-200">
            <p className="text-xs text-neutral-500 font-medium">
              ✓ You&apos;ve viewed all {totalCount} images in the collection
            </p>
          </div>
        )}
      </section>

      {/* Architecture Verification Footer Banner */}
      <section className="border border-neutral-200 rounded-xl bg-neutral-100/70 p-5 text-xs text-neutral-600 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-neutral-800">
            Storefront Continuous Image Feed Active
          </p>
          <p className="text-neutral-500 text-[11px] mt-0.5">
            Single continuous infinite-scroll catalogue. Images delivered from private Cloudflare R2 with background prefetching and rolling preload queue.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-xs text-neutral-800 font-medium hover:underline shrink-0"
        >
          Manage Catalog in Admin →
        </Link>
      </section>
    </div>
  );
}
