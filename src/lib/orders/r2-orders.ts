import crypto from "crypto";
import {
  getR2Object,
  putR2Object,
  deleteR2Object,
} from "../r2/operations.ts";

export interface OrderSnapshotItem {
  id: string;
  productId: string;
  name: string;
  slug: string;
  image: string;
  size: string | null;
  color: string | null;
  quantity: number;
  regularUnitPrice: number;
  regularSubtotal: number;
  appliedOffer: {
    qualifyingQuantity: number;
    bundlePrice: number;
    label: string;
  } | null;
  discountAmount: number;
  finalTotal: number;
}

export interface OrderSnapshot {
  orderRef: string;
  token: string;
  createdAt: string; // UTC ISO 8601
  status: "Pending confirmation";
  documentType: "Order Request / Provisional Invoice";
  selectedCount: number;
  selectedTotalUnits: number;
  items: OrderSnapshotItem[];
  totals: {
    regularSubtotal: number;
    totalSavings: number;
    finalTotal: number;
  };
  invoice: {
    filename: string;
    storagePath: string; // e.g. orders/{token}/invoice.pdf
    downloadUrl: string; // e.g. /api/orders/{token}/invoice
  };
}

/**
 * Generates a cryptographically random, unguessable bearer token (32 random bytes in base64url format).
 * Yields 43 URL-safe characters with 256 bits of entropy.
 */
export function generateOrderToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Validates that a token strictly conforms to the expected URL-safe format and length (32-64 chars).
 */
export function isValidOrderToken(token: string): boolean {
  if (!token || typeof token !== "string") return false;
  return /^[A-Za-z0-9_-]{32,64}$/.test(token);
}

/**
 * Generates a human-readable order reference number.
 * Format: SE-YYYYMMDD-XXXX
 */
export function generateOrderReference(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `SE-${year}${month}${day}-${randomSuffix}`;
}

/**
 * Resolves the canonical base URL for public order links.
 * Checks environment variables first, falling back to local origin in development or styleedit.in in production.
 */
export function getOrderBaseUrl(request?: Request): string {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_CANONICAL_URL ||
    process.env.SITE_URL;

  if (envUrl && typeof envUrl === "string" && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, "");
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV === "development" && request) {
    try {
      const url = new URL(request.url);
      return url.origin;
    } catch {
      // Ignore URL parse error
    }
  }

  return "https://styleedit.in";
}

/**
 * Stores the order PDF and complete JSON snapshot in the existing Cloudflare R2 bucket.
 * Key structure:
 *   orders/{token}/invoice.pdf
 *   orders/{token}/order.json
 *
 * Implements atomic cleanup: if order.json upload fails, invoice.pdf is deleted.
 */
export async function saveOrderToR2(
  token: string,
  snapshot: OrderSnapshot,
  pdfBuffer: Buffer | Uint8Array
): Promise<{ success: boolean; invoiceKey: string; snapshotKey: string }> {
  if (!isValidOrderToken(token)) {
    throw new Error("Invalid order token format.");
  }

  const invoiceKey = `orders/${token}/invoice.pdf`;
  const snapshotKey = `orders/${token}/order.json`;

  // 1. Upload invoice PDF
  await putR2Object(invoiceKey, pdfBuffer, "application/pdf");

  // 2. Upload order snapshot JSON
  try {
    const jsonBuffer = Buffer.from(JSON.stringify(snapshot, null, 2), "utf8");
    await putR2Object(snapshotKey, jsonBuffer, "application/json");
  } catch (err) {
    // Cleanup orphaned invoice.pdf on snapshot failure
    try {
      await deleteR2Object(invoiceKey);
    } catch (cleanupErr) {
      console.error(`[R2-Orders] Failed to cleanup orphaned invoice ${invoiceKey}:`, cleanupErr);
    }
    throw err;
  }

  return { success: true, invoiceKey, snapshotKey };
}

/**
 * Retrieves the complete order snapshot from the private R2 bucket using server-side credentials.
 */
export async function getOrderSnapshotFromR2(token: string): Promise<OrderSnapshot | null> {
  if (!isValidOrderToken(token)) {
    return null;
  }

  const snapshotKey = `orders/${token}/order.json`;

  try {
    const res = await getR2Object(snapshotKey);
    if (!res.body || res.body.byteLength === 0) {
      return null;
    }

    const jsonStr = new TextDecoder("utf-8").decode(res.body);
    const parsed = JSON.parse(jsonStr) as OrderSnapshot;
    return parsed;
  } catch (err: unknown) {
    const errorObj = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (errorObj?.name === "NoSuchKey" || errorObj?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    console.error(`[R2-Orders] Error reading order snapshot for token ${token}:`, err);
    return null;
  }
}

/**
 * Retrieves the stored invoice PDF bytes from the private R2 bucket.
 */
export async function getOrderPdfFromR2(token: string): Promise<{
  body: Uint8Array;
  contentLength?: number;
  contentType?: string;
} | null> {
  if (!isValidOrderToken(token)) {
    return null;
  }

  const invoiceKey = `orders/${token}/invoice.pdf`;

  try {
    const res = await getR2Object(invoiceKey);
    if (!res.body || res.body.byteLength === 0) {
      return null;
    }

    return {
      body: res.body,
      contentLength: res.contentLength,
      contentType: res.contentType || "application/pdf",
    };
  } catch (err: unknown) {
    const errorObj = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (errorObj?.name === "NoSuchKey" || errorObj?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    console.error(`[R2-Orders] Error reading invoice PDF for token ${token}:`, err);
    return null;
  }
}

