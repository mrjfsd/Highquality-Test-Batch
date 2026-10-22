import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyAdminServer } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { deleteR2Objects } from "@/lib/r2/operations";

const MAX_BULK_DELETE_SIZE = 100;

/**
 * POST /api/admin/products/bulk-delete
 *
 * Secure server-side endpoint for deleting multiple products in one batch:
 * 1. Authenticates requester and verifies app_admins membership.
 * 2. Validates and deduplicates product UUIDs up to MAX_BULK_DELETE_SIZE.
 * 3. Confirms which products exist.
 * 4. Deletes dependent variants, image metadata, and product records.
 * 5. Cleans up associated binary assets from Cloudflare R2.
 * 6. Revalidates storefront and catalogue caches.
 * 7. Accurately reports deleted IDs and any failures.
 */
export async function POST(request: NextRequest) {
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

  // 2. Parse request JSON body
  let body: { productIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const { productIds } = body;
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return Response.json(
      { error: "Product IDs must be a non-empty array of strings." },
      { status: 400 }
    );
  }

  // Deduplicate and sanitize string IDs
  const validIds = Array.from(
    new Set(
      productIds
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        .map((id) => id.trim())
    )
  );

  if (validIds.length === 0) {
    return Response.json({ error: "No valid product IDs provided." }, { status: 400 });
  }

  if (validIds.length > MAX_BULK_DELETE_SIZE) {
    return Response.json(
      { error: `Maximum of ${MAX_BULK_DELETE_SIZE} products can be deleted at one time.` },
      { status: 400 }
    );
  }

  const adminClient = createSupabaseAdminClient();

  // 3. Confirm which requested products actually exist and retrieve their details
  const { data: existingProducts, error: fetchError } = await adminClient
    .from("products")
    .select("id, name, slug, department")
    .in("id", validIds);

  if (fetchError) {
    return Response.json(
      { error: `Database error querying products: ${fetchError.message}` },
      { status: 500 }
    );
  }

  const existingMap = new Map((existingProducts || []).map((p) => [p.id, p]));

  // 4. Sequential deletion of existing products
  const deletedIds: string[] = [];
  const failed: Array<{ id: string; name?: string; error: string }> = [];
  const allStorageKeysToDelete: string[] = [];
  const departmentsToRevalidate = new Set<string>();
  const slugsToRevalidate = new Set<string>();

  for (const id of validIds) {
    const product = existingMap.get(id);
    if (!product) {
      failed.push({ id, error: "Product not found in database." });
      continue;
    }

    try {
      // Find image storage paths
      const { data: images } = await adminClient
        .from("product_images")
        .select("storage_path")
        .eq("product_id", id);

      const storageKeys = (images || [])
        .map((img) => img.storage_path)
        .filter((path): path is string => Boolean(path));

      // Delete dependent records
      await adminClient.from("product_variants").delete().eq("product_id", id);
      await adminClient.from("product_images").delete().eq("product_id", id);

      // Delete product record
      const { error: delErr } = await adminClient
        .from("products")
        .delete()
        .eq("id", id);

      if (delErr) {
        failed.push({ id, name: product.name, error: delErr.message });
        continue;
      }

      deletedIds.push(id);
      if (storageKeys.length > 0) {
        allStorageKeysToDelete.push(...storageKeys);
      }
      if (product.department) {
        departmentsToRevalidate.add(product.department.toLowerCase());
      }
      if (product.slug) {
        slugsToRevalidate.add(product.slug);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Deletion failed.";
      failed.push({ id, name: product.name, error: msg });
    }
  }

  // 5. Clean up associated R2 objects
  let r2CleanupSuccess = true;
  let r2CleanupError: string | null = null;
  if (allStorageKeysToDelete.length > 0) {
    try {
      await deleteR2Objects(allStorageKeysToDelete);
    } catch (err: unknown) {
      r2CleanupSuccess = false;
      r2CleanupError = err instanceof Error ? err.message : "R2 deletion error.";
      console.error("[bulk-delete] Failed to clean up R2 objects:", r2CleanupError);
    }
  }

  // 6. Invalidate caches
  try {
    revalidatePath("/admin/products");
    revalidatePath("/shop");
    departmentsToRevalidate.forEach((dept) => {
      revalidatePath(`/shop/${dept}`);
    });
    slugsToRevalidate.forEach((slug) => {
      revalidatePath(`/product/${slug}`);
    });
  } catch (revalErr) {
    console.warn("[bulk-delete] revalidatePath warning:", revalErr);
  }

  return Response.json({
    success: true,
    deletedCount: deletedIds.length,
    failedCount: failed.length,
    deletedIds,
    failed,
    deletedImagesCount: allStorageKeysToDelete.length,
    r2CleanupSuccess,
    warning: !r2CleanupSuccess
      ? `Database records deleted, but R2 image cleanup encountered an error: ${r2CleanupError}`
      : null,
  });
}
