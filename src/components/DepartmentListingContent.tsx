"use client";

// DepartmentListingContent — collection page layout adhering to the 30% Filter Sidebar / 70% Product Listing architecture.
// Dynamically supports /shop/men, /shop/women, /shop/kids with existing product data.

import { useState, useMemo } from "react";
import type { Product } from "@/data/products";
import ProductCard from "@/components/ProductCard";
import Icon from "@/components/Icon";

interface DepartmentListingContentProps {
  department: string;
  products: Product[];
}

// Human-readable labels for hex color swatches in the dataset
const COLOR_NAMES: Record<string, string> = {
  "#343434": "Charcoal Black",
  "#262626": "Deep Black",
  "#232323": "True Black",
  "#222222": "Jet Black",
  "#202020": "Pitch Black",
  "#252525": "Onyx Black",
  "#c2b8a8": "Warm Stone",
  "#e7e3dc": "Off-White",
  "#827c74": "Taupe Grey",
  "#ece9e2": "Soft Ecru",
  "#5f625e": "Slate Green",
  "#8c8983": "Heather Grey",
  "#b3aa9d": "Desert Sand",
  "#e9e9e7": "Studio White",
  "#a5adb4": "Mist Blue",
  "#e7e3da": "Natural Ivory",
  "#d9d6cf": "Pale Sand",
  "#d5cda7": "Muted Ochre",
  "#50616c": "Navy Blue",
  "#c6b7a7": "Light Oat",
  "#6c6c72": "Pewter Grey",
  "#a49b8b": "Olive Khaki",
  "#39423d": "Deep Olive",
  "#c8c2b6": "Light Clay",
  "#444a4b": "Dark Moss",
};

function getColorLabel(hex: string): string {
  return COLOR_NAMES[hex.toLowerCase()] || hex.toUpperCase();
}

const SUPPORTED_SIZES = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "3XL",
  "Oversized",
] as const;

type SortOption =
  | "featured"
  | "newest"
  | "price-asc"
  | "price-desc"
  | "name-asc";

export default function DepartmentListingContent({
  department,
  products,
}: DepartmentListingContentProps) {
  // ── Filter states ──
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");
  const [availability, setAvailability] = useState<{
    inStock: boolean;
    outOfStock: boolean;
  }>({
    inStock: false,
    outOfStock: false,
  });

  // ── View & Sort states ──
  const [sortBy, setSortBy] = useState<SortOption>("featured");
  const [gridCols, setGridCols] = useState<4 | 2>(4);
  const [showAllColors, setShowAllColors] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // ── Section collapse/expand states ──
  const [expandedSections, setExpandedSections] = useState({
    color: true,
    size: true,
    price: true,
    category: true,
    availability: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };



  // ── Derived filter data from current products ──
  const availableCategories = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.category))).sort();
  }, [products]);

  const availableColors = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      p.colors.forEach((c) => set.add(c));
    });
    return Array.from(set);
  }, [products]);

  const departmentMinPrice = useMemo(() => {
    if (products.length === 0) return 0;
    return Math.min(...products.map((p) => p.sale ?? p.price));
  }, [products]);

  const departmentMaxPrice = useMemo(() => {
    if (products.length === 0) return 10000;
    return Math.max(...products.map((p) => p.sale ?? p.price));
  }, [products]);

  // Visible colors with + Show more threshold of 5
  const displayedColors = showAllColors
    ? availableColors
    : availableColors.slice(0, 5);

  // Active filter count calculation
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategories.length > 0) count += selectedCategories.length;
    if (selectedColors.length > 0) count += selectedColors.length;
    if (selectedSizes.length > 0) count += selectedSizes.length;
    if (priceMin !== "" || priceMax !== "") count += 1;
    if (availability.inStock) count += 1;
    if (availability.outOfStock) count += 1;
    return count;
  }, [
    selectedCategories,
    selectedColors,
    selectedSizes,
    priceMin,
    priceMax,
    availability,
  ]);

  const handleClearAll = () => {
    setSelectedCategories([]);
    setSelectedColors([]);
    setSelectedSizes([]);
    setPriceMin("");
    setPriceMax("");
    setAvailability({ inStock: false, outOfStock: false });
  };

  // ── Combined Filtering ──
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // 1. Category filter
      if (
        selectedCategories.length > 0 &&
        !selectedCategories.includes(product.category)
      ) {
        return false;
      }

      // 2. Color filter
      if (
        selectedColors.length > 0 &&
        !product.colors.some((color) => selectedColors.includes(color))
      ) {
        return false;
      }

      // 3. Price filter
      const effectivePrice = product.sale ?? product.price;
      if (priceMin !== "") {
        const minVal = parseFloat(priceMin);
        if (!isNaN(minVal) && effectivePrice < minVal) {
          return false;
        }
      }
      if (priceMax !== "") {
        const maxVal = parseFloat(priceMax);
        if (!isNaN(maxVal) && effectivePrice > maxVal) {
          return false;
        }
      }

      // 4. Availability filter
      const isAvailable =
        (product as unknown as { is_available?: boolean }).is_available ?? true;
      if (availability.inStock && !availability.outOfStock && !isAvailable) {
        return false;
      }
      if (availability.outOfStock && !availability.inStock && isAvailable) {
        return false;
      }

      return true;
    });
  }, [
    products,
    selectedCategories,
    selectedColors,
    priceMin,
    priceMax,
    availability,
  ]);

  // ── Sorting ──
  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    switch (sortBy) {
      case "price-asc":
        return list.sort((a, b) => (a.sale ?? a.price) - (b.sale ?? b.price));
      case "price-desc":
        return list.sort((a, b) => (b.sale ?? b.price) - (a.sale ?? a.price));
      case "newest":
        return list.sort((a, b) => {
          if (a.created_at && b.created_at) {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          }
          if (typeof a.id === "number" && typeof b.id === "number") {
            return b.id - a.id;
          }
          return String(b.id).localeCompare(String(a.id));
        });
      case "name-asc":
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case "featured":
      default:
        return list;
    }
  }, [filteredProducts, sortBy]);

  // Handler helpers
  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const toggleColor = (color: string) => {
    setSelectedColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    );
  };

  const toggleSize = (size: string) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  return (
    <div className="collection-layout">
      {/* ═══════════════════════════════════════════════════════════
          LEFT: FILTER SIDEBAR (Approx 30%)
          ═══════════════════════════════════════════════════════════ */}
      <aside
        className={`filter-sidebar ${mobileFiltersOpen ? "filter-sidebar--open" : ""}`}
        aria-label={`${department} collection filters`}
      >
        <div className="filter-header">
          <div className="filter-title-wrap">
            <h2>Filters</h2>
            {activeFilterCount > 0 && (
              <span className="filter-badge">{activeFilterCount}</span>
            )}
          </div>
          <div className="filter-header-actions">
            {activeFilterCount > 0 && (
              <button
                type="button"
                className="filter-clear-link"
                onClick={handleClearAll}
              >
                Clear all
              </button>
            )}
            <button
              type="button"
              className="filter-close-btn"
              onClick={() => setMobileFiltersOpen(false)}
              aria-label="Close filters"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        </div>

        {/* 1. COLOR FILTER */}
        <section className="filter-section">
          <button
            type="button"
            className="filter-section-header"
            onClick={() => toggleSection("color")}
            aria-expanded={expandedSections.color}
          >
            <span>Color</span>
            <span className="filter-arrow" aria-hidden="true">
              {expandedSections.color ? "↑" : "↓"}
            </span>
          </button>
          {expandedSections.color && (
            <div className="filter-section-body">
              <div className="filter-checkbox-list">
                {displayedColors.map((hex) => {
                  const isChecked = selectedColors.includes(hex);
                  const label = getColorLabel(hex);
                  return (
                    <label
                      key={hex}
                      className={`filter-checkbox-item ${isChecked ? "active" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleColor(hex)}
                      />
                      <span
                        className="color-swatch-dot"
                        style={{ backgroundColor: hex }}
                        aria-hidden="true"
                      />
                      <span className="filter-item-label">{label}</span>
                    </label>
                  );
                })}
              </div>
              {availableColors.length > 5 && (
                <button
                  type="button"
                  className="filter-show-more-btn"
                  onClick={() => setShowAllColors((prev) => !prev)}
                >
                  {showAllColors
                    ? "− Show less"
                    : `+ Show more (${availableColors.length - 5})`}
                </button>
              )}
            </div>
          )}
        </section>

        {/* 2. SIZE FILTER */}
        <section className="filter-section">
          <button
            type="button"
            className="filter-section-header"
            onClick={() => toggleSection("size")}
            aria-expanded={expandedSections.size}
          >
            <span>Size</span>
            <span className="filter-arrow" aria-hidden="true">
              {expandedSections.size ? "↑" : "↓"}
            </span>
          </button>
          {expandedSections.size && (
            <div className="filter-section-body">
              <div className="filter-checkbox-list">
                {SUPPORTED_SIZES.map((size) => {
                  const isChecked = selectedSizes.includes(size);
                  return (
                    <label
                      key={size}
                      className={`filter-checkbox-item ${isChecked ? "active" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSize(size)}
                      />
                      <span className="filter-item-label">{size}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* 3. PRICE FILTER */}
        <section className="filter-section">
          <button
            type="button"
            className="filter-section-header"
            onClick={() => toggleSection("price")}
            aria-expanded={expandedSections.price}
          >
            <span>Price</span>
            <span className="filter-arrow" aria-hidden="true">
              {expandedSections.price ? "↑" : "↓"}
            </span>
          </button>
          {expandedSections.price && (
            <div className="filter-section-body">
              <div className="filter-price-inputs">
                <div className="price-input-box">
                  <span className="currency-prefix">₹</span>
                  <input
                    type="number"
                    min={departmentMinPrice}
                    max={departmentMaxPrice}
                    placeholder={departmentMinPrice.toLocaleString("en-IN")}
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    aria-label="Minimum price"
                  />
                </div>
                <span className="price-to-divider">to</span>
                <div className="price-input-box">
                  <span className="currency-prefix">₹</span>
                  <input
                    type="number"
                    min={departmentMinPrice}
                    max={departmentMaxPrice}
                    placeholder={departmentMaxPrice.toLocaleString("en-IN")}
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    aria-label="Maximum price"
                  />
                </div>
              </div>
              <div className="price-range-hint">
                Range: ₹{departmentMinPrice.toLocaleString("en-IN")} – ₹
                {departmentMaxPrice.toLocaleString("en-IN")}
              </div>
            </div>
          )}
        </section>

        {/* 4. CATEGORY FILTER */}
        <section className="filter-section">
          <button
            type="button"
            className="filter-section-header"
            onClick={() => toggleSection("category")}
            aria-expanded={expandedSections.category}
          >
            <span>Category</span>
            <span className="filter-arrow" aria-hidden="true">
              {expandedSections.category ? "↑" : "↓"}
            </span>
          </button>
          {expandedSections.category && (
            <div className="filter-section-body">
              <div className="filter-checkbox-list">
                {availableCategories.map((category) => {
                  const isChecked = selectedCategories.includes(category);
                  const count = products.filter(
                    (p) => p.category === category
                  ).length;
                  return (
                    <label
                      key={category}
                      className={`filter-checkbox-item ${isChecked ? "active" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCategory(category)}
                      />
                      <span className="filter-item-label">{category}</span>
                      <span className="filter-item-count">({count})</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* 5. AVAILABILITY FILTER */}
        <section className="filter-section">
          <button
            type="button"
            className="filter-section-header"
            onClick={() => toggleSection("availability")}
            aria-expanded={expandedSections.availability}
          >
            <span>Availability</span>
            <span className="filter-arrow" aria-hidden="true">
              {expandedSections.availability ? "↑" : "↓"}
            </span>
          </button>
          {expandedSections.availability && (
            <div className="filter-section-body">
              <div className="filter-checkbox-list">
                <label
                  className={`filter-checkbox-item ${availability.inStock ? "active" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={availability.inStock}
                    onChange={(e) =>
                      setAvailability((prev) => ({
                        ...prev,
                        inStock: e.target.checked,
                      }))
                    }
                  />
                  <span className="filter-item-label">In stock</span>
                </label>
                <label
                  className={`filter-checkbox-item ${availability.outOfStock ? "active" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={availability.outOfStock}
                    onChange={(e) =>
                      setAvailability((prev) => ({
                        ...prev,
                        outOfStock: e.target.checked,
                      }))
                    }
                  />
                  <span className="filter-item-label">Out of stock</span>
                </label>
              </div>
            </div>
          )}
        </section>
      </aside>

      {/* Backdrop for mobile filter drawer */}
      {mobileFiltersOpen && (
        <div
          className="filter-drawer-backdrop"
          onClick={() => setMobileFiltersOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ═══════════════════════════════════════════════════════════
          RIGHT: PRODUCT AREA (Approx 70%)
          ═══════════════════════════════════════════════════════════ */}
      <section className="product-area" aria-label="Product collection">
        {/* PRODUCT TOOLBAR */}
        <div className="product-toolbar">
          <div className="product-toolbar-left">
            <span className="product-count">
              {filteredProducts.length}{" "}
              {filteredProducts.length === 1 ? "item" : "items"}
            </span>
          </div>

          <div className="product-toolbar-right">
            {/* Mobile Filter Toggle Button */}
            <button
              type="button"
              className="mobile-filter-toggle"
              onClick={() => setMobileFiltersOpen(true)}
              aria-label="Open filter menu"
            >
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="filter-badge-mobile">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Sort Control */}
            <div className="sort-dropdown-wrap">
              <label htmlFor="collection-sort-select" className="sort-label">
                Sort
              </label>
              <select
                id="collection-sort-select"
                className="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sort products"
              >
                <option value="featured">Featured</option>
                <option value="newest">Newest</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name-asc">Alphabetical: A–Z</option>
              </select>
              <span className="sort-indicator" aria-hidden="true">
                ↓
              </span>
            </div>

            {/* View / Grid Toggle Controls */}
            <div className="grid-view-toggle" aria-label="Grid layout view">
              <button
                type="button"
                className={`grid-toggle-btn ${gridCols === 4 ? "active" : ""}`}
                onClick={() => setGridCols(4)}
                aria-label="4 columns per row"
                title="4 columns"
              >
                ▦
              </button>
              <button
                type="button"
                className={`grid-toggle-btn ${gridCols === 2 ? "active" : ""}`}
                onClick={() => setGridCols(2)}
                aria-label="2 columns per row"
                title="2 columns"
              >
                ☷
              </button>
            </div>
          </div>
        </div>

        {/* ACTIVE FILTER PILLS */}
        {activeFilterCount > 0 && (
          <div className="active-filters-bar" aria-label="Active filters">
            <span className="active-filters-label">Active filters:</span>
            <div className="active-filters-list">
              {selectedCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className="filter-pill"
                  onClick={() => toggleCategory(cat)}
                  aria-label={`Remove category filter ${cat}`}
                >
                  <span>{cat}</span>
                  <span className="pill-remove">×</span>
                </button>
              ))}
              {selectedColors.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className="filter-pill"
                  onClick={() => toggleColor(hex)}
                  aria-label={`Remove color filter ${getColorLabel(hex)}`}
                >
                  <span
                    className="pill-swatch"
                    style={{ backgroundColor: hex }}
                  />
                  <span>{getColorLabel(hex)}</span>
                  <span className="pill-remove">×</span>
                </button>
              ))}
              {selectedSizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  className="filter-pill"
                  onClick={() => toggleSize(size)}
                  aria-label={`Remove size filter ${size}`}
                >
                  <span>Size: {size}</span>
                  <span className="pill-remove">×</span>
                </button>
              ))}
              {(priceMin !== "" || priceMax !== "") && (
                <button
                  type="button"
                  className="filter-pill"
                  onClick={() => {
                    setPriceMin("");
                    setPriceMax("");
                  }}
                  aria-label="Remove price filter"
                >
                  <span>
                    Price: ₹{priceMin || departmentMinPrice} – ₹
                    {priceMax || departmentMaxPrice}
                  </span>
                  <span className="pill-remove">×</span>
                </button>
              )}
              {availability.inStock && (
                <button
                  type="button"
                  className="filter-pill"
                  onClick={() =>
                    setAvailability((prev) => ({ ...prev, inStock: false }))
                  }
                  aria-label="Remove In Stock filter"
                >
                  <span>In stock</span>
                  <span className="pill-remove">×</span>
                </button>
              )}
              {availability.outOfStock && (
                <button
                  type="button"
                  className="filter-pill"
                  onClick={() =>
                    setAvailability((prev) => ({ ...prev, outOfStock: false }))
                  }
                  aria-label="Remove Out of Stock filter"
                >
                  <span>Out of stock</span>
                  <span className="pill-remove">×</span>
                </button>
              )}
              <button
                type="button"
                className="filter-clear-all-pill"
                onClick={handleClearAll}
              >
                Clear all
              </button>
            </div>
          </div>
        )}

        {/* 4-COLUMN PRODUCT GRID */}
        {sortedProducts.length > 0 ? (
          <div
            className={`collection-product-grid collection-product-grid--${gridCols}`}
          >
            {sortedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="collection-empty-state">
            <p className="empty-title">
              No products found matching your selection
            </p>
            <p className="empty-description">
              Try adjusting your color, size, price or category filters to find
              what you are looking for in {department}.
            </p>
            <button
              type="button"
              className="button button--dark"
              onClick={handleClearAll}
            >
              Clear All Filters
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
