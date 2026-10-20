"use client";

import { use, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { verifyAdminAuthorization, type AdminVerificationResult } from "@/lib/supabase/auth";
import type { Product, ProductVariant, ProductImage } from "@/types/product";

function ProductInspectContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(paramsPromise);
  const productId = resolvedParams.id;

  const [authStatus, setAuthStatus] = useState<AdminVerificationResult>({
    isAuthenticated: false,
    isAdmin: false,
    user: null,
  });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingProduct, setDeletingProduct] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);

  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const auth = await verifyAdminAuthorization();
        if (!isMounted) return;
        setAuthStatus(auth);

        if (!auth.isAdmin) {
          setLoading(false);
          return;
        }

        if (!productId) {
          setErrorMessage("No product ID specified in URL.");
          setLoading(false);
          return;
        }

        const client = getSupabaseClient();

        // 1. Fetch Product
        const { data: prodData, error: prodErr } = await client
          .from("products")
          .select("*")
          .eq("id", productId)
          .single();

        if (prodErr || !prodData) {
          setErrorMessage(prodErr?.message || "Product not found.");
          setLoading(false);
          return;
        }

        // 2. Fetch Variants
        const { data: varData } = await client
          .from("product_variants")
          .select("*")
          .eq("product_id", productId)
          .order("created_at", { ascending: true });

        // 3. Fetch Images
        const { data: imgData } = await client
          .from("product_images")
          .select("*")
          .eq("product_id", productId)
          .order("display_order", { ascending: true });

        // Resolve proxy URLs for private R2 image delivery (bucket remains private)
        const resolvedImages: ProductImage[] = (imgData || []).map((img: ProductImage) => ({
          ...img,
          proxyUrl: `/api/images/${img.storage_path}`,
        }));

        if (isMounted) {
          setProduct(prodData);
          setVariants(varData || []);
          setImages(resolvedImages);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setErrorMessage(err instanceof Error ? err.message : "Failed to load product.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [productId]);

  async function handleDeleteProduct() {
    if (!product) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${product.name}"? This will permanently delete the product, all variants, and all ${images.length} images from Cloudflare R2.`
    );
    if (!confirmed) return;

    setDeletingProduct(true);
    setActionError(null);

    try {
      const client = getSupabaseClient();
      const { data: sessionData } = await client.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "DELETE",
        headers,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned status ${res.status}`);
      }

      router.push("/admin");
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to delete product."
      );
      setDeletingProduct(false);
    }
  }

  async function handleDeleteImage(imageId: string) {
    const confirmed = window.confirm("Are you sure you want to delete this image from storage?");
    if (!confirmed) return;

    setDeletingImageId(imageId);
    setActionError(null);

    try {
      const client = getSupabaseClient();
      const { data: sessionData } = await client.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      const res = await fetch(`/api/admin/images/${imageId}`, {
        method: "DELETE",
        headers,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to delete image (status ${res.status})`);
      }

      setImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to delete image asset."
      );
    } finally {
      setDeletingImageId(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center text-xs text-neutral-500 font-mono">
        Loading product details from Supabase...
      </div>
    );
  }

  if (!authStatus.isAdmin) {
    return (
      <div className="max-w-md mx-auto bg-white border border-neutral-200 rounded-xl p-8 text-center space-y-3">
        <h1 className="text-lg font-bold text-neutral-900">Admin Authorization Required</h1>
        <p className="text-xs text-neutral-600">Please sign in as an authorized admin to inspect products.</p>
        <Link
          href="/admin/login"
          className="inline-block px-4 py-2 bg-neutral-900 text-white rounded-lg text-xs font-semibold"
        >
          Go to Admin Login →
        </Link>
      </div>
    );
  }

  if (errorMessage || !product) {
    return (
      <div className="max-w-md mx-auto bg-white border border-rose-200 rounded-xl p-8 text-center space-y-3">
        <h1 className="text-lg font-bold text-rose-900">Error Loading Product</h1>
        <p className="text-xs text-rose-700 font-mono">{errorMessage || "Product not found"}</p>
        <Link
          href="/admin"
          className="inline-block px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg text-xs"
        >
          ← Return to Admin
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-700 text-xs font-mono mb-2">
            Inspect Product
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            {product.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-neutral-500">
            <span>ID: <code className="font-mono text-neutral-800">{product.id}</code></span>
            <span>•</span>
            <span>Slug: <code className="font-mono text-neutral-800">{product.slug}</code></span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/admin/products/new"
            className="px-3 py-1.5 bg-neutral-900 text-white rounded-lg font-semibold hover:bg-neutral-800 transition-colors"
          >
            + Create New
          </Link>
          <button
            type="button"
            onClick={handleDeleteProduct}
            disabled={deletingProduct}
            className="px-3 py-1.5 border border-rose-300 text-rose-700 rounded-lg font-medium hover:bg-rose-50 transition-colors disabled:opacity-50"
          >
            {deletingProduct ? "Deleting..." : "Delete Product"}
          </button>
          <Link
            href="/admin"
            className="px-3 py-1.5 border border-neutral-300 text-neutral-700 rounded-lg font-medium hover:bg-neutral-50 transition-colors"
          >
            ← Admin
          </Link>
        </div>
      </div>

      {/* Action Error Banner */}
      {actionError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-800 flex items-center justify-between">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-rose-600 hover:text-rose-900 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Classification</span>
          <p className="text-sm font-medium text-neutral-900">{product.category}</p>
          <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${
            product.status === "published"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-neutral-100 text-neutral-700 border border-neutral-200"
          }`}>
            {product.status}
          </span>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Pricing</span>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-neutral-900">
              ${product.price.toFixed(2)}
            </span>
            {product.sale_price !== null && (
              <span className="text-sm text-emerald-600 font-medium">
                (Sale: ${product.sale_price.toFixed(2)})
              </span>
            )}
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-1">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Inventory</span>
          <p className="text-sm font-medium text-neutral-900">
            {variants.length} Variant(s)
          </p>
          <p className="text-xs text-neutral-500">
            Total Units: {variants.reduce((sum, v) => sum + v.stock_quantity, 0)}
          </p>
        </div>
      </div>

      {/* Description */}
      {product.description && (
        <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-xs space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-800">
            Description
          </h2>
          <p className="text-xs text-neutral-700 leading-relaxed whitespace-pre-line">
            {product.description}
          </p>
        </div>
      )}

      {/* Image Gallery */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-800">
            Image Gallery ({images.length})
          </h2>
          <span className="text-xs text-neutral-500">
            Bucket: <code className="font-mono">style-edit-products (private R2)</code>
          </span>
        </div>

        {images.length === 0 ? (
          <p className="text-xs text-neutral-500 italic">No images attached.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((img) => (
              <div
                key={img.id}
                className="border border-neutral-200 rounded-lg p-3 bg-neutral-50/50 space-y-2 flex flex-col"
              >
                <div className="w-full h-44 bg-white rounded-md overflow-hidden flex items-center justify-center border border-neutral-200">
                  {img.proxyUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={img.proxyUrl}
                      alt={img.alt_text || product.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-neutral-400">No preview</span>
                  )}
                </div>
                <div className="text-[11px] space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    {img.is_primary ? (
                      <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                        Primary
                      </span>
                    ) : (
                      <span className="text-[10px] text-neutral-500">Gallery</span>
                    )}
                    {img.color && (
                      <span className="text-[10px] bg-neutral-200 px-1.5 py-0.5 rounded text-neutral-700">
                        {img.color}
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[10px] text-neutral-500 truncate" title={img.storage_path}>
                    {img.storage_path}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-1">
                  {img.proxyUrl && (
                    <a
                      href={img.proxyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-[11px] block truncate"
                    >
                      View via proxy ↗
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteImage(img.id)}
                    disabled={deletingImageId === img.id}
                    className="text-rose-600 hover:text-rose-800 text-[11px] underline ml-auto disabled:opacity-50"
                  >
                    {deletingImageId === img.id ? "Deleting..." : "Delete image"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Variants Table */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-800">
          Variants Matrix ({variants.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500 font-semibold">
                <th className="py-2 px-3">Size</th>
                <th className="py-2 px-3">Color</th>
                <th className="py-2 px-3">SKU</th>
                <th className="py-2 px-3 text-right">Stock</th>
                <th className="py-2 px-3 text-center">Availability</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="py-2 px-3 font-semibold text-neutral-800">{v.size}</td>
                  <td className="py-2 px-3">{v.color}</td>
                  <td className="py-2 px-3 font-mono text-neutral-500">{v.sku || "—"}</td>
                  <td className="py-2 px-3 text-right font-medium">{v.stock_quantity}</td>
                  <td className="py-2 px-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                      v.is_available ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    }`}>
                      {v.is_available ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function ProductInspectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto p-12 text-center text-xs text-neutral-500 font-mono">
          Loading product inspector...
        </div>
      }
    >
      <ProductInspectContent paramsPromise={params} />
    </Suspense>
  );
}
