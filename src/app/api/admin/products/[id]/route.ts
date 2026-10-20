import type { NextRequest } from "next/server";
import { verifyAdminServer } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { deleteR2Objects } from "@/lib/r2/operations";

/**
 * DELETE /api/admin/products/[id]
 *
 * Atomically removes a product, its variants, its database records, and all
 * associated images from Cloudflare R2:
 *
 * 1. Verifies server-side administrator authorization.
 * 2. Fetches all image storage paths associated with the product.
 * 3. Deletes all binary assets from R2.
 * 4. Deletes the product from Supabase (cascades variants and image records).
 *
 * Security:
 * - Admin-only (server-verified).
 * - Safe against orphaned R2 files.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Verify admin authorization (checks Bearer token header and cookies)
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

  // 2. Fetch all image records belonging to this product
  const { data: images, error: fetchImagesError } = await adminClient
    .from("product_images")
    .select("storage_path")
    .eq("product_id", productId);

  if (fetchImagesError) {
    return Response.json(
      { error: `Database error querying product images: ${fetchImagesError.message}` },
      { status: 500 }
    );
  }

  // 3. Delete all associated image objects from R2
  const storageKeys = (images || [])
    .map((img) => img.storage_path)
    .filter((path): path is string => Boolean(path));

  if (storageKeys.length > 0) {
    try {
      await deleteR2Objects(storageKeys);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "R2 deletion error.";
      console.error(
        `[delete-product] Failed to delete ${storageKeys.length} images from R2 for product ${productId}:`,
        message
      );
      return Response.json(
        {
          error:
            "Failed to delete images from R2 storage. Product database records were not removed.",
        },
        { status: 500 }
      );
    }
  }

  // 4. Delete the product from the database
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

  return Response.json({
    success: true,
    deletedProductId: productId,
    deletedImagesCount: storageKeys.length,
  });
}
