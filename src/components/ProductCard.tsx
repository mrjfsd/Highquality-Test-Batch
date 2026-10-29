"use client";

import React, { useState, useMemo, useRef } from "react";
import Link from "next/link";
import type { Product, ProductGalleryImage } from "@/data/products";
import { formatPrice } from "@/data/products";
import {
  getOptimizedImageUrl,
  getResponsiveImageSrcSet,
  RESPONSIVE_SIZES,
} from "@/lib/images/responsive";
import { useCart } from "@/context/CartContext";
import { resolveProductColorImage } from "@/lib/products/colors";

interface ProductCardProps {
  product: Product;
  priority?: boolean;
  isSalePage?: boolean;
}

const ProductCard = React.memo(function ProductCard({
  product,
  priority = false,
  isSalePage = false,
}: ProductCardProps) {
  const { items, addItem, removeItem, isLoaded, getProductOffer } = useCart();
  const [showSizeSelector, setShowSizeSelector] = useState(false);

  const activeOffer = useMemo(() => {
    if (product.offers && product.offers.length > 0) return product.offers[0];
    return getProductOffer(product.id);
  }, [product.offers, product.id, getProductOffer]);

  const offerBadge = useMemo(() => {
    if (!activeOffer || !activeOffer.is_active) return null;
    const effectiveUnitPrice = product.sale ?? product.price;
    const regularCost = activeOffer.qualifying_quantity * effectiveUnitPrice;
    const savings = Math.round((regularCost - activeOffer.bundle_price + Number.EPSILON) * 100) / 100;
    if (savings <= 0) return null;
    return `Buy ${activeOffer.qualifying_quantity} for ₹${Math.round(activeOffer.bundle_price).toLocaleString("en-IN")}`;
  }, [activeOffer, product.sale, product.price]);

  // Derive cart status directly from shared cart context
  const cartItemsForProduct = useMemo(() => {
    if (!isLoaded) return [];
    const pid = String(product.id).trim();
    return items.filter((item) => item.productId === pid);
  }, [items, product.id, isLoaded]);

  const isInCart = cartItemsForProduct.length > 0;

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

  // Determine available variants and sizes
  const availableVariants = useMemo(() => {
    if (!Array.isArray(product.variants) || product.variants.length === 0) return [];
    return product.variants.filter((v) => v.is_available);
  }, [product.variants]);

  const availableSizes = useMemo(() => {
    const set = new Set<string>();
    availableVariants.forEach((v) => {
      if (v.size && v.size.trim()) set.add(v.size.trim());
    });
    return Array.from(set);
  }, [availableVariants]);

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

  const triggerAddToCart = (size?: string | null, variantId?: string | null, color?: string | null) => {
    const resolvedColorImage = color ? resolveProductColorImage(product, color) : null;
    addItem({
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        image: resolvedColorImage || currentImage.url || product.image,
        images: product.images,
        colors: product.colors,
      },
      variantId: variantId || null,
      size: size || null,
      color: color || null,
      quantity: 1,
    });
    setShowSizeSelector(false);
  };

  const handleQuickAddClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // ── Toggle Behavior: If already in cart -> Remove / Undo ──
    if (isInCart) {
      if (availableSizes.length > 1) {
        if (cartItemsForProduct.length === 1) {
          // Exactly 1 variant in cart: remove it directly without ambiguity
          removeItem(cartItemsForProduct[0].id);
          setShowSizeSelector(false);
        } else {
          // Multiple distinct variants in cart: toggle size popup so user can choose which to remove
          setShowSizeSelector((prev) => !prev);
        }
      } else if (cartItemsForProduct.length > 0) {
        // Single size or non-variant product: remove it directly
        removeItem(cartItemsForProduct[0].id);
        setShowSizeSelector(false);
      }
      return;
    }

    // ── Not in cart: Add to cart ──
    if (availableSizes.length > 1) {
      // Must prompt customer to select size
      setShowSizeSelector((prev) => !prev);
      return;
    }

    if (availableSizes.length === 1) {
      // Exactly 1 size available: add directly
      const size = availableSizes[0];
      const match = availableVariants.find((v) => v.size.trim().toLowerCase() === size.toLowerCase());
      triggerAddToCart(size, match?.id, match?.color);
      return;
    }

    // No explicit size variants: add product directly
    triggerAddToCart(null, null, null);
  };

  const handleSelectSize = (size: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if this specific size is already in cart
    const existingItem = cartItemsForProduct.find(
      (item) => item.size?.trim().toLowerCase() === size.trim().toLowerCase()
    );

    if (existingItem) {
      // Toggle off / remove this size from cart
      removeItem(existingItem.id);
      if (cartItemsForProduct.length <= 1) {
        setShowSizeSelector(false);
      }
    } else {
      // Add this size to cart
      const match = availableVariants.find((v) => v.size.trim().toLowerCase() === size.toLowerCase());
      triggerAddToCart(size, match?.id, match?.color);
      setShowSizeSelector(false);
    }
  };

  const srcSet = getResponsiveImageSrcSet(currentImage.url);
  const optimizedSrc = getOptimizedImageUrl(currentImage.url, 640, 80);

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
          prefetch={true}
        >
          {hasDiscount && (
            <span className="sale-tag sale-tag--on-sale" aria-label="On Sale">
              <span className="sale-tag-text">ON SALE</span>
              <span className="sale-tag-hole" aria-hidden="true" />
            </span>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="product-image"
            src={optimizedSrc}
            srcSet={srcSet}
            sizes={srcSet ? RESPONSIVE_SIZES.productCard : undefined}
            alt={currentImage.alt || product.name}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            width={320}
            height={416}
          />
        </Link>

        {/* Quick Size Selection Overlay when multiple sizes exist */}
        {showSizeSelector && (
          <div
            className="product-card-size-popup"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className="product-card-size-header">
              <span className="product-card-size-title">Select Size</span>
              <button
                type="button"
                className="product-card-size-close"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowSizeSelector(false);
                }}
                aria-label="Close size selector"
              >
                ✕
              </button>
            </div>
            <div className="product-card-size-list" role="group" aria-label="Select size">
              {availableSizes.map((size) => {
                const isSizeInCart = cartItemsForProduct.some(
                  (item) => item.size?.trim().toLowerCase() === size.trim().toLowerCase()
                );

                return (
                  <button
                    key={size}
                    type="button"
                    className={`product-card-size-chip ${isSizeInCart ? "in-cart" : ""}`}
                    onClick={(e) => handleSelectSize(size, e)}
                    aria-label={
                      isSizeInCart
                        ? `Remove size ${size} from bag`
                        : `Add size ${size} to bag`
                    }
                    title={
                      isSizeInCart
                        ? `Size ${size} in bag — click to remove`
                        : `Add size ${size}`
                    }
                  >
                    {isSizeInCart ? `✓ ${size}` : size}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
        {offerBadge && (
          <div className="product-card-offer-tag">
            <span className="product-card-offer-badge">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                <circle cx="7" cy="7" r="1.5" />
              </svg>
              <span>{offerBadge}</span>
            </span>
          </div>
        )}
        <h3 className="product-card-title">
          <Link
            href={`/product/${product.slug}`}
            className="product-card-title-link"
            prefetch={true}
          >
            {product.name}
          </Link>
        </h3>
        <div className="product-card-bottom-row">
          <div className="price product-card-price">
            {hasDiscount && (
              <span className="old-price">{formatPrice(product.price)}</span>
            )}
            <span className="current-price">
              {formatPrice(product.sale ?? product.price)}
            </span>
          </div>

          <button
            type="button"
            className={`product-card-add-btn ${isInCart ? "in-cart" : ""}`}
            onClick={handleQuickAddClick}
            aria-label={
              isInCart
                ? `Remove ${product.name} from cart`
                : `Add ${product.name} to cart`
            }
            title={
              isInCart
                ? "In cart — click to remove"
                : availableSizes.length > 1
                ? "Choose size to add"
                : "Add to cart"
            }
          >
            {isInCart ? (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Added</span>
              </>
            ) : (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Add</span>
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
});

export default ProductCard;
