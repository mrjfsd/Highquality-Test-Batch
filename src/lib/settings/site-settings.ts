import fs from "fs";
import path from "path";
import { cache } from "react";
import { unstable_cache, revalidateTag } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export interface PromoBannerConfig {
  imageUrl: string;
  storagePath?: string | null;
  altText?: string;
  enabled: boolean;
  positionX: number; // 0 - 100 percentage
  positionY: number; // 0 - 100 percentage
  zoom: number;      // 1.0 - 2.5 scale factor
  updatedAt?: string;
}

export interface CatalogueMarqueeConfig {
  ads: [string, string, string];
  updatedAt?: string;
}

export interface NavbarConfig {
  showSaleLink: boolean;
  updatedAt?: string;
}

export const DEFAULT_PROMO_BANNER: PromoBannerConfig = {
  imageUrl: "/assets/image.png",
  storagePath: null,
  altText: "Diwali Sale Promotional Banner — Click to explore sale pieces",
  enabled: true,
  positionX: 50,
  positionY: 46,
  zoom: 1.0,
};

export const DEFAULT_CATALOGUE_ADS: [string, string, string] = [
  "BUY ANY 4 GET Rs.200 OFF",
  "BUY ANY 2 GET Rs.100 OFF",
  "10% OFF ON FIRST ORDER",
];

export const DEFAULT_NAVBAR_CONFIG: NavbarConfig = {
  showSaleLink: true,
};

function normalizeNavbarConfig(raw?: Partial<NavbarConfig> | null): NavbarConfig {
  if (!raw) return { ...DEFAULT_NAVBAR_CONFIG };
  return {
    showSaleLink: raw.showSaleLink !== false,
    updatedAt: raw.updatedAt,
  };
}

function normalizePromoBanner(raw?: Partial<PromoBannerConfig> | null): PromoBannerConfig {
  if (!raw) return { ...DEFAULT_PROMO_BANNER };
  return {
    ...DEFAULT_PROMO_BANNER,
    ...raw,
    enabled: raw.enabled !== false,
    positionX: typeof raw.positionX === "number" ? Math.max(0, Math.min(100, raw.positionX)) : DEFAULT_PROMO_BANNER.positionX,
    positionY: typeof raw.positionY === "number" ? Math.max(0, Math.min(100, raw.positionY)) : DEFAULT_PROMO_BANNER.positionY,
    zoom: typeof raw.zoom === "number" ? Math.max(1, Math.min(2.5, raw.zoom)) : DEFAULT_PROMO_BANNER.zoom,
  };
}

// Fallback persistence file in server runtime if DB table is not yet provisioned
const DATA_DIR = path.join(process.cwd(), ".data");
const FALLBACK_FILE = path.join(DATA_DIR, "site_settings.json");

interface PersistedSettings {
  promo_banner?: PromoBannerConfig;
  catalogue_marquee?: CatalogueMarqueeConfig;
  navbar?: NavbarConfig;
}

function readFallbackSettings(): PersistedSettings {
  try {
    if (fs.existsSync(FALLBACK_FILE)) {
      const raw = fs.readFileSync(FALLBACK_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn("[site-settings] Could not read fallback settings file:", err);
  }
  return {};
}

function writeFallbackSettings(settings: PersistedSettings): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(settings, null, 2), "utf-8");
  } catch (err) {
    console.warn("[site-settings] Could not write fallback settings file:", err);
  }
}

function invalidateSettingsCache(): void {
  try {
    revalidateTag("site-settings", "max");
  } catch {
    // Ignored outside of request context
  }
}

/**
 * Low-level query: homepage promotional banner config.
 */
async function queryPromoBannerConfig(): Promise<PromoBannerConfig> {
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "promo_banner")
        .maybeSingle();

      if (error) {
        console.warn("[site-settings] Supabase getPromoBanner error:", error.code, error.message);
      } else if (data?.value) {
        return normalizePromoBanner(data.value as Partial<PromoBannerConfig>);
      }
    }
  } catch (err) {
    console.warn("[site-settings] Supabase getPromoBanner fallback:", err);
  }

  const fallback = readFallbackSettings();
  if (fallback.promo_banner) {
    return normalizePromoBanner(fallback.promo_banner);
  }

  return { ...DEFAULT_PROMO_BANNER };
}

/**
 * Low-level query: catalogue marquee advertisement config.
 */
async function queryCatalogueMarqueeConfig(): Promise<CatalogueMarqueeConfig> {
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "catalogue_marquee")
        .maybeSingle();

      if (!error && data?.value) {
        const val = data.value as { ads?: string[]; updatedAt?: string };
        const rawAds = Array.isArray(val.ads) ? val.ads : [];
        return {
          ads: [
            typeof rawAds[0] === "string" ? rawAds[0] : DEFAULT_CATALOGUE_ADS[0],
            typeof rawAds[1] === "string" ? rawAds[1] : DEFAULT_CATALOGUE_ADS[1],
            typeof rawAds[2] === "string" ? rawAds[2] : DEFAULT_CATALOGUE_ADS[2],
          ],
          updatedAt: val.updatedAt,
        };
      }
    }
  } catch (err) {
    console.warn("[site-settings] Supabase getCatalogueMarquee fallback:", err);
  }

  const fallback = readFallbackSettings();
  if (fallback.catalogue_marquee?.ads) {
    const rawAds = fallback.catalogue_marquee.ads;
    return {
      ads: [
        typeof rawAds[0] === "string" ? rawAds[0] : DEFAULT_CATALOGUE_ADS[0],
        typeof rawAds[1] === "string" ? rawAds[1] : DEFAULT_CATALOGUE_ADS[1],
        typeof rawAds[2] === "string" ? rawAds[2] : DEFAULT_CATALOGUE_ADS[2],
      ],
      updatedAt: fallback.catalogue_marquee.updatedAt,
    };
  }

  return {
    ads: [...DEFAULT_CATALOGUE_ADS],
  };
}

/**
 * Low-level query: customer navbar configuration.
 */
async function queryNavbarConfig(): Promise<NavbarConfig> {
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "navbar")
        .maybeSingle();

      if (!error && data?.value) {
        return normalizeNavbarConfig(data.value as Partial<NavbarConfig>);
      }
    }
  } catch (err) {
    console.warn("[site-settings] Supabase getNavbarConfig fallback:", err);
  }

  const fallback = readFallbackSettings();
  if (fallback.navbar) {
    return normalizeNavbarConfig(fallback.navbar);
  }

  return { ...DEFAULT_NAVBAR_CONFIG };
}

// ============================================================================
// 1. Persistent Data Cache (unstable_cache)
// 1 hour background revalidation (3600s), tagged with 'site-settings'
// ============================================================================

const getCachedPromoBannerConfig = unstable_cache(
  async () => queryPromoBannerConfig(),
  ["site-settings-promo-banner"],
  {
    revalidate: 3600,
    tags: ["site-settings", "promo-banner"],
  }
);

const getCachedCatalogueMarqueeConfig = unstable_cache(
  async () => queryCatalogueMarqueeConfig(),
  ["site-settings-catalogue-marquee"],
  {
    revalidate: 3600,
    tags: ["site-settings", "catalogue-marquee"],
  }
);

const getCachedNavbarConfig = unstable_cache(
  async () => queryNavbarConfig(),
  ["site-settings-navbar"],
  {
    revalidate: 3600,
    tags: ["site-settings", "navbar"],
  }
);

// ============================================================================
// 2. Request-Scoped Memoization (React.cache)
// Deduplicates fetches within a single server rendering pass
// ============================================================================

export const getPromoBannerConfig = cache(async (): Promise<PromoBannerConfig> => {
  return getCachedPromoBannerConfig();
});

export const getCatalogueMarqueeConfig = cache(async (): Promise<CatalogueMarqueeConfig> => {
  return getCachedCatalogueMarqueeConfig();
});

export const getNavbarConfig = cache(async (): Promise<NavbarConfig> => {
  return getCachedNavbarConfig();
});

/**
 * Updates the homepage promotional banner config.
 */
export async function savePromoBannerConfig(
  config: Partial<PromoBannerConfig>
): Promise<PromoBannerConfig> {
  const current = await getPromoBannerConfig();
  const updated: PromoBannerConfig = {
    ...current,
    ...config,
    enabled: typeof config.enabled === "boolean" ? config.enabled : current.enabled,
    positionX: typeof config.positionX === "number" ? Math.max(0, Math.min(100, Math.round(config.positionX))) : current.positionX,
    positionY: typeof config.positionY === "number" ? Math.max(0, Math.min(100, Math.round(config.positionY))) : current.positionY,
    zoom: typeof config.zoom === "number" ? Math.max(1, Math.min(2.5, Math.round(config.zoom * 100) / 100)) : current.zoom,
    updatedAt: new Date().toISOString(),
  };

  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase.from("site_settings").upsert(
        {
          key: "promo_banner",
          value: updated,
          updated_at: updated.updatedAt,
        },
        { onConflict: "key" }
      );
      if (error) {
        console.error(
          `[site-settings] Supabase upsert promo_banner failed (${error.code}): ${error.message}. ` +
          (error.hint ? `Hint: ${error.hint}` : "Check public.site_settings permissions.")
        );
      }
    }
  } catch (err) {
    console.error("[site-settings] DB savePromoBanner failed:", err);
  }

  // Always update local fallback for server restarts/redundancy
  const currentFallback = readFallbackSettings();
  currentFallback.promo_banner = updated;
  writeFallbackSettings(currentFallback);

  invalidateSettingsCache();
  return updated;
}

/**
 * Updates the catalogue marquee advertisement config (all 3 fields together).
 */
export async function saveCatalogueMarqueeConfig(
  ads: [string, string, string] | string[]
): Promise<CatalogueMarqueeConfig> {
  const normalizedAds: [string, string, string] = [
    typeof ads[0] === "string" ? ads[0] : "",
    typeof ads[1] === "string" ? ads[1] : "",
    typeof ads[2] === "string" ? ads[2] : "",
  ];

  const updated: CatalogueMarqueeConfig = {
    ads: normalizedAds,
    updatedAt: new Date().toISOString(),
  };

  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase.from("site_settings").upsert(
        {
          key: "catalogue_marquee",
          value: updated,
          updated_at: updated.updatedAt,
        },
        { onConflict: "key" }
      );
      if (error) {
        console.warn("[site-settings] Upsert catalogue_marquee DB error:", error.message);
      }
    }
  } catch (err) {
    console.warn("[site-settings] DB saveCatalogueMarquee failed:", err);
  }

  // Always update local fallback
  const currentFallback = readFallbackSettings();
  currentFallback.catalogue_marquee = updated;
  writeFallbackSettings(currentFallback);

  invalidateSettingsCache();
  return updated;
}

/**
 * Updates the customer navbar configuration.
 */
export async function saveNavbarConfig(
  config: Partial<NavbarConfig>
): Promise<NavbarConfig> {
  const current = await getNavbarConfig();
  const updated: NavbarConfig = {
    ...current,
    ...config,
    showSaleLink: typeof config.showSaleLink === "boolean" ? config.showSaleLink : current.showSaleLink,
    updatedAt: new Date().toISOString(),
  };

  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase.from("site_settings").upsert(
        {
          key: "navbar",
          value: updated,
          updated_at: updated.updatedAt,
        },
        { onConflict: "key" }
      );
      if (error) {
        console.warn("[site-settings] Upsert navbar DB error:", error.message);
      }
    }
  } catch (err) {
    console.warn("[site-settings] DB saveNavbarConfig failed:", err);
  }

  // Always update local fallback for server restarts/redundancy
  const currentFallback = readFallbackSettings();
  currentFallback.navbar = updated;
  writeFallbackSettings(currentFallback);

  invalidateSettingsCache();
  return updated;
}

