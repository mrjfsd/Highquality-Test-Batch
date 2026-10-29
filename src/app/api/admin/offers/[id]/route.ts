import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyAdminServer } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { invalidateOffersCache } from "@/lib/pricing/offers-loader";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/offers/[id]
 *
 * Updates an existing quantity offer (qualifying_quantity, bundle_price, is_active).
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await verifyAdminServer(request);
  if (!auth.isAdmin) {
    return Response.json(
      {
        error: auth.isAuthenticated
          ? "Forbidden: Administrator privileges are required."
          : "Unauthorized: No active administrator session.",
      },
      { status: auth.isAuthenticated ? 403 : 401 }
    );
  }

  const { id: offerId } = await params;
  if (!offerId || typeof offerId !== "string") {
    return Response.json({ error: "Invalid offer ID." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const { qualifying_quantity, bundle_price, is_active } = body;
  const updates: Record<string, unknown> = {};

  if (qualifying_quantity !== undefined) {
    const qty = Number(qualifying_quantity);
    if (!Number.isInteger(qty) || qty < 2) {
      return Response.json(
        { error: "Qualifying quantity must be an integer of 2 or greater." },
        { status: 400 }
      );
    }
    updates.qualifying_quantity = qty;
  }

  if (bundle_price !== undefined) {
    const price = Number(bundle_price);
    if (!Number.isFinite(price) || price < 0) {
      return Response.json(
        { error: "Bundle price must be a valid non-negative amount." },
        { status: 400 }
      );
    }
    updates.bundle_price = Math.round((price + Number.EPSILON) * 100) / 100;
  }

  if (is_active !== undefined) {
    updates.is_active = Boolean(is_active);
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields provided for update." }, { status: 400 });
  }

  try {
    const adminClient = createSupabaseAdminClient();

    // 1. Fetch current offer to get product_id
    const { data: currentOffer, error: fetchError } = await adminClient
      .from("product_quantity_offers")
      .select("id, product_id, qualifying_quantity, bundle_price, is_active")
      .eq("id", offerId)
      .maybeSingle();

    if (fetchError || !currentOffer) {
      return Response.json({ error: "Offer not found." }, { status: 404 });
    }

    // 2. If qualifying_quantity changed, verify no duplicate tier on the same product
    if (
      updates.qualifying_quantity !== undefined &&
      updates.qualifying_quantity !== currentOffer.qualifying_quantity
    ) {
      const { data: duplicateTier } = await adminClient
        .from("product_quantity_offers")
        .select("id")
        .eq("product_id", currentOffer.product_id)
        .eq("qualifying_quantity", updates.qualifying_quantity)
        .neq("id", offerId)
        .maybeSingle();

      if (duplicateTier) {
        return Response.json(
          {
            error: `Another offer tier for this product already uses quantity ${updates.qualifying_quantity}.`,
          },
          { status: 409 }
        );
      }
    }

    // 3. Update offer
    const { data: updatedOffer, error: updateError } = await adminClient
      .from("product_quantity_offers")
      .update(updates)
      .eq("id", offerId)
      .select(`
        id,
        product_id,
        qualifying_quantity,
        bundle_price,
        is_active,
        created_at,
        updated_at,
        product:products (
          id,
          name,
          slug,
          price,
          sale_price,
          category,
          status,
          department
        )
      `)
      .single();

    if (updateError) {
      console.error("[admin-offer-patch] Database error:", updateError);
      return Response.json({ error: updateError.message }, { status: 500 });
    }

    revalidatePath("/admin/offers");
    revalidatePath("/admin/products");
    invalidateOffersCache();

    return Response.json({ success: true, offer: updatedOffer });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    console.error("[admin-offer-patch] Error:", err);
    return Response.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/offers/[id]
 *
 * Deletes an existing quantity offer.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await verifyAdminServer(request);
  if (!auth.isAdmin) {
    return Response.json(
      {
        error: auth.isAuthenticated
          ? "Forbidden: Administrator privileges are required."
          : "Unauthorized: No active administrator session.",
      },
      { status: auth.isAuthenticated ? 403 : 401 }
    );
  }

  const { id: offerId } = await params;
  if (!offerId || typeof offerId !== "string") {
    return Response.json({ error: "Invalid offer ID." }, { status: 400 });
  }

  try {
    const adminClient = createSupabaseAdminClient();

    const { error: deleteError } = await adminClient
      .from("product_quantity_offers")
      .delete()
      .eq("id", offerId);

    if (deleteError) {
      console.error("[admin-offer-delete] Database error:", deleteError);
      return Response.json({ error: deleteError.message }, { status: 500 });
    }

    revalidatePath("/admin/offers");
    revalidatePath("/admin/products");
    invalidateOffersCache();

    return Response.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    console.error("[admin-offer-delete] Error:", err);
    return Response.json({ error: message }, { status: 500 });
  }
}
