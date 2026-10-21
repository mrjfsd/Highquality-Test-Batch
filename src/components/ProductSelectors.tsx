"use client";

// ProductSelectors — client component handling color and size selection on the product detail page.
// The parent server component renders the static content; this manages interactive state only.

import { useState } from "react";
import type { Product } from "@/data/products";
import { formatPrice } from "@/data/products";
import Icon from "@/components/Icon";

const SIZES = ["XS", "S", "M", "L", "XL"] as const;

interface ProductSelectorsProps {
  product: Product;
}

export default function ProductSelectors({ product }: ProductSelectorsProps) {
  const [selectedColor, setSelectedColor] = useState(product.colors[0]);
  const [selectedSize, setSelectedSize] = useState<string>("M");

  const displayPrice = product.sale ?? product.price;

  return (
    <>
      {/* Color selector */}
      <div className="selector">
        <div className="selector-head">
          <span>Color</span>
          <small>
            {selectedColor === product.colors[0] ? "Selected" : "Alternative"}
          </small>
        </div>
        <div className="color-options">
          {product.colors.map((color) => (
            <button
              key={color}
              aria-label={`Select color ${color}`}
              className={selectedColor === color ? "selected" : ""}
              style={{ backgroundColor: color }}
              onClick={() => setSelectedColor(color)}
            />
          ))}
        </div>
      </div>

      {/* Size selector */}
      <div className="selector">
        <div className="selector-head">
          <span>Size</span>
          <button type="button">Size guide</button>
        </div>
        <div className="size-options">
          {SIZES.map((size) => (
            <button
              key={size}
              className={selectedSize === size ? "selected" : ""}
              onClick={() => setSelectedSize(size)}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Add to bag — placeholder, functional cart is out of scope for this phase */}
      <button
        id="add-to-bag-button"
        className="button button--dark add-button"
        aria-label={`Add ${product.name} to bag — ${formatPrice(displayPrice)}`}
        disabled
        title="Cart functionality coming soon"
      >
        Add to bag{" "}
        <span>{formatPrice(displayPrice)}</span>
      </button>

      {/* Product detail accordions */}
      <div className="detail-accordions">
        <details open>
          <summary>
            Product details <Icon name="plus" />
          </summary>
          <dl>
            <div>
              <dt>Fabric</dt>
              <dd>{product.fabric}</dd>
            </div>
            <div>
              <dt>Fit</dt>
              <dd>{product.fit}</dd>
            </div>
            <div>
              <dt>Care</dt>
              <dd>Cold gentle wash, line dry</dd>
            </div>
          </dl>
        </details>
        <details>
          <summary>
            Delivery &amp; returns <Icon name="plus" />
          </summary>
          <p>Standard delivery in 3–5 working days.</p>
        </details>
      </div>
    </>
  );
}
