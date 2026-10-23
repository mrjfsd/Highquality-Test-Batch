"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import { verifyAdminAuthorization, type AdminVerificationResult } from "@/lib/supabase/auth";
import { AdminProductNav } from "@/components/AdminProductNav";

interface AdminProductItem {
  id: string;
  name: string;
  slug: string;
  department: string;
  category: string;
  price: number;
  sale_price: number | null;
  status: "draft" | "published" | "archived";
  is_featured: boolean;
  created_at: string;
  primaryImage: string | null;
  imageCount: number;
  variantCount: number;
  variantsSummary?: Array<{
    size: string;
    color: string;
    is_available: boolean;
    stock_quantity: number;
  }>;
}

export default function AdminProductsCataloguePage() {
  // Auth state
  const [authStatus, setAuthStatus] = useState<AdminVerificationResult>({
    isAuthenticated: false,
    isAdmin: false,
    user: null,
  });
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Products state
  const [products, setProducts] = useState<AdminProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Single Delete modal state
  const [productToDelete, setProductToDelete] = useState<AdminProductItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Multi-select bulk deletion state
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Feedback notifications
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft" | "archived">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Checkbox indeterminate ref
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Filtered products list
  const filteredProducts = products.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = p.name.toLowerCase().includes(q);
      const catMatch = p.category.toLowerCase().includes(q);
      const deptMatch = p.department.toLowerCase().includes(q);
      const slugMatch = p.slug.toLowerCase().includes(q);
      return nameMatch || catMatch || deptMatch || slugMatch;
    }
    return true;
  });

  // Calculate selection state based on visible filtered products
  const visibleProductIds = filteredProducts.map((p) => p.id);
  const selectedVisibleCount = visibleProductIds.filter((id) => selectedProductIds.has(id)).length;
  const allVisibleSelected =
    visibleProductIds.length > 0 && selectedVisibleCount === visibleProductIds.length;
  const isIndeterminate = selectedVisibleCount > 0 && !allVisibleSelected;

  // Sync indeterminate state to header checkbox
  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  // Lock background scroll when any delete modal is open
  useEffect(() => {
    const isModalOpen = Boolean(productToDelete || isBulkDeleteModalOpen);
    if (!isModalOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isDeleting && !isBulkDeleting) {
        setProductToDelete(null);
        setIsBulkDeleteModalOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [productToDelete, isBulkDeleteModalOpen, isDeleting, isBulkDeleting]);

  // 1. Initial auth check & catalogue fetch on mount
  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const result = await verifyAdminAuthorization();
        if (!isMounted) return;
        setAuthStatus(result);

        if (result.isAuthenticated && result.isAdmin) {
          const client = getSupabaseClient();
          const { data: sessionData } = await client.auth.getSession();
          const token = sessionData.session?.access_token;

          const res = await fetch("/api/admin/products", {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });

          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            if (isMounted)
              setFetchError(errJson.error || `Failed to fetch catalogue (HTTP ${res.status})`);
          } else {
            const json = await res.json();
            if (isMounted) setProducts(json.products || []);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          setFetchError(err instanceof Error ? err.message : "Error loading products.");
        }
      } finally {
        if (isMounted) {
          setCheckingAuth(false);
          setLoading(false);
        }
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch catalogue records for manual refresh or retry
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const client = getSupabaseClient();
      const { data: sessionData } = await client.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch("/api/admin/products", {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to fetch catalogue (HTTP ${res.status})`);
      }

      const json = await res.json();
      setProducts(json.products || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to load products.";
      console.error("[admin-products] Fetch error:", message);
      setFetchError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Selection Handlers ---
  const handleToggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      // Deselect all visible
      setSelectedProductIds((prev) => {
        const next = new Set(prev);
        visibleProductIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      // Select all visible
      setSelectedProductIds((prev) => {
        const next = new Set(prev);
        visibleProductIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleToggleSelectProduct = (productId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedProductIds(new Set());
  };

  // 3. Handle Single Product Deletion
  async function handleDeleteSingleProduct() {
    if (!productToDelete) return;

    setIsDeleting(true);
    setFeedbackMessage(null);

    try {
      const client = getSupabaseClient();
      const { data: sessionData } = await client.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(`/api/admin/products/${productToDelete.id}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(result.error || `Deletion failed (HTTP ${res.status})`);
      }

      // Remove product from state
      setProducts((prev) => prev.filter((p) => p.id !== productToDelete.id));
      setSelectedProductIds((prev) => {
        const next = new Set(prev);
        next.delete(productToDelete.id);
        return next;
      });

      if (result.warning) {
        setFeedbackMessage({
          type: "warning",
          text: `Product "${productToDelete.name}" was removed from database, with warning: ${result.warning}`,
        });
      } else {
        setFeedbackMessage({
          type: "success",
          text: `Product "${productToDelete.name}" was successfully deleted along with its variants and R2 assets.`,
        });
      }

      setProductToDelete(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error deleting product.";
      console.error("[admin-products] Delete error:", message);
      setFeedbackMessage({
        type: "error",
        text: `Failed to delete product: ${message}`,
      });
    } finally {
      setIsDeleting(false);
    }
  }

  // 4. Handle Multi-Select Bulk Product Deletion
  async function handleConfirmBulkDelete() {
    if (selectedProductIds.size === 0) return;

    setIsBulkDeleting(true);
    setFeedbackMessage(null);

    const idsToDelete = Array.from(selectedProductIds);

    try {
      const client = getSupabaseClient();
      const { data: sessionData } = await client.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch("/api/admin/products/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ productIds: idsToDelete }),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(result.error || `Bulk deletion failed (HTTP ${res.status})`);
      }

      const successfullyDeletedIds: string[] = result.deletedIds || [];
      const failedItems: Array<{ id: string; name?: string; error: string }> = result.failed || [];

      // Remove deleted products from products list
      if (successfullyDeletedIds.length > 0) {
        const deletedSet = new Set(successfullyDeletedIds);
        setProducts((prev) => prev.filter((p) => !deletedSet.has(p.id)));

        // Remove successfully deleted IDs from selection
        setSelectedProductIds((prev) => {
          const next = new Set(prev);
          successfullyDeletedIds.forEach((id) => next.delete(id));
          return next;
        });
      }

      // Compose clear user feedback
      if (failedItems.length === 0) {
        setFeedbackMessage({
          type: result.warning ? "warning" : "success",
          text: `Successfully deleted ${successfullyDeletedIds.length} product(s) and associated variants/R2 media.${
            result.warning ? ` Warning: ${result.warning}` : ""
          }`,
        });
      } else {
        setFeedbackMessage({
          type: "warning",
          text: `Deleted ${successfullyDeletedIds.length} product(s). ${failedItems.length} product(s) failed: ${failedItems[0].error}`,
        });
      }

      setIsBulkDeleteModalOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error executing bulk deletion.";
      console.error("[admin-products] Bulk delete error:", message);
      setFeedbackMessage({
        type: "error",
        text: `Failed to delete selected products: ${message}`,
      });
    } finally {
      setIsBulkDeleting(false);
    }
  }

  // Selected products for the confirmation modal
  const selectedProductsList = products.filter((p) => selectedProductIds.has(p.id));

  // --- Auth Checking Guard ---
  if (checkingAuth) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-neutral-500 text-xs">
          <div className="w-6 h-6 border-2 border-neutral-300 border-t-[#800020] rounded-full animate-spin" />
          <span>Verifying administrator permissions...</span>
        </div>
      </div>
    );
  }

  // --- Unauthorized State ---
  if (!authStatus.isAuthenticated || !authStatus.isAdmin) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white border border-neutral-200 rounded-2xl shadow-xs space-y-4 text-center">
        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto text-lg font-bold">
          !
        </div>
        <h1 className="text-base font-semibold text-neutral-900">Administrator Access Required</h1>
        <p className="text-xs text-neutral-600 leading-relaxed">
          {authStatus.isAuthenticated
            ? "Your account is authenticated but does not have administrator privileges."
            : "Please sign in with an authorized administrator account to manage store products."}
        </p>
        <Link
          href="/admin/login"
          className="inline-block px-4 py-2 bg-[#800020] text-white rounded-lg text-xs font-semibold hover:bg-[#66001a] transition-colors"
        >
          Sign In as Administrator
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Unified Admin Product Navigation Bar */}
      <AdminProductNav
        current="catalogue"
        title="Product Catalogue"
        subtitle="Real-time Supabase product inventory. Showing draft, published, and archived products."
        extraActions={
          <>
            <button
              type="button"
              onClick={fetchProducts}
              disabled={loading}
              className="px-3.5 py-2 border border-neutral-300 rounded-xl text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              title="Refresh product list"
            >
              {loading ? "Refreshing..." : "↻ Refresh"}
            </button>
            <Link
              href="/admin/products/new"
              className="px-3.5 py-2 border border-neutral-300 rounded-xl text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50 transition-colors shadow-xs"
            >
              + Single Product
            </Link>
            <Link
              href="/admin/products/bulk"
              className="px-3.5 py-2 bg-[#800020] hover:bg-[#66001a] text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
            >
              + Bulk Upload
            </Link>
          </>
        }
      />

      {/* Feedback Toast / Banner */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-start justify-between gap-3 ${
            feedbackMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : feedbackMessage.type === "warning"
              ? "bg-amber-50 text-amber-800 border border-amber-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-bold">
              {feedbackMessage.type === "success" ? "✓" : "!"}
            </span>
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-neutral-500 hover:text-neutral-800 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-[#faf9f6] p-1 rounded-xl border border-neutral-200 self-start md:self-auto overflow-x-auto max-w-full">
          {(
            [
              { id: "all", label: `All (${products.length})` },
              { id: "published", label: `Published (${products.filter((p) => p.status === "published").length})` },
              { id: "draft", label: `Draft (${products.filter((p) => p.status === "draft").length})` },
              { id: "archived", label: `Archived (${products.filter((p) => p.status === "archived").length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === tab.id
                  ? "bg-white text-neutral-900 shadow-xs font-semibold"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Search by name, category, slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 border border-neutral-300 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-[#800020]"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">
            🔍
          </span>
        </div>
      </div>

      {/* Bulk Selection Actions Bar (Appears when at least 1 product is selected) */}
      {selectedProductIds.size > 0 && (
        <div className="bg-[#800020]/5 border border-[#800020]/20 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5">
            <span className="w-5 h-5 rounded-full bg-[#800020] text-white flex items-center justify-center text-[10px] font-bold">
              ✓
            </span>
            <span className="text-xs font-semibold text-neutral-900">
              {selectedProductIds.size} product{selectedProductIds.size > 1 ? "s" : ""} selected
              {selectedVisibleCount < selectedProductIds.size && (
                <span className="text-neutral-500 font-normal ml-1">
                  ({selectedVisibleCount} visible in current filter)
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleClearSelection}
              disabled={isBulkDeleting}
              className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors shadow-2xs"
            >
              Clear Selection
            </button>

            <button
              type="button"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              disabled={isBulkDeleting}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              <span>Delete Selected ({selectedProductIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="bg-white border border-neutral-200 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-neutral-500 space-y-3">
            <div className="w-6 h-6 border-2 border-neutral-300 border-t-[#800020] rounded-full animate-spin mx-auto" />
            <p>Loading database products from Supabase...</p>
          </div>
        ) : fetchError ? (
          <div className="py-16 text-center text-xs space-y-3">
            <p className="text-rose-600 font-semibold">Failed to load product catalogue.</p>
            <p className="text-neutral-500 max-w-sm mx-auto">{fetchError}</p>
            <button
              type="button"
              onClick={fetchProducts}
              className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center text-xs text-neutral-500 space-y-3">
            <div className="text-3xl text-neutral-300">📦</div>
            <p className="font-semibold text-neutral-800 text-sm">No products found</p>
            <p className="text-neutral-500 max-w-sm mx-auto">
              {searchQuery || statusFilter !== "all"
                ? "No products match your current search and filter criteria."
                : "No products exist in your Supabase database yet."}
            </p>
            <Link
              href="/admin/products/new"
              className="inline-block px-4 py-2 bg-[#800020] text-white rounded-lg text-xs font-semibold hover:bg-[#66001a] transition-colors"
            >
              + Create Your First Product
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-100 bg-[#faf9f6] text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  {/* Select All Checkbox Column */}
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={handleToggleSelectAllVisible}
                      className="w-4 h-4 rounded border-neutral-300 text-[#800020] focus:ring-[#800020] cursor-pointer"
                      title={allVisibleSelected ? "Deselect all displayed products" : "Select all displayed products"}
                    />
                  </th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Variants</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredProducts.map((p) => {
                  const isSelected = selectedProductIds.has(p.id);
                  const createdDate = p.created_at
                    ? new Date(p.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—";

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${
                        isSelected
                          ? "bg-[#800020]/5 hover:bg-[#800020]/10 border-l-2 border-l-[#800020]"
                          : "hover:bg-neutral-50/70"
                      }`}
                    >
                      {/* Row Checkbox */}
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectProduct(p.id)}
                          className="w-4 h-4 rounded border-neutral-300 text-[#800020] focus:ring-[#800020] cursor-pointer"
                          title={isSelected ? `Deselect "${p.name}"` : `Select "${p.name}"`}
                        />
                      </td>

                      {/* Product Thumbnail & Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-14 bg-neutral-100 rounded-md border border-neutral-200 overflow-hidden shrink-0 flex items-center justify-center">
                            {p.primaryImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={p.primaryImage}
                                alt={p.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[9px] text-neutral-400 uppercase">No Img</span>
                            )}
                          </div>
                          <div>
                            <span className="font-semibold text-neutral-900 block">{p.name}</span>
                            <span className="font-mono text-[10px] text-neutral-400 block truncate max-w-[160px]">
                              /{p.slug}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            p.department.toLowerCase() === "men"
                              ? "bg-blue-50 text-blue-700"
                              : p.department.toLowerCase() === "women"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {p.department}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 text-neutral-700 font-medium">
                        {p.category}
                      </td>

                      {/* Price */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-neutral-900">
                          ₹{p.price.toLocaleString()}
                        </div>
                        {p.sale_price !== null && (
                          <div className="text-[10px] text-rose-600 font-medium">
                            Sale: ₹{p.sale_price.toLocaleString()}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                            p.status === "published"
                              ? "bg-emerald-100/70 text-emerald-800"
                              : p.status === "draft"
                              ? "bg-amber-100/70 text-amber-800"
                              : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              p.status === "published"
                                ? "bg-emerald-600"
                                : p.status === "draft"
                                ? "bg-amber-600"
                                : "bg-neutral-400"
                            }`}
                          />
                          {p.status}
                        </span>
                      </td>

                      {/* Variants Count */}
                      <td className="py-3.5 px-4 text-neutral-600">
                        <span className="font-medium text-neutral-800">
                          {p.variantCount}
                        </span>{" "}
                        <span className="text-[10px] text-neutral-400">option(s)</span>
                      </td>

                      {/* Created Date */}
                      <td className="py-3.5 px-4 text-neutral-500 whitespace-nowrap">
                        {createdDate}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            href={`/product/${p.slug}`}
                            className="px-2.5 py-1 text-[11px] font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-200 rounded hover:bg-neutral-50 transition-colors"
                          >
                            View
                          </Link>

                          <button
                            type="button"
                            onClick={() => setProductToDelete(p)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:text-rose-800 border border-rose-200 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Individual Single-Product Delete Confirmation Modal */}
      {productToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-description"
          onClick={() => {
            if (!isDeleting) setProductToDelete(null);
          }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto my-auto"
          >
            {/* Header with Danger Icon */}
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center text-xl font-bold shrink-0 border border-rose-200">
                ⚠
              </div>
              <div className="space-y-1">
                <h3 id="delete-dialog-title" className="text-base font-bold text-neutral-900 tracking-tight">
                  Delete &quot;{productToDelete.name}&quot;?
                </h3>
                <p id="delete-dialog-description" className="text-xs text-neutral-600 leading-relaxed">
                  Are you sure you want to permanently remove this product from the catalogue?
                </p>
              </div>
            </div>

            {/* Product Metadata Summary Box */}
            <div className="p-4 bg-[#faf9f6] border border-neutral-200 rounded-xl text-xs space-y-2">
              <div className="flex items-center justify-between py-0.5 border-b border-neutral-200/60">
                <span className="text-neutral-500 font-medium">Database Record:</span>
                <span className="font-semibold text-neutral-900 font-mono text-[11px] truncate max-w-[240px]">
                  {productToDelete.name}
                </span>
              </div>
              <div className="flex items-center justify-between py-0.5 border-b border-neutral-200/60">
                <span className="text-neutral-500 font-medium">Associated Variants:</span>
                <span className="font-semibold text-neutral-800">
                  {productToDelete.variantCount} configured row(s)
                </span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="text-neutral-500 font-medium">Cloudflare R2 Media:</span>
                <span className="font-semibold text-neutral-800">
                  {productToDelete.imageCount} image file(s)
                </span>
              </div>
            </div>

            {/* Irreversible Action Warning Banner */}
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200/80 rounded-xl text-xs text-rose-800">
              <span className="text-rose-600 font-bold shrink-0 text-sm mt-[-1px]">!</span>
              <p className="leading-relaxed text-[11.5px]">
                <strong>Irreversible Action:</strong> This action cannot be undone. The product record, its variants, and all associated media stored in Cloudflare R2 will be permanently deleted.
              </p>
            </div>

            {/* Action Buttons: Cancel (Secondary) & Confirm Delete (Destructive) */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-3 border-t border-neutral-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setProductToDelete(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-100 hover:text-neutral-900 active:bg-neutral-200 focus:outline-hidden focus:ring-2 focus:ring-neutral-400 disabled:opacity-50 transition-all cursor-pointer shadow-xs text-center justify-center"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteSingleProduct}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 focus:outline-hidden focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:opacity-60 transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2 text-center"
              >
                {isDeleting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting Product...</span>
                  </>
                ) : (
                  <span>Delete Product</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Select Bulk Delete Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-delete-dialog-title"
          aria-describedby="bulk-delete-dialog-description"
          onClick={() => {
            if (!isBulkDeleting) setIsBulkDeleteModalOpen(false);
          }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto my-auto"
          >
            {/* Header with Danger Icon */}
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center text-xl font-bold shrink-0 border border-rose-200">
                ⚠
              </div>
              <div className="space-y-1">
                <h3 id="bulk-delete-dialog-title" className="text-base font-bold text-neutral-900 tracking-tight">
                  Delete {selectedProductsList.length} Selected Product{selectedProductsList.length > 1 ? "s" : ""}?
                </h3>
                <p id="bulk-delete-dialog-description" className="text-xs text-neutral-600 leading-relaxed">
                  Are you sure you want to permanently delete these {selectedProductsList.length} products from the catalogue?
                </p>
              </div>
            </div>

            {/* Scrollable List of Selected Products */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase text-neutral-500 tracking-wider">
                Selected Products ({selectedProductsList.length}):
              </span>
              <div className="border border-neutral-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-neutral-100 bg-[#faf9f6]">
                {selectedProductsList.map((p) => (
                  <div key={p.id} className="p-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate max-w-[280px]">
                      <span className="font-semibold text-neutral-900 truncate">{p.name}</span>
                      <span className="text-neutral-400 font-mono text-[10px]">/{p.slug}</span>
                    </div>
                    <span className="text-[11px] font-medium text-neutral-500 shrink-0">
                      ₹{p.price.toLocaleString()} ({p.department})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Irreversible Action Warning Banner */}
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200/80 rounded-xl text-xs text-rose-800">
              <span className="text-rose-600 font-bold shrink-0 text-sm mt-[-1px]">!</span>
              <p className="leading-relaxed text-[11.5px]">
                <strong>Irreversible Action:</strong> This action cannot be undone. All {selectedProductsList.length} product records, their associated variants, and their image files stored in Cloudflare R2 will be permanently deleted.
              </p>
            </div>

            {/* Action Buttons: Cancel & Confirm Bulk Delete */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-3 border-t border-neutral-100">
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-100 hover:text-neutral-900 active:bg-neutral-200 focus:outline-hidden focus:ring-2 focus:ring-neutral-400 disabled:opacity-50 transition-all cursor-pointer shadow-xs text-center justify-center"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={handleConfirmBulkDelete}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 focus:outline-hidden focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:opacity-60 transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2 text-center"
              >
                {isBulkDeleting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting {selectedProductsList.length} Products...</span>
                  </>
                ) : (
                  <span>Delete {selectedProductsList.length} Products</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
