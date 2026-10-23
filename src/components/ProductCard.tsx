// ProductCard — reusable product card used on catalogue and related sections.
// Server component with refined typography and spacing. Color swatches removed from cards.

import Link from "next/link";
import type { Product } from "@/data/products";
import { formatPrice } from "@/data/products";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const hasDiscount =
    typeof product.sale === "number" && product.sale < product.price;

  return (
    <article className="product-card">
      <Link
        href={`/product/${product.slug}`}
        className="product-image-wrap"
        aria-label={`View ${product.name}`}
        tabIndex={0}
      >
        {hasDiscount && <span className="sale-tag">EDIT PRICE</span>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="product-image"
          src={product.image}
          alt={product.alt}
          loading="lazy"
        />
      </Link>
      <div className="product-meta">
        <h3 className="product-card-title">
          <Link
            href={`/product/${product.slug}`}
            className="product-card-title-link"
          >
            {product.name}
          </Link>
        </h3>
        <div className="price product-card-price">
          {hasDiscount && (
            <span className="old-price">{formatPrice(product.price)}</span>
          )}
          <span className="current-price">
            {formatPrice(product.sale ?? product.price)}
          </span>
        </div>
      </div>
    </article>
  );
}
