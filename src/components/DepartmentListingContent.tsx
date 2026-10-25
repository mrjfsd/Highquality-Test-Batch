"use client";

// DepartmentListingContent — Snitch-inspired slide-out filter overlay.
// Supports /shop/men, /shop/women, /shop/kids with database-only products and fixed grid positioning.

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type { Product } from "@/data/products";
import ProductCard from "@/components/ProductCard";
import CollectionMarquee from "@/components/CollectionMarquee";

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

// Exactly the 5 requested sizes for catalogue filter
const CATALOGUE_FILTER_SIZES = ["XS", "S", "M", "L", "XL"] as const;

type PricePreset = 500 | 1000 | null;

// Professional customer-facing category options per department group
export const DEPARTMENT_CATEGORY_CONFIG = [
  {
    department: "Men",
    categories: [
      "Oversized T-Shirts",
      "Track Pants",
      "Hoodies",
      "Jeans",
    ],
  },
  {
    department: "Women",
    categories: [
      "T-Shirts",
      "Track Pants",
      "Short Kurtis",
      "Crop Tops",
      "Jeans",
      "Hoodies",
      "Oversized T-Shirts",
      "Sleepwear Sets",
      "Korean-Style Sleepwear Sets",
      "Korean-Style Pants",
      "Korean-Style Formal Trousers",
      "Palazzo Pants",
    ],
  },
  {
    department: "Kids",
    categories: [
      "T-Shirts",
      "Pants",
      "Co-ord Sets",
      "Sleepwear Sets",
      "Frocks",
      "Korean-Style Sets",
      "Korean-Style Frocks",
    ],
  },
] as const;

// Presentation-layer mapping from professional display labels to underlying database category aliases
const CATEGORY_DATABASE_ALIASES: Record<string, string[]> = {
  "T-Shirts": ["t-shirts", "t-shirt", "tshirts", "tshirt", "t shirt"],
  "Track Pants": ["track pants", "track pant", "night pants", "night pant"],
  "Short Kurtis": ["short kurtis", "short kurti"],
  "Crop Tops": ["crop tops", "crop top", "short tops", "short top"],
  "Jeans": ["jeans", "jean"],
  "Hoodies": ["hoodies", "hoodie"],
  "Oversized T-Shirts": [
    "oversized t-shirts",
    "oversize t-shirts",
    "oversize t-shirt",
    "oversized t-shirt",
  ],
  "Sleepwear Sets": ["sleepwear sets", "sleepwear set", "night suits", "night suit"],
  "Korean-Style Sleepwear Sets": [
    "korean-style sleepwear sets",
    "korean style sleepwear sets",
    "korean night suits",
    "korean night suit",
  ],
  "Korean-Style Pants": [
    "korean-style pants",
    "korean style pants",
    "korean pants",
    "korean pant",
  ],
  "Korean-Style Formal Trousers": [
    "korean-style formal trousers",
    "korean style formal trousers",
    "korean formal pants",
    "korean formal pant",
  ],
  "Palazzo Pants": [
    "palazzo pants",
    "palazzo pant",
    "plazo pants",
    "plazo pant",
  ],
  "Pants": ["pants", "pant"],
  "Co-ord Sets": ["co-ord sets", "co-ord set", "coord sets", "coord set"],
  "Frocks": ["frocks", "frock"],
  "Korean-Style Sets": [
    "korean-style sets",
    "korean style sets",
    "korean sets",
    "korean set",
  ],
  "Korean-Style Frocks": [
    "korean-style frocks",
    "korean style frocks",
    "korean frocks",
    "korean frock",
  ],
};

/**
 * Connects professional category display names to actual product records in Supabase.
 * Enforces strict department isolation and justified mappings for legacy records
 * without altering database values or filter behavior.
 */
export function productMatchesCategory(
  product: Product,
  targetCategory: string,
  targetGroupDept: string
): boolean {
  // Department isolation: product department must match target group
  if (product.department.toLowerCase() !== targetGroupDept.toLowerCase()) {
    return false;
  }

  const pCategory = (product.category || "").trim().toLowerCase();
  const target = targetCategory.trim();
  const pName = (product.name || "").trim().toLowerCase();
  const pSlug = (product.slug || "").trim().toLowerCase();

  // 1. Direct exact match (case-insensitive)
  if (pCategory === target.toLowerCase()) {
    return true;
  }

  // 2. Known database alias match
  const aliases = CATEGORY_DATABASE_ALIASES[target] || [target.toLowerCase()];
  if (aliases.includes(pCategory)) {
    return true;
  }

  // 3. Normalized alphanumeric match (ignoring hyphens, spaces: e.g. "T-Shirts" vs "T Shirts")
  const normCategory = pCategory.replace(/[-\s]/g, "");
  if (
    normCategory &&
    aliases.some((alias) => alias.replace(/[-\s]/g, "") === normCategory)
  ) {
    return true;
  }

  // 4. Justified legacy mapping for records saved with generic category 'Pants':
  if (pCategory === "pants" || pCategory === "pant") {
    if (target === "Pants") {
      return true;
    }
    if (target === "Jeans" && (pName.includes("jeans") || pSlug.includes("jeans"))) {
      return true;
    }
    if (target === "Track Pants" && (pName.includes("track") || pName.includes("night"))) {
      return true;
    }
    if (target === "Korean-Style Pants" && pName.includes("korean")) {
      return true;
    }
    if (target === "Korean-Style Formal Trousers" && pName.includes("formal")) {
      return true;
    }
    if (target === "Palazzo Pants" && pName.includes("palazzo")) {
      return true;
    }
  }

  // 5. Plural / singular match where unambiguous (e.g. "Hoodies" vs "Hoodie")
  if (
    (target === "Hoodies" && pCategory === "hoodie") ||
    (target === "Frocks" && pCategory === "frock")
  ) {
    return true;
  }

  return false;
}

export default function DepartmentListingContent({
  department,
  products,
}: DepartmentListingContentProps) {
  // ── Snitch Overlay Drawer state ──
  const [drawerOpen, setDrawerOpen] = useState(false);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // ── Applied Filter States (active in catalogue) ──
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [pricePreset, setPricePreset] = useState<PricePreset>(null);
  const [availability, setAvailability] = useState<{
    inStock: boolean;
    outOfStock: boolean;
  }>({
    inStock: false,
    outOfStock: false,
  });

  // ── Draft Filter States (inside drawer before applying) ──
  const [draftCategories, setDraftCategories] = useState<string[]>([]);
  const [draftColors, setDraftColors] = useState<string[]>([]);
  const [draftSizes, setDraftSizes] = useState<string[]>([]);
  const [draftPricePreset, setDraftPricePreset] = useState<PricePreset>(null);
  const [draftAvailability, setDraftAvailability] = useState<{
    inStock: boolean;
    outOfStock: boolean;
  }>({
    inStock: false,
    outOfStock: false,
  });

  // ── Color Dropdown state & ref (inside drawer) ──
  const [colorDropdownOpen, setColorDropdownOpen] = useState(false);
  const colorDropdownRef = useRef<HTMLDivElement>(null);

  // ── Expandable Drawer Sections (matching Snitch reference rows) ──
  const [expandedSections, setExpandedSections] = useState({
    size: true,
    color: true,
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

  // ── Predefined Category Options for Current Department ──
  const currentDepartmentCategories = useMemo(() => {
    const config = DEPARTMENT_CATEGORY_CONFIG.find(
      (c) => c.department.toLowerCase() === department.toLowerCase()
    );
    return config ? config.categories : [];
  }, [department]);

  // Category product count based on published products in the current catalogue
  const getCategoryProductCount = useCallback(
    (catName: string) => {
      return products.filter((p) =>
        productMatchesCategory(p, catName, department)
      ).length;
    },
    [products, department]
  );

  // Open drawer: populate draft state from applied state
  const openDrawer = useCallback(() => {
    setDraftCategories(selectedCategories);
    setDraftColors(selectedColors);
    setDraftSizes(selectedSizes);
    setDraftPricePreset(pricePreset);
    setDraftAvailability(availability);
    setDrawerOpen(true);
  }, [
    selectedCategories,
    selectedColors,
    selectedSizes,
    pricePreset,
    availability,
  ]);

  // Close drawer: restore focus to FILTERS trigger
  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setColorDropdownOpen(false);
    setTimeout(() => {
      filterTriggerRef.current?.focus();
    }, 50);
  }, []);

  // Commit draft to applied state and close drawer
  const applyFilters = () => {
    setSelectedCategories(draftCategories);
    setSelectedColors(draftColors);
    setSelectedSizes(draftSizes);
    setPricePreset(draftPricePreset);
    setAvailability(draftAvailability);
    setDrawerOpen(false);
    setColorDropdownOpen(false);
    setTimeout(() => {
      filterTriggerRef.current?.focus();
    }, 50);
  };

  // Clear selections inside drawer
  const clearDraftFilters = () => {
    setDraftCategories([]);
    setDraftColors([]);
    setDraftSizes([]);
    setDraftPricePreset(null);
    setDraftAvailability({ inStock: false, outOfStock: false });
  };

  // Global Clear All (from pills bar or if applied directly)
  const handleClearAll = () => {
    setSelectedCategories([]);
    setSelectedColors([]);
    setSelectedSizes([]);
    setPricePreset(null);
    setAvailability({ inStock: false, outOfStock: false });
    setDraftCategories([]);
    setDraftColors([]);
    setDraftSizes([]);
    setDraftPricePreset(null);
    setDraftAvailability({ inStock: false, outOfStock: false });
  };

  // Lock background scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || "0", 10) * -1);
      }
    }
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  // Handle Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (colorDropdownOpen) {
          setColorDropdownOpen(false);
        } else if (drawerOpen) {
          closeDrawer();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen, colorDropdownOpen, closeDrawer]);

  // Close color dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        colorDropdownRef.current &&
        !colorDropdownRef.current.contains(event.target as Node)
      ) {
        setColorDropdownOpen(false);
      }
    }
    if (colorDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [colorDropdownOpen]);

  // Derived filter data from current products
  const availableColors = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      p.colors?.forEach((c) => set.add(c));
    });
    return Array.from(set);
  }, [products]);

  // Active filter count (applied)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategories.length > 0) count += selectedCategories.length;
    if (selectedColors.length > 0) count += selectedColors.length;
    if (selectedSizes.length > 0) count += selectedSizes.length;
    if (pricePreset !== null) count += 1;
    if (availability.inStock) count += 1;
    if (availability.outOfStock) count += 1;
    return count;
  }, [
    selectedCategories,
    selectedColors,
    selectedSizes,
    pricePreset,
    availability,
  ]);

  // Draft filter count (inside drawer)
  const draftFilterCount = useMemo(() => {
    let count = 0;
    if (draftCategories.length > 0) count += draftCategories.length;
    if (draftColors.length > 0) count += draftColors.length;
    if (draftSizes.length > 0) count += draftSizes.length;
    if (draftPricePreset !== null) count += 1;
    if (draftAvailability.inStock) count += 1;
    if (draftAvailability.outOfStock) count += 1;
    return count;
  }, [
    draftCategories,
    draftColors,
    draftSizes,
    draftPricePreset,
    draftAvailability,
  ]);

  // Combined Filtering (based on committed applied filters)
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // 1. Category filter
      if (selectedCategories.length > 0) {
        const matchesAny = selectedCategories.some((catName) => {
          return productMatchesCategory(product, catName, department);
        });
        if (!matchesAny) {
          return false;
        }
      }

      // 2. Color filter
      if (
        selectedColors.length > 0 &&
        !product.colors?.some((color) => selectedColors.includes(color))
      ) {
        return false;
      }

      // 3. Size filter
      if (selectedSizes.length > 0) {
        const hasMatchingSize =
          product.variants && product.variants.length > 0
            ? product.variants.some((v) => selectedSizes.includes(v.size))
            : false;
        if (!hasMatchingSize) {
          return false;
        }
      }

      // 4. Price preset filter (strictly below ₹500 or ₹1,000)
      const effectivePrice = product.sale ?? product.price;
      if (pricePreset === 500 && effectivePrice >= 500) {
        return false;
      }
      if (pricePreset === 1000 && effectivePrice >= 1000) {
        return false;
      }

      // 5. Availability filter
      const productHasAvailableVariant =
        product.variants && product.variants.length > 0
          ? product.variants.some((v) => v.is_available)
          : (product as unknown as { is_available?: boolean }).is_available ??
            true;

      if (
        availability.inStock &&
        !availability.outOfStock &&
        !productHasAvailableVariant
      ) {
        return false;
      }
      if (
        availability.outOfStock &&
        !availability.inStock &&
        productHasAvailableVariant
      ) {
        return false;
      }

      return true;
    });
  }, [
    products,
    selectedCategories,
    selectedColors,
    selectedSizes,
    pricePreset,
    availability,
  ]);

  // Draft Toggle Helpers (inside drawer)
  const toggleDraftCategory = (catName: string) => {
    setDraftCategories((prev) =>
      prev.includes(catName)
        ? prev.filter((c) => c !== catName)
        : [...prev, catName]
    );
  };

  const toggleDraftColor = (color: string) => {
    setDraftColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    );
  };

  const toggleDraftSize = (size: string) => {
    setDraftSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const toggleDraftPricePreset = (preset: 500 | 1000) => {
    setDraftPricePreset((prev) => (prev === preset ? null : preset));
  };

  // Draft color label for closed dropdown trigger inside drawer
  const draftColorDropdownLabel = useMemo(() => {
    if (draftColors.length === 0) return "All colors";
    if (draftColors.length === 1) return getColorLabel(draftColors[0]);
    return `${draftColors.length} selected`;
  }, [draftColors]);

  return (
    <div className="collection-layout">
      {/* ═══════════════════════════════════════════════════════════
          CATALOGUE TOP TOOLBAR (Above Product Grid)
          Left: Item Count | Right: EXACTLY ONE Snitch-Style FILTERS Button
          ═══════════════════════════════════════════════════════════ */}
      <div
        className="product-toolbar"
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "nowrap",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div
          className="product-toolbar-left"
          style={{
            flexShrink: 0,
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
          }}
        >
          <span className="product-count">
            {filteredProducts.length}{" "}
            {filteredProducts.length === 1 ? "item" : "items"}
          </span>
        </div>

        {/* PROMOTIONAL SCROLLING MARQUEE BANNER (Middle horizontal space) */}
        <div
          className="product-toolbar-center"
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
          }}
        >
          <CollectionMarquee />
        </div>

        <div
          className="product-toolbar-right"
          style={{
            flexShrink: 0,
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <button
            ref={filterTriggerRef}
            type="button"
            className={`snitch-filter-btn ${activeFilterCount > 0 ? "active" : ""}`}
            onClick={openDrawer}
            aria-expanded={drawerOpen}
            aria-haspopup="dialog"
            aria-label="Open filter drawer"
          >
            {/* Minimal sliders/filter icon matching Snitch reference */}
            <svg
              className="snitch-filter-icon"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
              <circle cx="8" cy="6" r="2.5" fill="var(--white)" />
              <circle cx="16" cy="12" r="2.5" fill="var(--white)" />
              <circle cx="9" cy="18" r="2.5" fill="var(--white)" />
            </svg>
            <span className="snitch-filter-text">FILTERS</span>
            {activeFilterCount > 0 && (
              <span className="snitch-filter-badge">{activeFilterCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* ACTIVE FILTER PILLS (Beneath Toolbar) */}
      {activeFilterCount > 0 && (
        <div className="active-filters-bar" aria-label="Active filters">
          <span className="active-filters-label">Active filters:</span>
          <div className="active-filters-list">
            {selectedCategories.map((catName) => (
              <button
                key={catName}
                type="button"
                className="filter-pill"
                onClick={() => {
                  setSelectedCategories((prev) =>
                    prev.filter((c) => c !== catName)
                  );
                  setDraftCategories((prev) =>
                    prev.filter((c) => c !== catName)
                  );
                }}
                aria-label={`Remove category filter ${catName}`}
              >
                <span>{catName}</span>
                <span className="pill-remove">×</span>
              </button>
            ))}
            {selectedColors.map((hex) => (
              <button
                key={hex}
                type="button"
                className="filter-pill"
                onClick={() => {
                  setSelectedColors((prev) => prev.filter((c) => c !== hex));
                  setDraftColors((prev) => prev.filter((c) => c !== hex));
                }}
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
                onClick={() => {
                  setSelectedSizes((prev) => prev.filter((s) => s !== size));
                  setDraftSizes((prev) => prev.filter((s) => s !== size));
                }}
                aria-label={`Remove size filter ${size}`}
              >
                <span>Size: {size}</span>
                <span className="pill-remove">×</span>
              </button>
            ))}
            {pricePreset !== null && (
              <button
                type="button"
                className="filter-pill"
                onClick={() => {
                  setPricePreset(null);
                  setDraftPricePreset(null);
                }}
                aria-label={`Remove price filter under ₹${pricePreset}`}
              >
                <span>Price: &lt; ₹{pricePreset.toLocaleString("en-IN")}</span>
                <span className="pill-remove">×</span>
              </button>
            )}
            {availability.inStock && (
              <button
                type="button"
                className="filter-pill"
                onClick={() => {
                  setAvailability((prev) => ({ ...prev, inStock: false }));
                  setDraftAvailability((prev) => ({
                    ...prev,
                    inStock: false,
                  }));
                }}
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
                onClick={() => {
                  setAvailability((prev) => ({ ...prev, outOfStock: false }));
                  setDraftAvailability((prev) => ({
                    ...prev,
                    outOfStock: false,
                  }));
                }}
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

      {/* 4-COLUMN PRODUCT GRID (Full width, fixed position behind overlay) */}
      <section className="product-area" aria-label="Product collection">
        {filteredProducts.length > 0 ? (
          <div className="collection-product-grid collection-product-grid--4">
            {filteredProducts.map((product) => (
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

      {/* ═══════════════════════════════════════════════════════════
          SNITCH-STYLE SLIDE-OUT FILTER DRAWER & BACKDROP
          ═══════════════════════════════════════════════════════════ */}
      {/* Semi-transparent Dimmed Backdrop */}
      <div
        className={`snitch-drawer-backdrop ${drawerOpen ? "open" : ""}`}
        onClick={closeDrawer}
        aria-hidden={!drawerOpen}
      />

      {/* Fixed Off-Canvas Drawer (Slides in from Right) */}
      <div
        ref={drawerRef}
        className={`snitch-filter-drawer ${drawerOpen ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Filter products"
        aria-hidden={!drawerOpen}
      >
        {/* Drawer Header: Centered FILTER title + Close '×' button */}
        <div className="drawer-header">
          <div className="drawer-header-spacer" aria-hidden="true" />
          <h2 className="drawer-title">FILTER</h2>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={closeDrawer}
            aria-label="Close filters"
          >
            ×
          </button>
        </div>

        {/* Scrollable Filter Content (Vertical list of clean expandable groups) */}
        <div className="drawer-content">
          {/* 1. SIZE GROUP */}
          <div className="drawer-filter-group">
            <button
              type="button"
              className="drawer-group-header"
              onClick={() => toggleSection("size")}
              aria-expanded={expandedSections.size}
            >
              <span className="drawer-group-label">SIZE</span>
              <span className="drawer-group-toggle" aria-hidden="true">
                {expandedSections.size ? "−" : "+"}
              </span>
            </button>
            {expandedSections.size && (
              <div className="drawer-group-body">
                <div
                  className="size-chips-row"
                  role="group"
                  aria-label="Filter by size"
                >
                  {CATALOGUE_FILTER_SIZES.map((size) => {
                    const isSelected = draftSizes.includes(size);
                    return (
                      <button
                        key={size}
                        type="button"
                        className={`filter-chip-btn size-chip-btn ${
                          isSelected ? "selected" : ""
                        }`}
                        onClick={() => toggleDraftSize(size)}
                        aria-pressed={isSelected}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 2. COLOR GROUP (Multi-select dropdown) */}
          <div className="drawer-filter-group">
            <button
              type="button"
              className="drawer-group-header"
              onClick={() => toggleSection("color")}
              aria-expanded={expandedSections.color}
            >
              <span className="drawer-group-label">COLOUR</span>
              <span className="drawer-group-toggle" aria-hidden="true">
                {expandedSections.color ? "−" : "+"}
              </span>
            </button>
            {expandedSections.color && (
              <div className="drawer-group-body">
                <div className="color-dropdown-wrap" ref={colorDropdownRef}>
                  <button
                    type="button"
                    className={`color-dropdown-trigger ${
                      colorDropdownOpen ? "open" : ""
                    } ${draftColors.length > 0 ? "active" : ""}`}
                    onClick={() => setColorDropdownOpen((prev) => !prev)}
                    aria-expanded={colorDropdownOpen}
                    aria-haspopup="listbox"
                    aria-label="Select colors"
                  >
                    <div className="color-trigger-left">
                      {draftColors.length === 1 && (
                        <span
                          className="color-swatch-dot color-swatch-dot--small"
                          style={{ backgroundColor: draftColors[0] }}
                          aria-hidden="true"
                        />
                      )}
                      <span>{draftColorDropdownLabel}</span>
                    </div>
                    <span className="color-trigger-arrow" aria-hidden="true">
                      ▼
                    </span>
                  </button>

                  {colorDropdownOpen && (
                    <div
                      className="color-dropdown-menu"
                      role="listbox"
                      aria-multiselectable="true"
                    >
                      <div className="color-dropdown-header">
                        <span className="color-dropdown-title">
                          Available Colors
                        </span>
                        {draftColors.length > 0 && (
                          <button
                            type="button"
                            className="color-dropdown-clear-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDraftColors([]);
                            }}
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <div className="color-dropdown-list">
                        {availableColors.map((hex) => {
                          const isChecked = draftColors.includes(hex);
                          const label = getColorLabel(hex);
                          return (
                            <label
                              key={hex}
                              className={`color-dropdown-item ${
                                isChecked ? "active" : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleDraftColor(hex)}
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
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 3. PRICE GROUP (Horizontal quick-filter buttons: ↓ ₹500, ↓ ₹1,000) */}
          <div className="drawer-filter-group">
            <button
              type="button"
              className="drawer-group-header"
              onClick={() => toggleSection("price")}
              aria-expanded={expandedSections.price}
            >
              <span className="drawer-group-label">PRICE</span>
              <span className="drawer-group-toggle" aria-hidden="true">
                {expandedSections.price ? "−" : "+"}
              </span>
            </button>
            {expandedSections.price && (
              <div className="drawer-group-body">
                <div
                  className="price-presets-row"
                  role="group"
                  aria-label="Filter by price"
                >
                  <button
                    type="button"
                    className={`filter-chip-btn price-preset-btn ${
                      draftPricePreset === 500 ? "selected" : ""
                    }`}
                    onClick={() => toggleDraftPricePreset(500)}
                    aria-pressed={draftPricePreset === 500}
                  >
                    ↓ ₹500
                  </button>
                  <button
                    type="button"
                    className={`filter-chip-btn price-preset-btn ${
                      draftPricePreset === 1000 ? "selected" : ""
                    }`}
                    onClick={() => toggleDraftPricePreset(1000)}
                    aria-pressed={draftPricePreset === 1000}
                  >
                    ↓ ₹1,000
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. CATEGORY GROUP (Department-specific expandable submenus) */}
          <div className="drawer-filter-group category-filter-group">
            <button
              type="button"
              className="drawer-group-header"
              onClick={() => toggleSection("category")}
              aria-expanded={expandedSections.category}
            >
              <span className="drawer-group-label">CATEGORY</span>
              <span className="drawer-group-toggle" aria-hidden="true">
                {expandedSections.category ? "−" : "+"}
              </span>
            </button>
            {expandedSections.category && (
              <div className="drawer-group-body category-group-body">
                <div
                  className="category-items-list"
                  role="group"
                  aria-label={`${department} categories`}
                >
                  {currentDepartmentCategories.map((catName) => {
                    const isChecked = draftCategories.includes(catName);
                    const count = getCategoryProductCount(catName);
                    return (
                      <label
                        key={catName}
                        className={`category-item-row ${
                          isChecked ? "checked" : ""
                        }`}
                      >
                        <span className="category-checkbox-wrapper">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleDraftCategory(catName)}
                            className="category-checkbox-native"
                          />
                          <span
                            className="category-custom-checkbox"
                            aria-hidden="true"
                          >
                            {isChecked && (
                              <svg
                                width="10"
                                height="8"
                                viewBox="0 0 10 8"
                                fill="none"
                              >
                                <path
                                  d="M1 4L3.5 6.5L9 1"
                                  stroke="currentColor"
                                  strokeWidth="1.75"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </span>
                        </span>
                        <span className="category-item-name">{catName}</span>
                        <span className="category-item-count">({count})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 5. AVAILABILITY GROUP (Horizontal chips) */}
          <div className="drawer-filter-group">
            <button
              type="button"
              className="drawer-group-header"
              onClick={() => toggleSection("availability")}
              aria-expanded={expandedSections.availability}
            >
              <span className="drawer-group-label">AVAILABILITY</span>
              <span className="drawer-group-toggle" aria-hidden="true">
                {expandedSections.availability ? "−" : "+"}
              </span>
            </button>
            {expandedSections.availability && (
              <div className="drawer-group-body">
                <div
                  className="availability-chips-row"
                  role="group"
                  aria-label="Filter by availability"
                >
                  <button
                    type="button"
                    className={`filter-chip-btn availability-chip-btn ${
                      draftAvailability.inStock ? "selected" : ""
                    }`}
                    onClick={() =>
                      setDraftAvailability((prev) => ({
                        ...prev,
                        inStock: !prev.inStock,
                      }))
                    }
                    aria-pressed={draftAvailability.inStock}
                  >
                    In stock
                  </button>
                  <button
                    type="button"
                    className={`filter-chip-btn availability-chip-btn ${
                      draftAvailability.outOfStock ? "selected" : ""
                    }`}
                    onClick={() =>
                      setDraftAvailability((prev) => ({
                        ...prev,
                        outOfStock: !prev.outOfStock,
                      }))
                    }
                    aria-pressed={draftAvailability.outOfStock}
                  >
                    Out of stock
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Persistent Bottom Action Bar: CLEAR & APPLY */}
        <div className="drawer-actions-bar">
          <button
            type="button"
            className="drawer-clear-btn"
            onClick={clearDraftFilters}
          >
            CLEAR
          </button>
          <button
            type="button"
            className="drawer-apply-btn"
            onClick={applyFilters}
          >
            APPLY {draftFilterCount > 0 ? `(${draftFilterCount})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

