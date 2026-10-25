"use client";

import React, { useState, useMemo, useRef } from "react";
import Link from "next/link";
import type { Product, ProductGalleryImage } from "@/data/products";
import { formatPrice } from "@/data/products";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const hasDiscount =
    typeof product.sale === "number" && product.sale < product.price;

  // Deduplicate and gather all distinct images
  const imageList = useMemo<ProductGalleryImage[]>(() => {
    if (Array.isArray(product.images) && product.images.length > 0) {
      const seen = new Set<string>();
      const valid = product.images.filter((img) => {
        if (!img?.url || seen.has(img.url)) return false;
        seen.add(img.url);
        return true;
      });
      if (valid.length > 0) return valid;
    }
    return [{ url: product.image, alt: product.alt, is_primary: true }];
  }, [product.images, product.image, product.alt]);

  const hasMultipleImages = imageList.length > 1;
  const [currentIndex, setCurrentIndex] = useState(0);

  // Safeguard index within bounds
  const safeIndex =
    ((currentIndex % imageList.length) + imageList.length) % imageList.length;
  const currentImage = imageList[safeIndex] || {
    url: product.image,
    alt: product.alt,
  };

  const handlePrev = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + imageList.length) % imageList.length);
  };

  const handleNext = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % imageList.length);
  };

  // Touch gesture support without blocking vertical page scrolling
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!hasMultipleImages) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !hasMultipleImages) return;
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    // Detect horizontal swipe if deltaX is significant and primarily horizontal
    if (Math.abs(deltaX) > 36 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
      if (deltaX < 0) {
        // Swiped left -> next
        setCurrentIndex((prev) => (prev + 1) % imageList.length);
      } else {
        // Swiped right -> prev
        setCurrentIndex(
          (prev) => (prev - 1 + imageList.length) % imageList.length
        );
      }
    }
  };

  return (
    <article className="product-card">
      <div
        className="product-image-wrap"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Link
          href={`/product/${product.slug}`}
          className="product-image-link"
          aria-label={`View ${product.name}`}
          tabIndex={0}
        >
          {hasDiscount && <span className="sale-tag">EDIT PRICE</span>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="product-image"
            src={currentImage.url}
            alt={currentImage.alt || product.name}
            loading="lazy"
          />
        </Link>

        {hasMultipleImages && (
          <div className="product-card-arrows" aria-hidden="false">
            <button
              type="button"
              className="product-card-arrow product-card-arrow--prev"
              onClick={handlePrev}
              aria-label={`Previous image for ${product.name}`}
              tabIndex={0}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            <button
              type="button"
              className="product-card-arrow product-card-arrow--next"
              onClick={handleNext}
              aria-label={`Next image for ${product.name}`}
              tabIndex={0}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        )}
      </div>

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
