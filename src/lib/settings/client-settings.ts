"use client";

import type { PromoBannerConfig, NavbarConfig } from "./site-settings";

export interface StorefrontSettingsData {
  promoBanner?: PromoBannerConfig;
  catalogueMarquee?: {
    ads: string[];
    rawAds?: [string, string, string];
    updatedAt?: string;
  };
  navbar?: NavbarConfig;
}

let cachedSettings: StorefrontSettingsData | null = null;
let inflightPromise: Promise<StorefrontSettingsData | null> | null = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds client-side memory cache

/**
 * Retrieves storefront settings on the client.
 * - Deduplicates concurrent calls from multiple mounting components (e.g. Navbar + CollectionMarquee).
 * - Caches data in memory across client-side page transitions.
 */
export async function getClientStorefrontSettings(): Promise<StorefrontSettingsData | null> {
  const now = Date.now();
  if (cachedSettings && now - lastFetchedAt < CACHE_TTL_MS) {
    return cachedSettings;
  }

  if (inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = (async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) {
        return cachedSettings;
      }
      const data: StorefrontSettingsData = await res.json();
      cachedSettings = data;
      lastFetchedAt = Date.now();
      return data;
    } catch (err) {
      console.warn("[client-settings] Error fetching site settings:", err);
      return cachedSettings;
    } finally {
      inflightPromise = null;
    }
  })();

  return inflightPromise;
}

/**
 * Clears the in-memory settings cache. Can be used after admin mutations if needed.
 */
export function invalidateClientStorefrontSettingsCache(): void {
  cachedSettings = null;
  lastFetchedAt = 0;
  inflightPromise = null;
}
