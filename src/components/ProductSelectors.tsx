"use client";

// ProductSelectors — client component handling color, size, quantity selection,
// and purchase controls on the product detail page, matching the reference design.

import { useState, useMemo } from "react";
import type { Product } from "@/data/products";
import { formatPrice } from "@/data/products";
import Icon from "@/components/Icon";
import { useProductColor } from "@/components/ProductColorContext";
import { areColorsMatching, resolveProductColorImage, resolveProductColorImageObject } from "@/lib/products/colors";
import { useCart } from "@/context/CartContext";
import { calculateItemPriceWithOffers } from "@/lib/pricing/quantity-offers";
import { WhatsAppIcon } from "@/components/Icons";
import {
  generateBuyNowWhatsAppUrl,
  STORE_WHATSAPP_NUMBER,
} from "@/lib/cart/cart-utils";

const FALLBACK_MOCK_SIZES = ["XS", "S", "M", "L", "XL"] as const;

// Human-friendly labels for hex colors used in Style Edit's catalog
const COLOR_NAMES: Record<string, string> = {
  "#343434": "Charcoal",
  "#c2b8a8": "Oatmeal",
  "#e7e3dc": "Off-White",
  "#262626": "Black",
  "#827c74": "Taupe",
  "#ece9e2": "Ivory",
  "#5f625e": "Slate Grey",
  "#8c8983": "Warm Grey",
  "#232323": "Deep Black",
  "#222222": "Black",
  "#b3aa9d": "Sand",
  "#e9e9e7": "Chalk White",
  "#a5adb4": "Mist Blue",
  "#202020": "Washed Black",
  "#e7e3da": "Ecru",
  "#d9d6cf": "Stone",
  "#252525": "Ink Black",
  "#d5cda7": "Pale Olive",
  "#50616c": "Steel Blue",
  "#c6b7a7": "Clay",
  "#6c6c72": "Heather Grey",
  "#a49b8b": "Khaki",
  "#39423d": "Dark Olive",
  "#c8c2b6": "Natural",
  "#444a4b": "Graphite",
};

// Known color names mapped to hex for swatch display
const COLOR_NAME_TO_HEX: Record<string, string> = {
  black: "#1a1a1a",
  white: "#f8f8f8",
  charcoal: "#343434",
  grey: "#808080",
  gray: "#808080",
  "light grey": "#d1d5db",
  "light gray": "#d1d5db",
  navy: "#1a2b49",
  blue: "#2b5c8f",
  olive: "#556b2f",
  green: "#2e5a36",
  beige: "#d9d2c5",
  khaki: "#a49b8b",
  brown: "#5c4033",
  pink: "#e8a598",
  red: "#9e2a2b",
  maroon: "#800020",
  burgundy: "#781d29",
  orange: "#f97316",
  yellow: "#eab308",
  purple: "#9333ea",
  cream: "#fffdd0",
  oatmeal: "#c2b8a8",
  taupe: "#827c74",
  ivory: "#ece9e2",
  stone: "#d9d6cf",
  ecru: "#e7e3da",
  sand: "#b3aa9d",
};

function formatColorLabel(rawColor: string): string {
  if (!rawColor) return "";
  const normalized = rawColor.trim().toLowerCase();
  if (COLOR_NAMES[normalized]) {
    return COLOR_NAMES[normalized];
  }
  if (!rawColor.startsWith("#")) {
    return rawColor.charAt(0).toUpperCase() + rawColor.slice(1);
  }
  return rawColor;
}

function resolveSwatchBackground(rawColor: string): string {
  if (!rawColor) return "#222222";
  const trimmed = rawColor.trim();
  if (trimmed.startsWith("#") || trimmed.startsWith("rgb") || trimmed.startsWith("hsl")) {
    return trimmed;
  }
  const lower = trimmed.toLowerCase();
  if (COLOR_NAME_TO_HEX[lower]) {
    return COLOR_NAME_TO_HEX[lower];
  }
  return trimmed;
}

interface ProductSelectorsProps {
  product: Product;
}

function isDatabaseBackedProduct(product: Product): boolean {
  if (product.is_database === true) return true;
  if (typeof product.id === "string") return true;
  if (Boolean(product.created_at)) return true;
  if (Array.isArray(product.variants)) return true;
  return false;
}

export default function ProductSelectors({ product }: ProductSelectorsProps) {
  const isDb = isDatabaseBackedProduct(product);

  const hasColors = Boolean(product.colors && product.colors.length > 0);
  const colorContext = useProductColor();
  const [internalSelectedColor, setInternalSelectedColor] = useState<string>(
    hasColors ? product.colors[0] : ""
  );

  const selectedColor = colorContext ? colorContext.selectedColor : internalSelectedColor;
  const setSelectedColor = colorContext ? colorContext.setSelectedColor : setInternalSelectedColor;

  const handleColorChange = (newColor: string) => {
    setSelectedColor(newColor);
    setUserSelectedSize(null);
    setValidationError(null);
  };

  // Compute variants configured for the currently selected color
  const variantsForSelectedColor = useMemo(() => {
    if (!isDb || !product.variants) return [];
    if (!selectedColor) return product.variants;
    return product.variants.filter(
      (v) => areColorsMatching(v.color, selectedColor)
    );
  }, [isDb, product.variants, selectedColor]);

  // Determine available sizes based on configured variants for this color
  const availableSizes = useMemo(() => {
    if (!isDb) {
      // Legacy mock fallback for homepage products only
      return Array.from(FALLBACK_MOCK_SIZES);
    }
    // Collect unique sizes specifically configured for this color
    const uniqueSizes: string[] = [];
    variantsForSelectedColor.forEach((v) => {
      if (v.size && !uniqueSizes.includes(v.size)) {
        uniqueSizes.push(v.size);
      }
    });
    return uniqueSizes;
  }, [isDb, variantsForSelectedColor]);

  // User selected size state
  const [userSelectedSize, setUserSelectedSize] = useState<string | null>(null);

  // Effective selected size: if user selected a size that is valid for the current color, use it;
  // otherwise auto-select the first in-stock size, or first configured size for this color.
  const selectedSize = useMemo(() => {
    if (!isDb) {
      return userSelectedSize || "M";
    }
    if (availableSizes.length === 0) {
      return "";
    }
    if (userSelectedSize && availableSizes.includes(userSelectedSize)) {
      return userSelectedSize;
    }
    const firstInStock = variantsForSelectedColor.find((v) => v.is_available);
    return firstInStock ? firstInStock.size : (availableSizes[0] || "");
  }, [isDb, userSelectedSize, availableSizes, variantsForSelectedColor]);

  const { items, addItem, removeItem, getProductOffer } = useCart();
  const [quantity, setQuantity] = useState<number>(1);

  // Active quantity offer lookup from product prop or CartContext offers map
  const activeOffer = useMemo(() => {
    if (product.offers && product.offers.length > 0) {
      return product.offers[0];
    }
    return getProductOffer(product.id);
  }, [product.offers, product.id, getProductOffer]);

  // Dynamic pricing calculation evaluated via shared pricing engine
  const pricingCalculation = useMemo(() => {
    return calculateItemPriceWithOffers(quantity, product.price, activeOffer);
  }, [quantity, product.price, activeOffer]);

  const baseOfferSavings = useMemo(() => {
    if (!activeOffer) return 0;
    return Math.max(0, activeOffer.qualifying_quantity * product.price - activeOffer.bundle_price);
  }, [activeOffer, product.price]);

  const unitsNeeded = useMemo(() => {
    if (!activeOffer) return 0;
    return Math.max(0, activeOffer.qualifying_quantity - quantity);
  }, [activeOffer, quantity]);

  // Check if current selection corresponds to an available in-stock variant
  const currentVariant = useMemo(() => {
    if (!isDb) return null;
    return variantsForSelectedColor.find(
      (v) => v.size.trim().toLowerCase() === selectedSize.trim().toLowerCase()
    );
  }, [isDb, variantsForSelectedColor, selectedSize]);

  const isCurrentSelectionAvailable = useMemo(() => {
    if (!isDb) {
      return Boolean(selectedSize);
    }
    if (availableSizes.length === 0 || !selectedSize) {
      return false;
    }
    return Boolean(currentVariant && currentVariant.is_available);
  }, [isDb, availableSizes.length, selectedSize, currentVariant]);

  // Effective selected variant attributes
  const effectiveVariantId = currentVariant?.id || null;
  const effectiveSize = selectedSize || null;
  const effectiveColor = selectedColor ? formatColorLabel(selectedColor) : null;

  // Derive cart presence from shared CartContext items (persistent, synced with catalog & refresh)
  const currentCartItem = useMemo(() => {
    return items.find((item) => {
      if (String(item.productId) !== String(product.id)) return false;

      if (effectiveVariantId && item.variantId) {
        if (String(item.variantId) !== String(effectiveVariantId)) return false;
      }

      const itemSize = item.size ? item.size.trim().toLowerCase() : "";
      const curSize = effectiveSize ? effectiveSize.trim().toLowerCase() : "";
      if (itemSize !== curSize) return false;

      const itemColor = item.color ? item.color.trim().toLowerCase() : "";
      const curColor = effectiveColor ? effectiveColor.trim().toLowerCase() : "";
      if (itemColor !== curColor) return false;

      return true;
    });
  }, [items, product.id, effectiveVariantId, effectiveSize, effectiveColor]);

  const isInCart = Boolean(currentCartItem);

  // Toggle behavior: Add when absent, remove when present
  const handleAddToCartToggle = () => {
    if (!isCurrentSelectionAvailable) return;

    if (isInCart && currentCartItem) {
      removeItem(currentCartItem.id);
      return;
    }

    const resolvedColorImage = resolveProductColorImage(product, selectedColor);

    addItem({
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        image: resolvedColorImage || product.image,
        images: product.images,
        colors: product.colors,
      },
      variantId: effectiveVariantId,
      size: effectiveSize,
      color: effectiveColor,
      quantity,
    });
  };

  const [validationError, setValidationError] = useState<string | null>(null);
  const [isProcessingBuyNow, setIsProcessingBuyNow] = useState<boolean>(false);

  const handleBuyNow = () => {
    if (isProcessingBuyNow) return;

    // 1. Validate required color selection where applicable
    if (hasColors && !selectedColor) {
      setValidationError("Please select a color before ordering.");
      return;
    }

    // 2. Validate required size selection where applicable
    if (availableSizes.length > 0 && !selectedSize) {
      setValidationError("Please select a size before ordering.");
      return;
    }

    // 3. Validate stock availability
    if (!isCurrentSelectionAvailable) {
      setValidationError("The selected option is currently out of stock.");
      return;
    }

    // 4. Validate store WhatsApp number
    const cleanPhone = STORE_WHATSAPP_NUMBER.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 7) {
      setValidationError("Store WhatsApp order number is not configured.");
      return;
    }

    setValidationError(null);
    setIsProcessingBuyNow(true);

    const resolvedImageObj = resolveProductColorImageObject(product, selectedColor);
    const resolvedColorImage =
      resolvedImageObj?.url || resolvedImageObj?.proxyUrl || product.image;
    const resolvedImageId =
      resolvedImageObj?.id || (product as { imageId?: string }).imageId || null;

    try {
      const url = generateBuyNowWhatsAppUrl({
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          image: resolvedColorImage || product.image,
          imageId: resolvedImageId,
          price: product.price,
        },
        variantId: effectiveVariantId,
        size: effectiveSize,
        color: effectiveColor,
        quantity,
        activeOffer,
      });

      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        setValidationError("Could not generate WhatsApp order URL.");
      }
    } catch (err) {
      console.error("[BuyNow] Error generating WhatsApp order:", err);
      setValidationError("An error occurred while opening WhatsApp.");
    } finally {
      // Debounce repeated clicks
      setTimeout(() => {
        setIsProcessingBuyNow(false);
      }, 1000);
    }
  };

  const getButtonText = () => {
    if (isDb) {
      if (availableSizes.length === 0) return "Unavailable";
      if (!isCurrentSelectionAvailable) return "Out of stock";
    }
    if (isInCart) return "✓ Added";
    return "Add to cart";
  };

  return (
    <div className="product-selectors">
      {/* Color selection — small circular swatches in horizontal row */}
      {hasColors && (
        <div className="selector-group">
          <div className="selector-head">
            <span className="selector-label">COLOR</span>
            <small className="selector-state">
              {formatColorLabel(selectedColor) || "Selected"}
            </small>
          </div>
          <div
            className="color-swatches-row"
            role="radiogroup"
            aria-label="Select color"
          >
            {product.colors.map((color) => {
              const isSelected = areColorsMatching(selectedColor, color);
              const label = formatColorLabel(color);
              const bgColor = resolveSwatchBackground(color);
              return (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={label}
                  title={label}
                  className={`color-swatch-btn ${isSelected ? "selected" : ""}`}
                  onClick={() => handleColorChange(color)}
                >
                  <span
                    className="color-swatch-inner"
                    style={{ backgroundColor: bgColor }}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Size selection — ONLY configured sizes for database products */}
      <div className="selector-group">
        <div className="selector-head">
          <span className="selector-label">SIZE</span>
          {isDb && !isCurrentSelectionAvailable && selectedSize && (
            <small className="selector-state text-rose-600">Out of Stock</small>
          )}
        </div>
        <div className="size-row" role="radiogroup" aria-label="Select size">
          {availableSizes.length > 0 ? (
            availableSizes.map((size) => {
              const isSelected = selectedSize === size;
              const variantMatch = isDb
                ? variantsForSelectedColor.find(
                    (v) => v.size.trim().toLowerCase() === size.trim().toLowerCase()
                  )
                : null;
              const isSizeAvailable = isDb
                ? Boolean(variantMatch && variantMatch.is_available)
                : true;

              return (
                <button
                  key={size}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`Select size ${size}${!isSizeAvailable ? " (Out of stock)" : ""}`}
                  disabled={!isSizeAvailable}
                  title={!isSizeAvailable ? `${size} - Out of stock` : `Size ${size}`}
                  className={`size-btn ${isSelected ? "selected" : ""} ${
                    !isSizeAvailable ? "disabled" : ""
                  }`}
                  onClick={() => {
                    if (isSizeAvailable) {
                      setUserSelectedSize(size);
                      setValidationError(null);
                    }
                  }}
                >
                  {size}
                </button>
              );
            })
          ) : (
            <p className="no-sizes-msg">No sizes currently configured for this color.</p>
          )}
        </div>
      </div>

      {/* Active Quantity Offer Banner & Interactive Preview */}
      {activeOffer && (
        <div className="detail-offer-box" aria-live="polite">
          <div className="detail-offer-head">
            <div className="detail-offer-badge">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                <path d="M7 7h.01" />
              </svg>
              <span>Buy {activeOffer.qualifying_quantity} for ₹{Math.round(activeOffer.bundle_price).toLocaleString("en-IN")}</span>
            </div>
            {baseOfferSavings > 0 && (
              <span className="detail-offer-savings-pill">
                Save ₹{Math.round(baseOfferSavings).toLocaleString("en-IN")}
              </span>
            )}
          </div>

          {pricingCalculation.hasOfferApplied ? (
            <div className="detail-offer-pricing-preview">
              <div>
                <span style={{ fontSize: "11px", color: "rgba(247, 243, 238, 0.7)", marginRight: "6px" }}>
                  For {quantity} {quantity === 1 ? "item" : "items"}:
                </span>
                <span className="old-subtotal">{formatPrice(pricingCalculation.regularSubtotal)}</span>
                <span className="deal-total">{formatPrice(pricingCalculation.finalTotal)}</span>
              </div>
              <span className="detail-offer-savings-pill">
                You save {formatPrice(pricingCalculation.totalSavings)}
              </span>
            </div>
          ) : (
            <div className="detail-offer-tip">
              <span>
                Add <strong>{unitsNeeded} more</strong> to unlock this offer ({formatPrice(pricingCalculation.regularSubtotal)} regular)
              </span>
              <button
                type="button"
                className="detail-offer-qualify-btn"
                onClick={() => setQuantity(activeOffer.qualifying_quantity)}
                title={`Set quantity to ${activeOffer.qualifying_quantity}`}
              >
                Set to {activeOffer.qualifying_quantity}
              </button>
            </div>
          )}

          {pricingCalculation.hasOfferApplied && pricingCalculation.remainingUnits > 0 && (
            <div className="detail-offer-tip">
              <span>
                Add <strong>{activeOffer.qualifying_quantity - pricingCalculation.remainingUnits} more</strong> to qualify for another bundle!
              </span>
            </div>
          )}
        </div>
      )}

      {/* Quantity and purchase actions */}
      <div className="purchase-controls">
        <div className="purchase-row">
          {/* Quantity selector with minus, current quantity, and plus */}
          <div className="quantity-selector" aria-label="Quantity selector">
            <button
              type="button"
              className="qty-btn"
              aria-label="Decrease quantity"
              disabled={quantity <= 1 || !isCurrentSelectionAvailable}
              onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
            >
              <Icon name="minus" size={14} />
            </button>
            <span className="qty-value" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              className="qty-btn"
              aria-label="Increase quantity"
              disabled={!isCurrentSelectionAvailable}
              onClick={() => setQuantity((prev) => prev + 1)}
            >
              <Icon name="plus" size={14} />
            </button>
          </div>

          {/* Add to cart button */}
          <button
            id="add-to-bag-button"
            type="button"
            className={`btn-add-to-cart ${isInCart ? "in-cart" : ""}`}
            aria-label={isInCart ? `Remove ${product.name} from cart` : `Add ${product.name} to cart`}
            disabled={!isCurrentSelectionAvailable}
            onClick={handleAddToCartToggle}
          >
            {!isInCart && <Icon name="bag" size={18} />}
            <span>{getButtonText()}</span>
          </button>
        </div>

        {/* Buy Now button via WhatsApp */}
        <button
          id="buy-it-now-button"
          type="button"
          className="btn-buy-it-now"
          aria-label={`Buy ${product.name} now via WhatsApp`}
          disabled={!isCurrentSelectionAvailable || isProcessingBuyNow}
          onClick={handleBuyNow}
        >
          <WhatsAppIcon size={18} />
          <span>{isProcessingBuyNow ? "Opening WhatsApp..." : "Buy Now"}</span>
        </button>

        {validationError && (
          <div className="buy-now-validation-error" role="alert">
            {validationError}
          </div>
        )}
      </div>

      {/* Product details specifications (permanently visible) */}
      <div className="product-details-section detail-accordions">
        <h2 className="product-details-heading">PRODUCT DETAILS</h2>
        <dl>
          {product.fabric && (
            <div>
              <dt>Fabric</dt>
              <dd>{product.fabric}</dd>
            </div>
          )}
          {product.fit && (
            <div>
              <dt>Fit</dt>
              <dd>{product.fit}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
