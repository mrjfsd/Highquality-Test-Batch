// ProductCard — reusable product card used on home, listing, and related sections.
// Server component: the link is a standard Next.js Link, no client state needed.

import Link from "next/link";
import type { Product } from "@/data/products";
import { formatPrice } from "@/data/products";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  return (
    <article className="product-card">
      <Link
        href={`/product/${product.slug}`}
        className="product-image-wrap"
        aria-label={`View ${product.name}`}
        tabIndex={0}
      >
        {product.sale && <span className="sale-tag">EDIT PRICE</span>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="product-image"
          src={product.image}
          alt={product.alt}
          loading="lazy"
        />
      </Link>
      <div className="product-meta">
        <div>
          <h3>{product.name}</h3>
          <div className="price">
            {product.sale && (
              <span className="old-price">{formatPrice(product.price)}</span>
            )}{" "}
            {formatPrice(product.sale ?? product.price)}
          </div>
        </div>
        <div className="swatches" aria-label="Available colors">
          {product.colors.map((color) => (
            <span key={color} style={{ backgroundColor: color }} />
          ))}
        </div>
      </div>
    </article>
  );
}
