import type { CartItem, AddToCartInput } from "@/types/cart";
import {
  calculateItemPriceWithOffers,
  roundCurrency,
  formatOfferLabel,
  createRegularPricing,
} from "../pricing/quantity-offers.ts";
import type { ProductQuantityOffer, ItemPriceCalculation } from "@/types/offers";

/**
 * Verified repository WhatsApp phone number for Style Edit Mysuru.
 * As referenced in Navbar.tsx (https://wa.me/917676105819) and Footer.tsx.
 */
export const STORE_WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_STORE_WHATSAPP || "917676105819";

export const CART_STORAGE_KEY = "style_edit_cart_v1";
export const CART_SELECTED_STORAGE_KEY = "style_edit_cart_selected_v1";

/**
 * Builds a deterministic unique ID for a cart item based on product and variant attributes.
 */
export function buildCartItemId(
  productId: string | number,
  variantId?: string | null,
  size?: string | null,
  color?: string | null
): string {
  const p = String(productId).trim();
  const v = (variantId || "default").trim();
  const s = (size || "nosize").trim().toLowerCase();
  const c = (color || "nocolor").trim().toLowerCase();
  return `${p}__${v}__${s}__${c}`;
}

/**
 * Formats currency in Indian Rupee format (e.g. ₹4,490 or ₹400).
 */
export function formatCartCurrency(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  return `₹${Math.round(safeAmount).toLocaleString("en-IN")}`;
}

/**
 * Calculates item regular subtotal (regular price * quantity).
 */
export function calculateItemSubtotal(item: CartItem): number {
  const price = Number.isFinite(item.price) ? Math.max(0, item.price) : 0;
  const qty = Number.isFinite(item.quantity) ? Math.max(1, Math.floor(item.quantity)) : 1;
  return roundCurrency(price * qty);
}

/**
 * Calculates overall cart regular subtotal (before offer savings).
 */
export function calculateCartSubtotal(items: CartItem[]): number {
  if (!Array.isArray(items)) return 0;
  return roundCurrency(items.reduce((sum, item) => sum + calculateItemSubtotal(item), 0));
}

/**
 * Calculates total number of units in the cart.
 */
export function calculateTotalCount(items: CartItem[]): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    const qty = Number.isFinite(item.quantity) ? Math.max(0, Math.floor(item.quantity)) : 0;
    return sum + qty;
  }, 0);
}

/**
 * Detailed item pricing evaluation inside cart.
 * Takes into account all variants of the same product present in the cart,
 * allowing product-level bundle offers to apply across variant selections.
 */
export function calculateItemPricingInCart(
  item: CartItem,
  allItems: CartItem[],
  offersMap: Record<string, ProductQuantityOffer[]> = {}
): ItemPriceCalculation & {
  unitsNeededForNextTier: number | null;
  nextTierOffer: ProductQuantityOffer | null;
} {
  const productOffers = offersMap[item.productId] || [];
  const safeQty = Number.isFinite(item.quantity) && item.quantity > 0 ? Math.floor(item.quantity) : 0;
  const safeUnitPrice = Number.isFinite(item.price) && item.price > 0 ? roundCurrency(item.price) : 0;

  if (safeQty <= 0 || safeUnitPrice <= 0) {
    return {
      ...createRegularPricing(safeQty, safeUnitPrice),
      unitsNeededForNextTier: null,
      nextTierOffer: null,
    };
  }

  // Find all items in the cart belonging to this product
  const siblingItems = (allItems || []).filter((i) => i.productId === item.productId);
  const totalProductQty = siblingItems.reduce((sum, i) => sum + Math.max(1, Math.floor(i.quantity || 1)), 0);

  // Evaluate offer for total units of this product
  const productCalc = calculateItemPriceWithOffers(totalProductQty, safeUnitPrice, productOffers);

  // Determine next offer tier progress
  let unitsNeededForNextTier: number | null = null;
  let nextTierOffer: ProductQuantityOffer | null = null;

  const eligibleOffers = productOffers
    .filter((o) => o.is_active && o.bundle_price < o.qualifying_quantity * safeUnitPrice)
    .sort((a, b) => a.qualifying_quantity - b.qualifying_quantity);

  const higherTier = eligibleOffers.find((o) => o.qualifying_quantity > totalProductQty);
  if (higherTier) {
    unitsNeededForNextTier = higherTier.qualifying_quantity - totalProductQty;
    nextTierOffer = higherTier;
  }

  // If there's only this item or no offers applied
  if (siblingItems.length <= 1 || !productCalc.hasOfferApplied) {
    const directCalc = calculateItemPriceWithOffers(safeQty, safeUnitPrice, productOffers);
    return {
      ...directCalc,
      unitsNeededForNextTier,
      nextTierOffer,
    };
  }

  // Allocate discount proportionally across sibling lines
  const regularSubtotal = roundCurrency(safeQty * safeUnitPrice);
  const proportion = safeQty / totalProductQty;
  const discountAmount = roundCurrency(productCalc.totalSavings * proportion);
  const finalTotal = roundCurrency(Math.max(0, regularSubtotal - discountAmount));

  return {
    quantity: safeQty,
    regularUnitPrice: safeUnitPrice,
    regularSubtotal,
    qualifyingBundles: productCalc.qualifyingBundles,
    bundledUnits: Math.floor(productCalc.bundledUnits * proportion),
    bundlePrice: productCalc.bundlePrice,
    bundleSubtotal: roundCurrency(productCalc.bundleSubtotal * proportion),
    remainingUnits: Math.max(0, safeQty - Math.floor(productCalc.bundledUnits * proportion)),
    remainingSubtotal: roundCurrency(finalTotal - roundCurrency(productCalc.bundleSubtotal * proportion)),
    discountAmount,
    totalSavings: discountAmount,
    finalTotal,
    hasOfferApplied: discountAmount > 0,
    appliedOffer: productCalc.appliedOffer,
    offerLabel: productCalc.appliedOffer ? formatOfferLabel(productCalc.appliedOffer) : null,
    unitsNeededForNextTier,
    nextTierOffer,
  };
}

/**
 * Calculates authoritative cart totals with quantity offers applied.
 */
export function calculateCartTotalsWithOffers(
  items: CartItem[],
  offersMap: Record<string, ProductQuantityOffer[]> = {}
): {
  regularSubtotal: number;
  totalSavings: number;
  finalTotal: number;
} {
  if (!Array.isArray(items) || items.length === 0) {
    return { regularSubtotal: 0, totalSavings: 0, finalTotal: 0 };
  }

  // Group items by productId to apply product-level quantity offers correctly
  const productGroups: Record<string, { items: CartItem[]; unitPrice: number; totalQty: number }> = {};

  for (const item of items) {
    const pid = item.productId;
    if (!productGroups[pid]) {
      productGroups[pid] = {
        items: [],
        unitPrice: Number(item.price) || 0,
        totalQty: 0,
      };
    }
    productGroups[pid].items.push(item);
    productGroups[pid].totalQty += Math.max(1, Math.floor(item.quantity || 1));
  }

  let cartRegularSubtotal = 0;
  let cartTotalSavings = 0;

  for (const [pid, group] of Object.entries(productGroups)) {
    const groupRegularSubtotal = roundCurrency(group.totalQty * group.unitPrice);
    cartRegularSubtotal = roundCurrency(cartRegularSubtotal + groupRegularSubtotal);

    const productOffers = offersMap[pid];
    if (productOffers && productOffers.length > 0) {
      const calc = calculateItemPriceWithOffers(group.totalQty, group.unitPrice, productOffers);
      if (calc.hasOfferApplied && calc.totalSavings > 0) {
        cartTotalSavings = roundCurrency(cartTotalSavings + calc.totalSavings);
      }
    }
  }

  const finalTotal = roundCurrency(Math.max(0, cartRegularSubtotal - cartTotalSavings));

  return {
    regularSubtotal: cartRegularSubtotal,
    totalSavings: cartTotalSavings,
    finalTotal,
  };
}

/**
 * Sanitizes and validates raw data parsed from localStorage.
 */
export function sanitizeCartItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];

  const validItems: CartItem[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;

    const maybeItem = entry as Partial<CartItem>;
    const productId = maybeItem.productId ? String(maybeItem.productId).trim() : "";
    const name = maybeItem.name ? String(maybeItem.name).trim() : "";
    const slug = maybeItem.slug ? String(maybeItem.slug).trim() : "";
    const image = maybeItem.image ? String(maybeItem.image).trim() : "";
    const price =
      typeof maybeItem.price === "number" && Number.isFinite(maybeItem.price)
        ? Math.max(0, maybeItem.price)
        : 0;
    const quantity =
      typeof maybeItem.quantity === "number" && Number.isFinite(maybeItem.quantity)
        ? Math.max(1, Math.floor(maybeItem.quantity))
        : 1;

    if (!productId || !name || !slug) continue;

    const variantId = maybeItem.variantId ? String(maybeItem.variantId).trim() : null;
    const size = maybeItem.size ? String(maybeItem.size).trim() : null;
    const color = maybeItem.color ? String(maybeItem.color).trim() : null;
    const imageId =
      maybeItem.imageId && typeof maybeItem.imageId === "string" && maybeItem.imageId.trim().length > 0
        ? maybeItem.imageId.trim()
        : null;

    const id =
      maybeItem.id && typeof maybeItem.id === "string" && maybeItem.id.length > 0
        ? maybeItem.id
        : buildCartItemId(productId, variantId, size, color);

    validItems.push({
      id,
      productId,
      name,
      slug,
      image: image || "/assets/floating-garment-mobile.webp",
      imageId,
      price,
      variantId,
      size,
      color,
      quantity,
    });
  }

  return validItems;
}

/**
 * Generates the human-readable WhatsApp order message including line item
 * breakdowns, applied quantity offers, savings, and order-level totals.
 *
 * Example:
 * Hello! I'd like to place an order from Style Edit.
 *
 * 1. Classic Denim Jeans
 *    Size: 32
 *    Color: Blue
 *    Quantity: 3
 *    Regular price: ₹400 each
 *    Regular subtotal: ₹1,200
 *    Offer: Buy 3 for ₹1,000
 *    Savings: ₹200
 *    Item total: ₹1,000
 *
 * Subtotal: ₹1,200
 * Offer savings: ₹200
 * Final total: ₹1,000
 *
/**
 * Resolves the canonical base URL for the deployed storefront.
 * Checks environment configuration with fallback to runtime origin, Vercel system variables, or active production deployment.
 */
export function getCanonicalSiteUrl(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_CANONICAL_URL;

  if (envUrl && typeof envUrl === "string" && envUrl.trim().length > 0) {
    const trimmed = envUrl.trim().replace(/\/+$/, "");
    return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }

  const vercelProjectUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProjectUrl && typeof vercelProjectUrl === "string" && vercelProjectUrl.trim().length > 0) {
    return `https://${vercelProjectUrl.trim().replace(/\/+$/, "")}`;
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl && typeof vercelUrl === "string" && vercelUrl.trim().length > 0) {
    return `https://${vercelUrl.trim().replace(/\/+$/, "")}`;
  }

  return "https://highquality-test-batch.vercel.app";
}

/**
 * Constructs an absolute short product details URL using canonical site URL and product slug or ID.
 * Format: `${baseUrl}/p/${cleanSlug}`
 * Safely handles missing slugs, leading slashes, and redundant route segments.
 */
export function formatProductUrl(
  slug?: string | null,
  baseUrl: string = getCanonicalSiteUrl()
): string {
  if (!slug || typeof slug !== "string") return "";
  const trimmed = slug.trim();
  if (!trimmed) return "";

  // If already an absolute URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  const cleanBase = baseUrl.trim().replace(/\/+$/, "");
  // Strip redundant leading /product/ or /p/ or /
  const cleanSlug = trimmed.replace(/^\/?(product|p)\//, "").replace(/^\/+/, "");
  if (!cleanSlug) return "";

  return `${cleanBase}/p/${cleanSlug}`;
}

/**
 * Constructs an absolute, short, publicly accessible product image URL on the same domain.
 * Format: `${baseUrl}/i/${imageId || identifier || cleanPath}`
 * Rejects local file paths, temporary blobs, and base64 data URLs.
 * Cleans thumbnail resizing query params for a short, direct link.
 * If relative or R2 proxy, converts to short /i/ route on canonical baseUrl.
 */
export function formatImageUrl(
  imageUrl?: string | null,
  baseUrl: string = getCanonicalSiteUrl(),
  imageId?: string | null,
  slugOrId?: string | null
): string {
  const cleanBase = baseUrl.trim().replace(/\/+$/, "");

  // If explicit persistent imageId (e.g. UUID) is available, use highest-priority short URL
  if (imageId && typeof imageId === "string" && imageId.trim()) {
    const trimmedId = imageId.trim();
    if (!trimmedId.includes("..") && !trimmedId.includes("\\")) {
      return `${cleanBase}/i/${trimmedId}`;
    }
  }

  if (!imageUrl || typeof imageUrl !== "string") {
    // If no imageUrl but slugOrId is provided, fallback to product-derived short image
    if (slugOrId && typeof slugOrId === "string" && slugOrId.trim()) {
      const cleanSlug = slugOrId.trim().replace(/^\/?(product|p)\//, "").replace(/^\/+/, "");
      if (cleanSlug && !cleanSlug.includes("..")) {
        return `${cleanBase}/i/${cleanSlug}`;
      }
    }
    return "";
  }

  const trimmed = imageUrl.trim();
  if (!trimmed) return "";

  // Reject local file paths, temporary browser blob URLs, and data URLs
  if (
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("file:") ||
    trimmed.startsWith("data:")
  ) {
    return "";
  }

  // Clean thumbnail query params (e.g. ?w=192&q=80) for a cleaner, full-resolution image URL
  let cleanUrl = trimmed;
  if (cleanUrl.includes("?")) {
    const [pathPart] = cleanUrl.split("?");
    cleanUrl = pathPart;
  }

  // If already an absolute short /i/ URL on baseUrl
  if (cleanUrl.startsWith(`${cleanBase}/i/`)) {
    return cleanUrl;
  }

  // If already a relative short /i/ URL
  if (cleanUrl.startsWith("/i/")) {
    return `${cleanBase}${cleanUrl}`;
  }

  // If it's an R2 image proxy path (e.g. /api/images/products/... or https://style-edit.com/api/images/products/...)
  if (cleanUrl.includes("/api/images/")) {
    const storagePath = cleanUrl.split("/api/images/")[1];
    if (storagePath) {
      return `${cleanBase}/i/${storagePath.replace(/^\/+/, "")}`;
    }
  }

  // If relative path (e.g. /jeans.jpg, /images/shirt.jpg, /assets/...)
  if (cleanUrl.startsWith("/")) {
    const relativePath = cleanUrl.replace(/^\/+/, "");
    return `${cleanBase}/i/${relativePath}`;
  }

  // If simple filename without slash (e.g. "jeans.jpg")
  if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
    return `${cleanBase}/i/${cleanUrl}`;
  }

  // If external absolute URL (e.g. Unsplash) and slug/productId is known, route through same-domain short link
  if (slugOrId && typeof slugOrId === "string" && slugOrId.trim()) {
    const cleanSlug = slugOrId.trim().replace(/^\/?(product|p)\//, "").replace(/^\/+/, "");
    if (cleanSlug && !cleanSlug.includes("..")) {
      return `${cleanBase}/i/${cleanSlug}`;
    }
  }

  // Otherwise return cleanUrl
  return cleanUrl;
}

/**
 * Generates the human-readable WhatsApp order message including line item
 * breakdowns, product links, image URLs, variant details, applied quantity offers,
 * and order summary totals using WhatsApp bulleted and bold formatting.
 *
 * Example:
 * Hello! I'd like to place an order from Style Edit.
 *
 * *1. Relaxed Fit Collar Down Shirt*
 * - Product: https://style-edit.com/p/relaxed-fit-collar-down-shirt
 * - Image: https://style-edit.com/i/shirt-pink.jpg
 * - Size: L
 * - Colour: Pink
 * - Quantity: 1
 * - Regular price: ₹1,200 each
 * - Regular subtotal: ₹1,200
 * - Savings: ₹0
 * - Final item total: ₹1,200
 *
 * ---
 *
 * *Order Summary*
 * - Selected order subtotal: ₹1,200
 * - Offer savings: ₹0
 * - Final order total: ₹1,200
 *
 * Please confirm availability and the order details. Thank you!
 */
export function generateWhatsAppOrderMessage(
  items: CartItem[],
  offersMap: Record<string, ProductQuantityOffer[]> = {},
  baseUrl: string = getCanonicalSiteUrl()
): string {
  if (!items || items.length === 0) {
    return "Hello! I'm interested in ordering from Style Edit.";
  }

  const lines: string[] = [
    "Hello! I'd like to place an order from Style Edit.",
    "",
  ];

  items.forEach((item, index) => {
    const itemPricing = calculateItemPricingInCart(item, items, offersMap);
    const productUrl = formatProductUrl(item.slug, baseUrl);
    const imageUrl = formatImageUrl(
      item.image,
      baseUrl,
      item.imageId,
      item.slug
    );

    lines.push(`*${index + 1}. ${item.name}*`);

    if (productUrl) {
      lines.push(`- Product: ${productUrl}`);
    }

    if (imageUrl) {
      lines.push(`- Image: ${imageUrl}`);
    }

    if (item.size && item.size.trim() && item.size.trim().toLowerCase() !== "nosize") {
      lines.push(`- Size: ${item.size.trim()}`);
    }

    if (item.color && item.color.trim() && item.color.trim().toLowerCase() !== "nocolor") {
      lines.push(`- Colour: ${item.color.trim()}`);
    }

    const safeQty = Math.max(1, Math.floor(item.quantity || 1));
    lines.push(`- Quantity: ${safeQty}`);
    lines.push(`- Regular price: ${formatCartCurrency(item.price)} each`);
    lines.push(`- Regular subtotal: ${formatCartCurrency(itemPricing.regularSubtotal)}`);

    if (itemPricing.hasOfferApplied && itemPricing.appliedOffer) {
      lines.push(
        `- Offer: Buy ${itemPricing.appliedOffer.qualifying_quantity} for ${formatCartCurrency(
          itemPricing.appliedOffer.bundle_price
        )}`
      );
      lines.push(`- Savings: ${formatCartCurrency(itemPricing.discountAmount)}`);
    } else {
      lines.push("- Savings: ₹0");
    }

    lines.push(`- Final item total: ${formatCartCurrency(itemPricing.finalTotal)}`);
    lines.push("");
    lines.push("---");
    lines.push("");
  });

  const totals = calculateCartTotalsWithOffers(items, offersMap);

  lines.push("*Order Summary*");
  lines.push(`- Selected order subtotal: ${formatCartCurrency(totals.regularSubtotal)}`);
  lines.push(`- Offer savings: ${formatCartCurrency(totals.totalSavings)}`);
  lines.push(`- Final order total: ${formatCartCurrency(totals.finalTotal)}`);
  lines.push("");
  lines.push("Please confirm availability and the order details. Thank you!");

  return lines.join("\n");
}

/**
 * Generates the complete wa.me URL with properly URL-encoded order message.
 */
export function generateWhatsAppOrderUrl(
  items: CartItem[],
  offersMap: Record<string, ProductQuantityOffer[]> = {},
  customPhone: string = STORE_WHATSAPP_NUMBER,
  baseUrl: string = getCanonicalSiteUrl()
): string {
  if (!items || items.length === 0) {
    return "";
  }
  const cleanPhone = customPhone.replace(/\D/g, "");
  if (!cleanPhone) {
    return "";
  }
  const message = generateWhatsAppOrderMessage(items, offersMap, baseUrl);
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

export interface BuyNowInput {
  product: {
    id: string | number;
    name: string;
    price: number;
    slug?: string;
    image?: string;
    imageId?: string | null;
  };
  variantId?: string | null;
  size?: string | null;
  color?: string | null;
  quantity: number;
  activeOffer?: ProductQuantityOffer | null;
  imageId?: string | null;
}

/**
 * Generates the WhatsApp order message for a direct "Buy Now" action
 * on a single product without modifying or including cart items.
 */
export function generateBuyNowWhatsAppMessage(
  input: BuyNowInput,
  baseUrl: string = getCanonicalSiteUrl()
): string {
  const { product, size, color, quantity, activeOffer, imageId } = input;
  const safeQty = Math.max(1, Math.floor(quantity || 1));
  const safeUnitPrice =
    Number.isFinite(product.price) && product.price > 0
      ? Math.max(0, product.price)
      : 0;

  // Use the shared quantity-offer pricing engine
  const pricing = calculateItemPriceWithOffers(safeQty, safeUnitPrice, activeOffer);
  const productUrl = formatProductUrl(product.slug, baseUrl);
  const imageUrl = formatImageUrl(
    product.image,
    baseUrl,
    imageId || product.imageId,
    product.slug
  );

  const lines: string[] = [
    "Hello! I'd like to order from Style Edit.",
    "",
    `*Product: ${product.name}*`,
  ];

  if (productUrl) {
    lines.push(`- Product: ${productUrl}`);
  }
  if (imageUrl) {
    lines.push(`- Image: ${imageUrl}`);
  }

  if (size && size.trim() && size.trim().toLowerCase() !== "nosize") {
    lines.push(`- Size: ${size.trim()}`);
  }
  if (color && color.trim() && color.trim().toLowerCase() !== "nocolor") {
    lines.push(`- Colour: ${color.trim()}`);
  }
  lines.push(`- Quantity: ${safeQty}`);
  lines.push("");
  lines.push(`- Regular price: ${formatCartCurrency(safeUnitPrice)} each`);
  lines.push(`- Regular subtotal: ${formatCartCurrency(pricing.regularSubtotal)}`);

  if (pricing.hasOfferApplied && pricing.appliedOffer) {
    lines.push(
      `- Offer: Buy ${pricing.appliedOffer.qualifying_quantity} for ${formatCartCurrency(
        pricing.appliedOffer.bundle_price
      )}`
    );
    lines.push(`- Savings: ${formatCartCurrency(pricing.discountAmount)}`);
  } else {
    lines.push("- Savings: ₹0");
  }

  lines.push(`- Final total: ${formatCartCurrency(pricing.finalTotal)}`);
  lines.push("");
  lines.push("Please confirm availability and the order details. Thank you!");

  return lines.join("\n");
}

/**
 * Generates the complete wa.me URL for a direct "Buy Now" action on a single product.
 */
export function generateBuyNowWhatsAppUrl(
  input: BuyNowInput,
  customPhone: string = STORE_WHATSAPP_NUMBER,
  baseUrl: string = getCanonicalSiteUrl()
): string {
  const cleanPhone = customPhone.replace(/\D/g, "");
  if (!cleanPhone) {
    return "";
  }
  const message = generateBuyNowWhatsAppMessage(input, baseUrl);
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}
