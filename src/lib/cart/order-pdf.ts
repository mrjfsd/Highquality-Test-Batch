import { jsPDF } from "jspdf";
import type { CartItem, CartTotalsBreakdown } from "@/types/cart";
import type { ItemPriceCalculation } from "@/types/offers";
import {
  formatCartCurrency,
  getCanonicalSiteUrl,
  STORE_WHATSAPP_NUMBER,
} from "./cart-utils.ts";
import { getOptimizedImageUrl } from "../images/responsive.ts";

export interface PreparedPdfItem {
  item: CartItem;
  pricing: ItemPriceCalculation;
  productUrl?: string;
  imageUrl?: string;
}

export interface OrderPdfGenerationInput {
  orderRef: string;
  generatedAt?: Date;
  items: PreparedPdfItem[];
  selectedCount: number;
  selectedTotalUnits: number;
  totals: CartTotalsBreakdown;
  storeWhatsAppNumber?: string;
}

export interface PreparedImage {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Generates a unique, human-readable reference for the PDF.
 * Format: SE-YYYYMMDD-XXXX (e.g. SE-20261030-1234)
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
 * Formats currency for crisp PDF rendering without non-WinAnsi font encoding issues.
 */
export function formatPdfCurrency(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  return `Rs. ${Math.round(safe).toLocaleString("en-IN")}`;
}

/**
 * Creates an in-memory canvas placeholder image when product image loading fails.
 */
function createPlaceholderImage(label: string = "STYLE · EDIT"): PreparedImage {
  if (typeof document === "undefined") {
    return { dataUrl: "", width: 300, height: 380 };
  }

  const canvas = document.createElement("canvas");
  canvas.width = 300;
  canvas.height = 380;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // Soft neutral background
    ctx.fillStyle = "#F5F4F0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle 1px border
    ctx.strokeStyle = "#E2DFD8";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

    // Brand text
    ctx.fillStyle = "#888880";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("STYLE · EDIT", canvas.width / 2, canvas.height / 2 - 14);

    // Label
    ctx.fillStyle = "#A8A59E";
    ctx.font = "13px sans-serif";
    ctx.fillText(label.slice(0, 24) || "Preview", canvas.width / 2, canvas.height / 2 + 12);
  }

  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.85),
    width: 300,
    height: 380,
  };
}

/**
 * Safely loads an image in the browser and converts it to a standard JPEG Data URL.
 * Handles same-origin proxy, CORS-enabled remotes, and falls back to a clean placeholder.
 */
async function loadAndConvertImage(url: string, fallbackLabel: string): Promise<PreparedImage> {
  if (!url || typeof window === "undefined" || typeof document === "undefined") {
    return createPlaceholderImage(fallbackLabel);
  }

  // 1. First attempt: Direct fetch to Blob (optimal for same-origin /api/images/... and CORS-enabled CDN)
  try {
    const res = await fetch(url, { mode: "cors", cache: "force-cache" });
    if (res.ok) {
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      const converted = await new Promise<PreparedImage | null>((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth || 300;
            canvas.height = img.naturalHeight || 400;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              URL.revokeObjectURL(objectUrl);
              return resolve(null);
            }
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            URL.revokeObjectURL(objectUrl);
            resolve({ dataUrl, width: canvas.width, height: canvas.height });
          } catch {
            URL.revokeObjectURL(objectUrl);
            resolve(null);
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
        };
        img.src = objectUrl;
      });

      if (converted) {
        return converted;
      }
    }
  } catch {
    // Direct fetch failed; fall through to Image element
  }

  // 2. Second attempt: HTMLImageElement with anonymous crossOrigin
  try {
    const loaded = await new Promise<PreparedImage | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || 300;
          canvas.height = img.naturalHeight || 400;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          resolve({ dataUrl, width: canvas.width, height: canvas.height });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });

    if (loaded) {
      return loaded;
    }
  } catch (err) {
    console.warn(`[OrderPDF] Image conversion error for ${url}:`, err);
  }

  // 3. Fallback: Clean branded placeholder
  return createPlaceholderImage(fallbackLabel);
}

/**
 * Pre-fetches and prepares color-specific images for all selected cart items in parallel.
 */
export async function preloadItemImages(
  items: PreparedPdfItem[]
): Promise<Map<string, PreparedImage>> {
  const map = new Map<string, PreparedImage>();
  if (typeof window === "undefined") {
    return map;
  }

  const tasks = items.map(async (entry, index) => {
    const key = entry.item.id || String(index);
    try {
      // Use existing responsive utility to right-size the image for PDF embedding (width 320, quality 80)
      const optimizedUrl = getOptimizedImageUrl(entry.item.image, 320, 80);
      const prepared = await loadAndConvertImage(optimizedUrl, entry.item.name);
      map.set(key, prepared);
    } catch {
      map.set(key, createPlaceholderImage(entry.item.name));
    }
  });

  await Promise.allSettled(tasks);
  return map;
}

/**
 * Builds the complete jsPDF document for the selected order.
 */
export function buildOrderPdfDoc(
  input: OrderPdfGenerationInput,
  imageMap: Map<string, PreparedImage> = new Map()
): jsPDF {
  const {
    orderRef,
    generatedAt = new Date(),
    items,
    selectedCount,
    selectedTotalUnits,
    totals,
  } = input;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm
  const bottomLimit = pageHeight - 18; // reserve 18mm for bottom margin & footer

  let currentY = 16;

  // Draw Page 1 Main Header
  function drawMainHeader() {
    // Brand Heading
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(23, 23, 23); // #171717 charcoal
    doc.text("STYLE · EDIT", marginX, currentY);

    // Document Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(163, 28, 27); // #A31C1B burgundy accent
    doc.text("ORDER REQUEST", pageWidth - marginX, currentY, { align: "right" });

    currentY += 6;

    // Subtitle & Store Location
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(85, 83, 79);
    doc.text("Curated Wardrobe Foundations · Mysuru", marginX, currentY);

    // Reference Number
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(23, 23, 23);
    doc.text(`Ref: ${orderRef}`, pageWidth - marginX, currentY, { align: "right" });

    currentY += 5;

    // Date & Time
    const dateFormatted = generatedAt.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Date: ${dateFormatted}`, marginX, currentY);

    // Selection Count
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(85, 83, 79);
    doc.text(
      `${selectedCount} ${selectedCount === 1 ? "item" : "items"} · ${selectedTotalUnits} ${selectedTotalUnits === 1 ? "unit" : "units"} selected`,
      pageWidth - marginX,
      currentY,
      { align: "right" }
    );

    currentY += 4;

    // Divider Line
    doc.setDrawColor(229, 229, 229);
    doc.setLineWidth(0.4);
    doc.line(marginX, currentY, pageWidth - marginX, currentY);

    currentY += 4;
  }

  // Draw Continuation Header on Page 2+
  function drawContinuationHeader() {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(23, 23, 23);
    doc.text("STYLE · EDIT", marginX, 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(85, 83, 79);
    doc.text(`Order Request (Cont.) — Ref: ${orderRef}`, pageWidth - marginX, 14, { align: "right" });

    doc.setDrawColor(229, 229, 229);
    doc.setLineWidth(0.3);
    doc.line(marginX, 17, pageWidth - marginX, 17);

    currentY = 22;
  }

  // Draw Table Header
  function drawTableHeader() {
    const tableHeaderHeight = 7;
    doc.setFillColor(246, 245, 242);
    doc.rect(marginX, currentY, contentWidth, tableHeaderHeight, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(85, 83, 79);

    const textY = currentY + 4.8;
    doc.text("ITEM", marginX + 3, textY);
    doc.text("DESCRIPTION & DETAILS", marginX + 32, textY);
    doc.text("QTY", marginX + 115, textY, { align: "center" });
    doc.text("UNIT PRICE", marginX + 148, textY, { align: "right" });
    doc.text("TOTAL", pageWidth - marginX - 3, textY, { align: "right" });

    currentY += tableHeaderHeight + 2;
  }

  // Draw Initial Header & Table Header
  drawMainHeader();
  drawTableHeader();

  // Render Line Items
  items.forEach((entry, index) => {
    const { item, pricing } = entry;
    const hasOffer = Boolean(pricing.hasOfferApplied && pricing.offerLabel);
    const rowHeight = hasOffer ? 36 : 33;

    // Check pagination boundary
    if (currentY + rowHeight > bottomLimit) {
      doc.addPage();
      drawContinuationHeader();
      drawTableHeader();
    }

    const rowTop = currentY;

    // 1. Product Image Thumbnail Cell
    const imgBoxX = marginX + 2;
    const imgBoxY = rowTop + 1;
    const imgBoxW = 24;
    const imgBoxH = 29;

    doc.setDrawColor(238, 238, 238);
    doc.setFillColor(252, 252, 252);
    doc.roundedRect(imgBoxX, imgBoxY, imgBoxW, imgBoxH, 1, 1, "FD");

    const imgKey = item.id || String(index);
    const imgData = imageMap.get(imgKey);

    if (imgData && imgData.dataUrl) {
      try {
        const aspect = imgData.width / imgData.height;
        const boxAspect = imgBoxW / imgBoxH;
        let renderW = imgBoxW - 1.5;
        let renderH = imgBoxH - 1.5;
        let renderX = imgBoxX + 0.75;
        let renderY = imgBoxY + 0.75;

        if (aspect > boxAspect) {
          // Image is wider than container box
          renderW = imgBoxW - 1.5;
          renderH = renderW / aspect;
          renderY = imgBoxY + (imgBoxH - renderH) / 2;
        } else {
          // Image is taller than container box
          renderH = imgBoxH - 1.5;
          renderW = renderH * aspect;
          renderX = imgBoxX + (imgBoxW - renderW) / 2;
        }

        doc.addImage(imgData.dataUrl, "JPEG", renderX, renderY, renderW, renderH);
      } catch (err) {
        console.warn(`[OrderPDF] Image addImage failed for ${item.name}:`, err);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(160, 160, 160);
        doc.text("STYLE·EDIT", imgBoxX + imgBoxW / 2, imgBoxY + imgBoxH / 2, { align: "center" });
      }
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(160, 160, 160);
      doc.text("STYLE·EDIT", imgBoxX + imgBoxW / 2, imgBoxY + imgBoxH / 2, { align: "center" });
    }

    // 2. Details Column
    const detailsX = marginX + 32;
    let detailY = rowTop + 5;

    // Item Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(23, 23, 23);
    const wrappedTitle = doc.splitTextToSize(item.name, 72);
    doc.text(wrappedTitle, detailsX, detailY);
    detailY += Array.isArray(wrappedTitle) ? wrappedTitle.length * 4 : 4;

    // Size & Color Attributes
    const attrs: string[] = [];
    if (item.size && item.size.trim().toLowerCase() !== "nosize") {
      attrs.push(`Size: ${item.size.trim()}`);
    }
    if (item.color && item.color.trim().toLowerCase() !== "nocolor") {
      attrs.push(`Colour: ${item.color.trim()}`);
    }
    if (attrs.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(85, 83, 79);
      doc.text(attrs.join("   ·   "), detailsX, detailY);
      detailY += 4;
    }

    // Offer Applied & Savings Label
    if (hasOffer && pricing.offerLabel) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(163, 28, 27); // Burgundy
      doc.text(`${pricing.offerLabel}`, detailsX, detailY);
      detailY += 3.5;
    }

    // Short Product Link
    if (item.slug) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(140, 140, 140);
      doc.text(`style-edit.com/p/${item.slug}`, detailsX, detailY);
    }

    // 3. Quantity Column
    const qtyX = marginX + 115;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(23, 23, 23);
    doc.text(String(item.quantity), qtyX, rowTop + 8, { align: "center" });

    // 4. Regular Unit Price Column
    const unitPriceX = marginX + 148;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(85, 83, 79);
    doc.text(formatPdfCurrency(item.price), unitPriceX, rowTop + 8, { align: "right" });

    // 5. Total Column
    const totalX = pageWidth - marginX - 3;
    if (pricing.discountAmount > 0) {
      // Regular subtotal
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(140, 140, 140);
      doc.text(formatPdfCurrency(pricing.regularSubtotal), totalX, rowTop + 5.5, { align: "right" });

      // Final item total
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(23, 23, 23);
      doc.text(formatPdfCurrency(pricing.finalTotal), totalX, rowTop + 9.5, { align: "right" });

      // Savings label
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(163, 28, 27);
      doc.text(`Save ${formatPdfCurrency(pricing.discountAmount)}`, totalX, rowTop + 13.5, { align: "right" });
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(23, 23, 23);
      doc.text(formatPdfCurrency(pricing.finalTotal), totalX, rowTop + 8, { align: "right" });
    }

    currentY += rowHeight;

    // Row divider line
    doc.setDrawColor(242, 242, 242);
    doc.setLineWidth(0.3);
    doc.line(marginX, currentY, pageWidth - marginX, currentY);
    currentY += 2;
  });

  // Summary Block Pagination Check
  const summaryBoxHeight = totals.totalSavings > 0 ? 46 : 40;
  if (currentY + summaryBoxHeight + 20 > bottomLimit) {
    doc.addPage();
    drawContinuationHeader();
  } else {
    currentY += 4;
  }

  // Draw Order Summary Card
  const summaryCardW = 86;
  const summaryCardX = pageWidth - marginX - summaryCardW;
  const summaryCardY = currentY;

  doc.setFillColor(250, 249, 247);
  doc.setDrawColor(230, 228, 224);
  doc.roundedRect(summaryCardX, summaryCardY, summaryCardW, summaryBoxHeight, 1.5, 1.5, "FD");

  let cardY = summaryCardY + 6;

  // Summary Card Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(23, 23, 23);
  doc.text("ORDER SUMMARY", summaryCardX + 5, cardY);
  cardY += 6;

  // Selected Items & Units Row
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(85, 83, 79);
  doc.text("Selected Items", summaryCardX + 5, cardY);
  doc.text(
    `${selectedCount} (${selectedTotalUnits} ${selectedTotalUnits === 1 ? "unit" : "units"})`,
    summaryCardX + summaryCardW - 5,
    cardY,
    { align: "right" }
  );
  cardY += 5;

  // Regular Subtotal Row
  doc.text(totals.totalSavings > 0 ? "Regular Subtotal" : "Subtotal", summaryCardX + 5, cardY);
  doc.text(formatPdfCurrency(totals.regularSubtotal), summaryCardX + summaryCardW - 5, cardY, { align: "right" });
  cardY += 5;

  // Offer Savings Row
  if (totals.totalSavings > 0) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(163, 28, 27); // Burgundy
    doc.text("Offer Savings", summaryCardX + 5, cardY);
    doc.text(`-${formatPdfCurrency(totals.totalSavings)}`, summaryCardX + summaryCardW - 5, cardY, { align: "right" });
    cardY += 5;
  }

  // Card Divider
  doc.setDrawColor(220, 218, 214);
  doc.setLineWidth(0.3);
  doc.line(summaryCardX + 5, cardY, summaryCardX + summaryCardW - 5, cardY);
  cardY += 5;

  // Final Order Total Row
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(23, 23, 23);
  doc.text("Final Order Total", summaryCardX + 5, cardY);
  doc.text(formatPdfCurrency(totals.finalTotal), summaryCardX + summaryCardW - 5, cardY, { align: "right" });

  currentY = summaryCardY + summaryBoxHeight + 8;

  // Stock and Availability Disclaimer Box
  const disclaimerW = contentWidth;
  const disclaimerH = 16;
  doc.setFillColor(252, 252, 252);
  doc.setDrawColor(235, 235, 235);
  doc.roundedRect(marginX, currentY, disclaimerW, disclaimerH, 1, 1, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(163, 28, 27);
  doc.text("IMPORTANT NOTICE:", marginX + 4, currentY + 5.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(85, 83, 79);
  doc.text(
    "Order subject to stock and availability confirmation by Style Edit.",
    marginX + 36,
    currentY + 5.5
  );

  doc.text(
    "Please send this PDF via WhatsApp to complete your order. Our store team will verify size & color availability immediately.",
    marginX + 4,
    currentY + 11.5
  );

  // Footers on All Pages
  const totalPages = doc.getNumberOfPages();
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);

    doc.setDrawColor(235, 235, 235);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text("STYLE · EDIT — Curated Wardrobe Foundations · Mysuru", marginX, pageHeight - 8);

    doc.text(
      `Page ${pageNum} of ${totalPages}`,
      pageWidth - marginX,
      pageHeight - 8,
      { align: "right" }
    );
  }

  return doc;
}

/**
 * Generates the PDF as a browser-side Blob.
 */
export async function generateOrderPdfBlob(input: OrderPdfGenerationInput): Promise<{
  blob: Blob;
  orderRef: string;
}> {
  const imageMap = await preloadItemImages(input.items);
  const doc = buildOrderPdfDoc(input, imageMap);
  const blob = doc.output("blob");
  return { blob, orderRef: input.orderRef };
}

/**
 * Generates the PDF as a File instance for the Web Share API.
 */
export async function generateOrderPdfFile(input: OrderPdfGenerationInput): Promise<{
  file: File;
  blob: Blob;
  orderRef: string;
}> {
  const { blob, orderRef } = await generateOrderPdfBlob(input);
  const fileName = `order-${orderRef}.pdf`;
  const file = new File([blob], fileName, { type: "application/pdf" });
  return { file, blob, orderRef };
}

/**
 * Triggers an automatic download of a Blob file in the user's browser.
 */
export function downloadPdfBlob(blob: Blob, filename: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Generates the concise WhatsApp checkout message for shareable R2 order links.
 * Formats order reference, items, units, totals, and the direct link to the order page.
 */
export function generatePdfWhatsAppMessage(input: {
  orderRef: string;
  selectedCount: number;
  selectedTotalUnits: number;
  totals: CartTotalsBreakdown;
  orderUrl?: string;
}): string {
  const { orderRef, selectedCount, selectedTotalUnits, totals, orderUrl } = input;

  const lines: string[] = [
    "Hello! I'd like to place an order from Style Edit.",
    "",
    `*Order Reference:* ${orderRef}`,
    `*Selected Items:* ${selectedCount}`,
    `*Selected Units:* ${selectedTotalUnits}`,
    `*Regular Subtotal:* ${formatCartCurrency(totals.regularSubtotal)}`,
  ];

  if (totals.totalSavings > 0) {
    lines.push(`*Offer Savings:* ${formatCartCurrency(totals.totalSavings)}`);
  }

  lines.push(`*Final Order Total:* ${formatCartCurrency(totals.finalTotal)}`, "");

  if (orderUrl) {
    lines.push(
      "*View Complete Order & Download Invoice:*",
      orderUrl,
      ""
    );
  }

  lines.push("Please confirm product availability and order details. Thank you!");

  return lines.join("\n");
}

/**
 * Generates the wa.me checkout URL with prefilled concise message including the order link.
 */
export function generatePdfWhatsAppUrl(
  input: {
    orderRef: string;
    selectedCount: number;
    selectedTotalUnits: number;
    totals: CartTotalsBreakdown;
    orderUrl?: string;
  },
  customPhone: string = STORE_WHATSAPP_NUMBER
): string {
  const cleanPhone = customPhone.replace(/\D/g, "");
  if (!cleanPhone) return "";

  const text = generatePdfWhatsAppMessage(input);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

export interface CheckoutPdfResult {
  success: boolean;
  orderRef: string;
  token?: string;
  orderUrl?: string;
  invoiceUrl?: string;
  blob?: Blob;
  waUrl?: string;
  navigated?: boolean;
  error?: string;
}

/**
 * Executes the complete R2 order storage & direct WhatsApp business checkout flow:
 * 1. Generates the PDF document locally in the customer's browser in memory.
 * 2. Uploads the PDF and order JSON snapshot to Cloudflare R2 under orders/{token}/.
 * 3. Receives the secure, shareable order page URL (/order/[token]).
 * 4. Navigates directly to the Style Edit WhatsApp business chat with prefilled order link.
 * 
 * Note: Does NOT trigger an automatic local file download during checkout.
 * Does NOT open a blank about:blank placeholder tab.
 */
export async function executeWhatsAppPdfCheckout(
  input: OrderPdfGenerationInput,
  storePhone: string = STORE_WHATSAPP_NUMBER
): Promise<CheckoutPdfResult> {
  const { orderRef } = input;

  try {
    // 1. Generate client-side PDF document with embedded color-specific images
    const { blob } = await generateOrderPdfBlob(input);

    // 2. Prepare order payload for server-side R2 upload
    const orderDataPayload = {
      clientOrderRef: orderRef,
      selectedCount: input.selectedCount,
      selectedTotalUnits: input.selectedTotalUnits,
      totals: input.totals,
      items: input.items.map((entry) => ({
        id: entry.item.id,
        productId: entry.item.productId,
        name: entry.item.name,
        slug: entry.item.slug,
        image: entry.item.image,
        size: entry.item.size || null,
        color: entry.item.color || null,
        quantity: entry.item.quantity,
        regularUnitPrice: entry.pricing.regularUnitPrice,
        regularSubtotal: entry.pricing.regularSubtotal,
        discountAmount: entry.pricing.discountAmount,
        finalTotal: entry.pricing.finalTotal,
        appliedOffer: entry.pricing.hasOfferApplied && entry.pricing.appliedOffer
          ? {
              qualifyingQuantity: entry.pricing.appliedOffer.qualifying_quantity,
              bundlePrice: entry.pricing.appliedOffer.bundle_price,
              label: entry.pricing.offerLabel || "",
            }
          : null,
      })),
    };

    const formData = new FormData();
    formData.append("pdf", blob, `order-${orderRef}.pdf`);
    formData.append("orderData", JSON.stringify(orderDataPayload));

    // 3. Upload to server-side endpoint which stores invoice.pdf and order.json in R2
    const res = await fetch("/api/orders", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Server upload failed with status ${res.status}`);
    }

    const { orderUrl, invoiceUrl, token } = await res.json();

    // Ensure the order URL resolves to the verified deployment origin
    const finalOrderUrl =
      orderUrl && orderUrl.startsWith("http") && !orderUrl.includes("styleedit.in")
        ? orderUrl
        : `${typeof window !== "undefined" && window.location?.origin ? window.location.origin : getCanonicalSiteUrl()}/order/${token}`;

    // 4. Generate the direct wa.me URL containing the shareable order page link
    const waUrl = generatePdfWhatsAppUrl(
      {
        orderRef,
        selectedCount: input.selectedCount,
        selectedTotalUnits: input.selectedTotalUnits,
        totals: input.totals,
        orderUrl: finalOrderUrl,
      },
      storePhone
    );

    // 5. Navigate directly to the Style Edit business chat via the current window
    // (no blank about:blank tab, no popup blocker restrictions, seamless navigation)
    let navigated = false;
    if (typeof window !== "undefined" && waUrl) {
      try {
        window.location.href = waUrl;
        navigated = true;
      } catch (err) {
        console.warn("[OrderPDF] Direct navigation to WhatsApp failed:", err);
      }
    }

    return {
      success: true,
      orderRef,
      token,
      orderUrl: finalOrderUrl,
      invoiceUrl,
      blob,
      waUrl,
      navigated,
    };
  } catch (err: unknown) {
    console.error("[OrderPDF] Checkout execution failed:", err);

    return {
      success: false,
      orderRef,
      error: err instanceof Error ? err.message : "PDF generation or upload failed",
    };
  }
}
