import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyAdminServer } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { deleteR2Objects } from "@/lib/r2/operations";

/**
 * DELETE /api/admin/products/[id]
 *
 * Safely and authoritatively deletes a product from Supabase and removes
 * all associated image assets from Cloudflare R2:
 *
 * 1. Verifies server-side administrator authorization (Bearer token or cookie).
 * 2. Confirms the product exists in public.products.
 * 3. Identifies associated variant and image metadata records.
 * 4. Removes variants and image metadata.
 * 5. Removes the product record from public.products.
 * 6. Cleans up binary assets from Cloudflare R2 and reports status honestly.
 * 7. Invalidates storefront and admin catalogue caches.
 *
 * Security:
 * - Admin-only verified server-side.
 * - Idempotent, safe against orphaned records.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Verify admin authorization
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

  const { id: productId } = await params;

  if (!productId || productId.trim() === "") {
    return Response.json({ error: "Product ID parameter is required." }, { status: 400 });
  }

  const adminClient = createSupabaseAdminClient();

  // 2. Confirm product exists and retrieve details for revalidation
  const { data: product, error: fetchProductError } = await adminClient
    .from("products")
    .select("id, name, slug, department")
    .eq("id", productId)
    .maybeSingle();

  if (fetchProductError) {
    return Response.json(
      { error: `Database error querying product: ${fetchProductError.message}` },
      { status: 500 }
    );
  }

  if (!product) {
    return Response.json({ error: "Product not found." }, { status: 404 });
  }

  // 3. Fetch image storage paths belonging to this product
  const { data: images, error: fetchImagesError } = await adminClient
    .from("product_images")
    .select("storage_path")
    .eq("product_id", productId);

  if (fetchImagesError) {
    console.warn(`[delete-product] Warning querying images for product ${productId}:`, fetchImagesError.message);
  }

  const storageKeys = (images || [])
    .map((img) => img.storage_path)
    .filter((path): path is string => Boolean(path));

  // 4. Delete dependent records (variants and image metadata)
  await adminClient.from("product_variants").delete().eq("product_id", productId);
  await adminClient.from("product_images").delete().eq("product_id", productId);

  // 5. Delete product record from public.products
  const { error: deleteProductError } = await adminClient
    .from("products")
    .delete()
    .eq("id", productId);

  if (deleteProductError) {
    return Response.json(
      { error: `Database error deleting product: ${deleteProductError.message}` },
      { status: 500 }
    );
  }

  // 6. Clean up associated R2 objects
  let r2CleanupSuccess = true;
  let r2CleanupError: string | null = null;

  if (storageKeys.length > 0) {
    try {
      await deleteR2Objects(storageKeys);
    } catch (err: unknown) {
      r2CleanupSuccess = false;
      r2CleanupError = err instanceof Error ? err.message : "R2 deletion error.";
      console.error(
        `[delete-product] Failed to clean up ${storageKeys.length} images from R2 for product ${productId}:`,
        r2CleanupError
      );
    }
  }

  // 7. Invalidate storefront and admin catalogue caches
  try {
    revalidatePath("/admin/products");
    revalidatePath("/shop");
    if (product.department) {
      revalidatePath(`/shop/${product.department.toLowerCase()}`);
    }
    if (product.slug) {
      revalidatePath(`/product/${product.slug}`);
    }
  } catch (revalErr) {
    console.warn("[delete-product] revalidatePath warning:", revalErr);
  }

  return Response.json({
    success: true,
    deletedProductId: productId,
    productName: product.name,
    deletedImagesCount: storageKeys.length,
    r2CleanupSuccess,
    warning: !r2CleanupSuccess
      ? `Product deleted from database, but R2 image cleanup encountered an error: ${r2CleanupError}`
      : null,
  });
}
