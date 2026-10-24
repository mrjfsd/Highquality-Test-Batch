import type { NextRequest } from "next/server";
import { verifyAdminServer } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/images
 *
 * Retrieves all product images stored in Supabase and R2,
 * including product associations, metadata (width, height, file_size_bytes),
 * and derived proxy URLs.
 *
 * Security:
 * - Requires verified server-side administrator authorization.
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
    const { data: images, error } = await adminClient
      .from("product_images")
      .select("*, products(id, name, slug, status, department, category, price)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[admin-images-get] Database query error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    const mapped = (images || []).map((img) => {
      const fileName = img.storage_path ? img.storage_path.split("/").pop() || "image.jpg" : "image.jpg";
      const fileSizeBytes = img.file_size_bytes || 0;
      const sizeStr = fileSizeBytes > 0
        ? `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`
        : "Unknown size";
      const dimensionsStr = img.width && img.height
        ? `${img.width} × ${img.height}`
        : "3024 × 4032";

      return {
        id: img.id,
        storagePath: img.storage_path,
        proxyUrl: `/api/images/${img.storage_path}`,
        name: fileName,
        altText: img.alt_text,
        displayOrder: img.display_order,
        isPrimary: Boolean(img.is_primary),
        fileSizeBytes,
        size: sizeStr,
        dimensions: dimensionsStr,
        mimeType: img.mime_type || "image/jpeg",
        createdAt: img.created_at,
        product: img.products
          ? {
              id: img.products.id,
              name: img.products.name,
              slug: img.products.slug,
              status: img.products.status,
              department: img.products.department,
              category: img.products.category,
              price: img.products.price,
            }
          : null,
        assigned: Boolean(img.product_id && img.products),
      };
    });

    return Response.json({ success: true, images: mapped });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    console.error("[admin-images-get] Error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
