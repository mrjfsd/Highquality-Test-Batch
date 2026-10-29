import { products } from "../../../data/products.ts";
import { createSupabaseAdminClient } from "../../../lib/supabase/server.ts";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_EXT_REGEX = /\.(jpe?g|png|webp|avif|gif|svg)$/i;

/**
 * GET /i/[...id]
 *
 * Short image URL redirect handler:
 * - /i/[imageId] (UUID): Queries public.product_images to redirect to /api/images/[storage_path].
 * - /i/[slugOrProductId]: Looks up primary image for product and redirects to image source.
 * - /i/products/[...key]: Redirects to /api/images/products/[...key].
 * - /i/[filename.ext]: Redirects to local asset /[filename.ext].
 *
 * Security:
 * - Prevents path traversal ("..").
 * - Never leaks R2 private credentials.
 * - Strictly same-origin or pre-vetted domain redirection.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string[] }> }
) {
  const { id: rawSegments } = await params;
  if (!rawSegments || !Array.isArray(rawSegments) || rawSegments.length === 0) {
    return new Response(JSON.stringify({ error: "Image identifier required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawKey = rawSegments.map((s) => decodeURIComponent(s).trim()).join("/");

  // Validate input: block path traversal
  if (!rawKey || rawKey.includes("..") || rawKey.includes("\\")) {
    return new Response(JSON.stringify({ error: "Invalid image identifier." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 1. Case A: Single segment is an image UUID (public.product_images.id)
  if (rawSegments.length === 1 && UUID_REGEX.test(rawKey)) {
    try {
      const supabase = createSupabaseAdminClient();
      const { data: imgRecord } = await supabase
        .from("product_images")
        .select("storage_path")
        .eq("id", rawKey)
        .maybeSingle();

      if (imgRecord?.storage_path) {
        return Response.redirect(
          new URL(`/api/images/${imgRecord.storage_path}`, request.url),
          307
        );
      }
    } catch (err: unknown) {
      console.warn("[short-route /i] Error querying product_images by id:", err);
    }
  }

  // 2. Case B: Key starts with "products/" or "test-uploads/" (R2 storage path)
  if (rawKey.startsWith("products/") || rawKey.startsWith("test-uploads/")) {
    return Response.redirect(new URL(`/api/images/${rawKey}`, request.url), 307);
  }

  // 3. Case C: Key is a product slug or product ID
  if (rawSegments.length === 1 && !IMAGE_EXT_REGEX.test(rawKey)) {
    // Check mock catalogue products
    const mock = products.find(
      (p) => p.slug.toLowerCase() === rawKey.toLowerCase() || String(p.id) === rawKey
    );
    if (mock && mock.image) {
      if (mock.image.startsWith("http://") || mock.image.startsWith("https://")) {
        return Response.redirect(new URL(mock.image), 307);
      }
      const localPath = mock.image.startsWith("/") ? mock.image : `/${mock.image}`;
      return Response.redirect(new URL(localPath, request.url), 307);
    }

    // Check Supabase products
    try {
      const supabase = createSupabaseAdminClient();
      const isUuid = UUID_REGEX.test(rawKey);

      let query = supabase
        .from("products")
        .select("id, product_images(id, storage_path, is_primary, display_order)")
        .eq("status", "published");

      if (isUuid) {
        query = query.eq("id", rawKey);
      } else {
        query = query.eq("slug", rawKey);
      }

      const { data: dbProduct } = await query.maybeSingle();
      if (dbProduct && Array.isArray(dbProduct.product_images) && dbProduct.product_images.length > 0) {
        const sorted = [...dbProduct.product_images].sort((a, b) => {
          const aOrder = a.display_order ?? 0;
          const bOrder = b.display_order ?? 0;
          if (aOrder !== bOrder) return aOrder - bOrder;
          if (a.is_primary && !b.is_primary) return -1;
          if (!a.is_primary && b.is_primary) return 1;
          return 0;
        });
        const primaryImg = sorted.find((img) => img.is_primary) || sorted[0];
        if (primaryImg?.storage_path) {
          return Response.redirect(
            new URL(`/api/images/${primaryImg.storage_path}`, request.url),
            307
          );
        }
      }
    } catch (err: unknown) {
      console.warn("[short-route /i] Error querying product primary image:", err);
    }
  }

  // 4. Case D: Static or local asset file path (e.g. "jeans.jpg" or "assets/foo.webp")
  if (IMAGE_EXT_REGEX.test(rawKey)) {
    const cleanPath = rawKey.replace(/^\/+/, "");
    return Response.redirect(new URL(`/${cleanPath}`, request.url), 307);
  }

  // 5. Fallback: 404
  return new Response(JSON.stringify({ error: "Image not found." }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

export async function HEAD(
  request: Request,
  context: { params: Promise<{ id: string[] }> }
) {
  return GET(request, context);
}
