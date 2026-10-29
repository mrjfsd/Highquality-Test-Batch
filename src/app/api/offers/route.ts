import { NextResponse } from "next/server";
import { fetchStorefrontOffersMap } from "@/lib/pricing/offers-loader";

/**
 * GET /api/offers
 *
 * Public endpoint returning all active quantity offers grouped by product ID.
 * Returns empty map safely if database table is not yet migrated.
 */
export async function GET() {
  try {
    const offersMap = await fetchStorefrontOffersMap();
    return NextResponse.json(
      { success: true, offers: offersMap },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error loading offers";
    return NextResponse.json({ success: false, offers: {}, error: message }, { status: 500 });
  }
}
