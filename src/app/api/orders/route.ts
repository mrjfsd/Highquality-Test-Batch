import { NextRequest, NextResponse } from "next/server";
import {
  generateOrderToken,
  generateOrderReference,
  getOrderBaseUrl,
  saveOrderToR2,
  type OrderSnapshot,
  type OrderSnapshotItem,
} from "@/lib/orders/r2-orders";

// Security Limits
const MAX_PDF_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46]; // %PDF

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Content-Type must be multipart/form-data." },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const pdfFile = formData.get("pdf") as File | null;
    const orderDataRaw = formData.get("orderData") as string | null;

    if (!pdfFile) {
      return NextResponse.json(
        { error: "Order PDF file is required." },
        { status: 400 }
      );
    }

    if (pdfFile.size > MAX_PDF_SIZE_BYTES) {
      return NextResponse.json(
        { error: `PDF file exceeds maximum allowed size (${MAX_PDF_SIZE_BYTES / (1024 * 1024)}MB).` },
        { status: 413 }
      );
    }

    // Verify PDF Magic Bytes Signature (%PDF)
    const arrayBuffer = await pdfFile.arrayBuffer();
    const headerBytes = new Uint8Array(arrayBuffer.slice(0, 4));
    const isPdfSignatureValid = PDF_MAGIC_BYTES.every(
      (byte, index) => headerBytes[index] === byte
    );

    if (!isPdfSignatureValid) {
      return NextResponse.json(
        { error: "Invalid file format: Document must be a valid PDF." },
        { status: 400 }
      );
    }

    if (!orderDataRaw) {
      return NextResponse.json(
        { error: "Order data payload is required." },
        { status: 400 }
      );
    }

    let parsedOrderData: {
      items?: Array<Partial<OrderSnapshotItem>>;
      selectedCount?: number;
      selectedTotalUnits?: number;
      totals?: {
        regularSubtotal?: number;
        totalSavings?: number;
        finalTotal?: number;
      };
      clientOrderRef?: string;
    };

    try {
      parsedOrderData = JSON.parse(orderDataRaw);
    } catch {
      return NextResponse.json(
        { error: "Malformed order data JSON." },
        { status: 400 }
      );
    }

    if (!Array.isArray(parsedOrderData.items) || parsedOrderData.items.length === 0) {
      return NextResponse.json(
        { error: "At least one order line item is required." },
        { status: 400 }
      );
    }

    // Validate and sanitize each line item
    const sanitizedItems: OrderSnapshotItem[] = [];
    for (const rawItem of parsedOrderData.items) {
      const name = String(rawItem.name || "").trim();
      const slug = String(rawItem.slug || "").trim();
      const image = String(rawItem.image || "").trim();
      const price = Number(rawItem.regularUnitPrice ?? rawItem.regularSubtotal ?? 0);
      const qty = Math.max(1, Math.floor(Number(rawItem.quantity) || 1));

      if (!name) {
        return NextResponse.json(
          { error: "Item name is required for all line items." },
          { status: 400 }
        );
      }

      const regularSubtotal = Math.max(0, Number(rawItem.regularSubtotal) || price * qty);
      const discountAmount = Math.max(0, Number(rawItem.discountAmount) || 0);
      const finalTotal = Math.max(0, Number(rawItem.finalTotal) || (regularSubtotal - discountAmount));

      sanitizedItems.push({
        id: String(rawItem.id || `item_${sanitizedItems.length + 1}`).trim(),
        productId: String(rawItem.productId || "").trim(),
        name,
        slug,
        image: image || "/assets/floating-garment-mobile.webp",
        size: rawItem.size ? String(rawItem.size).trim() : null,
        color: rawItem.color ? String(rawItem.color).trim() : null,
        quantity: qty,
        regularUnitPrice: price,
        regularSubtotal,
        appliedOffer: rawItem.appliedOffer
          ? {
              qualifyingQuantity: Number(rawItem.appliedOffer.qualifyingQuantity) || 0,
              bundlePrice: Number(rawItem.appliedOffer.bundlePrice) || 0,
              label: String(rawItem.appliedOffer.label || ""),
            }
          : null,
        discountAmount,
        finalTotal,
      });
    }

    // Server-side generated order reference and cryptographically secure random bearer token
    const token = generateOrderToken();
    const orderRef =
      parsedOrderData.clientOrderRef && /^SE-\d{8}-\d{4}$/.test(parsedOrderData.clientOrderRef)
        ? parsedOrderData.clientOrderRef
        : generateOrderReference();

    const totals = parsedOrderData.totals || {
      regularSubtotal: sanitizedItems.reduce((acc, i) => acc + i.regularSubtotal, 0),
      totalSavings: sanitizedItems.reduce((acc, i) => acc + i.discountAmount, 0),
      finalTotal: sanitizedItems.reduce((acc, i) => acc + i.finalTotal, 0),
    };

    const baseUrl = getOrderBaseUrl(request);
    const orderUrl = `${baseUrl}/order/${token}`;
    const invoiceDownloadUrl = `/api/orders/${token}/invoice`;

    const snapshot: OrderSnapshot = {
      orderRef,
      token,
      createdAt: new Date().toISOString(),
      status: "Pending confirmation",
      documentType: "Order Request / Provisional Invoice",
      selectedCount: sanitizedItems.length,
      selectedTotalUnits: sanitizedItems.reduce((acc, i) => acc + i.quantity, 0),
      items: sanitizedItems,
      totals: {
        regularSubtotal: Math.max(0, totals.regularSubtotal || 0),
        totalSavings: Math.max(0, totals.totalSavings || 0),
        finalTotal: Math.max(0, totals.finalTotal || 0),
      },
      invoice: {
        filename: `order-${orderRef}.pdf`,
        storagePath: `orders/${token}/invoice.pdf`,
        downloadUrl: invoiceDownloadUrl,
      },
    };

    // Store objects in private R2 bucket:
    //   orders/{token}/invoice.pdf
    //   orders/{token}/order.json
    const pdfBuffer = Buffer.from(arrayBuffer);
    await saveOrderToR2(token, snapshot, pdfBuffer);

    return NextResponse.json(
      {
        success: true,
        orderRef,
        token,
        orderUrl,
        invoiceUrl: invoiceDownloadUrl,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (err: unknown) {
    console.error("[POST /api/orders] Failed to save order:", err);
    return NextResponse.json(
      {
        error: "Failed to create order. Please try again.",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

