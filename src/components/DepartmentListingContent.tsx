"use client";

// DepartmentListingContent — client component handling category filter state.
// The parent server component passes the product data; this manages UI state only.

import { useState } from "react";
import type { Product } from "@/data/products";
import CategoryBar from "@/components/CategoryBar";
import ProductCard from "@/components/ProductCard";

interface DepartmentListingContentProps {
  department: string;
  products: Product[];
}

export default function DepartmentListingContent({
  department,
  products,
}: DepartmentListingContentProps) {
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = [
    "All",
    ...Array.from(new Set(products.map((p) => p.category))),
  ];

  const visible =
    activeCategory === "All"
      ? products
      : products.filter((p) => p.category === activeCategory);

  return (
    <>
      <CategoryBar
        categories={categories}
        activeCategory={activeCategory}
        visibleCount={visible.length}
        onCategoryChange={setActiveCategory}
      />

      <div className="product-grid listing-grid">
        {visible.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <div className="listing-note">
        <span>END OF THE EDIT</span>
        <p>
          You&apos;ve viewed all {visible.length} pieces in{" "}
          {activeCategory === "All" ? department : activeCategory}.
        </p>
      </div>
    </>
  );
}
