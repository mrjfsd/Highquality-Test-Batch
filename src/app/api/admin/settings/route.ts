import { NextRequest, NextResponse } from "next/server";
import { verifyAdminServer } from "@/lib/supabase/server-auth";
import {
  getPromoBannerConfig,
  getCatalogueMarqueeConfig,
  getNavbarConfig,
  savePromoBannerConfig,
  saveCatalogueMarqueeConfig,
  saveNavbarConfig,
  PromoBannerConfig,
  NavbarConfig,
} from "@/lib/settings/site-settings";

/**
 * GET /api/admin/settings
 * Admin route to inspect current banner, marquee, and navbar settings.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdminServer(request);
  if (!auth.isAdmin) {
    return NextResponse.json(
      {
        error: auth.isAuthenticated
          ? "Forbidden: Administrator privileges required."
          : "Unauthorized: No active administrator session.",
      },
      { status: auth.isAuthenticated ? 403 : 401 }
    );
  }

  try {
    const [promoBanner, catalogueMarquee, navbar] = await Promise.all([
      getPromoBannerConfig(),
      getCatalogueMarqueeConfig(),
      getNavbarConfig(),
    ]);

    return NextResponse.json({ promoBanner, catalogueMarquee, navbar });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error reading settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/settings
 * Admin route to update promotional banner or catalogue marquee ads.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdminServer(request);
  if (!auth.isAdmin) {
    return NextResponse.json(
      {
        error: auth.isAuthenticated
          ? "Forbidden: Administrator privileges required."
          : "Unauthorized: No active administrator session.",
      },
      { status: auth.isAuthenticated ? 403 : 401 }
    );
  }

  let body: {
    promoBanner?: Partial<PromoBannerConfig>;
    catalogueMarquee?: { ads: string[] };
    navbar?: Partial<NavbarConfig>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  let updatedPromoBanner: PromoBannerConfig | undefined;
  let updatedCatalogueMarquee: { ads: [string, string, string]; updatedAt?: string } | undefined;
  let updatedNavbar: NavbarConfig | undefined;

  try {
    // 1. Update Promo Banner if provided
    if (body.promoBanner) {
      const { imageUrl, storagePath, altText, enabled, positionX, positionY, zoom } = body.promoBanner;
      const bannerUpdates: Partial<PromoBannerConfig> = {};

      if (imageUrl !== undefined) {
        if (typeof imageUrl !== "string" || imageUrl.trim() === "") {
          return NextResponse.json(
            { error: "Banner imageUrl must be a non-empty string." },
            { status: 400 }
          );
        }
        bannerUpdates.imageUrl = imageUrl.trim();
      }

      if (storagePath !== undefined) {
        bannerUpdates.storagePath = storagePath ? String(storagePath).trim() : null;
      }
      if (altText !== undefined) {
        bannerUpdates.altText = String(altText).trim();
      }
      if (typeof enabled === "boolean") {
        bannerUpdates.enabled = enabled;
      }
      if (typeof positionX === "number") {
        bannerUpdates.positionX = positionX;
      }
      if (typeof positionY === "number") {
        bannerUpdates.positionY = positionY;
      }
      if (typeof zoom === "number") {
        bannerUpdates.zoom = zoom;
      }

      updatedPromoBanner = await savePromoBannerConfig(bannerUpdates);
    }

    // 2. Update Catalogue Marquee Ads if provided
    if (body.catalogueMarquee) {
      const rawAds = body.catalogueMarquee.ads;
      if (!Array.isArray(rawAds)) {
        return NextResponse.json(
          { error: "catalogueMarquee.ads must be an array of strings." },
          { status: 400 }
        );
      }

      const stringAds: [string, string, string] = [
        typeof rawAds[0] === "string" ? rawAds[0] : "",
        typeof rawAds[1] === "string" ? rawAds[1] : "",
        typeof rawAds[2] === "string" ? rawAds[2] : "",
      ];

      updatedCatalogueMarquee = await saveCatalogueMarqueeConfig(stringAds);
    }

    // 3. Update Navbar Config if provided
    if (body.navbar) {
      const navbarUpdates: Partial<NavbarConfig> = {};
      if (typeof body.navbar.showSaleLink === "boolean") {
        navbarUpdates.showSaleLink = body.navbar.showSaleLink;
      }
      updatedNavbar = await saveNavbarConfig(navbarUpdates);
    }

    return NextResponse.json({
      success: true,
      promoBanner: updatedPromoBanner || (await getPromoBannerConfig()),
      catalogueMarquee: updatedCatalogueMarquee || (await getCatalogueMarqueeConfig()),
      navbar: updatedNavbar || (await getNavbarConfig()),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error updating settings";
    console.error("[api/admin/settings] Save error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
