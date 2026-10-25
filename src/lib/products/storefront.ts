import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getProductBySlug as getMockProductBySlug,
  products,
  type Product,
  type Department,
} from "@/data/products";

function normalizeDepartment(raw: string): { lower: string; title: Department } {
  const lower = raw.trim().toLowerCase();
  const title = (lower.charAt(0).toUpperCase() + lower.slice(1)) as Department;
  return { lower, title };
}

/**
 * Fetches published products for a specific department from Supabase,
 * resolves their primary images from Cloudflare R2 (via /api/images/[...key]),
 * and merges them with catalogue products.
 *
 * Security:
 * - Only queries status = 'published'.
 * - Sensitive fields (sku, stock_quantity) are NOT included in the returned Product object.
 */
export async function fetchPublishedProductsByDepartment(
  department: string
): Promise<Product[]> {
  const { lower: deptLower, title: deptTitle } = normalizeDepartment(department);

  try {
    const supabase = createSupabaseAdminClient();
    const { data: dbProducts, error } = await supabase
      .from("products")
      .select("*, product_images(*), product_variants(*)")
      .eq("status", "published")
      .eq("department", deptLower)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(
        `[storefront] Error querying published products for department "${deptLower}":`,
        error.message
      );
    }

    const mappedDbProducts: Product[] = (dbProducts || []).map((p) => {
      // Find primary image or the image with the lowest display_order
      const primaryImage =
        p.product_images?.find((img: { is_primary: boolean }) => img.is_primary) ||
        p.product_images?.[0];

      const image = primaryImage?.storage_path
        ? `/api/images/${primaryImage.storage_path}`
        : "https://images.unsplash.com/photo-1613915617430-8ab0fd7c6baf?auto=format&fit=crop&w=1200&q=80";

      const alt = primaryImage?.alt_text || p.name;

      // Collect available colors strictly from configured product variants
      const colorsSet = new Set<string>();
      if (Array.isArray(p.product_variants)) {
        p.product_variants.forEach((v: { color?: string | null }) => {
          if (v.color && v.color.trim()) colorsSet.add(v.color.trim());
        });
      }
      const colors = Array.from(colorsSet);

      // Map client-safe variant options (omitting sensitive sku and stock_quantity)
      const variants = Array.isArray(p.product_variants)
        ? p.product_variants.map((v: { id?: string; size?: string | null; color?: string | null; is_available?: boolean | null; stock_quantity?: number | null }) => ({
          id: v.id,
          size: (v.size || "").trim(),
          color: (v.color || "").trim(),
          is_available:
            Boolean(v.is_available) &&
            (typeof v.stock_quantity === "number" ? v.stock_quantity > 0 : true),
        }))
        : [];

      return {
        id: p.id,
        slug: p.slug,
        department: deptTitle,
        category: p.category,
        name: p.name,
        price: Number(p.price),
        sale:
          p.sale_price !== null && p.sale_price !== undefined
            ? Number(p.sale_price)
            : undefined,
        image,
        alt,
        colors,
        fabric: p.fabric || "Premium quality",
        fit: p.fit || "Regular fit",
        description: p.description || undefined,
        created_at: p.created_at,
        variants,
        is_database: true,
      };
    });

    // Department catalogues display actual published products from Supabase plus dummy test products
    const dummyProducts = products.filter(
      (p) =>
        p.department.toLowerCase() === deptLower &&
        typeof p.id === "string" &&
        p.id.startsWith("dummy-") &&
        !mappedDbProducts.some((dp) => dp.slug === p.slug)
    );

    return [...mappedDbProducts, ...dummyProducts];
  } catch (err: unknown) {
    console.error("[storefront] Unexpected error fetching department products:", err);
    return products.filter(
      (p) =>
        p.department.toLowerCase() === deptLower &&
        typeof p.id === "string" &&
        p.id.startsWith("dummy-")
    );
  }
}

/**
 * Resolves a published product by slug from Supabase, or falls back to catalogue data.
 */
export async function fetchProductBySlug(
  slug: string
): Promise<Product | undefined> {
  const cleanSlug = slug.trim();

  try {
    const supabase = createSupabaseAdminClient();
    const { data: p, error } = await supabase
      .from("products")
      .select("*, product_images(*), product_variants(*)")
      .eq("status", "published")
      .eq("slug", cleanSlug)
      .maybeSingle();

    if (error) {
      console.error(
        `[storefront] Error querying product by slug "${cleanSlug}":`,
        error.message
      );
    }

    if (p) {
      const { title: deptTitle } = normalizeDepartment(p.department);

      // Extract all valid images in ascending display_order while respecting primary selection
      const rawImages = Array.isArray(p.product_images)
        ? [...p.product_images]
            .filter((img: { storage_path?: string }) => Boolean(img.storage_path))
            .sort((a: { display_order?: number; is_primary?: boolean }, b: { display_order?: number; is_primary?: boolean }) => {
              if (a.is_primary && !b.is_primary) return -1;
              if (!a.is_primary && b.is_primary) return 1;
              return (a.display_order ?? 0) - (b.display_order ?? 0);
            })
        : [];

      const galleryImages = rawImages.map(
        (img: {
          id?: string;
          storage_path: string;
          alt_text?: string | null;
          is_primary?: boolean | null;
          display_order?: number | null;
        }) => ({
          id: img.id,
          url: `/api/images/${img.storage_path}`,
          alt: img.alt_text || p.name,
          is_primary: Boolean(img.is_primary),
          display_order: img.display_order ?? 0,
        })
      );

      const primaryImage =
        galleryImages.find((img) => img.is_primary) || galleryImages[0];

      const image =
        primaryImage?.url ||
        "https://images.unsplash.com/photo-1613915617430-8ab0fd7c6baf?auto=format&fit=crop&w=1200&q=80";

      const alt = primaryImage?.alt || p.name;

      const images =
        galleryImages.length > 0
          ? galleryImages
          : [{ url: image, alt, is_primary: true }];

      // Collect available colors strictly from configured product variants
      const colorsSet = new Set<string>();
      if (Array.isArray(p.product_variants)) {
        p.product_variants.forEach((v: { color?: string | null }) => {
          if (v.color && v.color.trim()) colorsSet.add(v.color.trim());
        });
      }
      const colors = Array.from(colorsSet);

      // Map client-safe variant options (omitting sensitive sku and stock_quantity)
      const variants = Array.isArray(p.product_variants)
        ? p.product_variants.map((v: { id?: string; size?: string | null; color?: string | null; is_available?: boolean | null; stock_quantity?: number | null }) => ({
          id: v.id,
          size: (v.size || "").trim(),
          color: (v.color || "").trim(),
          is_available:
            Boolean(v.is_available) &&
            (typeof v.stock_quantity === "number" ? v.stock_quantity > 0 : true),
        }))
        : [];

      return {
        id: p.id,
        slug: p.slug,
        department: deptTitle,
        category: p.category,
        name: p.name,
        price: Number(p.price),
        sale:
          p.sale_price !== null && p.sale_price !== undefined
            ? Number(p.sale_price)
            : undefined,
        image,
        images,
        alt,
        colors,
        fabric: p.fabric || "Premium quality",
        fit: p.fit || "Regular fit",
        description: p.description || undefined,
        created_at: p.created_at,
        variants,
        is_database: true,
      };
    }
  } catch (err: unknown) {
    console.error("[storefront] Unexpected error querying product by slug:", err);
  }

  // Fallback to mock product catalog
  return getMockProductBySlug(cleanSlug);
}

/**
 * Retrieves related products in the same department for the "You may also like" section.
 */
export async function fetchRelatedProducts(
  product: Product,
  limit = 4
): Promise<Product[]> {
  try {
    const allInDept = await fetchPublishedProductsByDepartment(product.department);
    const related = allInDept.filter(
      (p) => String(p.id) !== String(product.id) && p.slug !== product.slug
    );
    return related.slice(0, limit);
  } catch {
    return [];
  }
}
