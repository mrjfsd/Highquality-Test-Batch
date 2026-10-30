import { NextRequest, NextResponse } from "next/server";
import {
  isValidOrderToken,
  getOrderPdfFromR2,
  getOrderSnapshotFromR2,
} from "@/lib/orders/r2-orders";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!isValidOrderToken(token)) {
    return NextResponse.json(
      { error: "Invalid order token." },
      {
        status: 400,
        headers: { "X-Robots-Tag": "noindex, nofollow" },
      }
    );
  }

  try {
    const [pdfData, snapshot] = await Promise.all([
      getOrderPdfFromR2(token),
      getOrderSnapshotFromR2(token),
    ]);

    if (!pdfData || !pdfData.body) {
      return NextResponse.json(
        { error: "Order invoice not found." },
        {
          status: 404,
          headers: { "X-Robots-Tag": "noindex, nofollow" },
        }
      );
    }

    const orderRef = snapshot?.orderRef || "request";
    const filename = `order-${orderRef}.pdf`;

    const searchParams = request.nextUrl.searchParams;
    const isDownload = searchParams.get("download") === "1" || searchParams.get("download") === "true";
    const dispositionType = isDownload ? "attachment" : "inline";

    return new Response(Buffer.from(pdfData.body), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${dispositionType}; filename="${filename}"`,
        "Content-Length": String(pdfData.body.byteLength),
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  } catch (err: unknown) {
    console.error(`[GET /api/orders/${token}/invoice] Error:`, err);
    return NextResponse.json(
      { error: "Internal server error." },
      {
        status: 500,
        headers: { "X-Robots-Tag": "noindex, nofollow" },
      }
    );
  }
}
