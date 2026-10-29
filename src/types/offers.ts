/**
 * Quantity Offer Data Types
 * Style Edit — Phase 2: Quantity-Offer Foundation
 */

export interface ProductQuantityOffer {
  /** Unique offer identifier (UUID) */
  id: string;
  /** Foreign key referencing public.products(id) */
  product_id: string;
  /** Qualifying quantity threshold (e.g. 3 for "Buy 3 for ₹1,000") */
  qualifying_quantity: number;
  /** Total price in INR for one bundle of qualifying units (e.g. 1000) */
  bundle_price: number;
  /** Active / inactive status toggle */
  is_active: boolean;
  /** UTC ISO timestamp when offer was created */
  created_at: string;
  /** UTC ISO timestamp when offer was last updated */
  updated_at: string;
}

/**
 * Payload used when creating or updating an offer
 */
export interface ProductQuantityOfferInput {
  product_id: string;
  qualifying_quantity: number;
  bundle_price: number;
  is_active?: boolean;
}

/**
 * Product-specific offer record with joined product metadata for the Admin UI
 */
export interface AdminProductQuantityOffer extends ProductQuantityOffer {
  product?: {
    id: string;
    name: string;
    slug: string;
    price: number;
    sale_price: number | null;
    category: string;
    status: string;
    department?: string;
    primaryImage?: string | null;
  } | null;
}

/**
 * Detailed breakdown of price calculation for an item with quantity offers applied
 */
export interface ItemPriceCalculation {
  /** Total units evaluated */
  quantity: number;
  /** Authoritative regular unit price in INR */
  regularUnitPrice: number;
  /** Regular subtotal without any offer: quantity * regularUnitPrice */
  regularSubtotal: number;
  /** Number of complete qualifying bundles: floor(quantity / qualifying_quantity) */
  qualifyingBundles: number;
  /** Total units that belong to the qualifying bundles: qualifyingBundles * qualifying_quantity */
  bundledUnits: number;
  /** Bundle price applied per bundle (0 if no bundle applied) */
  bundlePrice: number;
  /** Total cost for all bundled units: qualifyingBundles * bundlePrice */
  bundleSubtotal: number;
  /** Remaining units outside of complete bundles: quantity % qualifying_quantity */
  remainingUnits: number;
  /** Total cost for remaining units: remainingUnits * regularUnitPrice */
  remainingSubtotal: number;
  /** Discount amount in INR: regularSubtotal - finalTotal */
  discountAmount: number;
  /** Total customer savings in INR: regularSubtotal - finalTotal */
  totalSavings: number;
  /** Final amount payable: bundleSubtotal + remainingSubtotal */
  finalTotal: number;
  /** Whether any bundle offer was successfully applied */
  hasOfferApplied: boolean;
  /** The offer tier rule applied (null if no offer applied) */
  appliedOffer: ProductQuantityOffer | null;
  /** Human-readable offer summary (e.g., "Buy 3 for ₹1,000" or null) */
  offerLabel: string | null;
}
