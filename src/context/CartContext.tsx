"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type {
  CartItem,
  AddToCartInput,
  CartContextValue,
  CartItemPricingResult,
  CartTotalsBreakdown,
} from "@/types/cart";
import type { ProductQuantityOffer, ItemPriceCalculation } from "@/types/offers";
import {
  CART_STORAGE_KEY,
  CART_SELECTED_STORAGE_KEY,
  buildCartItemId,
  calculateTotalCount,
  sanitizeCartItems,
  calculateCartTotalsWithOffers,
  calculateItemPricingInCart,
  generateWhatsAppOrderUrl,
} from "@/lib/cart/cart-utils";
import { createRegularPricing } from "@/lib/pricing/quantity-offers";
import { resolveProductColorImage } from "@/lib/products/colors";

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [offersMap, setOffersMap] = useState<Record<string, ProductQuantityOffer[]>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Synchronize selection state to localStorage
  const persistSelected = useCallback((newSelected: string[]) => {
    try {
      localStorage.setItem(CART_SELECTED_STORAGE_KEY, JSON.stringify(newSelected));
    } catch (err) {
      console.warn("[CartContext] Failed to save cart selection to localStorage:", err);
    }
  }, []);

  // Synchronize items state to localStorage
  const persistItems = useCallback((newItems: CartItem[]) => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newItems));
    } catch (err) {
      console.warn("[CartContext] Failed to save cart to localStorage:", err);
    }
  }, []);

  // Initialize and load persisted cart & selection from localStorage on client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const sanitized = sanitizeCartItems(parsed);
        setItems(sanitized);

        if (sanitized.length === 1) {
          // Exactly one item: automatically include it in selection
          const singleId = [sanitized[0].id];
          setSelectedItemIds(singleId);
          persistSelected(singleId);
        } else {
          // Restore previously selected items or default to selecting all valid items
          try {
            const storedSelected = localStorage.getItem(CART_SELECTED_STORAGE_KEY);
            if (storedSelected) {
              const parsedSelected = JSON.parse(storedSelected);
              if (Array.isArray(parsedSelected)) {
                // Only keep IDs that still exist in the sanitized cart
                const validSelected = parsedSelected.filter((id) =>
                  sanitized.some((item) => item.id === id)
                );
                setSelectedItemIds(validSelected);
              } else {
                setSelectedItemIds(sanitized.map((i) => i.id));
              }
            } else {
              setSelectedItemIds(sanitized.map((i) => i.id));
            }
          } catch {
            setSelectedItemIds(sanitized.map((i) => i.id));
          }
        }
      }
    } catch (err) {
      console.warn("[CartContext] Failed to load cart from localStorage:", err);
      // Malformed data is safely discarded
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Fetch active storefront quantity offers
  const fetchOffers = useCallback(async () => {
    try {
      const res = await fetch("/api/offers", {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.offers === "object") {
          setOffersMap(data.offers);
        }
      }
    } catch (err) {
      // Non-blocking: if network fails or table is unmigrated, cart continues with regular pricing
      console.warn("[CartContext] Could not fetch active quantity offers:", err);
    }
  }, []);

  useEffect(() => {
    fetchOffers();

    // Re-check offers when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchOffers();
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    return () => window.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [fetchOffers]);

  // Listen for storage events across browser tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          const sanitized = sanitizeCartItems(parsed);
          setItems(sanitized);
          setSelectedItemIds((prev) => {
            const filtered = prev.filter((id) => sanitized.some((i) => i.id === id));
            return filtered;
          });
        } catch {
          // Ignore parse errors from concurrent writes
        }
      } else if (e.key === CART_STORAGE_KEY && !e.newValue) {
        setItems([]);
        setSelectedItemIds([]);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Reconcile color-specific images for existing cart items non-destructively
  useEffect(() => {
    if (!isLoaded || items.length === 0) return;

    const itemsWithColor = items.filter((item) => Boolean(item.color && item.color.trim()));
    if (itemsWithColor.length === 0) return;

    let isMounted = true;

    async function reconcileColorImages() {
      const productIds = Array.from(new Set(itemsWithColor.map((i) => i.productId)));
      const updates: Record<string, string> = {};

      await Promise.all(
        productIds.map(async (pid) => {
          try {
            const res = await fetch(`/api/products/${encodeURIComponent(pid)}/gallery?limit=50`, {
              headers: { Accept: "application/json" },
            });
            if (!res.ok) return;
            const data = await res.json();
            if (!data?.images || !Array.isArray(data.images) || data.images.length === 0) return;

            const relevantItems = itemsWithColor.filter((i) => i.productId === pid);
            for (const item of relevantItems) {
              const resolved = resolveProductColorImage(
                {
                  image: item.image,
                  images: data.images,
                  colors: data.colors,
                },
                item.color
              );
              if (resolved && resolved !== item.image) {
                updates[item.id] = resolved;
              }
            }
          } catch (err) {
            console.warn(`[CartContext] Color image reconciliation skipped for product ${pid}:`, err);
          }
        })
      );

      if (!isMounted || Object.keys(updates).length === 0) return;

      setItems((prevItems) => {
        let hasChanges = false;
        const updated = prevItems.map((item) => {
          if (updates[item.id] && updates[item.id] !== item.image) {
            hasChanges = true;
            return {
              ...item,
              image: updates[item.id],
            };
          }
          return item;
        });

        if (hasChanges) {
          persistItems(updated);
          return updated;
        }
        return prevItems;
      });
    }

    reconcileColorImages();

    return () => {
      isMounted = false;
    };
  }, [isLoaded, persistItems]);

  const addItem = useCallback(
    (input: AddToCartInput): { success: boolean; itemId: string } => {
      const { product, variantId, size, color, quantity = 1 } = input;
      const addQty = Math.max(1, Math.floor(quantity));
      const targetId = buildCartItemId(product.id, variantId, size, color);

      setItems((prevItems) => {
        const existingIndex = prevItems.findIndex((item) => item.id === targetId);
        let updated: CartItem[];

        if (existingIndex > -1) {
          // Merge matching product and variant: increase existing quantity
          updated = prevItems.map((item, index) => {
            if (index === existingIndex) {
              return {
                ...item,
                quantity: item.quantity + addQty,
              };
            }
            return item;
          });
        } else {
          // Add as new item (resolving color image if available)
          const resolvedColorImage =
            color && product.images && product.images.length > 0
              ? resolveProductColorImage(
                  {
                    image: product.image,
                    images: product.images,
                    colors: product.colors,
                  },
                  color
                )
              : product.image;

          const newItem: CartItem = {
            id: targetId,
            productId: String(product.id),
            name: product.name,
            slug: product.slug,
            image: resolvedColorImage || product.image,
            price: Number.isFinite(product.price) ? Math.max(0, product.price) : 0,
            variantId: variantId || null,
            size: size || null,
            color: color || null,
            quantity: addQty,
          };
          updated = [...prevItems, newItem];
        }

        persistItems(updated);
        return updated;
      });

      // Newly added items should be selected by default
      setSelectedItemIds((prev) => {
        const next = prev.includes(targetId) ? prev : [...prev, targetId];
        persistSelected(next);
        return next;
      });

      return { success: true, itemId: targetId };
    },
    [persistItems, persistSelected]
  );

  const removeItem = useCallback(
    (itemId: string) => {
      setItems((prevItems) => {
        const updated = prevItems.filter((item) => item.id !== itemId);
        persistItems(updated);

        // If reduced to exactly 1 distinct item, automatically include it
        if (updated.length === 1) {
          const singleId = [updated[0].id];
          setSelectedItemIds(singleId);
          persistSelected(singleId);
        } else {
          // Automatically remove from selection
          setSelectedItemIds((prev) => {
            const next = prev.filter((id) => id !== itemId);
            persistSelected(next);
            return next;
          });
        }

        return updated;
      });
    },
    [persistItems, persistSelected]
  );

  const updateQuantity = useCallback(
    (itemId: string, newQuantity: number) => {
      const validQty = Math.floor(newQuantity);

      setItems((prevItems) => {
        if (validQty <= 0) {
          // Remove if reduced to 0 or less
          const updated = prevItems.filter((item) => item.id !== itemId);
          persistItems(updated);

          // If reduced to exactly 1 distinct item, automatically include it
          if (updated.length === 1) {
            const singleId = [updated[0].id];
            setSelectedItemIds(singleId);
            persistSelected(singleId);
          } else {
            setSelectedItemIds((prev) => {
              const next = prev.filter((id) => id !== itemId);
              persistSelected(next);
              return next;
            });
          }

          return updated;
        }

        const updated = prevItems.map((item) => {
          if (item.id === itemId) {
            return {
              ...item,
              quantity: validQty,
            };
          }
          return item;
        });

        persistItems(updated);
        return updated;
      });
    },
    [persistItems, persistSelected]
  );

  const clearCart = useCallback(() => {
    setItems([]);
    setSelectedItemIds([]);
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
      localStorage.removeItem(CART_SELECTED_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  const isItemSelected = useCallback(
    (itemId: string) => {
      if (items.length === 1) {
        return items[0].id === itemId;
      }
      return selectedItemIds.includes(itemId);
    },
    [items, selectedItemIds]
  );

  const toggleSelectItem = useCallback(
    (itemId: string) => {
      setSelectedItemIds((prev) => {
        const next = prev.includes(itemId)
          ? prev.filter((id) => id !== itemId)
          : [...prev, itemId];
        persistSelected(next);
        return next;
      });
    },
    [persistSelected]
  );

  const selectAllItems = useCallback(() => {
    const allIds = items.map((i) => i.id);
    setSelectedItemIds(allIds);
    persistSelected(allIds);
  }, [items, persistSelected]);

  const deselectAllItems = useCallback(() => {
    setSelectedItemIds([]);
    persistSelected([]);
  }, [persistSelected]);

  const totalCount = useMemo(() => calculateTotalCount(items), [items]);

  // Authoritative calculations applying active quantity offers across full cart
  const cartTotals = useMemo(() => {
    return calculateCartTotalsWithOffers(items, offersMap);
  }, [items, offersMap]);

  // Selected items subset: when single item cart, automatically includes that item
  const selectedItems = useMemo(() => {
    if (items.length === 1) {
      return items;
    }
    return items.filter((item) => selectedItemIds.includes(item.id));
  }, [items, selectedItemIds]);

  // Authoritative calculations applying active quantity offers exclusively to selected items
  const selectedTotals = useMemo(() => {
    return calculateCartTotalsWithOffers(selectedItems, offersMap);
  }, [selectedItems, offersMap]);

  const selectedCount = selectedItems.length;

  const selectedTotalUnits = useMemo(
    () => selectedItems.reduce((acc, item) => acc + item.quantity, 0),
    [selectedItems]
  );

  const getItemPricing = useCallback(
    (item: CartItem, contextItems?: CartItem[]): CartItemPricingResult => {
      const isSelected = items.length === 1 || selectedItemIds.includes(item.id);
      const pool =
        contextItems ||
        (isSelected ? selectedItems : [item]);
      return calculateItemPricingInCart(item, pool, offersMap);
    },
    [items.length, selectedItemIds, selectedItems, offersMap]
  );

  const getProductOffer = useCallback(
    (productId: string | number): ProductQuantityOffer | null => {
      const pid = String(productId).trim();
      const offers = offersMap[pid];
      if (!offers || offers.length === 0) return null;
      // Return lowest qualifying threshold tier as primary banner offer
      return offers[0] || null;
    },
    [offersMap]
  );

  const getWhatsAppOrderUrl = useCallback(
    (selectedItemsOverride?: CartItem[]) => {
      const targetItems = selectedItemsOverride || selectedItems;
      return generateWhatsAppOrderUrl(targetItems, offersMap);
    },
    [selectedItems, offersMap]
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      totalCount,
      subtotal: cartTotals.regularSubtotal,
      totalSavings: cartTotals.totalSavings,
      finalTotal: cartTotals.finalTotal,
      offersMap,
      isLoaded,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      getItemPricing,
      getProductOffer,
      getWhatsAppOrderUrl,
      selectedItemIds,
      isItemSelected,
      toggleSelectItem,
      selectAllItems,
      deselectAllItems,
      selectedItems,
      selectedTotals,
      selectedCount,
      selectedTotalUnits,
    }),
    [
      items,
      totalCount,
      cartTotals,
      offersMap,
      isLoaded,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      getItemPricing,
      getProductOffer,
      getWhatsAppOrderUrl,
      selectedItemIds,
      isItemSelected,
      toggleSelectItem,
      selectAllItems,
      deselectAllItems,
      selectedItems,
      selectedTotals,
      selectedCount,
      selectedTotalUnits,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

const defaultCartTotals: CartTotalsBreakdown = {
  regularSubtotal: 0,
  totalSavings: 0,
  finalTotal: 0,
};

const defaultCartValue: CartContextValue = {
  items: [],
  totalCount: 0,
  subtotal: 0,
  totalSavings: 0,
  finalTotal: 0,
  offersMap: {},
  isLoaded: false,
  addItem: () => ({ success: false, itemId: "" }),
  removeItem: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  getItemPricing: (item: CartItem): CartItemPricingResult => ({
    ...createRegularPricing(item.quantity, item.price),
    unitsNeededForNextTier: null,
    nextTierOffer: null,
  }),
  getProductOffer: () => null,
  getWhatsAppOrderUrl: () => "",
  selectedItemIds: [],
  isItemSelected: () => false,
  toggleSelectItem: () => {},
  selectAllItems: () => {},
  deselectAllItems: () => {},
  selectedItems: [],
  selectedTotals: defaultCartTotals,
  selectedCount: 0,
  selectedTotalUnits: 0,
};

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  return context || defaultCartValue;
}
