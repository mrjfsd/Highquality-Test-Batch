import type { NextRequest } from "next/server";
import { verifyAdminServer } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { deleteR2Object } from "@/lib/r2/operations";

/**
 * DELETE /api/admin/images/[id]
 *
 * Deletes a product image asset:
 *   1. Verifies admin authorization server-side.
 *   2. If [id] matches a record in public.product_images (by UUID id or storage_path):
 *      - Deletes the object from R2.
 *      - Deletes the metadata record from public.product_images.
 *   3. If [id] is an uncommitted/orphaned object key (starts with products/ or test-uploads/):
 *      - Deletes the object directly from R2 (e.g. during rollback of failed product creation).
 *
 * Security:
 * - Admin-only (server-verified).
 * - Restricts direct R2 deletions to approved key prefixes (products/, test-uploads/).
 * - Prevents path traversal ("..").
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

  const { id: rawParam } = await params;

  if (!rawParam || rawParam.trim() === "") {
    return Response.json({ error: "Image identifier parameter is required." }, { status: 400 });
  }

  const decodedParam = decodeURIComponent(rawParam).trim();
  const adminClient = createSupabaseAdminClient();

  // 2. Check if a DB record matches by primary key (UUID) or storage_path
  let imageRecord: { id: string; storage_path: string; product_id: string } | null = null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    decodedParam
  );

  if (isUuid) {
    const { data, error: fetchError } = await adminClient
      .from("product_images")
      .select("id, storage_path, product_id")
      .eq("id", decodedParam)
      .maybeSingle();

    if (fetchError) {
      return Response.json(
        { error: `Database error fetching image: ${fetchError.message}` },
        { status: 500 }
      );
    }
    imageRecord = data;
  }

  if (!imageRecord) {
    const { data: byPathRecord } = await adminClient
      .from("product_images")
      .select("id, storage_path, product_id")
      .eq("storage_path", decodedParam)
      .maybeSingle();
    imageRecord = byPathRecord;
  }

  // Case A: Image record exists in the database
  if (imageRecord) {
    const objectKey = imageRecord.storage_path;

    // 3. Delete from R2
    try {
      await deleteR2Object(objectKey);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "R2 deletion failed.";
      console.error(`[delete-image] R2 deletion failed for key "${objectKey}":`, message);
      return Response.json(
        { error: "Failed to delete image from storage. Database record was not removed." },
        { status: 500 }
      );
    }

    // 4. Delete the DB metadata record
    const { error: deleteError } = await adminClient
      .from("product_images")
      .delete()
      .eq("id", imageRecord.id);

    if (deleteError) {
      console.error(
        `[delete-image] ORPHAN WARNING: R2 object "${objectKey}" deleted but DB record ` +
        `"${imageRecord.id}" could not be removed: ${deleteError.message}`
      );
      return Response.json(
        {
          error:
            "Image was removed from storage, but the database record could not be deleted. " +
            "Please remove image record manually from public.product_images.",
          imageId: imageRecord.id,
          objectKey,
        },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      deletedImageId: imageRecord.id,
      deletedObjectKey: objectKey,
    });
  }

  // Case B: Not in DB — check if it is an uncommitted/orphaned uploaded R2 object (e.g. rollback cleanup)
  const isAllowedR2Key =
    (decodedParam.startsWith("products/") || decodedParam.startsWith("test-uploads/")) &&
    !decodedParam.includes("..");

  if (isAllowedR2Key) {
    try {
      await deleteR2Object(decodedParam);
      return Response.json({
        success: true,
        deletedObjectKey: decodedParam,
        message: "Uncommitted R2 storage asset deleted successfully.",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "R2 deletion failed.";
      console.error(`[delete-image] R2 deletion error for uncommitted key "${decodedParam}":`, message);
      return Response.json(
        { error: `Failed to remove uncommitted asset from storage: ${message}` },
        { status: 500 }
      );
    }
  }

  return Response.json({ error: "Image record not found." }, { status: 404 });
}
