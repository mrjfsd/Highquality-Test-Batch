/**
 * Cart Item and Cart State Type Definitions
 * Style Edit — Phase 1: Basic Cart Functionality
 */

export interface CartItem {
  /**
   * Deterministic unique item identifier.
   * Format: `${productId}__${variantId || 'default'}__${size || ''}__${color || ''}`
   */
  id: string;
  productId: string;
  name: string;
  slug: string;
  image: string;
  price: number; // Regular unit price in INR
  variantId?: string | null;
  size?: string | null;
  color?: string | null;
  quantity: number;
}

export interface AddToCartInput {
  product: {
    id: string | number;
    name: string;
    slug: string;
    price: number;
    image: string;
  };
  variantId?: string | null;
  size?: string | null;
  color?: string | null;
  quantity?: number;
}

import type { ProductQuantityOffer, ItemPriceCalculation } from "./offers";

export type CartItemPricingResult = ItemPriceCalculation & {
  unitsNeededForNextTier: number | null;
  nextTierOffer: ProductQuantityOffer | null;
};

export interface CartTotalsBreakdown {
  regularSubtotal: number;
  totalSavings: number;
  finalTotal: number;
}

export interface CartContextValue {
  items: CartItem[];
  totalCount: number;
  subtotal: number;
  totalSavings: number;
  finalTotal: number;
  offersMap: Record<string, ProductQuantityOffer[]>;
  isLoaded: boolean;
  addItem: (input: AddToCartInput) => { success: boolean; itemId: string };
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, newQuantity: number) => void;
  clearCart: () => void;
  getItemPricing: (item: CartItem, contextItems?: CartItem[]) => CartItemPricingResult;
  getProductOffer: (productId: string | number) => ProductQuantityOffer | null;
  getWhatsAppOrderUrl: (selectedItemsOverride?: CartItem[]) => string;
  // Selective WhatsApp ordering controls
  selectedItemIds: string[];
  isItemSelected: (itemId: string) => boolean;
  toggleSelectItem: (itemId: string) => void;
  selectAllItems: () => void;
  deselectAllItems: () => void;
  selectedItems: CartItem[];
  selectedTotals: CartTotalsBreakdown;
  selectedCount: number;
  selectedTotalUnits: number;
}
