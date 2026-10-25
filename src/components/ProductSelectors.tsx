"use client";

// ProductSelectors — client component handling color, size, quantity selection,
// and purchase controls on the product detail page, matching the reference design.

import { useState, useMemo } from "react";
import type { Product } from "@/data/products";
import Icon from "@/components/Icon";

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
  const [selectedColor, setSelectedColor] = useState<string>(
    hasColors ? product.colors[0] : ""
  );

  const handleColorChange = (newColor: string) => {
    setSelectedColor(newColor);
    setUserSelectedSize(null);
  };

  // Compute variants configured for the currently selected color
  const variantsForSelectedColor = useMemo(() => {
    if (!isDb || !product.variants) return [];
    if (!selectedColor) return product.variants;
    return product.variants.filter(
      (v) => v.color.trim().toLowerCase() === selectedColor.trim().toLowerCase()
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

  const [quantity, setQuantity] = useState<number>(1);
  const [added, setAdded] = useState<boolean>(false);

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

  const handleAddToCart = () => {
    if (!isCurrentSelectionAvailable) return;
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const getButtonText = () => {
    if (added) return "Added to cart";
    if (isDb) {
      if (availableSizes.length === 0) return "Unavailable";
      if (!isCurrentSelectionAvailable) return "Out of stock";
    }
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
              const isSelected = selectedColor === color;
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
                    if (isSizeAvailable) setUserSelectedSize(size);
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
            className="btn-add-to-cart"
            aria-label={`Add ${product.name} to cart`}
            disabled={!isCurrentSelectionAvailable}
            onClick={handleAddToCart}
          >
            <Icon name="bag" size={18} />
            <span>{getButtonText()}</span>
          </button>
        </div>

        {/* Buy it now button */}
        <button
          id="buy-it-now-button"
          type="button"
          className="btn-buy-it-now"
          aria-label={`Buy ${product.name} now`}
          disabled
          title="Checkout functionality coming soon"
        >
          Buy it now
        </button>
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
