import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * GET /api/products/[id]/gallery
 *
 * Progressively retrieves product image gallery records in pages of 20 images.
 * Supports products with hundreds of images (e.g. 657 images) without transferring
 * all records at once.
 *
 * Accepts either a product UUID or product slug in the [id] parameter.
 * Query Parameters:
 *   - page: 1-indexed page number (default: 1)
 *   - limit: items per page (default: 20, max: 50)
 *
 * Security:
 *   - Accessible by storefront visitors for published products.
 *   - Image binary delivery is proxied via /api/images/[...key] (private R2 bucket).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawParam } = await params;

  if (!rawParam || rawParam.trim() === "") {
    return NextResponse.json(
      { error: "Product identifier parameter is required." },
      { status: 400 }
    );
  }

  const decodedParam = decodeURIComponent(rawParam).trim();
  const searchParams = request.nextUrl.searchParams;

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const requestedLimit = parseInt(searchParams.get("limit") || `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT;
  const limit = Math.min(MAX_LIMIT, Math.max(1, requestedLimit));

  const supabase = createSupabaseAdminClient();

  // Step 1: Resolve product by UUID or slug
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decodedParam);

  let productQuery = supabase
    .from("products")
    .select("id, name, slug, status, category, product_variants(color)");

  if (isUuid) {
    productQuery = productQuery.eq("id", decodedParam);
  } else {
    productQuery = productQuery.eq("slug", decodedParam);
  }

  const { data: product, error: prodError } = await productQuery.maybeSingle();

  if (prodError) {
    return NextResponse.json(
      { error: `Database error resolving product: ${prodError.message}` },
      { status: 500 }
    );
  }

  if (!product) {
    return NextResponse.json(
      { error: "Product not found." },
      { status: 404 }
    );
  }

  // Ensure unpublished products are not exposed on public storefront
  if (product.status !== "published") {
    return NextResponse.json(
      { error: "Product is not published." },
      { status: 403 }
    );
  }

  // Step 2: Fetch the paginated batch of images for this product
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data: imagesData, count, error: imgError } = await supabase
    .from("product_images")
    .select(
      `
      id,
      product_id,
      storage_path,
      alt_text,
      display_order,
      is_primary,
      color,
      mime_type,
      file_size_bytes,
      width,
      height,
      created_at
    `,
      { count: "exact" }
    )
    .eq("product_id", product.id)
    .order("display_order", { ascending: true })
    .order("id", { ascending: true }) // Deterministic unique tie-breaker
    .range(from, to);

  if (imgError) {
    return NextResponse.json(
      { error: `Database error retrieving gallery images: ${imgError.message}` },
      { status: 500 }
    );
  }

  const total = count || 0;
  const hasMore = to < total - 1;

  // Derive private R2 proxy URL for each image
  const images = (imagesData || []).map((img) => ({
    id: img.id,
    productId: img.product_id,
    storagePath: img.storage_path,
    proxyUrl: `/api/images/${img.storage_path}`,
    altText: img.alt_text || `${product.name} image ${img.display_order + 1}`,
    displayOrder: img.display_order,
    isPrimary: img.is_primary,
    color: img.color,
    mimeType: img.mime_type,
    fileSizeBytes: img.file_size_bytes,
    width: img.width,
    height: img.height,
  }));

  const colorsSet = new Set<string>();
  if (Array.isArray((product as any).product_variants)) {
    (product as any).product_variants.forEach((v: { color?: string | null }) => {
      if (v?.color && v.color.trim()) colorsSet.add(v.color.trim());
    });
  }
  const colors = Array.from(colorsSet);

  return NextResponse.json({
    productId: product.id,
    productName: product.name,
    productSlug: product.slug,
    images,
    colors,
    page,
    limit,
    total,
    hasMore,
  });
}
