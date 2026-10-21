"use client";

// CategoryBar — sticky category filter bar on department listing pages.
// Client component because it holds active-category UI state.

interface CategoryBarProps {
  categories: string[];
  activeCategory: string;
  visibleCount: number;
  onCategoryChange: (category: string) => void;
}

export default function CategoryBar({
  categories,
  activeCategory,
  visibleCount,
  onCategoryChange,
}: CategoryBarProps) {
  return (
    <div className="category-bar">
      <div className="category-scroll">
        {categories.map((cat) => (
          <button
            key={cat}
            className={activeCategory === cat ? "active" : ""}
            onClick={() => onCategoryChange(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
      <span>{visibleCount} pieces</span>
    </div>
  );
}
