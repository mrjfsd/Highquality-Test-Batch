import { NextRequest, NextResponse } from "next/server";
import {
  getPromoBannerConfig,
  getCatalogueMarqueeConfig,
  getNavbarConfig,
  getHeroCardsConfig,
  DEFAULT_CATALOGUE_ADS,
} from "@/lib/settings/site-settings";

/**
 * GET /api/settings
 * Public endpoint delivering published storefront configuration (promotional banner, catalogue marquee ads, navbar, and hero cards).
 */
export async function GET(request: NextRequest) {
  try {
    const [promoBanner, catalogueConfig, navbar, heroCards] = await Promise.all([
      getPromoBannerConfig(),
      getCatalogueMarqueeConfig(),
      getNavbarConfig(),
      getHeroCardsConfig(),
    ]);

    // Active ads: non-empty trimmed strings
    const activeAds = catalogueConfig.ads
      .map((ad) => (typeof ad === "string" ? ad.trim() : ""))
      .filter((ad) => ad.length > 0);

    const effectiveAds = activeAds.length > 0 ? activeAds : [...DEFAULT_CATALOGUE_ADS];

    return NextResponse.json(
      {
        promoBanner,
        catalogueMarquee: {
          ads: effectiveAds,
          rawAds: catalogueConfig.ads,
          updatedAt: catalogueConfig.updatedAt,
        },
        navbar,
        heroCards,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load site settings";
    console.error("[api/settings] Error:", message);
    return NextResponse.json(
      { error: "Internal server error fetching settings" },
      { status: 500 }
    );
  }
}
