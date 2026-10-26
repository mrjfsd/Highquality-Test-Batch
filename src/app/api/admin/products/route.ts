import type { NextRequest } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { verifyAdminServer } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { deleteR2Objects } from "@/lib/r2/operations";
import { normalizeSlug, resolveUniqueSlug } from "@/lib/products/slug";
import type { Product, ProductVariant, ProductImage } from "@/types/product";

interface VariantInput {
  size: string;
  color: string;
  sku?: string | null;
  stock_quantity: number;
  is_available: boolean;
}

interface ImageInput {
  storage_path: string;
  alt_text?: string | null;
  display_order?: number;
  is_primary?: boolean;
  color?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  width?: number | null;
  height?: number | null;
}

interface SizeConfigInput {
  size: string;
  colors: string[];
  sku?: string | null;
  total_stock: number;
  is_available?: boolean;
}

interface CreateProductRequestBody {
  name: string;
  slug?: string;
  description?: string | null;
  department: string;
  category: string;
  price: number;
  sale_price?: number | null;
  discount_percent?: number | null;
  fabric?: string | null;
  fit?: string | null;
  status?: "draft" | "published" | "archived";
  is_featured?: boolean;
  size_configs?: SizeConfigInput[];
  variants?: VariantInput[];
  images?: ImageInput[];
}

const VALID_DEPARTMENTS = new Set(["men", "women", "kids"]);
const VALID_STATUSES = new Set(["draft", "published", "archived"]);
const ALLOWED_DISCOUNT_PERCENTS = new Set([10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65]);

/**
 * POST /api/admin/products
 *
 * Secure server-side endpoint for creating a new product record, its variants,
 * and associating its uploaded R2 image metadata.
 *
 * Security:
 * - Requires verified server-side administrator authorization (Bearer token or cookie).
 * - Full server-side validation against database constraints.
 * - Inventory sensitive fields (sku, stock_quantity) managed exclusively through server privileges.
 * - Automatic compensation and rollback on partial failure (deleting product and cleaning orphaned R2 assets).
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
  let body: CreateProductRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const {
    name,
    slug,
    description,
    department,
    category,
    price,
    sale_price,
    discount_percent,
    fabric,
    fit,
    status = "draft",
    is_featured = false,
    size_configs,
    variants = [],
    images = [],
  } = body;

  // 3. Server-side validations
  // Product Name
  if (!name || typeof name !== "string" || name.trim() === "") {
    return Response.json({ error: "Product name is required." }, { status: 400 });
  }
  const cleanName = name.trim();
  if (cleanName.length > 255) {
    return Response.json(
      { error: "Product name must be 255 characters or fewer." },
      { status: 400 }
    );
  }

  // Slug: Authoritatively derive from name (or slug if explicitly provided)
  const proposedSlug = slug && typeof slug === "string" && slug.trim() !== "" ? slug : cleanName;
  const cleanSlug = normalizeSlug(proposedSlug);

  if (!cleanSlug) {
    return Response.json(
      { error: "Product name must contain alphanumeric characters to generate a valid slug." },
      { status: 400 }
    );
  }

  // Department
  const normalizedDept = (department || "").trim().toLowerCase();
  if (!VALID_DEPARTMENTS.has(normalizedDept)) {
    return Response.json(
      { error: "Department must be one of: Men, Women, Kids." },
      { status: 400 }
    );
  }

  // Category
  if (!category || typeof category !== "string" || category.trim() === "") {
    return Response.json({ error: "Category is required." }, { status: 400 });
  }
  const cleanCategory = category.trim();

  // Price
  const numPrice = Number(price);
  if (isNaN(numPrice) || numPrice < 0 || !isFinite(numPrice)) {
    return Response.json(
      { error: "Price must be a valid non-negative number." },
      { status: 400 }
    );
  }

  // Sale Price & Discount Percent
  let numSalePrice: number | null = null;
  let numDiscountPercent: number | null = null;

  if (discount_percent !== undefined && discount_percent !== null && String(discount_percent).trim() !== "") {
    numDiscountPercent = Number(discount_percent);
    if (!ALLOWED_DISCOUNT_PERCENTS.has(numDiscountPercent)) {
      return Response.json(
        { error: "Discount percentage must be one of: 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65." },
        { status: 400 }
      );
    }
    // Calculate and enforce consistent sale price based on discount_percent: sale_price = ROUND(price * (100 - discount_percent) / 100, 2)
    numSalePrice = Math.round(numPrice * ((100 - numDiscountPercent) / 100) * 100) / 100;
  } else if (sale_price !== undefined && sale_price !== null && String(sale_price).trim() !== "") {
    numSalePrice = Number(sale_price);
    if (isNaN(numSalePrice) || numSalePrice < 0 || !isFinite(numSalePrice)) {
      return Response.json(
        { error: "Sale price must be a valid non-negative number." },
        { status: 400 }
      );
    }
    if (numSalePrice > numPrice) {
      return Response.json(
        { error: "Sale price cannot be greater than the regular price." },
        { status: 400 }
      );
    }
  }

  // Publication Status
  if (!VALID_STATUSES.has(status)) {
    return Response.json(
      { error: `Status must be one of: 'draft', 'published', 'archived'.` },
      { status: 400 }
    );
  }

  // Attributes
  const cleanDescription = description && typeof description === "string" ? description.trim() || null : null;
  const cleanFabric = fabric && typeof fabric === "string" ? fabric.trim() || null : null;
  const cleanFit = fit && typeof fit === "string" ? fit.trim() || null : null;
  const cleanIsFeatured = Boolean(is_featured);

  // Validate Variants / Size Configs
  const finalVariants: VariantInput[] = [];

  if (Array.isArray(size_configs) && size_configs.length > 0) {
    const seenCombos = new Set<string>();

    for (let cIdx = 0; cIdx < size_configs.length; cIdx++) {
      const cfg = size_configs[cIdx];
      if (!cfg.size || typeof cfg.size !== "string" || cfg.size.trim() === "") {
        return Response.json(
          { error: `Size configuration #${cIdx + 1}: Size is required.` },
          { status: 400 }
        );
      }
      const cleanSize = cfg.size.trim();

      if (!Array.isArray(cfg.colors) || cfg.colors.length === 0) {
        return Response.json(
          { error: `Size "${cleanSize}": At least one color must be selected.` },
          { status: 400 }
        );
      }

      // Normalize color names and deduplicate within config
      const normalizedColors: string[] = [];
      const configColorsLower = new Set<string>();
      for (const rawCol of cfg.colors) {
        if (!rawCol || typeof rawCol !== "string" || rawCol.trim() === "") continue;
        const norm = rawCol
          .trim()
          .split(/\s+/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ");
        const lower = norm.toLowerCase();
        if (!configColorsLower.has(lower)) {
          configColorsLower.add(lower);
          normalizedColors.push(norm);
        }
      }

      if (normalizedColors.length === 0) {
        return Response.json(
          { error: `Size "${cleanSize}": At least one valid color is required.` },
          { status: 400 }
        );
      }

      const totalStock = Number(cfg.total_stock);
      if (isNaN(totalStock) || totalStock < 0 || !Number.isInteger(totalStock)) {
        return Response.json(
          {
            error: `Size "${cleanSize}": Total stock quantity must be a non-negative integer.`,
          },
          { status: 400 }
        );
      }

      // Check divisibility rule
      if (totalStock > 0 && totalStock % normalizedColors.length !== 0) {
        return Response.json(
          {
            error: `Size "${cleanSize}": Total stock quantity (${totalStock}) cannot be distributed evenly across ${normalizedColors.length} selected colors (${normalizedColors.join(
              ", "
            )}). Each color must receive an equal integer share.`,
          },
          { status: 400 }
        );
      }

      const stockPerColor = totalStock === 0 ? 0 : totalStock / normalizedColors.length;
      const skuPrefix = cfg.sku && typeof cfg.sku === "string" ? cfg.sku.trim() : "";

      for (const color of normalizedColors) {
        const comboKey = `${cleanSize.toLowerCase()}:::${color.toLowerCase()}`;
        if (seenCombos.has(comboKey)) {
          return Response.json(
            {
              error: `Duplicate variant detected for size "${cleanSize}" and color "${color}". Each combination must be unique.`,
            },
            { status: 400 }
          );
        }
        seenCombos.add(comboKey);

        let finalSku: string | null = null;
        if (skuPrefix) {
          const colorCode = color.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase() || "VAR";
          const sizeCode = cleanSize.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
          if (sizeCode && skuPrefix.toUpperCase().endsWith(`-${sizeCode}`)) {
            finalSku = `${skuPrefix}-${colorCode}`;
          } else {
            finalSku = `${skuPrefix}-${sizeCode}-${colorCode}`;
          }
        }

        finalVariants.push({
          size: cleanSize,
          color,
          sku: finalSku,
          stock_quantity: stockPerColor,
          is_available: cfg.is_available ?? (stockPerColor > 0),
        });
      }
    }
  } else if (Array.isArray(variants)) {
    // Fallback: Validate legacy/direct variants array
    const seenCombinations = new Set<string>();
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      if (!v.size || typeof v.size !== "string" || v.size.trim() === "") {
        return Response.json(
          { error: `Variant #${i + 1}: Size is required.` },
          { status: 400 }
        );
      }
      if (!v.color || typeof v.color !== "string" || v.color.trim() === "") {
        return Response.json(
          { error: `Variant #${i + 1}: Color is required.` },
          { status: 400 }
        );
      }
      const comboKey = `${v.size.trim().toLowerCase()}:::${v.color.trim().toLowerCase()}`;
      if (seenCombinations.has(comboKey)) {
        return Response.json(
          {
            error: `Duplicate variant detected for size "${v.size.trim()}" and color "${v.color.trim()}". Each combination must be unique.`,
          },
          { status: 400 }
        );
      }
      seenCombinations.add(comboKey);

      const qty = Number(v.stock_quantity);
      if (isNaN(qty) || qty < 0 || !Number.isInteger(qty)) {
        return Response.json(
          {
            error: `Variant #${i + 1} (${v.size}/${v.color}): Stock quantity must be a non-negative integer.`,
          },
          { status: 400 }
        );
      }
      finalVariants.push(v);
    }
  } else {
    return Response.json({ error: "Variants or size_configs must be provided." }, { status: 400 });
  }

  // Validate Images
  if (!Array.isArray(images)) {
    return Response.json({ error: "Images must be an array." }, { status: 400 });
  }

  let primaryCount = 0;
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (
      !img.storage_path ||
      typeof img.storage_path !== "string" ||
      !img.storage_path.startsWith("products/") ||
      img.storage_path.includes("..")
    ) {
      return Response.json(
        { error: `Image #${i + 1}: Invalid storage_path.` },
        { status: 400 }
      );
    }
    if (img.is_primary) {
      primaryCount++;
    }
  }

  if (images.length > 0 && primaryCount > 1) {
    return Response.json(
      { error: "Only one image may be marked as primary." },
      { status: 400 }
    );
  }

  // Initialize Admin client for privileged write operations
  const adminClient = createSupabaseAdminClient();

  // 4. Step A: Automatically resolve unique available slug (e.g. jeans -> jeans-2 -> jeans-3)
  let candidateSlug: string;
  try {
    candidateSlug = await resolveUniqueSlug(cleanSlug, adminClient);
  } catch (slugErr: unknown) {
    const msg = slugErr instanceof Error ? slugErr.message : "Error resolving unique slug.";
    return Response.json({ error: msg }, { status: 400 });
  }

  // Insert with retry loop to safely handle race conditions and unique-constraint conflicts
  let productData: Product | null = null;
  let productError: { message: string; code?: string } | null = null;
  const MAX_SLUG_RETRIES = 10;

  for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
    const insertRes = await adminClient
      .from("products")
      .insert({
        name: cleanName,
        slug: candidateSlug,
        description: cleanDescription,
        department: normalizedDept,
        category: cleanCategory,
        price: numPrice,
        sale_price: numSalePrice,
        discount_percent: numDiscountPercent,
        fabric: cleanFabric,
        fit: cleanFit,
        status,
        is_featured: cleanIsFeatured,
      })
      .select()
      .single();

    if (!insertRes.error && insertRes.data) {
      productData = insertRes.data as Product;
      productError = null;
      break;
    }

    // Check if error is unique constraint violation on slug
    const isSlugConflict =
      insertRes.error?.code === "23505" ||
      insertRes.error?.message?.includes("products_slug_key") ||
      insertRes.error?.message?.includes("slug");

    if (isSlugConflict) {
      // Re-query database to find the next available candidate suffix
      try {
        candidateSlug = await resolveUniqueSlug(cleanSlug, adminClient);
        continue;
      } catch {
        productError = insertRes.error;
        break;
      }
    } else {
      productError = insertRes.error;
      break;
    }
  }

  if (productError || !productData) {
    console.error("[create-product] Failed to insert product:", productError);
    return Response.json(
      { error: `Database error creating product: ${productError?.message || "Unknown error"}` },
      { status: 500 }
    );
  }

  const savedProduct = productData as Product;
  const productId = savedProduct.id;

  // 5. Step B: Insert Variants (if any)
  let savedVariants: ProductVariant[] = [];
  if (finalVariants.length > 0) {
    const variantRows = finalVariants.map((v) => ({
      product_id: productId,
      size: v.size.trim(),
      color: v.color.trim(),
      sku: v.sku && typeof v.sku === "string" && v.sku.trim() !== "" ? v.sku.trim() : null,
      stock_quantity: Math.max(0, Math.floor(Number(v.stock_quantity) || 0)),
      is_available: Boolean(v.is_available),
    }));

    const { data: variantData, error: variantError } = await adminClient
      .from("product_variants")
      .insert(variantRows)
      .select();

    if (variantError || !variantData) {
      console.error(`[create-product] Failed inserting variants for product ${productId}. Rolling back product:`, variantError);
      // Rollback: delete product record
      await adminClient.from("products").delete().eq("id", productId);

      return Response.json(
        { error: `Failed to save product variants: ${variantError?.message || "Unknown error"}` },
        { status: 500 }
      );
    }

    savedVariants = variantData as ProductVariant[];
  }

  // 6. Step C: Insert Image Metadata (if any)
  let savedImages: ProductImage[] = [];
  if (images.length > 0) {
    // Ensure exactly one primary image if images exist
    const hasPrimary = images.some((img) => Boolean(img.is_primary));

    const imageRows = images.map((img, idx) => ({
      product_id: productId,
      storage_path: img.storage_path,
      alt_text:
        img.alt_text && typeof img.alt_text === "string" && img.alt_text.trim() !== ""
          ? img.alt_text.trim()
          : `${cleanName} image ${idx + 1}`,
      display_order: typeof img.display_order === "number" ? img.display_order : idx,
      is_primary: hasPrimary ? Boolean(img.is_primary) : idx === 0,
      color: img.color && typeof img.color === "string" && img.color.trim() !== "" ? img.color.trim() : null,
      mime_type: img.mime_type || null,
      file_size_bytes: img.file_size_bytes ? Number(img.file_size_bytes) : null,
      width: img.width ? Number(img.width) : null,
      height: img.height ? Number(img.height) : null,
    }));

    const { data: imageData, error: imageError } = await adminClient
      .from("product_images")
      .insert(imageRows)
      .select();

    if (imageError || !imageData) {
      console.error(`[create-product] Failed inserting images for product ${productId}. Rolling back product & R2:`, imageError);

      // Rollback: delete product record (cascades variants)
      await adminClient.from("products").delete().eq("id", productId);

      // Rollback: delete uploaded R2 objects to prevent orphans
      const storageKeys = images.map((img) => img.storage_path);
      try {
        await deleteR2Objects(storageKeys);
      } catch (r2Err) {
        console.error(`[create-product] Warning: failed cleaning up R2 objects for product ${productId}:`, r2Err);
      }

      return Response.json(
        { error: `Failed to save product image metadata: ${imageError?.message || "Unknown error"}` },
        { status: 500 }
      );
    }

    savedImages = imageData.map((img) => ({
      ...img,
      proxyUrl: `/api/images/${img.storage_path}`,
    })) as ProductImage[];
  }

  // 7. Invalidate catalogue caches
  try {
    revalidateTag("products", "max");
    revalidatePath(`/shop/${normalizedDept}`);
    revalidatePath("/shop/[department]", "page");
    revalidatePath("/shop");
    revalidatePath(`/product/${savedProduct.slug}`);
    revalidatePath("/");
  } catch (revalErr) {
    console.warn("[create-product] revalidate warning:", revalErr);
  }

  // 8. Success Response
  return Response.json(
    {
      success: true,
      product: savedProduct,
      variants: savedVariants,
      images: savedImages,
    },
    { status: 201 }
  );
}

/**
 * GET /api/admin/products
 *
 * Retrieves all products saved in Supabase (draft, published, archived),
 * along with their image metadata and variants.
 *
 * Security:
 * - Requires verified server-side administrator authorization (Bearer token or cookie).
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
    const { data: products, error } = await adminClient
      .from("products")
      .select("*, product_images(*), product_variants(*)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[admin-products-get] Database query error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    const mapped = (products || []).map((p) => {
      const primaryImage =
        p.product_images?.find((img: { is_primary: boolean }) => img.is_primary) ||
        p.product_images?.[0];

      const proxyUrl = primaryImage?.storage_path
        ? `/api/images/${primaryImage.storage_path}`
        : null;

      return {
        ...p,
        primaryImage: proxyUrl,
        imageCount: p.product_images?.length || 0,
        variantCount: p.product_variants?.length || 0,
        variantsSummary: (p.product_variants || []).map((v: { size: string; color: string; is_available: boolean; stock_quantity: number }) => ({
          size: v.size,
          color: v.color,
          is_available: v.is_available,
          stock_quantity: v.stock_quantity,
        })),
      };
    });

    return Response.json({ success: true, products: mapped });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    console.error("[admin-products-get] Error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}

