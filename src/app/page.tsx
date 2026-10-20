"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";

const BATCH_SIZE = 12;
const BATCH_TIMEOUT_MS = 8000;

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

/**
 * Preloads and decodes an image URL using the browser's native Image and decode() API.
 * Ensures that pixels are decompressed in memory before the card is mounted into the DOM,
 * eliminating individual image flash/pop-in.
 */
function preloadAndDecodeImage(
  url: string,
  timeoutMs = 6000
): Promise<{ success: boolean; durationMs: number }> {
  return new Promise((resolve) => {
    const start = performance.now();
    let settled = false;

    const cleanup = (success: boolean) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ success, durationMs: Math.round(performance.now() - start) });
      }
    };

    const timer = setTimeout(() => {
      cleanup(false);
    }, timeoutMs);

    const img = new Image();

    const tryDecode = async () => {
      if (typeof img.decode === "function") {
        try {
          await Promise.race([
            img.decode(),
            new Promise((r) => setTimeout(r, 800)),
          ]);
        } catch {
          // Decode error or timeout — bytes are already downloaded
        }
      }
      cleanup(true);
    };

    img.onload = tryDecode;
    img.onerror = () => {
      console.warn("[preload] Image onerror triggered for:", url);
      cleanup(false);
    };

    // Set src AFTER attaching handlers
    img.src = url;

    // Fast-path if image was already cached synchronously
    if (img.complete && img.naturalWidth > 0) {
      tryDecode();
    }
  });
}

export default function StorefrontPage() {
  const [images, setImages] = useState<ImageCardItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);

  // Coordinated Batch Loading States
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ loaded: number; total: number }>({
    loaded: 0,
    total: 0,
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  // Filters & Search
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());

  // Performance Diagnostics
  const [metrics, setMetrics] = useState<BatchMetric[]>([]);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);

  // Guards against concurrent duplicate requests & stale batch updates
  const isFetchingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const observerSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  function logDebug(msg: string, data?: unknown) {
    if (typeof window !== "undefined") {
      const win = window as unknown as { __debug_logs?: Array<{ time: number; msg: string; data?: unknown }> };
      win.__debug_logs = win.__debug_logs || [];
      win.__debug_logs.push({ time: Date.now(), msg, data });
    }
    console.log(msg, data);
  }

  // Initial load: queries first 12 images, preloads them, and reveals them together
  useEffect(() => {
    let ignore = false;
    isFetchingRef.current = false;

    async function loadInitial() {
      setIsLoadingInitial(true);
      setErrorMessage(null);
      setBatchProgress({ loaded: 0, total: BATCH_SIZE });
      logDebug("[loadInitial] Starting...");

      const tStart = performance.now();

      try {
        const client = getSupabaseClient();
        logDebug("[loadInitial] Supabase client obtained");
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

        console.log("[loadInitial] Executing Supabase query...");
        const tMetaStart = performance.now();
        const { data, count, error } = await query;
        const metaDurationMs = Math.round(performance.now() - tMetaStart);
        console.log("[loadInitial] Query result:", { count, dataLength: data?.length, error });

        if (error) {
          throw new Error(error.message || "Failed to retrieve image catalogue.");
        }

        if (ignore) {
          console.log("[loadInitial] Ignored due to cleanup/strictmode");
          return;
        }

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
            // Secure direct URL via private R2 proxy
            proxyUrl: `/api/images/${item.storage_path}`,
            product: parentProduct,
          };
        });

        // Preload & decode images concurrently before initial reveal
        const tPreloadStart = performance.now();
        let loaded = 0;
        setBatchProgress({ loaded: 0, total: formatted.length });

        const preloadPromises = formatted.map(async (item) => {
          const res = await preloadAndDecodeImage(item.proxyUrl, BATCH_TIMEOUT_MS);
          loaded++;
          if (!ignore) {
            setBatchProgress({ loaded, total: formatted.length });
          }
          return { id: item.id, success: res.success };
        });

        const preloadResults = await Promise.all(preloadPromises);
        const preloadDurationMs = Math.round(performance.now() - tPreloadStart);

        if (ignore) return;

        const failed = preloadResults.filter((r) => !r.success).map((r) => r.id);
        if (failed.length > 0) {
          setFailedImageIds(new Set(failed));
        }

        const total = count || 0;
        setTotalCount(total);
        setHasMore(BATCH_SIZE < total);
        setPage(1);

        // Coordinated reveal of all 12 initial cards together in a single state update
        setImages(formatted);
        logDebug("[loadInitial] Revealed initial 12 cards!");

        const totalDurationMs = Math.round(performance.now() - tStart);
        const metric: BatchMetric = {
          batchNumber: 1,
          imageCount: formatted.length,
          metaDurationMs,
          preloadDurationMs,
          totalDurationMs,
          successfulCount: formatted.length - failed.length,
          failedCount: failed.length,
          timestamp: new Date().toLocaleTimeString(),
        };
        setMetrics([metric]);
        console.log("[Style_Edit Coordinated Batch]", metric);
      } catch (err: unknown) {
        logDebug("[loadInitial] Error caught:", err);
        if (!ignore) {
          const msg =
            err instanceof Error
              ? err.message
              : "An unexpected error occurred while loading images.";
          setErrorMessage(msg);
        }
      } finally {
        logDebug("[loadInitial] finally block reached, ignore:", ignore);
        if (!ignore) {
          setIsLoadingInitial(false);
        }
      }
    }

    loadInitial();

    return () => {
      ignore = true;
    };
  }, [selectedCategory, searchQuery]);

  // Fetch and coordinate subsequent batches of 12 images
  const fetchNextBatch = useCallback(async () => {
    if (isFetchingRef.current || isLoadingMore || !hasMore) return;

    isFetchingRef.current = true;
    setIsLoadingMore(true);
    setLoadMoreError(null);
    setBatchProgress({ loaded: 0, total: BATCH_SIZE });

    const tStart = performance.now();
    const nextPage = page + 1;
    const from = (nextPage - 1) * BATCH_SIZE;
    const to = from + BATCH_SIZE - 1;

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
        throw new Error(error.message || "Failed to retrieve next batch of images.");
      }

      if (!isMountedRef.current) return;

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

      // Keep newly loaded cards HIDDEN while preloading and decoding in memory
      const tPreloadStart = performance.now();
      let loaded = 0;
      setBatchProgress({ loaded: 0, total: formatted.length });

      const preloadPromises = formatted.map(async (item) => {
        const res = await preloadAndDecodeImage(item.proxyUrl, BATCH_TIMEOUT_MS);
        loaded++;
        if (isMountedRef.current) {
          setBatchProgress({ loaded, total: formatted.length });
        }
        return { id: item.id, success: res.success };
      });

      const preloadResults = await Promise.all(preloadPromises);
      const preloadDurationMs = Math.round(performance.now() - tPreloadStart);

      if (!isMountedRef.current) return;

      // Check failed or timed-out images
      const failed = preloadResults.filter((r) => !r.success).map((r) => r.id);
      if (failed.length > 0) {
        setFailedImageIds((prev) => {
          const next = new Set(prev);
          failed.forEach((id) => next.add(id));
          return next;
        });
      }

      // Minimum display guard (250ms) to prevent visual flash on instant cache hits
      const elapsed = performance.now() - tStart;
      if (elapsed < 250) {
        await new Promise((r) => setTimeout(r, 250 - elapsed));
      }

      const total = count || 0;
      setTotalCount(total);
      setHasMore(to < total - 1);
      setPage(nextPage);

      // CO-ORDINATED REVEAL: Append all 12 images together in a single state update!
      setImages((prev) => {
        const existingIds = new Set(prev.map((img) => img.id));
        const fresh = formatted.filter((img) => !existingIds.has(img.id));
        return [...prev, ...fresh];
      });

      const totalDurationMs = Math.round(performance.now() - tStart);
      const metric: BatchMetric = {
        batchNumber: nextPage,
        imageCount: formatted.length,
        metaDurationMs,
        preloadDurationMs,
        totalDurationMs,
        successfulCount: formatted.length - failed.length,
        failedCount: failed.length,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMetrics((prev) => [...prev, metric]);
      console.log("[Style_Edit Coordinated Batch]", metric);
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const msg =
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while loading more images.";
        setLoadMoreError(msg);
      }
    } finally {
      isFetchingRef.current = false;
      setIsLoadingMore(false);
    }
  }, [page, hasMore, isLoadingMore, selectedCategory, searchQuery]);

  // Infinite scroll IntersectionObserver with 250px rootMargin
  useEffect(() => {
    if (isLoadingInitial || isLoadingMore || !hasMore) return;

    const sentinel = observerSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first && first.isIntersecting && !isFetchingRef.current) {
          fetchNextBatch();
        }
      },
      { rootMargin: "250px", threshold: 0.1 }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [fetchNextBatch, hasMore, isLoadingInitial, isLoadingMore]);

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
            delivered privately through Cloudflare R2 with live product inventory, responsive WebP/AVIF optimization, and coordinated 12-image batch loading.
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
                className="text-[11px] font-mono font-medium px-2.5 py-1 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-300 transition-colors"
                title="Toggle Batch Loading & Cloudflare Optimization Diagnostics"
              >
                {showDiagnostics ? "Hide Diagnostics" : "📊 Batch Diagnostics"}
              </button>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              {totalCount > 0
                ? `Showing ${images.length} of ${totalCount} styles (12 per batch)`
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
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
                Live Batch & Delivery Diagnostics
              </span>
              <span className="text-[10px] text-neutral-400">
                Storage: Private Cloudflare R2 • Client Pre-Compressed • Immutable Cache
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
              <div className="bg-neutral-800/80 p-2.5 rounded-lg">
                <span className="text-neutral-400 block text-[10px]">Delivered Cards</span>
                <span className="text-base font-bold text-white">{images.length} / {totalCount}</span>
              </div>
              <div className="bg-neutral-800/80 p-2.5 rounded-lg">
                <span className="text-neutral-400 block text-[10px]">Pipeline Mode</span>
                <span className="text-base font-bold text-sky-400">R2 Direct Proxy</span>
              </div>
              <div className="bg-neutral-800/80 p-2.5 rounded-lg">
                <span className="text-neutral-400 block text-[10px]">Target Asset Size</span>
                <span className="text-base font-bold text-emerald-400">1–2 MB / img</span>
              </div>
              <div className="bg-neutral-800/80 p-2.5 rounded-lg">
                <span className="text-neutral-400 block text-[10px]">Browser Cache</span>
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
                      <th className="py-1">Metadata Query</th>
                      <th className="py-1">Preload & Decode</th>
                      <th className="py-1">Total Wait</th>
                      <th className="py-1">Success / Fail</th>
                      <th className="py-1">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/50">
                    {metrics.map((m) => (
                      <tr key={m.batchNumber}>
                        <td className="py-1 font-semibold text-white">#{m.batchNumber}</td>
                        <td className="py-1">{m.imageCount}</td>
                        <td className="py-1">{m.metaDurationMs}ms</td>
                        <td className="py-1">{m.preloadDurationMs}ms</td>
                        <td className="py-1 text-emerald-300 font-semibold">{m.totalDurationMs}ms</td>
                        <td className="py-1">
                          <span className="text-emerald-400">{m.successfulCount}</span>
                          {m.failedCount > 0 && (
                            <span className="text-rose-400 ml-1">({m.failedCount} err)</span>
                          )}
                        </td>
                        <td className="py-1 text-emerald-400">✓ Revealed together</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Initial Loading State: Coordinated batch preparation spinner */}
        {isLoadingInitial && (
          <div className="py-24 flex flex-col items-center justify-center text-center space-y-4">
            <div className="relative flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-neutral-900/10 motion-safe:animate-ping opacity-30" />
              <div className="absolute w-12 h-12 border-3 border-neutral-200 border-t-neutral-900 rounded-full motion-safe:animate-spin" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-neutral-900 tracking-tight">
                Preparing Initial Styles...
              </p>
              <p className="text-xs font-mono text-neutral-500">
                {batchProgress.total > 0
                  ? `Loading & decoding images ${batchProgress.loaded} of ${batchProgress.total}`
                  : "Connecting to Cloudflare R2 archive"}
              </p>
            </div>
          </div>
        )}

        {/* Global Initial Error */}
        {errorMessage && !isLoadingInitial && (
          <div className="p-6 rounded-xl border border-rose-200 bg-rose-50 text-center space-y-3">
            <p className="text-sm text-rose-800 font-medium">{errorMessage}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 transition-colors"
            >
              Reload Catalogue
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoadingInitial && !errorMessage && images.length === 0 && (
          <div className="text-center py-20 border border-dashed border-neutral-300 rounded-2xl bg-neutral-50/50 space-y-3">
            <p className="text-sm text-neutral-600 font-medium">
              No clothing images found matching your selection.
            </p>
            {(searchQuery || selectedCategory !== "All") && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory("All");
                  setSearchQuery("");
                }}
                className="inline-flex items-center px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg text-xs font-semibold hover:bg-neutral-50 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Individual Image Cards Grid: All cards rendered together without staggered pop-ins */}
        {!isLoadingInitial && !errorMessage && images.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {images.map((item) => {
              const hasDiscount =
                item.product.sale_price !== null &&
                item.product.price > 0 &&
                item.product.sale_price < item.product.price;

              const discountPercentage = hasDiscount
                ? Math.round(((item.product.price - item.product.sale_price!) / item.product.price) * 100)
                : null;

              const isImageBroken = failedImageIds.has(item.id);

              const totalStock = (item.product.product_variants || []).reduce(
                (acc, v) => acc + (v.stock_quantity || 0),
                0
              );
              const inStock = totalStock > 0;

              return (
                <article
                  key={item.id}
                  className="group bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-2xs hover:shadow-md transition-shadow duration-200 flex flex-col"
                >
                  {/* Image Container with Reserved 3:4 Aspect Ratio */}
                  <div className="relative w-full aspect-3/4 bg-neutral-100 overflow-hidden flex items-center justify-center">
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
                          onClick={() => handleRetryImage(item.id)}
                          className="text-[11px] text-neutral-900 font-semibold underline hover:text-black mt-1"
                        >
                          Retry Image
                        </button>
                      </div>
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.proxyUrl}
                        alt={item.alt_text || `${item.product.name} image ${item.display_order + 1}`}
                        loading="eager"
                        decoding="async"
                        onError={() => handleImageError(item.id)}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
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
            })}
          </div>
        )}

        {/* Polished Bottom Coordinated Batch Loading Indicator */}
        {isLoadingMore && (
          <div
            role="status"
            aria-live="polite"
            className="py-10 flex flex-col items-center justify-center text-center space-y-3.5"
          >
            <div className="relative flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-neutral-900/10 motion-safe:animate-ping opacity-25" />
              <div className="absolute w-10 h-10 border-2 border-neutral-200 border-t-neutral-900 rounded-full motion-safe:animate-spin" />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-semibold text-neutral-900 tracking-tight">
                Loading more styles...
              </p>
              <p className="text-xs font-mono text-neutral-500">
                {batchProgress.total > 0
                  ? `Preparing images ${batchProgress.loaded} of ${batchProgress.total}`
                  : "Fetching image batch metadata..."}
              </p>
            </div>

            {/* Smooth progress bar */}
            <div className="w-56 h-1.5 bg-neutral-100 rounded-full overflow-hidden border border-neutral-200/50">
              <div
                className="h-full bg-neutral-900 transition-all duration-150 ease-out"
                style={{
                  width: `${
                    batchProgress.total > 0
                      ? Math.min((batchProgress.loaded / batchProgress.total) * 100, 100)
                      : 10
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Load More Error State with Retry Button */}
        {loadMoreError && (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-center space-y-2">
            <p className="text-xs text-rose-800 font-medium">{loadMoreError}</p>
            <button
              type="button"
              onClick={fetchNextBatch}
              className="px-3.5 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 transition-colors"
            >
              Retry Loading Next Batch
            </button>
          </div>
        )}

        {/* Sentinel element for infinite scroll observer */}
        {hasMore && <div ref={observerSentinelRef} className="h-10 w-full" />}

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
            Storefront Image Feed Active
          </p>
          <p className="text-neutral-500 text-[11px] mt-0.5">
            Single continuous infinite-scroll catalogue. Images delivered from private Cloudflare R2 via Next.js proxy signed URLs with WebP/AVIF compression.
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
