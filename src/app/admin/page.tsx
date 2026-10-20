"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  verifyAdminAuthorization,
  type AdminVerificationResult,
} from "@/lib/supabase/auth";

interface AdminProductImage {
  id: string;
  storage_path: string;
  is_primary: boolean;
}

interface AdminProductItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  sale_price: number | null;
  category: string;
  status: "draft" | "published" | "archived";
  created_at: string;
  product_images?: AdminProductImage[];
  product_variants?: { id: string }[];
}

export default function AdminPage() {
  const [authStatus, setAuthStatus] = useState<AdminVerificationResult>({
    isAuthenticated: false,
    isAdmin: false,
    user: null,
  });
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  // Product Management State
  const [products, setProducts] = useState<AdminProductItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(false);
  const [productLoadError, setProductLoadError] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const result = await verifyAdminAuthorization();
        if (isMounted) {
          setAuthStatus(result);
        }
      } finally {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    }

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch catalog products when authorized
  useEffect(() => {
    if (!authStatus.isAdmin) return;

    let isMounted = true;

    async function loadProducts() {
      setLoadingProducts(true);
      setProductLoadError(null);
      try {
        const client = getSupabaseClient();
        const { data, error } = await client
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
            product_images (id, storage_path, is_primary),
            product_variants (id)
          `)
          .order("created_at", { ascending: false });

        if (error) {
          throw new Error(error.message);
        }

        if (isMounted) {
          setProducts((data as unknown as AdminProductItem[]) || []);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setProductLoadError(
            err instanceof Error ? err.message : "Failed to load products."
          );
        }
      } finally {
        if (isMounted) {
          setLoadingProducts(false);
        }
      }
    }

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [authStatus.isAdmin]);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      const client = getSupabaseClient();
      await client.auth.signOut();
      setAuthStatus({
        isAuthenticated: false,
        isAdmin: false,
        user: null,
      });
      setProducts([]);
    } finally {
      setIsLoggingOut(false);
    }
  }

  // Safe product deletion with confirmation
  async function handleDeleteProduct(product: AdminProductItem) {
    const imagesCount = product.product_images?.length || 0;
    const confirmed = window.confirm(
      `⚠️ Permanently delete product "${product.name}"?\n\nThis will remove:\n- Database product record\n- Associated variant records\n- All ${imagesCount} image object(s) from Cloudflare R2\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingProductId(product.id);
    setActionFeedback(null);

    try {
      const client = getSupabaseClient();
      const { data: sessionData } = await client.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "DELETE",
        headers,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Server returned status ${res.status}`);
      }

      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      setActionFeedback({
        type: "success",
        message: `Product "${product.name}" and all associated R2 assets were deleted successfully.`,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to delete product.";
      setActionFeedback({ type: "error", message });
    } finally {
      setDeletingProductId(null);
    }
  }

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.slug.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [products, searchQuery, statusFilter]);

  if (isChecking) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center text-xs text-neutral-500 font-mono">
        Verifying administrator authorization...
      </div>
    );
  }

  // Case 1: Unauthenticated or Unauthorized
  if (!authStatus.isAdmin) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white border border-neutral-200 rounded-xl p-8 shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">
              Administrator Access Required
            </h1>
            <p className="text-xs text-neutral-600 max-w-md mx-auto leading-relaxed">
              {authStatus.isAuthenticated
                ? "Your account is authenticated, but is not registered in the app_admins table or granted an admin role."
                : "You must be signed in with an authorized administrator account to access this management interface."}
            </p>
          </div>

          {authStatus.isAuthenticated && authStatus.user && (
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-xs text-neutral-600 max-w-md mx-auto text-left space-y-1">
              <p>
                <strong>User ID:</strong>{" "}
                <code className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-neutral-200">
                  {authStatus.user.id}
                </code>
              </p>
              <p>
                <strong>Email:</strong> {authStatus.user.email}
              </p>
              <p className="text-[11px] text-neutral-500 pt-1">
                To grant admin privileges, insert this User ID into{" "}
                <code className="font-mono">public.app_admins</code> in Supabase.
              </p>
            </div>
          )}

          <div className="flex items-center justify-center gap-3 pt-2">
            {!authStatus.isAuthenticated ? (
              <Link
                href="/admin/login"
                className="inline-flex items-center justify-center px-5 py-2.5 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 transition-colors"
              >
                Sign In as Administrator →
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="inline-flex items-center justify-center px-4 py-2 border border-rose-300 text-rose-700 rounded-lg text-xs font-semibold hover:bg-rose-50 transition-colors"
              >
                {isLoggingOut ? "Signing Out..." : "Sign Out Current Account"}
              </button>
            )}

            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2.5 border border-neutral-300 text-neutral-700 rounded-lg text-xs font-medium hover:bg-neutral-50 transition-colors"
            >
              ← Back to Storefront
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Authorized Administrator
  return (
    <div className="space-y-8">
      {/* Route Banner with Active Admin Status */}
      <section className="bg-white border border-neutral-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Authorized Administrator: {authStatus.user?.email || authStatus.user?.id}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              Admin Management Interface
            </h1>
            <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
              Manage clothing catalog products, variants, and Cloudflare R2 image assets with full server-verified authorization.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 text-neutral-700 rounded-lg text-xs font-medium hover:bg-neutral-100 transition-colors"
            >
              {isLoggingOut ? "Signing Out..." : "Sign Out"}
            </button>
          </div>
        </div>
      </section>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            actionFeedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                actionFeedback.type === "success" ? "bg-emerald-600" : "bg-rose-600"
              }`}
            />
            <span className="font-medium">{actionFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-neutral-500 hover:text-neutral-800 font-bold ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* Admin Quick Action Modules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Module 1: Product Creation */}
        <section className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <h2 className="text-base font-semibold text-neutral-800">
              Product Creation
            </h2>
            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-mono font-medium">
              Active
            </span>
          </div>
          <p className="text-xs text-neutral-600">
            Create products with categories, variants (size/color), and direct-to-R2 image uploads.
          </p>
          <div className="border border-neutral-200 rounded-lg p-4 flex flex-col items-center justify-center text-center gap-2 bg-neutral-50/50">
            <Link
              href="/admin/products/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 transition-colors"
            >
              + Create New Product →
            </Link>
          </div>
        </section>

        {/* Module 2: Image Storage Upload POC */}
        <section className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <h2 className="text-base font-semibold text-neutral-800">
              Image Storage Test &amp; Cleanup
            </h2>
            <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded font-mono">
              POC Tool
            </span>
          </div>
          <p className="text-xs text-neutral-600">
            Upload test images and manage cleanup of assets under <code className="font-mono">test-uploads/</code>.
          </p>
          <div className="border border-neutral-200 rounded-lg p-4 flex flex-col items-center justify-center text-center gap-2 bg-neutral-50/50">
            <Link
              href="/admin/image-test"
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg text-xs font-medium hover:bg-neutral-100 transition-colors"
            >
              Open Image Tester &amp; Cleanup →
            </Link>
          </div>
        </section>

        {/* Module 3: Connectivity & Diagnostics */}
        <section className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <h2 className="text-base font-semibold text-neutral-800">
              Supabase Diagnostics
            </h2>
            <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded font-mono">
              Diagnostic
            </span>
          </div>
          <p className="text-xs text-neutral-600">
            Verify database connectivity, schema tables, and authentication health checks.
          </p>
          <div className="border border-neutral-200 rounded-lg p-4 flex flex-col items-center justify-center text-center gap-2 bg-neutral-50/50">
            <Link
              href="/admin/supabase-test"
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg text-xs font-medium hover:bg-neutral-100 transition-colors"
            >
              Open Connectivity Test →
            </Link>
          </div>
        </section>
      </div>

      {/* RESTORED: Product Management Section */}
      <section id="products" className="bg-white border border-neutral-200 rounded-xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-neutral-900">
                Product Catalog Management
              </h2>
              <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full font-mono">
                {products.length} products
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Inspect product details, view variant/image counts, and delete products along with their Cloudflare R2 assets.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/products/new"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-800 transition-colors"
            >
              + Add Product
            </Link>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search by title, category, or slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs border border-neutral-300 rounded-lg px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-neutral-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Product Table / Roster */}
        {loadingProducts ? (
          <div className="p-12 text-center text-xs text-neutral-500 font-mono">
            Loading catalog products...
          </div>
        ) : productLoadError ? (
          <div className="p-4 rounded-lg border border-rose-200 bg-rose-50 text-xs text-rose-800">
            Error loading catalog: {productLoadError}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-xs text-neutral-500 border border-dashed border-neutral-200 rounded-lg space-y-3">
            <p>
              {products.length === 0
                ? "No products found in the database catalog."
                : "No products matched your search filters."}
            </p>
            {products.length === 0 && (
              <Link
                href="/admin/products/new"
                className="inline-block px-3 py-1.5 bg-neutral-900 text-white rounded text-xs font-medium"
              >
                Create your first product →
              </Link>
            )}
          </div>
        ) : (
          <div className="border border-neutral-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Variants / Images</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredProducts.map((prod) => {
                    const primaryImg =
                      prod.product_images?.find((img) => img.is_primary) ||
                      prod.product_images?.[0];
                    const isDeleting = deletingProductId === prod.id;

                    return (
                      <tr
                        key={prod.id}
                        className="hover:bg-neutral-50/70 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded border border-neutral-200 bg-neutral-100 flex items-center justify-center shrink-0 overflow-hidden">
                              {primaryImg ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={`/api/images/${primaryImg.storage_path}`}
                                  alt={prod.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-[9px] text-neutral-400 font-mono">
                                  No img
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-neutral-900 truncate">
                                {prod.name}
                              </p>
                              <p className="text-[11px] text-neutral-500 font-mono truncate">
                                /{prod.slug}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-neutral-700 capitalize">
                          {prod.category}
                        </td>

                        <td className="px-4 py-3 font-medium text-neutral-900">
                          ${prod.price.toFixed(2)}
                          {prod.sale_price !== null && (
                            <span className="text-[10px] text-emerald-600 block">
                              Sale: ${prod.sale_price.toFixed(2)}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                              prod.status === "published"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : prod.status === "draft"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-neutral-100 text-neutral-600 border border-neutral-200"
                            }`}
                          >
                            {prod.status}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-neutral-600 text-[11px]">
                          <span>{prod.product_variants?.length || 0} variants</span>
                          <span className="mx-1 text-neutral-300">•</span>
                          <span>{prod.product_images?.length || 0} images</span>
                        </td>

                        <td className="px-4 py-3 text-neutral-500 text-[11px] whitespace-nowrap">
                          {new Date(prod.created_at).toLocaleDateString()}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/admin/products/${prod.id}`}
                              className="px-2.5 py-1 border border-neutral-300 rounded text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
                            >
                              Inspect
                            </Link>

                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(prod)}
                              disabled={isDeleting}
                              className="px-2.5 py-1 border border-rose-200 rounded text-[11px] font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 transition-colors"
                            >
                              {isDeleting ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Security Status Card */}
      <section className="border border-emerald-200 rounded-lg bg-emerald-50/50 p-5 text-xs text-emerald-900 space-y-2">
        <p className="font-semibold uppercase tracking-wider">
          Active Security Context
        </p>
        <p>
          You are authenticated with an authorized administrator session. API requests will pass
          your authorization token to Supabase, satisfying Row Level Security (RLS) policies for administrative operations.
        </p>
      </section>
    </div>
  );
}
