import { createClient } from "@supabase/supabase-js";
import type { ProductQuantityOffer } from "@/types/offers";

/**
 * Creates a public client for storefront offer lookups.
 * Safe to run both on server and in API routes.
 */
function getPublicSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

let memoryOffersCache: { data: ProductQuantityOffer[]; expiresAt: number } | null = null;
const OFFERS_CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Invalidates the in-memory active offers cache (called when admin creates, updates, or deletes offers).
 */
export function invalidateOffersCache(): void {
  memoryOffersCache = null;
}

/**
 * Fetches all active quantity offers for published products from Supabase.
 * Returns empty array if table does not exist yet (PGRST205) or database is unreachable.
 * Result is cached in memory for 30 seconds to prevent hammering Supabase on repeated requests.
 */
export async function fetchStorefrontActiveOffers(): Promise<ProductQuantityOffer[]> {
  if (memoryOffersCache && Date.now() < memoryOffersCache.expiresAt) {
    return memoryOffersCache.data;
  }

  try {
    const supabase = getPublicSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("product_quantity_offers")
      .select("id, product_id, qualifying_quantity, bundle_price, is_active, created_at, updated_at")
      .eq("is_active", true)
      .order("qualifying_quantity", { ascending: true });

    if (error) {
      // PGRST205: Table not found in schema cache
      if (error.code === "PGRST205" || error.message?.includes("product_quantity_offers")) {
        console.warn("[offers-loader] public.product_quantity_offers table not yet applied in Supabase.");
        memoryOffersCache = {
          data: [],
          expiresAt: Date.now() + OFFERS_CACHE_TTL_MS,
        };
        return [];
      }
      console.warn("[offers-loader] Database error fetching offers:", error.message);
      return [];
    }

    const mapped = (data || []).map((row) => ({
      id: row.id,
      product_id: String(row.product_id),
      qualifying_quantity: Number(row.qualifying_quantity),
      bundle_price: Number(row.bundle_price),
      is_active: Boolean(row.is_active),
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    memoryOffersCache = {
      data: mapped,
      expiresAt: Date.now() + OFFERS_CACHE_TTL_MS,
    };

    return mapped;
  } catch (err: unknown) {
    console.warn("[offers-loader] Unexpected error fetching active offers:", err);
    return [];
  }
}

/**
 * Fetches active quantity offers grouped by product_id as a dictionary map.
 */
export async function fetchStorefrontOffersMap(): Promise<Record<string, ProductQuantityOffer[]>> {
  const offers = await fetchStorefrontActiveOffers();
  const map: Record<string, ProductQuantityOffer[]> = {};

  for (const offer of offers) {
    if (!map[offer.product_id]) {
      map[offer.product_id] = [];
    }
    map[offer.product_id].push(offer);
  }

  return map;
}

/**
 * Fetches active offers for a specific product ID.
 */
export async function fetchActiveOffersForProduct(
  productId: string | number
): Promise<ProductQuantityOffer[]> {
  const cleanId = String(productId).trim();
  if (!cleanId) return [];

  const offersMap = await fetchStorefrontOffersMap();
  return offersMap[cleanId] || [];
}
