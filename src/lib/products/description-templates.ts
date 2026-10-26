/**
 * Predefined product description templates by Department and Category.
 * Deterministic, code-based templates for Style Edit Add Clothes workflow.
 */

export type DepartmentKey = "men" | "women" | "kids" | "Men" | "Women" | "Kids";

export const PRODUCT_DESCRIPTION_TEMPLATES: Record<"men" | "women" | "kids", Record<string, string>> = {
  men: {
    "Oversized T-Shirts":
      "A relaxed oversized T-shirt designed for a comfortable, laid-back look. Pair it with jeans or track pants for an effortless streetwear outfit.",
    "Track Pants":
      "Designed for everyday comfort and easy movement, these track pants offer a relaxed, sporty style. Pair them with a T-shirt or hoodie for a casual outfit.",
    "Hoodies":
      "A versatile hoodie that brings a relaxed look to your everyday wardrobe. Style it with jeans or track pants for a comfortable, casual outfit.",
    "Jeans":
      "A versatile wardrobe essential that pairs effortlessly with T-shirts, shirts, and casual layers. Create an everyday look with your preferred footwear and accessories.",
  },
  women: {
    "T-Shirts":
      "An easy everyday essential that combines a casual look with versatile styling. Pair it with jeans, track pants, or skirts for a relaxed outfit.",
    "Track Pants":
      "Comfortable, versatile track pants suited to casual outings, lounging, and everyday wear. Pair them with a T-shirt or hoodie for a sporty look.",
    "Short Kurtis":
      "A contemporary take on everyday ethnic wear, offering an easy-to-style silhouette. Pair with jeans, trousers, or leggings for a versatile everyday outfit.",
    "Crop Tops":
      "A stylish crop top designed for versatile casual outfits. Pair it with high-waisted jeans, trousers, or skirts to create your preferred look.",
    "Jeans":
      "A timeless wardrobe staple that works effortlessly with crop tops, T-shirts, and kurtis. Style it for casual outings or everyday wear.",
    "Hoodies":
      "A relaxed wardrobe essential that adds a casual, sporty touch to everyday outfits. Pair it with jeans or track pants for an easygoing look.",
    "Oversized T-Shirts":
      "A relaxed oversized silhouette that creates an effortless, contemporary casual look. Style it with jeans, shorts, or track pants for everyday wear.",
    "Sleepwear Sets":
      "A coordinated sleepwear set designed for a comfortable and relaxed bedtime routine. Enjoy a matching look that is equally suited to winding down at home.",
    "Korean-Style Sleepwear Sets":
      "A coordinated sleepwear set inspired by soft, playful Korean-style fashion. Its matching design creates a neat, relaxed look for bedtime and lounging.",
    "Korean-Style Pants":
      "Contemporary pants inspired by Korean casual fashion, offering versatile styling for everyday outfits. Pair them with fitted tops, oversized T-shirts, or shirts for a balanced look.",
    "Korean-Style Formal Trousers":
      "Refined trousers inspired by modern Korean formal styling. Pair them with a shirt, blouse, or structured top for a polished outfit suitable for work or occasions.",
    "Palazzo Pants":
      "Wide-leg palazzo pants that create a flowing, versatile silhouette. Style them with kurtis, crop tops, or shirts for a relaxed ethnic or contemporary outfit.",
  },
  kids: {
    "T-Shirts":
      "An everyday wardrobe essential for easy, versatile kids' outfits. Pair with jeans, shorts, or pants for school, outings, and playtime.",
    "Pants":
      "Versatile everyday pants designed to complement a variety of kids' outfits. Pair them with T-shirts or shirts for casual outings and daily activities.",
    "Co-ord Sets":
      "A matching outfit that makes dressing simple while creating a coordinated look. The set offers an easy styling choice for outings, family gatherings, and everyday wear.",
    "Night Suits / Sleepwear Sets":
      "A coordinated sleepwear set for a relaxed bedtime routine. Matching top-and-bottom styling creates a neat, comfortable option for sleeping and lounging.",
    "Sleepwear Sets":
      "A coordinated sleepwear set for a relaxed bedtime routine. Matching top-and-bottom styling creates a neat, comfortable option for sleeping and lounging.",
    "Frocks":
      "A charming dress option for everyday outings, celebrations, and special moments. Style it with simple footwear and accessories for a complete look.",
    "Korean-Style Sets":
      "A coordinated kids' outfit inspired by contemporary Korean fashion. Its matching styling creates a playful, put-together look for outings and everyday occasions.",
    "Korean-Style Frocks":
      "A dress inspired by contemporary Korean fashion, with a playful and stylish look. Suitable for creating a coordinated outfit for outings, celebrations, and special occasions.",
  },
};

/**
 * Precomputed set of all exact template texts for constant-time lookup.
 */
const ALL_TEMPLATE_TEXTS_SET = new Set<string>();
for (const dept of Object.values(PRODUCT_DESCRIPTION_TEMPLATES)) {
  for (const text of Object.values(dept)) {
    ALL_TEMPLATE_TEXTS_SET.add(text.trim());
  }
}

/**
 * Normalizes category string to match template keys.
 */
function normalizeCategory(category: string): string {
  const trimmed = category.trim();
  if (/^sleepwear\s*sets$/i.test(trimmed) || /^night\s*suits\s*\/\s*sleepwear\s*sets$/i.test(trimmed)) {
    return "Sleepwear Sets";
  }
  return trimmed;
}

/**
 * Returns the predefined description template for a department and category, or null if none exists.
 */
export function getProductDescriptionTemplate(
  department?: string | null,
  category?: string | null
): string | null {
  if (!department || !category) return null;
  const deptKey = department.trim().toLowerCase() as "men" | "women" | "kids";
  const deptTemplates = PRODUCT_DESCRIPTION_TEMPLATES[deptKey];
  if (!deptTemplates) return null;

  const normalizedCat = normalizeCategory(category);
  if (deptTemplates[normalizedCat]) {
    return deptTemplates[normalizedCat];
  }

  // Case-insensitive fallback lookup
  const lowerCat = normalizedCat.toLowerCase();
  for (const [key, text] of Object.entries(deptTemplates)) {
    if (key.toLowerCase() === lowerCat) {
      return text;
    }
  }

  return null;
}

/**
 * Checks whether a given description string matches any known template.
 */
export function isKnownDescriptionTemplate(text?: string | null): boolean {
  if (!text) return false;
  return ALL_TEMPLATE_TEXTS_SET.has(text.trim());
}
