import { NextResponse } from "next/server";
import {
  getPromoBannerConfig,
  getCatalogueMarqueeConfig,
  getNavbarConfig,
  DEFAULT_CATALOGUE_ADS,
} from "@/lib/settings/site-settings";


/**
 * GET /api/settings
 * Public endpoint delivering published storefront configuration (promotional banner, catalogue marquee ads, and navbar).
 */
export async function GET() {
  try {
    const [promoBanner, catalogueConfig, navbar] = await Promise.all([
      getPromoBannerConfig(),
      getCatalogueMarqueeConfig(),
      getNavbarConfig(),
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
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
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
