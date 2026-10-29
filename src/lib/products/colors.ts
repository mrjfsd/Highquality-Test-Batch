// Shared color utility functions and mappings for Style Edit products

export const COLOR_NAMES: Record<string, string> = {
  "#343434": "Charcoal",
  "#c2b8a8": "Oatmeal",
  "#e7e3dc": "Off-White",
  "#262626": "Black",
  "#827c74": "Taupe",
  "#ece9e2": "Ivory",
  "#5f625e": "Slate Grey",
  "#8c8983": "Warm Grey",
  "#232323": "Deep Black",
  "#222222": "Black",
  "#b3aa9d": "Sand",
  "#e9e9e7": "Chalk White",
  "#a5adb4": "Mist Blue",
  "#202020": "Washed Black",
  "#e7e3da": "Ecru",
  "#d9d6cf": "Stone",
  "#252525": "Ink Black",
  "#d5cda7": "Pale Olive",
  "#50616c": "Steel Blue",
  "#c6b7a7": "Clay",
  "#6c6c72": "Heather Grey",
  "#a49b8b": "Khaki",
  "#39423d": "Dark Olive",
  "#c8c2b6": "Natural",
  "#444a4b": "Graphite",
};

export const COLOR_NAME_TO_HEX: Record<string, string> = {
  black: "#1a1a1a",
  white: "#f8f8f8",
  charcoal: "#343434",
  grey: "#808080",
  gray: "#808080",
  "light grey": "#d1d5db",
  "light gray": "#d1d5db",
  navy: "#1a2b49",
  blue: "#2b5c8f",
  olive: "#556b2f",
  green: "#2e5a36",
  beige: "#d9d2c5",
  khaki: "#a49b8b",
  brown: "#5c4033",
  pink: "#e8a598",
  red: "#9e2a2b",
  maroon: "#800020",
  burgundy: "#781d29",
  orange: "#f97316",
  yellow: "#eab308",
  purple: "#9333ea",
  cream: "#fffdd0",
  oatmeal: "#c2b8a8",
  taupe: "#827c74",
  ivory: "#ece9e2",
  stone: "#d9d6cf",
  ecru: "#e7e3da",
  sand: "#b3aa9d",
};

/**
 * Robust color comparison supporting:
 * 1. Exact string matches (case-insensitive, trimmed)
 * 2. Cross-matching between hex codes and standard color names
 */
export function areColorsMatching(c1?: string | null, c2?: string | null): boolean {
  if (!c1 || !c2) return false;
  const n1 = c1.trim().toLowerCase();
  const n2 = c2.trim().toLowerCase();
  if (n1 === n2) return true;

  // Normalized labels (e.g. #262626 -> "black")
  const name1 = (COLOR_NAMES[n1] || n1).toLowerCase();
  const name2 = (COLOR_NAMES[n2] || n2).toLowerCase();
  if (name1 === name2) return true;

  // Mapped hex values (e.g. "black" -> "#1a1a1a")
  const hex1 = (COLOR_NAME_TO_HEX[n1] || n1).toLowerCase();
  const hex2 = (COLOR_NAME_TO_HEX[n2] || n2).toLowerCase();
  if (hex1 === hex2) return true;

  return false;
}

export function formatColorLabel(rawColor: string): string {
  if (!rawColor) return "";
  const normalized = rawColor.trim().toLowerCase();
  if (COLOR_NAMES[normalized]) {
    return COLOR_NAMES[normalized];
  }
  if (!rawColor.startsWith("#")) {
    return rawColor.charAt(0).toUpperCase() + rawColor.slice(1);
  }
  return rawColor;
}

export function resolveSwatchBackground(rawColor: string): string {
  if (!rawColor) return "#222222";
  const trimmed = rawColor.trim();
  if (trimmed.startsWith("#") || trimmed.startsWith("rgb") || trimmed.startsWith("hsl")) {
    return trimmed;
  }
  const lower = trimmed.toLowerCase();
  if (COLOR_NAME_TO_HEX[lower]) {
    return COLOR_NAME_TO_HEX[lower];
  }
  return trimmed;
}

export interface ColorResolvableImage {
  id?: string;
  url?: string;
  proxyUrl?: string;
  color?: string | null;
  alt?: string | null;
  altText?: string | null;
  is_primary?: boolean;
  isPrimary?: boolean;
  display_order?: number;
  displayOrder?: number;
}

export interface ColorResolvableProduct {
  image?: string;
  images?: ColorResolvableImage[];
  colors?: string[];
}

/**
 * Returns the resolved ColorResolvableImage object matching the color, or primary/first image.
 */
export function resolveProductColorImageObject(
  product: ColorResolvableProduct,
  targetColor?: string | null
): ColorResolvableImage | null {
  if (!product) return null;
  const images = Array.isArray(product.images) && product.images.length > 0 ? product.images : [];
  if (images.length === 0) return null;

  const trimmedTarget = targetColor?.trim();
  if (trimmedTarget) {
    const directMatch = images.find((img) => areColorsMatching(img.color, trimmedTarget));
    if (directMatch) return directMatch;

    const lowerTarget = trimmedTarget.toLowerCase();
    if (lowerTarget.length > 1) {
      const textMatch = images.find((img) => {
        const alt = (img.alt || img.altText || "").toLowerCase();
        const u = (img.url || img.proxyUrl || "").toLowerCase();
        return alt.includes(lowerTarget) || u.includes(lowerTarget);
      });
      if (textMatch) return textMatch;
    }

    const availableColors = Array.isArray(product.colors) ? product.colors.filter(Boolean) : [];
    if (availableColors.length > 1 && images.length === availableColors.length) {
      const colorPos = availableColors.findIndex((c) => areColorsMatching(c, trimmedTarget));
      if (colorPos >= 0 && colorPos < images.length) {
        return images[colorPos];
      }
    }
  }

  const primaryImg = images.find((img) => Boolean(img.is_primary || img.isPrimary));
  return primaryImg || images[0] || null;
}

/**
 * Deterministically resolves the most accurate product image for a given color.
 *
 * Evaluation Strategy:
 * 1. Direct match: image where areColorsMatching(img.color, targetColor) is true.
 * 2. Alt text / URL match: image whose altText or url includes the color name.
 * 3. Positional 1-to-1 correspondence: when available product.colors and images have
 *    matching lengths (N > 1), map the index of targetColor in product.colors to images[index].
 * 4. Safe fallback: product's designated primary image, first image, or product.image fallback.
 */
export function resolveProductColorImage(
  product: ColorResolvableProduct,
  targetColor?: string | null
): string {
  if (!product) return "";
  const fallback = product.image || "";
  if (!targetColor || !targetColor.trim()) return fallback;

  const images = Array.isArray(product.images) && product.images.length > 0 ? product.images : [];
  if (images.length === 0) return fallback;

  const getImgUrl = (img?: ColorResolvableImage): string => img?.url || img?.proxyUrl || "";
  const isImgPrimary = (img?: ColorResolvableImage): boolean => Boolean(img?.is_primary || img?.isPrimary);
  const getImgAlt = (img?: ColorResolvableImage): string => img?.alt || img?.altText || "";

  const trimmedTarget = targetColor.trim();

  // 1. Direct color match on assigned image color
  const directMatch = images.find((img) => areColorsMatching(img.color, trimmedTarget));
  if (directMatch && getImgUrl(directMatch)) {
    return getImgUrl(directMatch);
  }

  // 2. Alt text or URL match
  const lowerTarget = trimmedTarget.toLowerCase();
  if (lowerTarget.length > 1) {
    const textMatch = images.find((img) => {
      const alt = getImgAlt(img).toLowerCase();
      const u = getImgUrl(img).toLowerCase();
      return alt.includes(lowerTarget) || u.includes(lowerTarget);
    });
    if (textMatch && getImgUrl(textMatch)) {
      return getImgUrl(textMatch);
    }
  }

  // 3. Positional 1-to-1 correspondence:
  // If product has N colors and N images, map targetColor's position to the corresponding image
  const availableColors = Array.isArray(product.colors) ? product.colors.filter(Boolean) : [];
  if (availableColors.length > 1 && images.length === availableColors.length) {
    const colorPos = availableColors.findIndex((c) => areColorsMatching(c, trimmedTarget));
    if (colorPos >= 0 && colorPos < images.length) {
      const mappedImg = images[colorPos];
      if (mappedImg && getImgUrl(mappedImg)) {
        return getImgUrl(mappedImg);
      }
    }
  }

  // 4. Fallback to primary image, first image, or product fallback
  const primaryImg = images.find((img) => isImgPrimary(img));
  return getImgUrl(primaryImg) || getImgUrl(images[0]) || fallback;
}
