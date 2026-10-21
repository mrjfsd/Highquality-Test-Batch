"use client";

// ProductSelectors — client component handling color, size, quantity selection,
// and purchase controls on the product detail page, matching the reference design.

import { useState } from "react";
import type { Product } from "@/data/products";
import Icon from "@/components/Icon";

const SIZES = ["XS", "S", "M", "L", "XL"] as const;

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

function formatColorLabel(rawColor: string): string {
  const normalized = rawColor.trim().toLowerCase();
  if (COLOR_NAMES[normalized]) {
    return COLOR_NAMES[normalized];
  }
  if (!rawColor.startsWith("#")) {
    return rawColor.charAt(0).toUpperCase() + rawColor.slice(1);
  }
  return rawColor;
}

interface ProductSelectorsProps {
  product: Product;
}

export default function ProductSelectors({ product }: ProductSelectorsProps) {
  const hasColors = Boolean(product.colors && product.colors.length > 0);
  const [selectedColor, setSelectedColor] = useState<string>(
    hasColors ? product.colors[0] : ""
  );
  const [selectedSize, setSelectedSize] = useState<string>("M");
  const [quantity, setQuantity] = useState<number>(1);
  const [added, setAdded] = useState<boolean>(false);

  const handleAddToCart = () => {
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="product-selectors">
      {/* Color selection — small circular swatches in horizontal row */}
      {hasColors && (
        <div className="selector-group">
          <div className="selector-head">
            <span className="selector-label">COLOR</span>
            <small className="selector-state">Selected</small>
          </div>
          <div
            className="color-swatches-row"
            role="radiogroup"
            aria-label="Select color"
          >
            {product.colors.map((color) => {
              const isSelected = selectedColor === color;
              const label = formatColorLabel(color);
              return (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={label}
                  title={label}
                  className={`color-swatch-btn ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedColor(color)}
                >
                  <span
                    className="color-swatch-inner"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Size selection — compact rectangular buttons without Size Guide */}
      <div className="selector-group">
        <div className="selector-head">
          <span className="selector-label">SIZE</span>
        </div>
        <div className="size-row" role="radiogroup" aria-label="Select size">
          {SIZES.map((size) => {
            const isSelected = selectedSize === size;
            return (
              <button
                key={size}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`Select size ${size}`}
                className={`size-btn ${isSelected ? "selected" : ""}`}
                onClick={() => setSelectedSize(size)}
              >
                {size}
              </button>
            );
          })}
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
              disabled={quantity <= 1}
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
            onClick={handleAddToCart}
          >
            <Icon name="bag" size={18} />
            <span>{added ? "Added to cart" : "Add to cart"}</span>
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

      {/* Product details collapsible specifications with clean plus (+) icons */}
      <div className="detail-accordions">
        <details open>
          <summary>
            <span>PRODUCT DETAILS</span>
            <span className="accordion-icon" aria-hidden="true">
              <Icon name="plus" size={14} />
            </span>
          </summary>
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
            <div>
              <dt>Care</dt>
              <dd>Cold gentle wash, line dry</dd>
            </div>
          </dl>
        </details>
        <details>
          <summary>
            <span>SHIPPING &amp; RETURNS</span>
            <span className="accordion-icon" aria-hidden="true">
              <Icon name="plus" size={14} />
            </span>
          </summary>
          <p>Standard delivery in 3–5 working days. Complimentary returns within 14 days.</p>
        </details>
        <details>
          <summary>
            <span>AFTERCARE</span>
            <span className="accordion-icon" aria-hidden="true">
              <Icon name="plus" size={14} />
            </span>
          </summary>
          <p>Cold delicate wash or dry clean. Hang dry away from direct heat to preserve fabric silhouette.</p>
        </details>
      </div>
    </div>
  );
}
