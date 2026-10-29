/**
 * Shared Quantity-Offer Pricing Engine
 * Style Edit — Phase 2: Quantity-Offer Foundation
 *
 * Pure, authoritative pricing utilities independent of UI components.
 * Can be reused across product catalog cards, product details page,
 * cart drawer, cart page, and WhatsApp order builders.
 */

import type { ProductQuantityOffer, ItemPriceCalculation } from "@/types/offers";

/**
 * Currency rounding helper to prevent IEEE-754 floating-point inaccuracies
 * (e.g., 0.1 + 0.2 = 0.30000000000000004).
 * Always rounds to two decimal places.
 */
export function roundCurrency(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Formats a quantity offer into a standardized human-readable label.
 * Example: "Buy 3 for ₹1,000"
 */
export function formatOfferLabel(
  offer: Pick<ProductQuantityOffer, "qualifying_quantity" | "bundle_price"> | null | undefined
): string | null {
  if (!offer) return null;
  const qty = offer.qualifying_quantity;
  const price = offer.bundle_price;
  if (!Number.isFinite(qty) || qty <= 1 || !Number.isFinite(price) || price < 0) {
    return null;
  }
  return `Buy ${qty} for ₹${Math.round(price).toLocaleString("en-IN")}`;
}

/**
 * Validates whether an offer object is structurally sound, active,
 * and delivers real customer savings at the given unit price.
 */
export function isOfferEligible(
  offer: unknown,
  regularUnitPrice: number
): offer is ProductQuantityOffer {
  if (!offer || typeof offer !== "object") return false;

  const o = offer as Partial<ProductQuantityOffer>;
  if (!o.is_active) return false;

  const qty = Number(o.qualifying_quantity);
  const bundlePrice = Number(o.bundle_price);
  const unitPrice = Number(regularUnitPrice);

  if (!Number.isInteger(qty) || qty < 2) return false;
  if (!Number.isFinite(bundlePrice) || bundlePrice < 0) return false;
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) return false;

  // The bundle price must be strictly lower than regular price for that quantity.
  // Otherwise, the offer would either provide 0 savings or penalize the customer.
  const regularBundleCost = roundCurrency(qty * unitPrice);
  if (bundlePrice >= regularBundleCost) return false;

  return true;
}

/**
 * Constructs a fallback calculation representing regular pricing without offers.
 */
export function createRegularPricing(
  quantity: number,
  regularUnitPrice: number
): ItemPriceCalculation {
  const safeQty = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 0;
  const safeUnitPrice = Number.isFinite(regularUnitPrice) && regularUnitPrice > 0
    ? roundCurrency(regularUnitPrice)
    : 0;
  const subtotal = roundCurrency(safeQty * safeUnitPrice);

  return {
    quantity: safeQty,
    regularUnitPrice: safeUnitPrice,
    regularSubtotal: subtotal,
    qualifyingBundles: 0,
    bundledUnits: 0,
    bundlePrice: 0,
    bundleSubtotal: 0,
    remainingUnits: safeQty,
    remainingSubtotal: subtotal,
    discountAmount: 0,
    totalSavings: 0,
    finalTotal: subtotal,
    hasOfferApplied: false,
    appliedOffer: null,
    offerLabel: null,
  };
}

/**
 * Evaluates a single specific offer tier against an item quantity and regular price.
 */
export function evaluateSingleOfferTier(
  quantity: number,
  regularUnitPrice: number,
  offer: ProductQuantityOffer
): ItemPriceCalculation {
  const safeQty = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 0;
  const safeUnitPrice = Number.isFinite(regularUnitPrice) && regularUnitPrice > 0
    ? roundCurrency(regularUnitPrice)
    : 0;

  if (safeQty <= 0 || safeUnitPrice <= 0) {
    return createRegularPricing(safeQty, safeUnitPrice);
  }

  // Check offer validity and active status
  if (!isOfferEligible(offer, safeUnitPrice)) {
    return createRegularPricing(safeQty, safeUnitPrice);
  }

  const threshold = offer.qualifying_quantity;
  const bundlePrice = roundCurrency(offer.bundle_price);
  const regularSubtotal = roundCurrency(safeQty * safeUnitPrice);

  // If quantity is below the qualifying threshold, no discount applies
  if (safeQty < threshold) {
    return {
      ...createRegularPricing(safeQty, safeUnitPrice),
      // Preserve appliedOffer as null since it did not apply to this quantity
    };
  }

  // Calculate complete bundles and remaining units
  const qualifyingBundles = Math.floor(safeQty / threshold);
  const bundledUnits = qualifyingBundles * threshold;
  const remainingUnits = safeQty % threshold;

  const bundleSubtotal = roundCurrency(qualifyingBundles * bundlePrice);
  const remainingSubtotal = roundCurrency(remainingUnits * safeUnitPrice);
  const finalTotal = roundCurrency(bundleSubtotal + remainingSubtotal);
  const discountAmount = roundCurrency(Math.max(0, regularSubtotal - finalTotal));

  return {
    quantity: safeQty,
    regularUnitPrice: safeUnitPrice,
    regularSubtotal,
    qualifyingBundles,
    bundledUnits,
    bundlePrice,
    bundleSubtotal,
    remainingUnits,
    remainingSubtotal,
    discountAmount,
    totalSavings: discountAmount,
    finalTotal,
    hasOfferApplied: discountAmount > 0 && qualifyingBundles > 0,
    appliedOffer: discountAmount > 0 && qualifyingBundles > 0 ? offer : null,
    offerLabel: discountAmount > 0 && qualifyingBundles > 0 ? formatOfferLabel(offer) : null,
  };
}

/**
 * Authoritative pricing calculator supporting both single offers and multiple offer tiers.
 *
 * If multiple active tiers are provided for a product (e.g. "Buy 3 for ₹1,000" and "Buy 5 for ₹1,500"),
 * it selects the tier that maximizes total customer savings for the given quantity.
 *
 * @param quantity The number of units of this product (must be a positive integer)
 * @param regularUnitPrice The verified regular unit price of the product
 * @param offers A single ProductQuantityOffer, an array of offers, or null/undefined
 */
export function calculateItemPriceWithOffers(
  quantity: number,
  regularUnitPrice: number,
  offers?: ProductQuantityOffer | ProductQuantityOffer[] | null
): ItemPriceCalculation {
  const safeQty = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 0;
  const safeUnitPrice = Number.isFinite(regularUnitPrice) && regularUnitPrice > 0
    ? roundCurrency(regularUnitPrice)
    : 0;

  if (safeQty <= 0 || safeUnitPrice <= 0) {
    return createRegularPricing(safeQty, safeUnitPrice);
  }

  if (!offers) {
    return createRegularPricing(safeQty, safeUnitPrice);
  }

  const offerList = Array.isArray(offers) ? offers : [offers];
  const eligibleOffers = offerList.filter((o) => isOfferEligible(o, safeUnitPrice));

  if (eligibleOffers.length === 0) {
    return createRegularPricing(safeQty, safeUnitPrice);
  }

  // Evaluate every eligible offer tier and pick the one with maximum customer savings
  let bestCalculation: ItemPriceCalculation = createRegularPricing(safeQty, safeUnitPrice);

  for (const offer of eligibleOffers) {
    const calc = evaluateSingleOfferTier(safeQty, safeUnitPrice, offer);
    if (calc.hasOfferApplied && calc.totalSavings > bestCalculation.totalSavings) {
      bestCalculation = calc;
    } else if (
      calc.hasOfferApplied &&
      calc.totalSavings === bestCalculation.totalSavings &&
      bestCalculation.appliedOffer &&
      offer.qualifying_quantity > bestCalculation.appliedOffer.qualifying_quantity
    ) {
      // Tie-breaker: prefer higher tier if savings happen to be identical
      bestCalculation = calc;
    }
  }

  return bestCalculation;
}
