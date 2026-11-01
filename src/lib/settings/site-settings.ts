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
  imageUrl: "/assets/image.webp",
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
  showSaleLink: false,
};

import {
  type HeroCardConfigItem,
  DEFAULT_HERO_CARDS,
  type HomepageFavouriteItem,
  DEFAULT_HOMEPAGE_FAVOURITES,
  type HomepageFormPerspectiveItem,
  DEFAULT_HOMEPAGE_FORM_PERSPECTIVE,
} from "@/types/homepage-images";

export {
  type HeroCardConfigItem,
  DEFAULT_HERO_CARDS,
  type HomepageFavouriteItem,
  DEFAULT_HOMEPAGE_FAVOURITES,
  type HomepageFormPerspectiveItem,
  DEFAULT_HOMEPAGE_FORM_PERSPECTIVE,
};

export function normalizeHeroCards(raw?: unknown): HeroCardConfigItem[] {
  return DEFAULT_HERO_CARDS.map((def, idx) => {
    let saved: Partial<HeroCardConfigItem> | null = null;
    if (Array.isArray(raw)) {
      saved =
        raw.find((r) => r && (r.slotIndex === idx || r.id === def.id || r.id === `hero-${idx}`)) ||
        null;
    }

    if (!saved || typeof saved !== "object") {
      return { ...def };
    }

    const customImage =
      (saved.customImage && typeof saved.customImage === "string" && saved.customImage.trim()) ||
      (saved.isCustom && saved.image && saved.image !== def.defaultImage ? saved.image.trim() : null) ||
      null;

    const isCustom = Boolean(customImage);

    return {
      id: def.id,
      slotIndex: idx,
      displayOrder: idx,
      defaultImage: def.defaultImage,
      defaultTitle: def.defaultTitle,
      defaultCategory: def.defaultCategory,
      defaultAlt: def.defaultAlt,
      customImage,
      customTitle: saved.customTitle || (isCustom ? saved.title : null) || null,
      customCategory: saved.customCategory || (isCustom ? saved.category : null) || null,
      customAlt: saved.customAlt || (isCustom ? saved.alt : null) || null,
      storagePath: isCustom ? saved.storagePath || null : null,
      isCustom,
      image: isCustom && customImage ? customImage : def.defaultImage,
      title: isCustom && (saved.customTitle || saved.title) ? (saved.customTitle || saved.title)! : def.defaultTitle,
      category: isCustom && (saved.customCategory || saved.category) ? (saved.customCategory || saved.category)! : def.defaultCategory,
      alt: isCustom && (saved.customAlt || saved.alt) ? (saved.customAlt || saved.alt)! : def.defaultAlt,
      updatedAt: saved.updatedAt,
    };
  });
}

export function normalizeHomepageFavourites(raw?: unknown): HomepageFavouriteItem[] {
  return DEFAULT_HOMEPAGE_FAVOURITES.map((def, idx) => {
    let saved: Partial<HomepageFavouriteItem> | null = null;
    if (Array.isArray(raw)) {
      saved =
        raw.find((r) => r && (r.slotIndex === idx || r.id === def.id || r.id === `fav-${idx}`)) ||
        null;
    }

    if (!saved || typeof saved !== "object") {
      return { ...def };
    }

    const customImage =
      (saved.customImage && typeof saved.customImage === "string" && saved.customImage.trim()) ||
      (saved.isCustom && saved.image && saved.image !== def.defaultImage ? saved.image.trim() : null) ||
      null;

    const isCustom = Boolean(customImage);

    return {
      id: def.id,
      slotIndex: idx,
      title: def.title,
      price: def.price,
      href: def.href,
      defaultImage: def.defaultImage,
      defaultAlt: def.defaultAlt,
      customImage,
      storagePath: isCustom ? saved.storagePath || null : null,
      isCustom,
      image: isCustom && customImage ? customImage : def.defaultImage,
      alt: isCustom && saved.alt ? saved.alt : def.defaultAlt,
      updatedAt: saved.updatedAt,
    };
  });
}

export function normalizeHomepageFormPerspective(raw?: unknown): HomepageFormPerspectiveItem[] {
  return DEFAULT_HOMEPAGE_FORM_PERSPECTIVE.map((def, idx) => {
    let saved: Partial<HomepageFormPerspectiveItem> | null = null;
    if (Array.isArray(raw)) {
      saved =
        raw.find((r) => r && (r.slotIndex === idx || r.id === def.id || r.id === `fp-${idx}`)) ||
        null;
    }

    if (!saved || typeof saved !== "object") {
      return { ...def };
    }

    const customImage =
      (saved.customImage && typeof saved.customImage === "string" && saved.customImage.trim()) ||
      (saved.isCustom && saved.image && saved.image !== def.defaultImage ? saved.image.trim() : null) ||
      null;

    const isCustom = Boolean(customImage);

    return {
      id: def.id,
      slotIndex: idx,
      position: def.position,
      title: def.title,
      subtitle: def.subtitle,
      tagNum: def.tagNum,
      tagLabel: def.tagLabel,
      href: def.href,
      defaultImage: def.defaultImage,
      defaultAlt: def.defaultAlt,
      customImage,
      storagePath: isCustom ? saved.storagePath || null : null,
      isCustom,
      image: isCustom && customImage ? customImage : def.defaultImage,
      alt: isCustom && saved.alt ? saved.alt : def.defaultAlt,
      updatedAt: saved.updatedAt,
    };
  });
}

function normalizeNavbarConfig(raw?: Partial<NavbarConfig> | null): NavbarConfig {
  if (!raw) return { ...DEFAULT_NAVBAR_CONFIG };
  return {
    showSaleLink:
      typeof raw.showSaleLink === "boolean"
        ? raw.showSaleLink
        : DEFAULT_NAVBAR_CONFIG.showSaleLink,
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
  hero_cards?: HeroCardConfigItem[];
  homepage_favourites?: HomepageFavouriteItem[];
  homepage_form_perspective?: HomepageFormPerspectiveItem[];
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
    revalidateTag("navbar", "max");
    revalidateTag("hero-cards", "max");
    revalidateTag("homepage", "max");
    revalidateTag("homepage-favourites", "max");
    revalidateTag("homepage-form-perspective", "max");
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

/**
 * Low-level query: homepage hero cards config.
 */
async function queryHeroCardsConfig(): Promise<HeroCardConfigItem[]> {
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "hero_cards")
        .maybeSingle();

      if (!error && data?.value) {
        return normalizeHeroCards(data.value);
      }
    }
  } catch (err) {
    console.warn("[site-settings] Supabase getHeroCardsConfig fallback:", err);
  }

  const fallback = readFallbackSettings();
  if (fallback.hero_cards && Array.isArray(fallback.hero_cards) && fallback.hero_cards.length > 0) {
    return normalizeHeroCards(fallback.hero_cards);
  }

  return [...DEFAULT_HERO_CARDS];
}

/**
 * Low-level query: homepage favourites config (4 slots).
 */
async function queryHomepageFavouritesConfig(): Promise<HomepageFavouriteItem[]> {
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "homepage_favourites")
        .maybeSingle();

      if (!error && data?.value) {
        return normalizeHomepageFavourites(data.value);
      }
    }
  } catch (err) {
    console.warn("[site-settings] Supabase getHomepageFavouritesConfig fallback:", err);
  }

  const fallback = readFallbackSettings();
  if (fallback.homepage_favourites && Array.isArray(fallback.homepage_favourites) && fallback.homepage_favourites.length > 0) {
    return normalizeHomepageFavourites(fallback.homepage_favourites);
  }

  return [...DEFAULT_HOMEPAGE_FAVOURITES];
}

/**
 * Low-level query: homepage form & perspective config (4 slots).
 */
async function queryHomepageFormPerspectiveConfig(): Promise<HomepageFormPerspectiveItem[]> {
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "homepage_form_perspective")
        .maybeSingle();

      if (!error && data?.value) {
        return normalizeHomepageFormPerspective(data.value);
      }
    }
  } catch (err) {
    console.warn("[site-settings] Supabase getHomepageFormPerspectiveConfig fallback:", err);
  }

  const fallback = readFallbackSettings();
  if (fallback.homepage_form_perspective && Array.isArray(fallback.homepage_form_perspective) && fallback.homepage_form_perspective.length > 0) {
    return normalizeHomepageFormPerspective(fallback.homepage_form_perspective);
  }

  return [...DEFAULT_HOMEPAGE_FORM_PERSPECTIVE];
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

const getCachedHeroCardsConfig = unstable_cache(
  async () => queryHeroCardsConfig(),
  ["site-settings-hero-cards"],
  {
    revalidate: 3600,
    tags: ["site-settings", "hero-cards", "homepage"],
  }
);

const getCachedHomepageFavouritesConfig = unstable_cache(
  async () => queryHomepageFavouritesConfig(),
  ["site-settings-homepage-favourites"],
  {
    revalidate: 3600,
    tags: ["site-settings", "homepage", "homepage-favourites"],
  }
);

const getCachedHomepageFormPerspectiveConfig = unstable_cache(
  async () => queryHomepageFormPerspectiveConfig(),
  ["site-settings-homepage-form-perspective"],
  {
    revalidate: 3600,
    tags: ["site-settings", "homepage", "homepage-form-perspective"],
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

export const getHeroCardsConfig = cache(async (): Promise<HeroCardConfigItem[]> => {
  if (process.env.NODE_ENV === "development") {
    return queryHeroCardsConfig();
  }
  return getCachedHeroCardsConfig();
});

export const getHomepageFavouritesConfig = cache(async (): Promise<HomepageFavouriteItem[]> => {
  if (process.env.NODE_ENV === "development") {
    return queryHomepageFavouritesConfig();
  }
  return getCachedHomepageFavouritesConfig();
});

export const getHomepageFormPerspectiveConfig = cache(async (): Promise<HomepageFormPerspectiveItem[]> => {
  if (process.env.NODE_ENV === "development") {
    return queryHomepageFormPerspectiveConfig();
  }
  return getCachedHomepageFormPerspectiveConfig();
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

/**
 * Saves the homepage hero cards configuration (max 7 cards).
 */
export async function saveHeroCardsConfig(
  cards: HeroCardConfigItem[]
): Promise<HeroCardConfigItem[]> {
  const normalized = normalizeHeroCards(cards.slice(0, 7)).map((c, i) => ({
    ...c,
    displayOrder: i,
    updatedAt: new Date().toISOString(),
  }));

  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase.from("site_settings").upsert(
        {
          key: "hero_cards",
          value: normalized,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );
      if (error) {
        console.warn("[site-settings] Upsert hero_cards DB error:", error.message);
      }
    }
  } catch (err) {
    console.warn("[site-settings] DB saveHeroCardsConfig failed:", err);
  }

  // Always update local fallback for server restarts/redundancy
  const currentFallback = readFallbackSettings();
  currentFallback.hero_cards = normalized;
  writeFallbackSettings(currentFallback);

  invalidateSettingsCache();
  return normalized;
}

/**
 * Replaces a specific hero card slot with a custom image override.
 */
export async function replaceHeroCardSlot(
  slotIndex: number,
  override: {
    image: string;
    storagePath?: string | null;
    title?: string;
    category?: string;
    alt?: string;
  }
): Promise<HeroCardConfigItem[]> {
  const current = await getHeroCardsConfig();
  if (slotIndex < 0 || slotIndex >= DEFAULT_HERO_CARDS.length) {
    throw new Error(`Invalid slotIndex: ${slotIndex}. Must be 0 to ${DEFAULT_HERO_CARDS.length - 1}.`);
  }

  const def = DEFAULT_HERO_CARDS[slotIndex];
  const updated = current.map((card, i) => {
    if (i !== slotIndex) return card;
    return {
      ...card,
      customImage: override.image.trim(),
      customTitle: override.title?.trim() || card.title || def.defaultTitle,
      customCategory: override.category?.trim() || card.category || def.defaultCategory,
      customAlt: override.alt?.trim() || card.alt || def.defaultAlt,
      storagePath: override.storagePath ? override.storagePath.trim() : null,
      isCustom: true,
      image: override.image.trim(),
      title: override.title?.trim() || card.title || def.defaultTitle,
      category: override.category?.trim() || card.category || def.defaultCategory,
      alt: override.alt?.trim() || card.alt || def.defaultAlt,
      updatedAt: new Date().toISOString(),
    };
  });

  return saveHeroCardsConfig(updated);
}

/**
 * Removes the custom override from a hero card slot, immediately restoring its default image.
 */
export async function removeHeroCardSlot(slotIndex: number): Promise<HeroCardConfigItem[]> {
  const current = await getHeroCardsConfig();
  if (slotIndex < 0 || slotIndex >= DEFAULT_HERO_CARDS.length) {
    throw new Error(`Invalid slotIndex: ${slotIndex}. Must be 0 to ${DEFAULT_HERO_CARDS.length - 1}.`);
  }

  const def = DEFAULT_HERO_CARDS[slotIndex];
  const updated = current.map((card, i) => {
    if (i !== slotIndex) return card;
    return {
      ...def,
      updatedAt: new Date().toISOString(),
    };
  });

  return saveHeroCardsConfig(updated);
}

/**
 * Saves the homepage favourites configuration (4 cards).
 */
export async function saveHomepageFavouritesConfig(
  favourites: HomepageFavouriteItem[]
): Promise<HomepageFavouriteItem[]> {
  const normalized = normalizeHomepageFavourites(favourites.slice(0, 4)).map((c, i) => ({
    ...c,
    slotIndex: i,
    updatedAt: new Date().toISOString(),
  }));

  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase.from("site_settings").upsert(
        {
          key: "homepage_favourites",
          value: normalized,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );
      if (error) {
        console.warn("[site-settings] Upsert homepage_favourites DB error:", error.message);
      }
    }
  } catch (err) {
    console.warn("[site-settings] DB saveHomepageFavouritesConfig failed:", err);
  }

  // Always update local fallback for server restarts/redundancy
  const currentFallback = readFallbackSettings();
  currentFallback.homepage_favourites = normalized;
  writeFallbackSettings(currentFallback);

  invalidateSettingsCache();
  return normalized;
}

/**
 * Replaces a specific favourite card slot image with a custom image override.
 */
export async function replaceHomepageFavouriteSlot(
  slotIndex: number,
  override: {
    image: string;
    storagePath?: string | null;
  }
): Promise<HomepageFavouriteItem[]> {
  const current = await getHomepageFavouritesConfig();
  if (slotIndex < 0 || slotIndex >= DEFAULT_HOMEPAGE_FAVOURITES.length) {
    throw new Error(`Invalid slotIndex: ${slotIndex}. Must be 0 to ${DEFAULT_HOMEPAGE_FAVOURITES.length - 1}.`);
  }

  const def = DEFAULT_HOMEPAGE_FAVOURITES[slotIndex];
  const updated = current.map((item, i) => {
    if (i !== slotIndex) return item;
    return {
      ...item,
      customImage: override.image.trim(),
      storagePath: override.storagePath ? override.storagePath.trim() : null,
      isCustom: true,
      image: override.image.trim(),
      updatedAt: new Date().toISOString(),
    };
  });

  return saveHomepageFavouritesConfig(updated);
}

/**
 * Removes the custom override from a favourite slot, immediately restoring its default image.
 */
export async function removeHomepageFavouriteSlot(slotIndex: number): Promise<HomepageFavouriteItem[]> {
  const current = await getHomepageFavouritesConfig();
  if (slotIndex < 0 || slotIndex >= DEFAULT_HOMEPAGE_FAVOURITES.length) {
    throw new Error(`Invalid slotIndex: ${slotIndex}. Must be 0 to ${DEFAULT_HOMEPAGE_FAVOURITES.length - 1}.`);
  }

  const def = DEFAULT_HOMEPAGE_FAVOURITES[slotIndex];
  const updated = current.map((item, i) => {
    if (i !== slotIndex) return item;
    return {
      ...def,
      updatedAt: new Date().toISOString(),
    };
  });

  return saveHomepageFavouritesConfig(updated);
}

/**
 * Saves the homepage form & perspective configuration (4 images).
 */
export async function saveHomepageFormPerspectiveConfig(
  items: HomepageFormPerspectiveItem[]
): Promise<HomepageFormPerspectiveItem[]> {
  const normalized = normalizeHomepageFormPerspective(items.slice(0, 4)).map((c, i) => ({
    ...c,
    slotIndex: i,
    updatedAt: new Date().toISOString(),
  }));

  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase.from("site_settings").upsert(
        {
          key: "homepage_form_perspective",
          value: normalized,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );
      if (error) {
        console.warn("[site-settings] Upsert homepage_form_perspective DB error:", error.message);
      }
    }
  } catch (err) {
    console.warn("[site-settings] DB saveHomepageFormPerspectiveConfig failed:", err);
  }

  // Always update local fallback for server restarts/redundancy
  const currentFallback = readFallbackSettings();
  currentFallback.homepage_form_perspective = normalized;
  writeFallbackSettings(currentFallback);

  invalidateSettingsCache();
  return normalized;
}

/**
 * Replaces a specific form & perspective slot image with a custom image override.
 */
export async function replaceHomepageFormPerspectiveSlot(
  slotIndex: number,
  override: {
    image: string;
    storagePath?: string | null;
  }
): Promise<HomepageFormPerspectiveItem[]> {
  const current = await getHomepageFormPerspectiveConfig();
  if (slotIndex < 0 || slotIndex >= DEFAULT_HOMEPAGE_FORM_PERSPECTIVE.length) {
    throw new Error(`Invalid slotIndex: ${slotIndex}. Must be 0 to ${DEFAULT_HOMEPAGE_FORM_PERSPECTIVE.length - 1}.`);
  }

  const def = DEFAULT_HOMEPAGE_FORM_PERSPECTIVE[slotIndex];
  const updated = current.map((item, i) => {
    if (i !== slotIndex) return item;
    return {
      ...item,
      customImage: override.image.trim(),
      storagePath: override.storagePath ? override.storagePath.trim() : null,
      isCustom: true,
      image: override.image.trim(),
      updatedAt: new Date().toISOString(),
    };
  });

  return saveHomepageFormPerspectiveConfig(updated);
}

/**
 * Removes the custom override from a form & perspective slot, immediately restoring its default image.
 */
export async function removeHomepageFormPerspectiveSlot(slotIndex: number): Promise<HomepageFormPerspectiveItem[]> {
  const current = await getHomepageFormPerspectiveConfig();
  if (slotIndex < 0 || slotIndex >= DEFAULT_HOMEPAGE_FORM_PERSPECTIVE.length) {
    throw new Error(`Invalid slotIndex: ${slotIndex}. Must be 0 to ${DEFAULT_HOMEPAGE_FORM_PERSPECTIVE.length - 1}.`);
  }

  const def = DEFAULT_HOMEPAGE_FORM_PERSPECTIVE[slotIndex];
  const updated = current.map((item, i) => {
    if (i !== slotIndex) return item;
    return {
      ...def,
      updatedAt: new Date().toISOString(),
    };
  });

  return saveHomepageFormPerspectiveConfig(updated);
}



