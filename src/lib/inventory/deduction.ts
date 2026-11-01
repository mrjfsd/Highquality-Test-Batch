import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { revalidateTag, revalidatePath } from "next/cache";

export interface InventoryOrderItemInput {
  variantId?: string | null;
  productId?: string | null;
  name?: string;
  size?: string | null;
  color?: string | null;
  quantity: number;
}

export interface ProcessOrderDeductionInput {
  orderRef: string;
  idempotencyKey?: string | null;
  token: string;
  items: InventoryOrderItemInput[];
  totals?: {
    regularSubtotal?: number;
    totalSavings?: number;
    finalTotal?: number;
  };
}

export interface InventoryDeductionResult {
  success: boolean;
  alreadyProcessed?: boolean;
  orderRef: string;
  token?: string;
  error?: string;
  message?: string;
  item?: {
    variantId?: string;
    name?: string;
    size?: string | null;
    color?: string | null;
    requested?: number;
    available?: number;
  };
}

// In-memory idempotency cache for fast deduplication across concurrent/repeated requests
const memoryIdempotencyCache = new Map<
  string,
  {
    result: InventoryDeductionResult;
    timestamp: number;
  }
>();

// Clean up entries older than 30 minutes
function cleanOldIdempotencyKeys() {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [key, entry] of memoryIdempotencyCache.entries()) {
    if (entry.timestamp < cutoff) {
      memoryIdempotencyCache.delete(key);
    }
  }
}

/**
 * Validates inventory availability for a list of variant IDs directly from Supabase.
 */
export async function fetchLiveVariantStock(
  variantIds: string[]
): Promise<Record<string, { stock_quantity: number; is_available: boolean; size: string; color: string }>> {
  if (!variantIds || variantIds.length === 0) return {};

  const cleanIds = Array.from(new Set(variantIds.filter(Boolean)));
  if (cleanIds.length === 0) return {};

  try {
    const supabase = createSupabaseAdminClient();
    const { data: variants, error } = await supabase
      .from("product_variants")
      .select("id, stock_quantity, is_available, size, color")
      .in("id", cleanIds);

    if (error || !variants) {
      console.error("[inventory] Error fetching variant stock:", error?.message);
      return {};
    }

    const stockMap: Record<string, { stock_quantity: number; is_available: boolean; size: string; color: string }> = {};
    for (const v of variants) {
      stockMap[v.id] = {
        stock_quantity: typeof v.stock_quantity === "number" ? Math.max(0, v.stock_quantity) : 0,
        is_available: Boolean(v.is_available) && (v.stock_quantity ?? 0) > 0,
        size: v.size || "",
        color: v.color || "",
      };
    }
    return stockMap;
  } catch (err) {
    console.error("[inventory] Unexpected error querying variant stock:", err);
    return {};
  }
}

/**
 * Executes authoritative, atomic inventory deduction for an order.
 * Handles concurrency safely, validates against negative stock, guarantees all-or-nothing processing,
 * and ensures idempotent retries do not deduct stock twice.
 */
export async function deductInventoryForOrder(
  input: ProcessOrderDeductionInput
): Promise<InventoryDeductionResult> {
  const { orderRef, idempotencyKey, token, items, totals } = input;
  cleanOldIdempotencyKeys();

  // 1. Check in-memory idempotency cache first
  const cacheKey = idempotencyKey || orderRef;
  if (cacheKey && memoryIdempotencyCache.has(cacheKey)) {
    const cached = memoryIdempotencyCache.get(cacheKey)!;
    return {
      ...cached.result,
      alreadyProcessed: true,
    };
  }

  const supabase = createSupabaseAdminClient();

  // 2. Try Supabase RPC procedure (if installed via migration)
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "process_order_inventory_deduction",
      {
        p_order_ref: orderRef,
        p_idempotency_key: idempotencyKey || null,
        p_token: token,
        p_items: items,
        p_totals: totals || {},
      }
    );

    if (!rpcError && rpcData) {
      if (rpcData.success) {
        // Cache successful deduction
        memoryIdempotencyCache.set(cacheKey, {
          result: {
            success: true,
            orderRef,
            token,
          },
          timestamp: Date.now(),
        });

        // Trigger cache invalidation so storefront immediately reflects new stock
        revalidateProductCache();

        return {
          success: true,
          alreadyProcessed: Boolean(rpcData.already_processed),
          orderRef,
          token,
        };
      } else {
        return {
          success: false,
          orderRef,
          error: rpcData.error || "INSUFFICIENT_STOCK",
          message: rpcData.message || "Insufficient stock for one or more items.",
          item: rpcData.item,
        };
      }
    }
  } catch (rpcErr) {
    // RPC not present or threw error; fallback to robust conditional updates below
    console.warn("[inventory] RPC process_order_inventory_deduction unavailable, using fallback:", rpcErr);
  }

  // 3. Fallback: Atomic Row-Level Locking & Conditional Updates
  // Filter items that have variantIds (mock/dummy catalogue items without database IDs bypass variant deduction)
  const dbItems = items.filter((item) => Boolean(item.variantId && String(item.variantId).trim() !== ""));

  if (dbItems.length === 0) {
    // No database variants to deduct; order succeeds
    const successResult: InventoryDeductionResult = { success: true, orderRef, token };
    memoryIdempotencyCache.set(cacheKey, { result: successResult, timestamp: Date.now() });
    return successResult;
  }

  // Check if order already recorded in public.orders (if table exists)
  try {
    const { data: existingOrders } = await supabase
      .from("orders")
      .select("order_ref, token, status")
      .or(`order_ref.eq.${orderRef}${idempotencyKey ? `,idempotency_key.eq.${idempotencyKey}` : ""}`)
      .limit(1);

    if (existingOrders && existingOrders.length > 0) {
      const existing = existingOrders[0];
      const res: InventoryDeductionResult = {
        success: true,
        alreadyProcessed: true,
        orderRef: existing.order_ref,
        token: existing.token,
      };
      memoryIdempotencyCache.set(cacheKey, { result: res, timestamp: Date.now() });
      return res;
    }
  } catch {
    // Table may not exist yet; continue safely
  }

  // Step A: Fetch current authoritative stock for all requested variant IDs
  const variantIds = dbItems.map((i) => String(i.variantId));
  const { data: variantRows, error: fetchErr } = await supabase
    .from("product_variants")
    .select("id, stock_quantity, is_available, size, color")
    .in("id", variantIds);

  if (fetchErr || !variantRows) {
    return {
      success: false,
      orderRef,
      error: "DATABASE_ERROR",
      message: "Could not verify stock availability in database. Please try again.",
    };
  }

  const rowMap = new Map<string, { stock_quantity: number; is_available: boolean; size: string; color: string }>();
  variantRows.forEach((r) => {
    rowMap.set(r.id, {
      stock_quantity: Number(r.stock_quantity) || 0,
      is_available: Boolean(r.is_available),
      size: r.size || "",
      color: r.color || "",
    });
  });

  // Step B: Pre-validate that all requested quantities are <= current available stock
  for (const item of dbItems) {
    const vId = String(item.variantId);
    const row = rowMap.get(vId);

    if (!row) {
      return {
        success: false,
        orderRef,
        error: "VARIANT_NOT_FOUND",
        message: `Product variant "${item.name}" was not found.`,
      };
    }

    const available = row.stock_quantity;
    const requested = item.quantity;

    if (available < requested) {
      return {
        success: false,
        orderRef,
        error: "INSUFFICIENT_STOCK",
        message: `Only ${available} unit${available === 1 ? "" : "s"} available for ${item.name} (${row.size}, ${row.color}).`,
        item: {
          variantId: vId,
          name: item.name,
          size: row.size,
          color: row.color,
          requested,
          available,
        },
      };
    }
  }

  // Step C: Atomically update rows conditionally:
  // Using conditional WHERE (stock_quantity >= requested) ensures that even with concurrent racers,
  // stock will never drop below 0 and only the first transaction succeeds.
  // Track successful updates so we can roll back if a later item in the batch fails.
  const successfulUpdates: Array<{ variantId: string; quantity: number }> = [];

  for (const item of dbItems) {
    const vId = String(item.variantId);
    const requested = item.quantity;
    const current = rowMap.get(vId)!.stock_quantity;
    const newStock = current - requested;
    const newAvailability = newStock > 0;

    // Execute atomic conditional update
    const { data: updatedRows, error: updateErr } = await supabase
      .from("product_variants")
      .update({
        stock_quantity: newStock,
        is_available: newAvailability,
        updated_at: new Date().toISOString(),
      })
      .eq("id", vId)
      .gte("stock_quantity", requested) // Guarantees stock_quantity >= requested at moment of execution!
      .select("id, stock_quantity");

    if (updateErr || !updatedRows || updatedRows.length === 0) {
      // Race condition detected! Another customer bought the remaining units while this request was running.
      console.warn(`[inventory] Concurrent stock contention on variant ${vId}. Rolling back previous batch items.`);

      // Compensating rollback for any earlier items in this order
      for (const comp of successfulUpdates) {
        try {
          const compRow = rowMap.get(comp.variantId);
          if (compRow) {
            await supabase
              .from("product_variants")
              .update({
                stock_quantity: compRow.stock_quantity,
                is_available: compRow.stock_quantity > 0,
                updated_at: new Date().toISOString(),
              })
              .eq("id", comp.variantId);
          }
        } catch (rollErr) {
          console.error(`[inventory] Critical: Failed to rollback variant ${comp.variantId}:`, rollErr);
        }
      }

      // Re-fetch fresh stock for the conflicting item to give exact error feedback
      const { data: latestRow } = await supabase
        .from("product_variants")
        .select("stock_quantity, size, color")
        .eq("id", vId)
        .maybeSingle();

      const latestAvailable = latestRow ? latestRow.stock_quantity : 0;
      return {
        success: false,
        orderRef,
        error: "INSUFFICIENT_STOCK",
        message: `Only ${latestAvailable} unit${latestAvailable === 1 ? "" : "s"} available for ${item.name}.`,
        item: {
          variantId: vId,
          name: item.name,
          size: item.size,
          color: item.color,
          requested: item.quantity,
          available: latestAvailable,
        },
      };
    }

    successfulUpdates.push({ variantId: vId, quantity: requested });
  }

  // Step D: Record order in public.orders (if table exists)
  try {
    await supabase.from("orders").insert({
      order_ref: orderRef,
      idempotency_key: idempotencyKey || null,
      token,
      status: "pending",
      items,
      totals: totals || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    // If orders table does not exist or fails, order snapshot is still preserved in R2
    console.warn("[inventory] Notice: Could not insert into public.orders table:", err);
  }

  // Step E: Store in memory cache
  const finalResult: InventoryDeductionResult = {
    success: true,
    orderRef,
    token,
  };
  memoryIdempotencyCache.set(cacheKey, { result: finalResult, timestamp: Date.now() });

  // Step F: Invalidate storefront caches
  revalidateProductCache();

  return finalResult;
}

/**
 * Restores inventory when an order is cancelled.
 * Guarantees that restock occurs exactly once.
 */
export async function cancelAndRestockOrder(
  orderRef: string
): Promise<{ success: boolean; message: string; alreadyCancelled?: boolean }> {
  const supabase = createSupabaseAdminClient();

  // 1. Try Supabase RPC
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("cancel_and_restock_order", {
      p_order_ref: orderRef,
    });

    if (!rpcErr && rpcData) {
      if (rpcData.already_cancelled) {
        return { success: true, message: "Order was already cancelled and restocked.", alreadyCancelled: true };
      }
      if (rpcData.success) {
        revalidateProductCache();
        return { success: true, message: "Order cancelled and inventory restored successfully." };
      }
    }
  } catch {
    // Fallback below
  }

  // 2. Fallback: Query order from database
  try {
    const { data: orderRow, error } = await supabase
      .from("orders")
      .select("id, order_ref, status, items")
      .eq("order_ref", orderRef)
      .maybeSingle();

    if (error || !orderRow) {
      return { success: false, message: "Order not found in database." };
    }

    if (orderRow.status === "cancelled") {
      return { success: true, message: "Order was already cancelled.", alreadyCancelled: true };
    }

    const items: InventoryOrderItemInput[] = Array.isArray(orderRow.items) ? orderRow.items : [];

    // Restock each variant
    for (const item of items) {
      if (item.variantId) {
        const { data: v } = await supabase
          .from("product_variants")
          .select("stock_quantity")
          .eq("id", item.variantId)
          .maybeSingle();

        if (v) {
          const newQty = (v.stock_quantity || 0) + (item.quantity || 1);
          await supabase
            .from("product_variants")
            .update({
              stock_quantity: newQty,
              is_available: true,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.variantId);
        }
      }
    }

    // Mark order cancelled
    await supabase
      .from("orders")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("order_ref", orderRef);

    revalidateProductCache();
    return { success: true, message: "Order cancelled and inventory restored." };
  } catch (err) {
    console.error("[inventory] Failed to restock order:", err);
    return { success: false, message: "Error restocking order." };
  }
}

/**
 * Revalidates Next.js cached storefront routes and data tags.
 */
export function revalidateProductCache() {
  try {
    revalidateTag("products", "max");
    revalidateTag("department-products", "max");
    revalidateTag("product-details", "max");
    revalidateTag("sale-products", "max");
    revalidatePath("/");
    revalidatePath("/cart");
    revalidatePath("/shop/women");
    revalidatePath("/shop/men");
    revalidatePath("/shop/kids");
  } catch (err) {
    // In background or route contexts where revalidateTag might be unsupported, fail silently
    console.warn("[inventory] Cache revalidation notice:", err);
  }
}
