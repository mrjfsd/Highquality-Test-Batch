"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { formatCartCurrency, STORE_WHATSAPP_NUMBER } from "@/lib/cart/cart-utils";
import { getOptimizedImageUrl } from "@/lib/images/responsive";
import { WhatsAppIcon, ArrowRightIcon } from "@/components/Icons";
import {
  generateOrderReference,
  executeWhatsAppPdfCheckout,
  generateOrderPdfBlob,
  downloadPdfBlob,
} from "@/lib/cart/order-pdf";

export default function CartPage() {
  const {
    items,
    totalCount,
    isLoaded,
    removeItem,
    updateQuantity,
    clearCart,
    getWhatsAppOrderUrl,
    getItemPricing,
    isItemSelected,
    toggleSelectItem,
    selectAllItems,
    deselectAllItems,
    selectedItems,
    selectedTotals,
    selectedCount,
    selectedTotalUnits,
  } = useCart();

  const selectAllInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [isDownloadingPdfOnly, setIsDownloadingPdfOnly] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<{
    orderRef: string;
    blob?: Blob;
    waUrl?: string;
    orderUrl?: string;
  } | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  const handleWhatsAppCheckout = useCallback(async () => {
    if (isProcessingOrder || isDownloadingPdfOnly || selectedCount === 0) return;

    setIsProcessingOrder(true);
    setOrderError(null);

    try {
      const orderRef = generateOrderReference();

      const preparedItems = selectedItems.map((item) => ({
        item,
        pricing: getItemPricing(item, selectedItems),
        productUrl: `/product/${item.slug}`,
        imageUrl: item.image,
      }));

      const result = await executeWhatsAppPdfCheckout(
        {
          orderRef,
          items: preparedItems,
          selectedCount,
          selectedTotalUnits,
          totals: selectedTotals,
        },
        STORE_WHATSAPP_NUMBER
      );

      if (result.success) {
        // Direct navigation fallback in case not already handled in checkout helper
        if (!result.navigated && result.waUrl && typeof window !== "undefined") {
          window.location.href = result.waUrl;
        }
      } else {
        setOrderError(result.error || "Failed to create order or upload invoice. Please try again.");
      }
    } catch (err) {
      console.error("[Cart] Checkout error:", err);
      setOrderError("An unexpected error occurred while preparing your order.");
    } finally {
      setIsProcessingOrder(false);
    }
  }, [
    isProcessingOrder,
    isDownloadingPdfOnly,
    selectedCount,
    selectedItems,
    selectedTotalUnits,
    selectedTotals,
    getItemPricing,
  ]);

  const handleDownloadPdfOnly = useCallback(async () => {
    if (isDownloadingPdfOnly || isProcessingOrder || selectedCount === 0) return;

    setIsDownloadingPdfOnly(true);
    setOrderError(null);

    try {
      const orderRef = generateOrderReference();
      const preparedItems = selectedItems.map((item) => ({
        item,
        pricing: getItemPricing(item, selectedItems),
        productUrl: `/product/${item.slug}`,
        imageUrl: item.image,
      }));

      const { blob } = await generateOrderPdfBlob({
        orderRef,
        items: preparedItems,
        selectedCount,
        selectedTotalUnits,
        totals: selectedTotals,
      });

      downloadPdfBlob(blob, `order-${orderRef}.pdf`);
      setDownloadNotice({ orderRef, blob });
    } catch (err) {
      console.error("[Cart] PDF download error:", err);
      setOrderError("Failed to generate order PDF. Please try again.");
    } finally {
      setIsDownloadingPdfOnly(false);
    }
  }, [
    isDownloadingPdfOnly,
    isProcessingOrder,
    selectedCount,
    selectedItems,
    selectedTotalUnits,
    selectedTotals,
    getItemPricing,
  ]);
  const showSelectionControls = items.length > 1;
  const isAllSelected = items.length > 0 && selectedCount === items.length;

  useEffect(() => {
    if (selectAllInputRef.current && showSelectionControls) {
      selectAllInputRef.current.indeterminate =
        selectedCount > 0 && selectedCount < items.length;
    }
  }, [selectedCount, items.length, showSelectionControls]);

  const handleToggleAll = () => {
    if (isAllSelected) {
      deselectAllItems();
    } else {
      selectAllItems();
    }
  };

  // Guard against SSR hydration mismatch while localStorage is loading
  if (!isLoaded) {
    return (
      <main className="cart-page">
        <div className="cart-container">
          <div className="cart-loading-skeleton" aria-busy="true">
            <div className="cart-skeleton-title" />
            <div className="cart-skeleton-card" />
            <div className="cart-skeleton-card" />
          </div>
        </div>
      </main>
    );
  }

  const isEmpty = items.length === 0;

  return (
    <main className="cart-page">
      <div className="cart-container">
        {/* Breadcrumb Navigation */}
        <nav className="breadcrumb cart-breadcrumb" aria-label="Breadcrumb">
          <Link href="/" prefetch={true}>
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Shopping Bag</span>
        </nav>

        <div className="cart-header">
          <div className="cart-header-left">
            <h1 className="cart-title">Shopping Bag</h1>
            {!isEmpty && (
              <span className="cart-count-badge">
                {totalCount} {totalCount === 1 ? "item" : "items"}
              </span>
            )}
          </div>
          {!isEmpty && (
            <button
              type="button"
              className="cart-clear-btn"
              onClick={clearCart}
              aria-label="Clear all items from bag"
            >
              Clear Bag
            </button>
          )}
        </div>

        {isEmpty ? (
          /* Empty Cart State */
          <div className="cart-empty-state">
            <div className="cart-empty-icon" aria-hidden="true">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
            <h2 className="cart-empty-heading">Your shopping bag is empty</h2>
            <p className="cart-empty-text">
              Discover considered, modern wardrobe foundations crafted with thoughtful
              proportions and versatile silhouettes.
            </p>
            <div className="cart-empty-actions">
              <Link href="/shop/women" className="button button-primary" prefetch={true}>
                <span>Shop Women</span>
                <ArrowRightIcon size={14} />
              </Link>
              <Link href="/shop/men" className="button button-secondary" prefetch={true}>
                <span>Shop Men</span>
              </Link>
              <Link href="/shop/kids" className="button button-secondary" prefetch={true}>
                <span>Shop Kids</span>
              </Link>
            </div>
          </div>
        ) : (
          /* Active Cart with Items */
          <div className="cart-layout">
            {/* Left Column: List of items */}
            <section className="cart-items-section" aria-label="Cart items">
              {/* Selective Order Selection Bar — Only shown when multiple distinct cart lines exist */}
              {showSelectionControls && (
                <div className="cart-selection-bar">
                  <label className="cart-selection-toggle" htmlFor="cart-select-all">
                    <input
                      type="checkbox"
                      id="cart-select-all"
                      ref={selectAllInputRef}
                      checked={isAllSelected}
                      onChange={handleToggleAll}
                      className="cart-checkbox"
                      aria-label={isAllSelected ? "Deselect all items" : "Select all items"}
                    />
                    <span className="cart-selection-toggle-text">
                      {isAllSelected ? "Deselect all" : "Select all"}
                    </span>
                  </label>

                  <span className="cart-selection-counter">
                    {selectedCount} of {items.length} {items.length === 1 ? "item" : "items"} selected
                    {selectedTotalUnits > 0 && ` (${selectedTotalUnits} ${selectedTotalUnits === 1 ? "unit" : "units"})`}
                  </span>
                </div>
              )}

              <ul className="cart-items-list" role="list">
                {items.map((item) => {
                  const isSelected = isItemSelected(item.id);
                  // Pricing is evaluated dynamically against selected siblings when selected
                  const pricing = getItemPricing(
                    item,
                    isSelected ? selectedItems : [item]
                  );

                  return (
                    <li
                      key={item.id}
                      className={`cart-item-card ${
                        showSelectionControls
                          ? isSelected
                            ? "cart-item-card--selected"
                            : "cart-item-card--unselected"
                          : "cart-item-card--single"
                      }`}
                    >
                      {/* Selection Checkbox — Only rendered when 2 or more distinct lines exist */}
                      {showSelectionControls && (
                        <div className="cart-item-select-wrap">
                          <input
                            type="checkbox"
                            id={`cart-select-${item.id}`}
                            checked={isSelected}
                            onChange={() => toggleSelectItem(item.id)}
                            className="cart-item-checkbox"
                            aria-label={`Select ${item.name} for WhatsApp order`}
                          />
                        </div>
                      )}

                      {/* Product Thumbnail */}
                      <Link
                        href={`/product/${item.slug}`}
                        className="cart-item-image-wrap"
                        aria-label={`View details for ${item.name}`}
                        prefetch={true}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getOptimizedImageUrl(item.image, 192, 80)}
                          alt={item.name}
                          className="cart-item-image"
                          width={96}
                          height={124}
                          loading="lazy"
                          decoding="async"
                        />
                      </Link>

                      {/* Product Content Column */}
                      <div className="cart-item-details">
                        {/* 1. Product Information Area */}
                        <div className="cart-item-product-info">
                          <h3 className="cart-item-name">
                            <Link href={`/product/${item.slug}`} prefetch={true}>
                              {item.name}
                            </Link>
                          </h3>

                          {/* Variant Attributes (Size, Color) */}
                          {(item.size || item.color) && (
                            <div className="cart-item-attributes">
                              {item.size && (
                                <span className="cart-attr-chip">
                                  <span className="cart-attr-label">Size:</span>
                                  <strong>{item.size}</strong>
                                </span>
                              )}
                              {item.color && (
                                <span className="cart-attr-chip">
                                  <span className="cart-attr-label">Color:</span>
                                  <strong>{item.color}</strong>
                                </span>
                              )}
                            </div>
                          )}

                          {/* Regular Unit Price */}
                          <div className="cart-item-unit-price-row">
                            <span className="cart-item-unit-price">
                              {formatCartCurrency(item.price)} each
                            </span>
                          </div>

                          {/* Applicable Offer & Savings — Minimal unbordered presentation */}
                          {pricing.appliedOffer && pricing.discountAmount > 0 ? (
                            <div className="cart-item-offer-plain">
                              <span className="cart-item-offer-desc">
                                Buy {pricing.appliedOffer.qualifying_quantity} for {formatCartCurrency(pricing.appliedOffer.bundle_price)}
                              </span>
                              <span className="cart-item-offer-savings">
                                Save {formatCartCurrency(pricing.discountAmount)}
                              </span>
                            </div>
                          ) : pricing.unitsNeededForNextTier !== null && pricing.nextTierOffer ? (
                            <div className="cart-item-offer-helper">
                              Add {pricing.unitsNeededForNextTier} more to unlock Buy {pricing.nextTierOffer.qualifying_quantity} for {formatCartCurrency(pricing.nextTierOffer.bundle_price)}
                            </div>
                          ) : null}

                          {!isSelected && showSelectionControls && (
                            <div className="cart-item-unselected-note">
                              Not selected for WhatsApp order
                            </div>
                          )}
                        </div>

                        {/* 2. Quantity Controls + 3. Pricing Summary */}
                        <div className="cart-item-bottom-row">
                          {/* Quantity Controls & Discreet Remove */}
                          <div className="cart-item-qty-group">
                            <div
                              className="cart-qty-control"
                              role="group"
                              aria-label={`Quantity for ${item.name}`}
                            >
                              <button
                                type="button"
                                className="cart-qty-btn"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                disabled={item.quantity <= 1}
                                aria-label="Decrease quantity"
                                title={item.quantity <= 1 ? "Minimum quantity is 1" : "Decrease quantity"}
                              >
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                              </button>
                              <span className="cart-qty-value" aria-live="polite">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                className="cart-qty-btn"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                aria-label="Increase quantity"
                                title="Increase quantity"
                              >
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <line x1="12" y1="5" x2="12" y2="19" />
                                  <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                              </button>
                            </div>

                            <button
                              type="button"
                              className="cart-item-remove-link"
                              onClick={() => removeItem(item.id)}
                              aria-label={`Remove ${item.name} from bag`}
                            >
                              Remove
                            </button>
                          </div>

                          {/* Structured Pricing Summary */}
                          <div className="cart-item-pricing-summary">
                            {pricing.discountAmount > 0 ? (
                              <>
                                <div className="cart-item-price-row cart-item-price-row--regular">
                                  <span className="price-label">Regular subtotal:</span>
                                  <span className="price-val price-val--old">
                                    {formatCartCurrency(pricing.regularSubtotal)}
                                  </span>
                                </div>
                                <div className="cart-item-price-row cart-item-price-row--final">
                                  <span className="price-label">Final item total:</span>
                                  <span className="price-val price-val--final">
                                    {formatCartCurrency(pricing.finalTotal)}
                                  </span>
                                </div>
                                <div className="cart-item-price-row cart-item-price-row--savings">
                                  <span className="price-label">Savings:</span>
                                  <span className="price-val price-val--savings">
                                    {formatCartCurrency(pricing.discountAmount)}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <div className="cart-item-price-row cart-item-price-row--final">
                                <span className="price-label">Final item total:</span>
                                <span className="price-val price-val--final">
                                  {formatCartCurrency(pricing.finalTotal)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Right Column: Order Summary for Selected Items & WhatsApp Action */}
            <aside className="cart-summary-sidebar" aria-label="Order summary">
              <div className="cart-summary-box">
                <div className="cart-summary-header">
                  <h2 className="cart-summary-title">Order Summary</h2>
                  {showSelectionControls && (
                    <span className="cart-summary-badge">Selected Items</span>
                  )}
                </div>

                <div className="cart-summary-rows">
                  {showSelectionControls ? (
                    <>
                      <div className="cart-summary-row">
                        <span className="cart-summary-label">Selected Items</span>
                        <span className="cart-summary-val">
                          {selectedCount} of {items.length} {items.length === 1 ? "item" : "items"}
                        </span>
                      </div>

                      <div className="cart-summary-row">
                        <span className="cart-summary-label">Selected Units</span>
                        <span className="cart-summary-val">
                          {selectedTotalUnits} {selectedTotalUnits === 1 ? "unit" : "units"}
                        </span>
                      </div>

                      <div className="cart-summary-row">
                        <span className="cart-summary-label">Regular Subtotal</span>
                        <span className="cart-summary-val">
                          {formatCartCurrency(selectedTotals.regularSubtotal)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="cart-summary-row">
                        <span className="cart-summary-label">Total Items</span>
                        <span className="cart-summary-val">
                          {items.length} {items.length === 1 ? "item" : "items"}
                        </span>
                      </div>

                      {totalCount > 1 && (
                        <div className="cart-summary-row">
                          <span className="cart-summary-label">Total Units</span>
                          <span className="cart-summary-val">
                            {totalCount} {totalCount === 1 ? "unit" : "units"}
                          </span>
                        </div>
                      )}

                      <div className="cart-summary-row">
                        <span className="cart-summary-label">
                          {selectedTotals.totalSavings > 0 ? "Regular Subtotal" : "Subtotal"}
                        </span>
                        <span className="cart-summary-val">
                          {formatCartCurrency(selectedTotals.regularSubtotal)}
                        </span>
                      </div>
                    </>
                  )}

                  {selectedTotals.totalSavings > 0 && (
                    <div className="cart-summary-row cart-summary-savings-row">
                      <span className="cart-summary-label">Offer Savings</span>
                      <span className="cart-summary-val">
                        -{formatCartCurrency(selectedTotals.totalSavings)}
                      </span>
                    </div>
                  )}

                  <div className="cart-summary-row cart-summary-row--final">
                    <span className="cart-summary-label">
                      {showSelectionControls ? "Final Order Total" : "Final Total"}
                    </span>
                    <span className="cart-summary-val cart-summary-val--highlight">
                      {formatCartCurrency(selectedTotals.finalTotal)}
                    </span>
                  </div>

                  <div className="cart-summary-row cart-summary-row--note">
                    <span className="cart-summary-note">
                      {showSelectionControls
                        ? selectedCount > 0
                          ? "Prices include all taxes. Only selected items are submitted with your WhatsApp order."
                          : "Select at least one item from your bag to enable WhatsApp ordering."
                        : "Prices are inclusive of all taxes. Final order confirmation and delivery details are finalized with Style Edit via WhatsApp."}
                    </span>
                  </div>
                </div>

                {/* Primary WhatsApp Order Action */}
                {selectedCount > 0 ? (
                  <button
                    type="button"
                    onClick={handleWhatsAppCheckout}
                    disabled={isProcessingOrder}
                    className={`cart-whatsapp-cta ${isProcessingOrder ? "cart-whatsapp-cta--loading" : ""}`}
                    aria-label={
                      showSelectionControls
                        ? `Order ${selectedCount} selected items via WhatsApp`
                        : "Order via WhatsApp directly with Style Edit"
                    }
                  >
                    {isProcessingOrder ? (
                      <>
                        <span className="cart-btn-spinner" aria-hidden="true" />
                        <span>Creating Order & Invoice...</span>
                      </>
                    ) : (
                      <>
                        <WhatsAppIcon size={20} />
                        <span>
                          {showSelectionControls
                            ? `Order via WhatsApp (${selectedCount})`
                            : "Order via WhatsApp"}
                        </span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="cart-whatsapp-cta cart-whatsapp-cta--disabled"
                    aria-disabled="true"
                    title="Select at least one item to proceed"
                  >
                    <WhatsAppIcon size={20} />
                    <span>Select items to order</span>
                  </button>
                )}

                {/* Secondary Desktop / Manual Download PDF Action */}
                {selectedCount > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadPdfOnly}
                    disabled={isProcessingOrder || isDownloadingPdfOnly}
                    className="cart-download-pdf-btn"
                    title="Download order summary PDF with images directly to your device"
                  >
                    {isDownloadingPdfOnly ? (
                      <>
                        <span className="cart-btn-spinner cart-btn-spinner--subtle" aria-hidden="true" />
                        <span>Preparing PDF...</span>
                      </>
                    ) : (
                      <>
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <span>Download Order PDF</span>
                      </>
                    )}
                  </button>
                )}

                {/* Clear Notice for Manual Download PDF Action */}
                {downloadNotice && (
                  <div className="cart-pdf-notice" role="status">
                    <div className="cart-pdf-notice-body">
                      <div className="cart-pdf-notice-badge">Order PDF Generated</div>
                      <p className="cart-pdf-notice-text">
                        Invoice PDF for order <strong>{downloadNotice.orderRef}</strong> has been downloaded to your device.
                      </p>
                    </div>
                    <div className="cart-pdf-notice-actions">
                      <div className="cart-pdf-notice-btn-group">
                        {downloadNotice.blob && (
                          <button
                            type="button"
                            onClick={() => downloadPdfBlob(downloadNotice.blob!, `order-${downloadNotice.orderRef}.pdf`)}
                            className="cart-pdf-notice-action-btn"
                          >
                            Re-download PDF
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setDownloadNotice(null)}
                        className="cart-pdf-notice-dismiss-btn"
                        aria-label="Dismiss notice"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}

                {orderError && (
                  <p className="cart-whatsapp-warning" role="alert">
                    {orderError}
                  </p>
                )}

                {showSelectionControls && selectedCount === 0 && (
                  <p className="cart-whatsapp-warning" role="alert">
                    Please select at least one item to proceed with your WhatsApp order.
                  </p>
                )}

                <div className="cart-continue-wrap">
                  <Link href="/shop/women" className="cart-continue-link" prefetch={true}>
                    <span>← Continue Shopping</span>
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
