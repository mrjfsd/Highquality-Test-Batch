import type { Metadata } from "next";
import Link from "next/link";
import { fetchPublishedSaleProducts } from "@/lib/products/storefront";
import ProductCard from "@/components/ProductCard";

export const instant = false;

export const metadata: Metadata = {
  title: "The Sale Edit | Style-Edit",
  description:
    "Shop The Sale Edit — considered everyday fashion pieces with exceptional seasonal reductions. Timeless essentials across Men, Women, and Kids.",
};

export default async function SalePage() {
  const saleProducts = await fetchPublishedSaleProducts();

  return (
    <main className="collection-page sale-page">
      <h1 className="sr-only">The Sale Edit</h1>

      {/* Plain Catalogue Product Grid or Empty State */}
      <div className="collection-layout sale-collection-layout">
        {saleProducts.length > 0 ? (
          <section className="product-area" aria-label="Sale collection products">
            <div className="collection-product-grid collection-product-grid--4">
              {saleProducts.map((product) => (
                <ProductCard key={product.id} product={product} isSalePage />
              ))}
            </div>
          </section>
        ) : (
          <section
            className="collection-empty-state sale-empty-state"
            aria-label="No sale products found"
          >
            <div className="sale-empty-icon" aria-hidden="true">
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
            </div>
            <h2 className="empty-title">No Active Sale Promotions</h2>
            <p className="empty-description">
              All promotional pieces have found a home, or our next curated seasonal sale is currently in preparation. Discover our full ongoing catalogues below.
            </p>
            <div className="sale-empty-actions">
              <Link href="/shop/women" className="button button-dark">
                Shop Women
              </Link>
              <Link href="/shop/men" className="button button-secondary sale-btn-outline">
                Shop Men
              </Link>
              <Link href="/shop/kids" className="button button-secondary sale-btn-outline">
                Shop Kids
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
