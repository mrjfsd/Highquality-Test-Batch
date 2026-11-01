import { NextRequest, NextResponse } from "next/server";
import { fetchLiveVariantStock } from "@/lib/inventory/deduction";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("variantIds") || searchParams.get("ids") || "";
    const variantIds = idsParam
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    const stockMap = await fetchLiveVariantStock(variantIds);

    return NextResponse.json(
      {
        success: true,
        variants: stockMap,
      },
      {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (err: unknown) {
    console.error("[GET /api/inventory] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch inventory." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const variantIds: string[] = Array.isArray(body.variantIds) ? body.variantIds : [];

    const stockMap = await fetchLiveVariantStock(variantIds);

    return NextResponse.json(
      {
        success: true,
        variants: stockMap,
      },
      {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (err: unknown) {
    console.error("[POST /api/inventory] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch inventory." },
      { status: 500 }
    );
  }
}
