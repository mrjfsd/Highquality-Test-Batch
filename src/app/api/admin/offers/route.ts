import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyAdminServer } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { invalidateOffersCache } from "@/lib/pricing/offers-loader";

interface ProductWithImages {
  id: string;
  name: string;
  slug: string;
  price: number;
  sale_price: number | null;
  category: string;
  status: string;
  department?: string;
  product_images?: Array<{ storage_path: string; is_primary: boolean }>;
}

interface RawOfferRow {
  id: string;
  product_id: string;
  qualifying_quantity: number;
  bundle_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product?: ProductWithImages | ProductWithImages[] | null;
}

/**
 * GET /api/admin/offers
 *
 * Retrieves all product quantity offers for administrative management.
 * Joins associated product name, pricing, and primary image.
 */
export async function GET(request: NextRequest) {
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

  try {
    const adminClient = createSupabaseAdminClient();

    const { data, error } = await adminClient
      .from("product_quantity_offers")
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
          department,
          product_images (
            storage_path,
            is_primary
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      // Check if table does not exist yet (schema cache missing table)
      const isMissingTable =
        error.code === "PGRST205" ||
        error.message?.includes("product_quantity_offers") ||
        error.message?.includes("schema cache");

      if (isMissingTable) {
        return Response.json({
          success: true,
          offers: [],
          tableExists: false,
          migrationRequired: true,
          message: "Table 'public.product_quantity_offers' has not been created yet.",
        });
      }

      console.error("[admin-offers-get] Database error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    const mapped = (data || []).map((row: RawOfferRow) => {
      const prod = Array.isArray(row.product) ? row.product[0] : row.product;
      const primaryImg =
        prod?.product_images?.find((img) => img.is_primary) ||
        prod?.product_images?.[0];

      const proxyUrl = primaryImg?.storage_path
        ? `/api/images/${primaryImg.storage_path}`
        : null;

      return {
        id: row.id,
        product_id: row.product_id,
        qualifying_quantity: Number(row.qualifying_quantity),
        bundle_price: Number(row.bundle_price),
        is_active: Boolean(row.is_active),
        created_at: row.created_at,
        updated_at: row.updated_at,
        product: prod
          ? {
              id: prod.id,
              name: prod.name,
              slug: prod.slug,
              price: Number(prod.price),
              sale_price: prod.sale_price !== null ? Number(prod.sale_price) : null,
              category: prod.category,
              status: prod.status,
              department: prod.department,
              primaryImage: proxyUrl,
            }
          : null,
      };
    });

    return Response.json({
      success: true,
      offers: mapped,
      tableExists: true,
      migrationRequired: false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    console.error("[admin-offers-get] Unexpected error:", err);
    return Response.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/offers
 *
 * Creates a new product quantity offer tier.
 */
export async function POST(request: NextRequest) {
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const { product_id, qualifying_quantity, bundle_price, is_active = true } = body;

  // 1. Validate Product ID
  if (!product_id || typeof product_id !== "string" || product_id.trim().length === 0) {
    return Response.json({ error: "Product selection is required." }, { status: 400 });
  }
  const cleanProductId = product_id.trim();

  // 2. Validate Qualifying Quantity
  const qtyNum = Number(qualifying_quantity);
  if (!Number.isInteger(qtyNum) || qtyNum < 2) {
    return Response.json(
      { error: "Qualifying quantity must be an integer of 2 or greater." },
      { status: 400 }
    );
  }

  // 3. Validate Bundle Price
  const priceNum = Number(bundle_price);
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    return Response.json(
      { error: "Bundle price must be a valid non-negative amount." },
      { status: 400 }
    );
  }
  const roundedBundlePrice = Math.round((priceNum + Number.EPSILON) * 100) / 100;

  try {
    const adminClient = createSupabaseAdminClient();

    // 4. Verify Product Exists
    const { data: product, error: productError } = await adminClient
      .from("products")
      .select("id, name, price, sale_price, category, status")
      .eq("id", cleanProductId)
      .single();

    if (productError || !product) {
      return Response.json(
        { error: `Selected product was not found in database (${cleanProductId}).` },
        { status: 404 }
      );
    }

    // 5. Prevent Duplicate Tier for Same Product & Quantity
    const { data: existingTier } = await adminClient
      .from("product_quantity_offers")
      .select("id")
      .eq("product_id", cleanProductId)
      .eq("qualifying_quantity", qtyNum)
      .maybeSingle();

    if (existingTier) {
      return Response.json(
        {
          error: `An offer tier for ${product.name} with quantity ${qtyNum} already exists. You can edit the existing tier instead.`,
        },
        { status: 409 }
      );
    }

    // 6. Check Savings
    const regularTotal = Math.round((qtyNum * Number(product.price) + Number.EPSILON) * 100) / 100;
    const savings = Math.round((regularTotal - roundedBundlePrice + Number.EPSILON) * 100) / 100;
    let warning: string | null = null;
    if (savings <= 0) {
      warning = `Warning: This offer price (₹${roundedBundlePrice}) provides no discount compared to regular pricing (₹${regularTotal}).`;
    }

    // 7. Insert Offer
    const { data: newOffer, error: insertError } = await adminClient
      .from("product_quantity_offers")
      .insert({
        product_id: cleanProductId,
        qualifying_quantity: qtyNum,
        bundle_price: roundedBundlePrice,
        is_active: Boolean(is_active),
      })
      .select(`
        id,
        product_id,
        qualifying_quantity,
        bundle_price,
        is_active,
        created_at,
        updated_at
      `)
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return Response.json(
          { error: `An offer tier with quantity ${qtyNum} already exists for this product.` },
          { status: 409 }
        );
      }
      if (insertError.code === "PGRST205") {
        return Response.json(
          {
            error: "The database table 'public.product_quantity_offers' has not been created yet. Please execute the migration first.",
            migrationRequired: true,
          },
          { status: 503 }
        );
      }
      console.error("[admin-offers-post] Insert error:", insertError);
      return Response.json({ error: insertError.message }, { status: 500 });
    }

    revalidatePath("/admin/offers");
    revalidatePath("/admin/products");
    invalidateOffersCache();

    return Response.json(
      {
        success: true,
        offer: {
          ...newOffer,
          product: {
            id: product.id,
            name: product.name,
            price: Number(product.price),
            sale_price: product.sale_price !== null ? Number(product.sale_price) : null,
            category: product.category,
            status: product.status,
          },
        },
        warning,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    console.error("[admin-offers-post] Unexpected error:", err);
    return Response.json({ error: message }, { status: 500 });
  }
}
