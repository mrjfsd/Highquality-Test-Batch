import { products } from "../../../data/products.ts";
import { createSupabaseAdminClient } from "../../../lib/supabase/server.ts";

/**
 * GET /p/[id]
 *
 * Short product URL redirect handler:
 * - Redirects /p/[slug] or /p/[id] to the canonical /product/[slug] route.
 * - Resolves both mock catalogue products and published Supabase database products.
 * - Protects against path traversal and arbitrary open redirects (strictly same-origin).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawParam } = await params;
  if (!rawParam || typeof rawParam !== "string") {
    return Response.redirect(new URL("/", request.url), 307);
  }

  const clean = decodeURIComponent(rawParam).trim();

  // Validate input: block path traversal or malicious character sequences
  if (!clean || clean.includes("..") || clean.includes("\\") || clean.includes("/")) {
    return Response.redirect(new URL("/", request.url), 307);
  }

  // 1. Check in-memory/static mock products (by slug or by ID)
  const mockProduct = products.find(
    (p) => p.slug.toLowerCase() === clean.toLowerCase() || String(p.id) === clean
  );
  if (mockProduct) {
    const targetUrl = new URL(`/product/${encodeURIComponent(mockProduct.slug)}`, request.url);
    return Response.redirect(targetUrl, 307);
  }

  // 2. Check Supabase database products
  try {
    const supabase = createSupabaseAdminClient();

    // Query published products by slug first
    const { data: prodBySlug } = await supabase
      .from("products")
      .select("slug")
      .eq("status", "published")
      .eq("slug", clean)
      .maybeSingle();

    if (prodBySlug?.slug) {
      const targetUrl = new URL(`/product/${encodeURIComponent(prodBySlug.slug)}`, request.url);
      return Response.redirect(targetUrl, 307);
    }

    // Query published products by UUID id
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
    if (isUuid) {
      const { data: prodById } = await supabase
        .from("products")
        .select("slug")
        .eq("status", "published")
        .eq("id", clean)
        .maybeSingle();

      if (prodById?.slug) {
        const targetUrl = new URL(`/product/${encodeURIComponent(prodById.slug)}`, request.url);
        return Response.redirect(targetUrl, 307);
      }
    }
  } catch (err: unknown) {
    console.warn("[short-route /p] Supabase product lookup failed, falling back to direct route:", err);
  }

  // 3. Fallback: redirect to canonical product route to let Next.js handle 404 or client routing
  const fallbackUrl = new URL(`/product/${encodeURIComponent(clean)}`, request.url);
  return Response.redirect(fallbackUrl, 307);
}

export async function HEAD(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return GET(request, context);
}
