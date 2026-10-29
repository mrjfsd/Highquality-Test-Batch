"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  authFetch,
  PageHeader,
  Button,
  Icon,
  Status,
  ConfirmDialog,
  Field,
  type Page,
  type LiveProduct,
} from "./wireframe-ui";
import type { AdminProductQuantityOffer } from "@/types/offers";
import { formatCartCurrency } from "@/lib/cart/cart-utils";

const MIGRATION_SQL = `-- Run this in Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS public.product_quantity_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    qualifying_quantity INTEGER NOT NULL CHECK (qualifying_quantity > 1),
    bundle_price NUMERIC(10, 2) NOT NULL CHECK (bundle_price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_product_quantity_offers_tier UNIQUE (product_id, qualifying_quantity)
);

CREATE INDEX IF NOT EXISTS idx_product_quantity_offers_product_id
    ON public.product_quantity_offers (product_id);

CREATE INDEX IF NOT EXISTS idx_product_quantity_offers_active
    ON public.product_quantity_offers (product_id, qualifying_quantity)
    WHERE is_active = true;

GRANT ALL ON TABLE public.product_quantity_offers TO anon, authenticated, service_role;
ALTER TABLE public.product_quantity_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Storefront can view active offers for published products" ON public.product_quantity_offers;
CREATE POLICY "Storefront can view active offers for published products"
    ON public.product_quantity_offers
    FOR SELECT
    TO anon, authenticated
    USING (
        public.is_admin() OR (
            is_active = true AND
            EXISTS (
                SELECT 1 FROM public.products p
                WHERE p.id = product_quantity_offers.product_id
                  AND p.status = 'published'
            )
        )
    );

DROP POLICY IF EXISTS "Admins can manage quantity offers" ON public.product_quantity_offers;
CREATE POLICY "Admins can manage quantity offers"
    ON public.product_quantity_offers
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS set_product_quantity_offers_updated_at ON public.product_quantity_offers;
CREATE TRIGGER set_product_quantity_offers_updated_at
    BEFORE UPDATE ON public.product_quantity_offers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();`;

interface QuantityOffersScreenProps {
  products: LiveProduct[];
  showToast: (message: string) => void;
  navigate?: (page: Page, productId?: string) => void;
}

export function QuantityOffersScreen({
  products,
  showToast,
  navigate,
}: QuantityOffersScreenProps) {
  const [offers, setOffers] = useState<AdminProductQuantityOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Modal / Drawer state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<AdminProductQuantityOffer | null>(null);
  const [deleteConfirmOffer, setDeleteConfirmOffer] = useState<AdminProductQuantityOffer | null>(null);

  // Form input state
  const [selectedProductId, setSelectedProductId] = useState("");
  const [qualifyingQuantity, setQualifyingQuantity] = useState("3");
  const [bundlePrice, setBundlePrice] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Fetch offers
  const fetchOffers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await authFetch("/api/admin/offers");
      if (res.ok) {
        const json = await res.json();
        setOffers(json.offers || []);
        setMigrationRequired(Boolean(json.migrationRequired));
      } else {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.error || `Failed to load offers (${res.status})`);
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error loading quantity offers.");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingOffer(null);
    setSelectedProductId(products[0]?.id || "");
    setQualifyingQuantity("3");
    setBundlePrice("");
    setIsActive(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (offer: AdminProductQuantityOffer) => {
    setEditingOffer(offer);
    setSelectedProductId(offer.product_id);
    setQualifyingQuantity(String(offer.qualifying_quantity));
    setBundlePrice(String(offer.bundle_price));
    setIsActive(offer.is_active);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Selected Product lookup in Form
  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // Real-time calculation metrics in Form
  const formCalculation = useMemo(() => {
    const qty = parseInt(qualifyingQuantity, 10);
    const regularUnitPrice = selectedProduct ? Number(selectedProduct.price) : 0;
    const isValidQty = Number.isInteger(qty) && qty >= 2;

    // Regular total is calculated whenever quantity and regular unit price are valid
    const regularTotal =
      isValidQty && regularUnitPrice > 0
        ? Math.round((qty * regularUnitPrice + Number.EPSILON) * 100) / 100
        : 0;

    const trimmedPrice = bundlePrice.trim();
    const hasBundlePriceInput = trimmedPrice !== "";
    const parsedPrice = parseFloat(trimmedPrice);
    const isValidPrice = hasBundlePriceInput && Number.isFinite(parsedPrice) && parsedPrice >= 0;

    // Calculate savings only when bundle price is valid and regular total is positive
    const expectedSavings =
      isValidPrice && regularTotal > 0
        ? Math.round((regularTotal - parsedPrice + Number.EPSILON) * 100) / 100
        : null;

    // Bundle price is equal to or greater than regular total
    const hasNoSavings = expectedSavings !== null && expectedSavings <= 0;

    // Check duplicate tier on this product (excluding the one being edited)
    const isDuplicateTier =
      isValidQty &&
      offers.some(
        (o) =>
          o.product_id === selectedProductId &&
          o.qualifying_quantity === qty &&
          o.id !== editingOffer?.id
      );

    const isValid =
      isValidQty &&
      isValidPrice &&
      regularUnitPrice > 0 &&
      !hasNoSavings &&
      !isDuplicateTier;

    return {
      isValid,
      regularUnitPrice,
      regularTotal,
      hasBundlePriceInput,
      isValidPrice,
      bundlePriceNumber: isValidPrice ? parsedPrice : null,
      expectedSavings,
      hasNoSavings,
      isDuplicateTier,
    };
  }, [qualifyingQuantity, bundlePrice, selectedProduct, selectedProductId, offers, editingOffer]);

  // Handle Form Submit (Create or Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedProductId) {
      setFormError("Please select a product.");
      return;
    }

    const qty = parseInt(qualifyingQuantity, 10);
    if (!Number.isInteger(qty) || qty < 2) {
      setFormError("Qualifying quantity must be an integer of 2 or greater.");
      return;
    }

    if (!formCalculation.hasBundlePriceInput) {
      setFormError("Please enter a bundle price.");
      return;
    }

    const price = parseFloat(bundlePrice);
    if (!Number.isFinite(price) || price < 0) {
      setFormError("Bundle price must be a valid non-negative number.");
      return;
    }

    if (formCalculation.hasNoSavings) {
      setFormError(
        `Bundle price (${formatCartCurrency(price)}) must be lower than the regular total (${formatCartCurrency(formCalculation.regularTotal)}) to provide customer savings.`
      );
      return;
    }

    if (formCalculation.isDuplicateTier) {
      setFormError(
        `An offer tier for this product with quantity ${qty} already exists. Please choose a different quantity threshold or edit that tier.`
      );
      return;
    }

    setIsSaving(true);
    try {
      const url = editingOffer
        ? `/api/admin/offers/${editingOffer.id}`
        : "/api/admin/offers";
      const method = editingOffer ? "PATCH" : "POST";

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: selectedProductId,
          qualifying_quantity: qty,
          bundle_price: price,
          is_active: isActive,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.error || `Save failed (${res.status})`);
      }

      showToast(
        editingOffer
          ? `Updated offer: Buy ${qty} for ₹${price.toLocaleString("en-IN")}.`
          : `Created offer: Buy ${qty} for ₹${price.toLocaleString("en-IN")}.`
      );

      if (json.warning) {
        showToast(json.warning);
      }

      setIsModalOpen(false);
      fetchOffers();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error saving offer.");
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Active/Inactive
  const handleToggleActive = async (offer: AdminProductQuantityOffer) => {
    const nextStatus = !offer.is_active;

    // Optimistic UI update
    setOffers((prev) =>
      prev.map((o) => (o.id === offer.id ? { ...o, is_active: nextStatus } : o))
    );

    try {
      const res = await authFetch(`/api/admin/offers/${offer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextStatus }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to update offer status.");
      }

      showToast(
        nextStatus
          ? `Activated offer for ${offer.product?.name || "product"}.`
          : `Deactivated offer for ${offer.product?.name || "product"}.`
      );
    } catch (err: unknown) {
      // Revert optimistic update
      setOffers((prev) =>
        prev.map((o) => (o.id === offer.id ? { ...o, is_active: offer.is_active } : o))
      );
      showToast(err instanceof Error ? err.message : "Error toggling status.");
    }
  };

  // Delete Offer
  const handleDeleteOffer = async (offer: AdminProductQuantityOffer) => {
    try {
      const res = await authFetch(`/api/admin/offers/${offer.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to delete offer.");
      }

      setOffers((prev) => prev.filter((o) => o.id !== offer.id));
      setDeleteConfirmOffer(null);
      showToast(`Deleted offer for ${offer.product?.name || "product"}.`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error deleting offer.");
    }
  };

  // Copy SQL to clipboard
  const handleCopySql = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(MIGRATION_SQL);
      setCopiedSql(true);
      showToast("Migration SQL copied to clipboard.");
      setTimeout(() => setCopiedSql(false), 3000);
    }
  };

  // Filtered offers list
  const filteredOffers = useMemo(() => {
    return offers.filter((offer) => {
      // Status filter
      if (statusFilter === "active" && !offer.is_active) return false;
      if (statusFilter === "inactive" && offer.is_active) return false;

      // Search filter
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const pName = offer.product?.name?.toLowerCase() || "";
        const pCat = offer.product?.category?.toLowerCase() || "";
        if (!pName.includes(q) && !pCat.includes(q)) return false;
      }
      return true;
    });
  }, [offers, statusFilter, search]);

  // Distinct products with active offers
  const distinctProductsWithOffers = useMemo(() => {
    return new Set(offers.map((o) => o.product_id)).size;
  }, [offers]);

  return (
    <div className="page quantity-offers-page">
      <PageHeader
        title="Quantity Offers"
        description="Configure product-specific quantity deals (e.g. Buy 3 for ₹1,000) with multi-tier pricing and instant status toggles."
        actions={
          <Button
            variant="primary"
            icon="plus"
            onClick={handleOpenCreate}
            disabled={products.length === 0}
          >
            New Offer
          </Button>
        }
      />

      {/* Database Migration Warning Banner if Table is missing */}
      {migrationRequired && (
        <div
          style={{
            backgroundColor: "#FFF8E7",
            border: "1px solid #E6A23C",
            borderRadius: "8px",
            padding: "16px 20px",
            marginBottom: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <span style={{ color: "#E6A23C", marginTop: "2px" }}>
              <Icon name="alert" size={20} />
            </span>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 700, color: "#8C5B00" }}>
                Supabase Migration Required: public.product_quantity_offers
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "#664800", lineHeight: 1.5 }}>
                The table <code>public.product_quantity_offers</code> has not yet been applied to your target Supabase PostgreSQL database.
                To activate quantity offers, copy the SQL migration script and run it in your{" "}
                <strong>Supabase Dashboard → SQL Editor</strong>.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              <Button onClick={handleCopySql} icon={copiedSql ? "check" : "list"}>
                {copiedSql ? "Copied!" : "Copy SQL Script"}
              </Button>
              <Button onClick={fetchOffers} icon="refresh">
                Check Again
              </Button>
            </div>
          </div>
          <details style={{ fontSize: "11px", color: "#664800" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>View Migration SQL</summary>
            <pre
              style={{
                marginTop: "8px",
                padding: "12px",
                backgroundColor: "#171717",
                color: "#E8E2D8",
                borderRadius: "6px",
                overflowX: "auto",
                fontSize: "11px",
              }}
            >
              {MIGRATION_SQL}
            </pre>
          </details>
        </div>
      )}

      {/* Metrics Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            background: "var(--admin-white)",
            border: "1px solid var(--admin-stone)",
            borderRadius: "8px",
            padding: "16px 20px",
          }}
        >
          <span style={{ fontSize: "11px", color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Total Offers
          </span>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--admin-charcoal)", marginTop: "4px" }}>
            {offers.length}
          </div>
        </div>

        <div
          style={{
            background: "var(--admin-white)",
            border: "1px solid var(--admin-stone)",
            borderRadius: "8px",
            padding: "16px 20px",
          }}
        >
          <span style={{ fontSize: "11px", color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Active Offers
          </span>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#166534", marginTop: "4px" }}>
            {offers.filter((o) => o.is_active).length}
          </div>
        </div>

        <div
          style={{
            background: "var(--admin-white)",
            border: "1px solid var(--admin-stone)",
            borderRadius: "8px",
            padding: "16px 20px",
          }}
        >
          <span style={{ fontSize: "11px", color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Inactive Offers
          </span>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--admin-muted)", marginTop: "4px" }}>
            {offers.filter((o) => !o.is_active).length}
          </div>
        </div>

        <div
          style={{
            background: "var(--admin-white)",
            border: "1px solid var(--admin-stone)",
            borderRadius: "8px",
            padding: "16px 20px",
          }}
        >
          <span style={{ fontSize: "11px", color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Products with Deals
          </span>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--admin-crimson)", marginTop: "4px" }}>
            {distinctProductsWithOffers}
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: "1 1 300px" }}>
          <div style={{ position: "relative", width: "100%", maxWidth: "360px" }}>
            <input
              type="text"
              placeholder="Search by product name or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 34px",
                border: "1px solid var(--admin-stone-dark)",
                borderRadius: "6px",
                backgroundColor: "var(--admin-white)",
                fontSize: "12px",
              }}
            />
            <span style={{ position: "absolute", left: "10px", top: "9px", color: "var(--admin-muted)" }}>
              <Icon name="search" size={15} />
            </span>
          </div>

          <div className="segmented">
            <button
              type="button"
              className={statusFilter === "all" ? "active" : ""}
              onClick={() => setStatusFilter("all")}
            >
              All ({offers.length})
            </button>
            <button
              type="button"
              className={statusFilter === "active" ? "active" : ""}
              onClick={() => setStatusFilter("active")}
            >
              Active ({offers.filter((o) => o.is_active).length})
            </button>
            <button
              type="button"
              className={statusFilter === "inactive" ? "active" : ""}
              onClick={() => setStatusFilter("inactive")}
            >
              Inactive ({offers.filter((o) => !o.is_active).length})
            </button>
          </div>
        </div>

        <Button onClick={fetchOffers} icon="refresh" disabled={isLoading}>
          {isLoading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Offers Table */}
      <div
        style={{
          background: "var(--admin-white)",
          border: "1px solid var(--admin-stone)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "32%" }}>Garment</th>
                <th style={{ width: "14%" }}>Regular Price</th>
                <th style={{ width: "18%" }}>Offer Deal</th>
                <th style={{ width: "16%" }}>Regular vs Bundle</th>
                <th style={{ width: "10%" }}>Status</th>
                <th style={{ width: "10%", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "48px 20px", color: "var(--admin-muted)" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                      <Icon name="refresh" size={16} /> Loading quantity offers...
                    </div>
                  </td>
                </tr>
              ) : filteredOffers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "48px 20px", color: "var(--admin-muted)" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                      <Icon name="tag" size={24} />
                      <strong style={{ fontSize: "14px", color: "var(--admin-charcoal)" }}>No quantity offers found</strong>
                      <span style={{ fontSize: "12px" }}>
                        {offers.length === 0
                          ? "Get started by creating your first product quantity offer."
                          : "No offers match your current filter."}
                      </span>
                      {offers.length === 0 && (
                        <Button
                          variant="primary"
                          icon="plus"
                          onClick={handleOpenCreate}
                          style={{ marginTop: "8px" }}
                        >
                          Create First Offer
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOffers.map((offer) => {
                  const product = offer.product;
                  const unitPrice = product ? Number(product.price) : 0;
                  const regularTotal = Math.round((offer.qualifying_quantity * unitPrice + Number.EPSILON) * 100) / 100;
                  const savings = Math.round((regularTotal - offer.bundle_price + Number.EPSILON) * 100) / 100;
                  const savingsPercent =
                    regularTotal > 0 ? Math.round((savings / regularTotal) * 100) : 0;
                  const hasNoSavings = savings <= 0;

                  return (
                    <tr key={offer.id}>
                      {/* Product Name & Category */}
                      <td>
                        <div className="product-cell">
                          <div
                            className="product-thumb"
                            style={{
                              backgroundColor: "var(--admin-cream-tint)",
                              border: "1px solid var(--admin-stone)",
                              borderRadius: "4px",
                            }}
                          >
                            {product?.primaryImage ? (
                              <img
                                src={product.primaryImage}
                                alt={product.name}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  display: "grid",
                                  placeItems: "center",
                                  color: "var(--admin-muted)",
                                }}
                              >
                                <Icon name="image" size={16} />
                              </div>
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: "var(--admin-charcoal)" }}>
                              {product?.name || "Unknown Product"}
                            </div>
                            <div style={{ fontSize: "10px", color: "var(--admin-muted)", textTransform: "capitalize" }}>
                              {product?.category || "Apparel"} ·{" "}
                              <span style={{ textTransform: "uppercase" }}>{product?.status || "Draft"}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Regular Price */}
                      <td>
                        <div style={{ fontWeight: 600 }}>{formatCartCurrency(unitPrice)}</div>
                        <span style={{ fontSize: "10px", color: "var(--admin-muted)" }}>per unit</span>
                      </td>

                      {/* Offer Deal */}
                      <td>
                        <div style={{ fontWeight: 700, color: "var(--admin-crimson)", fontSize: "12px" }}>
                          Buy {offer.qualifying_quantity} for {formatCartCurrency(offer.bundle_price)}
                        </div>
                        <span style={{ fontSize: "10px", color: "var(--admin-muted)" }}>
                          ₹{(offer.bundle_price / offer.qualifying_quantity).toFixed(0)} / unit in bundle
                        </span>
                      </td>

                      {/* Regular vs Bundle & Calculated Savings */}
                      <td>
                        <div>
                          <span style={{ textDecoration: "line-through", color: "var(--admin-muted)", fontSize: "11px", marginRight: "6px" }}>
                            {formatCartCurrency(regularTotal)}
                          </span>
                          <strong style={{ color: "var(--admin-charcoal)" }}>
                            {formatCartCurrency(offer.bundle_price)}
                          </strong>
                        </div>
                        {hasNoSavings ? (
                          <div style={{ color: "#B45309", fontSize: "10px", fontWeight: 600, marginTop: "2px" }}>
                            ⚠️ No savings
                          </div>
                        ) : (
                          <div style={{ color: "#166534", fontSize: "10px", fontWeight: 600, marginTop: "2px" }}>
                            ✓ Save {formatCartCurrency(savings)} ({savingsPercent}% off)
                          </div>
                        )}
                      </td>

                      {/* Status Toggle */}
                      <td>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(offer)}
                          title={`Click to ${offer.is_active ? "deactivate" : "activate"}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "4px 8px",
                            borderRadius: "99px",
                            border: offer.is_active ? "1px solid #BBF7D0" : "1px solid var(--admin-stone)",
                            backgroundColor: offer.is_active ? "#F0FDF4" : "var(--admin-cream-soft)",
                            color: offer.is_active ? "#15803D" : "var(--admin-muted)",
                            fontSize: "11px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          <span
                            style={{
                              width: "7px",
                              height: "7px",
                              borderRadius: "50%",
                              backgroundColor: offer.is_active ? "#22C55E" : "var(--admin-muted-light)",
                            }}
                          />
                          {offer.is_active ? "Active" : "Inactive"}
                        </button>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <Button
                            onClick={() => handleOpenEdit(offer)}
                            icon="edit"
                            title="Edit offer"
                            aria-label={`Edit offer for ${product?.name}`}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            icon="trash"
                            onClick={() => setDeleteConfirmOffer(offer)}
                            title="Delete offer"
                            aria-label={`Delete offer for ${product?.name}`}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Offer Modal Dialog */}
      {isModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => !isSaving && setIsModalOpen(false)}
          role="presentation"
        >
          <div
            className="dialog"
            style={{ maxWidth: "520px", width: "95%" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--admin-charcoal)" }}>
                {editingOffer ? "Edit Quantity Offer" : "Create Quantity Offer"}
              </h2>
              <button
                type="button"
                onClick={() => !isSaving && setIsModalOpen(false)}
                style={{ padding: "4px", color: "var(--admin-muted)", cursor: "pointer" }}
                aria-label="Close dialog"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Product Selector */}
              <Field label="Select Garment" required hint="Choose the clothing piece this quantity offer applies to">
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  disabled={Boolean(editingOffer) || isSaving}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--admin-stone-dark)",
                    borderRadius: "6px",
                    backgroundColor: editingOffer ? "var(--admin-cream-soft)" : "var(--admin-white)",
                    fontSize: "13px",
                  }}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatCartCurrency(Number(p.price))}) — {p.category} [{p.status}]
                    </option>
                  ))}
                </select>
              </Field>

              {/* Qualifying Quantity & Bundle Price Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "16px" }}>
                <Field
                  label="Qualifying Units"
                  required
                  hint="Threshold count (min 2, e.g. 3)"
                >
                  <input
                    type="number"
                    min="2"
                    step="1"
                    placeholder="e.g. 3"
                    value={qualifyingQuantity}
                    onChange={(e) => setQualifyingQuantity(e.target.value)}
                    disabled={isSaving}
                    required
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid var(--admin-stone-dark)",
                      borderRadius: "6px",
                      fontSize: "13px",
                    }}
                  />
                </Field>

                <Field
                  label="Bundle Price (₹)"
                  required
                  hint="Total price for the bundle (e.g. 1000)"
                >
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 1000"
                    value={bundlePrice}
                    onChange={(e) => setBundlePrice(e.target.value)}
                    disabled={isSaving}
                    required
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid var(--admin-stone-dark)",
                      borderRadius: "6px",
                      fontSize: "13px",
                    }}
                  />
                </Field>
              </div>

              {/* Live Price & Savings Breakdown Card */}
              <div
                style={{
                  marginTop: "20px",
                  padding: "14px 16px",
                  borderRadius: "6px",
                  backgroundColor: "var(--admin-cream-tint)",
                  border: "1px solid var(--admin-stone)",
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--admin-muted)", textTransform: "uppercase", marginBottom: "8px" }}>
                  Live Deal Preview
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                  <span>Regular Unit Price:</span>
                  <strong>{formatCartCurrency(formCalculation.regularUnitPrice)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                  <span>Regular Total for {qualifyingQuantity || 0} units:</span>
                  <strong>{formatCartCurrency(formCalculation.regularTotal)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                  <span>Offer Bundle Price:</span>
                  {formCalculation.isValidPrice ? (
                    <strong style={{ color: "var(--admin-crimson)" }}>
                      {formatCartCurrency(formCalculation.bundlePriceNumber!)}
                    </strong>
                  ) : (
                    <span style={{ color: "var(--admin-muted)" }}>—</span>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "12px",
                    paddingTop: "6px",
                    borderTop: "1px solid var(--admin-stone)",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>Customer Savings:</span>
                  {formCalculation.hasBundlePriceInput && formCalculation.isValidPrice ? (
                    formCalculation.expectedSavings !== null && formCalculation.expectedSavings > 0 ? (
                      <strong style={{ color: "#166534" }}>
                        Save {formatCartCurrency(formCalculation.expectedSavings)} ({formCalculation.regularTotal > 0 ? Math.round((formCalculation.expectedSavings / formCalculation.regularTotal) * 100) : 0}% off)
                      </strong>
                    ) : (
                      <strong style={{ color: "#B91C1C" }}>₹0 (No savings)</strong>
                    )
                  ) : (
                    <span style={{ color: "var(--admin-muted)", fontStyle: "italic", fontSize: "11.5px" }}>
                      Enter a bundle price to preview savings
                    </span>
                  )}
                </div>

                {/* Helper prompt when bundle price is empty */}
                {!formCalculation.hasBundlePriceInput && (
                  <div
                    style={{
                      marginTop: "10px",
                      fontSize: "11.5px",
                      color: "var(--admin-muted)",
                      fontStyle: "italic",
                    }}
                  >
                    Enter a bundle price to preview savings.
                  </div>
                )}

                {/* Warnings */}
                {formCalculation.hasNoSavings && formCalculation.isValidPrice && (
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "8px 10px",
                      borderRadius: "4px",
                      backgroundColor: "#FEF3C7",
                      color: "#92400E",
                      fontSize: "11px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Icon name="alert" size={14} />
                    <span>
                      Warning: Bundle price ({formatCartCurrency(formCalculation.bundlePriceNumber || 0)}) must be less than regular total ({formatCartCurrency(formCalculation.regularTotal)}) to provide customer savings.
                    </span>
                  </div>
                )}

                {formCalculation.isDuplicateTier && (
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "8px 10px",
                      borderRadius: "4px",
                      backgroundColor: "#FEE2E2",
                      color: "#B91C1C",
                      fontSize: "11px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Icon name="alert" size={14} />
                    <span>
                      Duplicate Tier: An offer for this garment with quantity {qualifyingQuantity} already exists.
                    </span>
                  </div>
                )}
              </div>

              {/* Active Switch */}
              <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="checkbox"
                  id="offer-active-checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "var(--admin-burgundy)", cursor: "pointer" }}
                />
                <label htmlFor="offer-active-checkbox" style={{ fontSize: "13px", cursor: "pointer", fontWeight: 500 }}>
                  Active immediately on save
                </label>
              </div>

              {/* Error Banner */}
              {formError && (
                <div
                  style={{
                    marginTop: "16px",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    backgroundColor: "#FEE2E2",
                    color: "#991B1B",
                    fontSize: "12px",
                  }}
                >
                  {formError}
                </div>
              )}

              {/* Form Footer Buttons */}
              <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <Button onClick={() => setIsModalOpen(false)} disabled={isSaving}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSaving || !formCalculation.isValid || formCalculation.isDuplicateTier}
                >
                  {isSaving ? "Saving..." : editingOffer ? "Save Changes" : "Create Offer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmOffer && (
        <ConfirmDialog
          title="Delete this quantity offer?"
          body={`Are you sure you want to delete the offer "Buy ${deleteConfirmOffer.qualifying_quantity} for ${formatCartCurrency(deleteConfirmOffer.bundle_price)}" for ${deleteConfirmOffer.product?.name || "this product"}? This action cannot be undone.`}
          action="Delete Offer"
          onCancel={() => setDeleteConfirmOffer(null)}
          onConfirm={() => handleDeleteOffer(deleteConfirmOffer)}
        />
      )}
    </div>
  );
}
