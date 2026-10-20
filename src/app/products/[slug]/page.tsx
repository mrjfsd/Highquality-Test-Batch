"use client";

import { use, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import ProductGallery from "@/components/ProductGallery";
import type { Product, ProductVariant, ProductImage } from "@/types/product";

interface CompleteDetailProduct extends Product {
  variants: ProductVariant[];
  primaryImage: {
    proxyUrl: string;
    altText: string;
  } | null;
}

function ProductDetailContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = use(paramsPromise);
  const decodedSlug = decodeURIComponent(rawSlug).trim();

  const [product, setProduct] = useState<CompleteDetailProduct | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProduct() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const client = getSupabaseClient();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decodedSlug);

        let query = client
          .from("products")
          .select(`
            id,
            name,
            slug,
            description,
            price,
            sale_price,
            category,
            status,
            created_at,
            updated_at,
            product_variants (
              id,
              product_id,
              size,
              color,
              sku,
              stock_quantity,
              is_available
            ),
            product_images (
              id,
              storage_path,
              alt_text,
              display_order,
              is_primary
            )
          `)
          .order("is_primary", { referencedTable: "product_images", ascending: false })
          .limit(1, { referencedTable: "product_images" });

        if (isUuid) {
          query = query.eq("id", decodedSlug);
        } else {
          query = query.eq("slug", decodedSlug);
        }

        const { data, error } = await query.maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        if (!data) {
          throw new Error("Product not found or is no longer available.");
        }

        if (data.status !== "published") {
          throw new Error("This product is currently in draft mode and not visible to customers.");
        }

        // Format primary image
        const rawImages = (data.product_images as unknown as ProductImage[]) || [];
        const primary = rawImages[0] || null;

        let primaryImage: { proxyUrl: string; altText: string } | null = null;
        if (primary?.storage_path) {
          primaryImage = {
            proxyUrl: `/api/images/${primary.storage_path}`,
            altText: primary.alt_text || data.name,
          };
        }

        const variants = (data.product_variants as unknown as ProductVariant[]) || [];

        const formatted: CompleteDetailProduct = {
          id: data.id,
          name: data.name,
          slug: data.slug,
          description: data.description,
          price: Number(data.price),
          sale_price: data.sale_price !== null ? Number(data.sale_price) : null,
          category: data.category,
          status: data.status,
          created_at: data.created_at,
          updated_at: data.updated_at,
          variants,
          primaryImage,
        };

        if (isMounted) {
          setProduct(formatted);
          if (variants.length > 0) {
            setSelectedSize(variants[0].size);
            setSelectedColor(variants[0].color);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg =
            err instanceof Error ? err.message : "Failed to load product details.";
          setErrorMessage(msg);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProduct();

    return () => {
      isMounted = false;
    };
  }, [decodedSlug]);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-8 animate-pulse py-6">
        <div className="h-4 w-48 bg-neutral-200 rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 aspect-square bg-neutral-200 rounded-2xl" />
          <div className="lg:col-span-5 space-y-4">
            <div className="h-4 w-24 bg-neutral-200 rounded" />
            <div className="h-8 w-3/4 bg-neutral-200 rounded" />
            <div className="h-6 w-32 bg-neutral-200 rounded" />
            <div className="h-24 w-full bg-neutral-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (errorMessage || !product) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white border border-neutral-200 rounded-2xl p-8 text-center space-y-4 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-neutral-900">Unable to view product</h1>
        <p className="text-xs text-neutral-600">{errorMessage || "Product not found."}</p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 transition-colors"
          >
            ← Return to Storefront
          </Link>
        </div>
      </div>
    );
  }

  const hasDiscount =
    product.sale_price !== null &&
    product.price > 0 &&
    product.sale_price < product.price;

  const discountPercentage = hasDiscount
    ? Math.round(((product.price - product.sale_price!) / product.price) * 100)
    : null;

  // Extract available sizes & colors
  const availableSizes = Array.from(new Set(product.variants.map((v) => v.size)));
  const availableColors = Array.from(new Set(product.variants.map((v) => v.color)));
  const totalStock = product.variants.reduce((acc, v) => acc + (v.stock_quantity || 0), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-4">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-neutral-500">
        <Link href="/" className="hover:text-neutral-900 transition-colors">
          Storefront
        </Link>
        <span>/</span>
        <span className="capitalize">{product.category}</span>
        <span>/</span>
        <span className="text-neutral-900 font-medium truncate max-w-xs">{product.name}</span>
      </nav>

      {/* Main Two-Column Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Column: Progressive Gallery */}
        <div className="lg:col-span-7">
          <ProductGallery
            key={product.id}
            productId={product.id}
            productName={product.name}
            initialPrimaryImage={product.primaryImage}
          />
        </div>

        {/* Right Column: Product Purchasing / Details Overview */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-2 border-b border-neutral-100 pb-5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-800 text-[10px] font-semibold uppercase tracking-wider">
                {product.category}
              </span>
              <span className="text-xs text-neutral-400 font-mono">
                /{product.slug}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
              {product.name}
            </h1>

            {/* Pricing Section */}
            <div className="pt-2 flex items-baseline gap-3">
              {hasDiscount ? (
                <>
                  <span className="text-2xl font-extrabold text-neutral-900">
                    ${product.sale_price!.toFixed(2)}
                  </span>
                  <span className="text-base text-neutral-400 line-through">
                    ${product.price.toFixed(2)}
                  </span>
                  <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                    Save {discountPercentage}%
                  </span>
                </>
              ) : (
                <span className="text-2xl font-extrabold text-neutral-900">
                  ${product.price.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="space-y-1">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-700">
                Description
              </h2>
              <p className="text-xs text-neutral-600 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}

          {/* Variants Selector */}
          <div className="space-y-4 border-t border-neutral-100 pt-5">
            {availableSizes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-800">Size:</span>
                  <span className="text-neutral-500 font-mono">{selectedSize}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableSizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        selectedSize === size
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-neutral-200 text-neutral-700 hover:border-neutral-400"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {availableColors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-800">Color:</span>
                  <span className="text-neutral-500">{selectedColor}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        selectedColor === color
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-neutral-200 text-neutral-700 hover:border-neutral-400"
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stock Availability */}
            <div className="flex items-center gap-2 text-xs text-neutral-600 pt-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  totalStock > 0 ? "bg-emerald-500" : "bg-neutral-300"
                }`}
              />
              <span>
                {totalStock > 0 ? (
                  <>
                    <strong className="text-neutral-900">In Stock</strong> ({totalStock} units available across variants)
                  </>
                ) : (
                  <span className="text-neutral-500">Currently out of stock</span>
                )}
              </span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="space-y-3 pt-4 border-t border-neutral-100">
            <button
              type="button"
              className="w-full py-3 bg-neutral-900 text-white rounded-xl text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-xs"
            >
              Add to Bag • ${hasDiscount ? product.sale_price!.toFixed(2) : product.price.toFixed(2)}
            </button>

            <div className="flex items-center justify-between text-xs text-neutral-500 pt-2">
              <Link href="/" className="hover:text-neutral-900 hover:underline">
                ← Continue Browsing
              </Link>
              <Link
                href={`/admin/products/${product.id}`}
                className="text-neutral-400 hover:text-neutral-700 text-[11px]"
              >
                Admin Inspector ↗
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto space-y-8 animate-pulse py-6">
          <div className="h-4 w-48 bg-neutral-200 rounded" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 aspect-square bg-neutral-200 rounded-2xl" />
            <div className="lg:col-span-5 space-y-4">
              <div className="h-4 w-24 bg-neutral-200 rounded" />
              <div className="h-8 w-3/4 bg-neutral-200 rounded" />
              <div className="h-6 w-32 bg-neutral-200 rounded" />
              <div className="h-24 w-full bg-neutral-200 rounded" />
            </div>
          </div>
        </div>
      }
    >
      <ProductDetailContent paramsPromise={params} />
    </Suspense>
  );
}
