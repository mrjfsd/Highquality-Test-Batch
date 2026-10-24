import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyAdminServer } from "@/lib/supabase/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { deleteR2Objects } from "@/lib/r2/operations";
import { normalizeSlug, resolveUniqueSlug } from "@/lib/products/slug";
import type { Product, ProductVariant, ProductImage } from "@/types/product";

interface VariantInput {
  id?: string;
  size: string;
  color: string;
  sku?: string | null;
  stock_quantity?: number;
  qty?: number | string;
  is_available?: boolean;
}

interface ImageInput {
  id?: string;
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

interface UpdateProductRequestBody {
  name?: string;
  slug?: string;
  description?: string | null;
  department?: string;
  category?: string;
  price?: number;
  sale_price?: number | null;
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

/**
 * Resolves a product identifier (UUID or slug) into the canonical database product record.
 */
async function resolveProduct(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  rawId: string
) {
  const cleanId = rawId.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

  let query = adminClient
    .from("products")
    .select("*, product_variants(*), product_images(*)");

  if (isUuid) {
    query = query.eq("id", cleanId);
  } else {
    query = query.eq("slug", cleanId);
  }

  return query.maybeSingle();
}

/**
 * GET /api/admin/products/[id]
 *
 * Retrieves a single product with all its associated variants and images.
 *
 * Security & Integrity:
 * - Requires verified server-side administrator authorization (Bearer token or cookie).
 * - Accepts either product UUID or slug.
 * - Sorts images by display_order ascending.
 * - Enriches each image with the derived proxyUrl for R2 access.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id: rawId } = await params;
  if (!rawId || rawId.trim() === "") {
    return Response.json({ error: "Product identifier is required." }, { status: 400 });
  }

  const adminClient = createSupabaseAdminClient();
  const { data: product, error } = await resolveProduct(adminClient, rawId);

  if (error) {
    console.error(`[get-product] Database query error for "${rawId}":`, error.message);
    return Response.json(
      { error: `Database error querying product: ${error.message}` },
      { status: 500 }
    );
  }

  if (!product) {
    return Response.json({ error: "Product not found." }, { status: 404 });
  }

  // Sort images by display_order ascending and enrich with proxyUrl
  const sortedImages = (product.product_images || [])
    .slice()
    .sort((a: { display_order?: number }, b: { display_order?: number }) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((img: ProductImage) => ({
      ...img,
      proxyUrl: `/api/images/${img.storage_path}`,
    }));

  // Sort variants by size and color
  const sortedVariants = (product.product_variants || [])
    .slice()
    .sort((a: { size: string; color: string }, b: { size: string; color: string }) =>
      a.size.localeCompare(b.size) || a.color.localeCompare(b.color)
    );

  const productPayload = {
    ...product,
    images: sortedImages,
    product_images: sortedImages,
    variants: sortedVariants,
    product_variants: sortedVariants,
  };

  return Response.json({
    success: true,
    product: productPayload,
    images: sortedImages,
    product_images: sortedImages,
    variants: sortedVariants,
    product_variants: sortedVariants,
  });
}

/**
 * PUT /api/admin/products/[id]
 * PATCH /api/admin/products/[id]
 *
 * Updates an existing product record, its variants, and its image metadata.
 *
 * Security & Integrity Protections:
 * 1. Admin-only verification server-side.
 * 2. Validates product existence; resolves canonical UUID.
 * 3. Server-side validation of all fields, prices, and allowed departments/statuses.
 * 4. Slug uniqueness checking: prevents duplicate slugs across different products.
 * 5. Foreign entity isolation: strictly verifies that any provided variant IDs and image IDs
 *    belong to THIS product, rejecting unauthorized foreign modifications.
 * 6. Single primary-image enforcement.
 * 7. Path revalidation for storefront and admin catalogue.
 */
export async function PUT(
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

  const { id: rawId } = await params;
  if (!rawId || rawId.trim() === "") {
    return Response.json({ error: "Product identifier is required." }, { status: 400 });
  }

  const adminClient = createSupabaseAdminClient();

  // 2. Confirm product exists and retrieve current state
  const { data: currentProduct, error: fetchError } = await resolveProduct(adminClient, rawId);
  if (fetchError) {
    return Response.json(
      { error: `Database error querying product: ${fetchError.message}` },
      { status: 500 }
    );
  }

  if (!currentProduct) {
    return Response.json({ error: "Product not found." }, { status: 404 });
  }

  const targetProductId = currentProduct.id as string;

  // 3. Parse request body
  let body: UpdateProductRequestBody;
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
    fabric,
    fit,
    status,
    is_featured,
    size_configs,
    variants,
    images,
  } = body;

  const productUpdates: Record<string, unknown> = {};

  // Validate Name
  if (name !== undefined) {
    if (typeof name !== "string" || name.trim() === "") {
      return Response.json({ error: "Product name cannot be empty." }, { status: 400 });
    }
    productUpdates.name = name.trim();
  }

  // Validate Department
  if (department !== undefined) {
    if (typeof department !== "string") {
      return Response.json({ error: "Department must be a string." }, { status: 400 });
    }
    const normalizedDept = department.trim().toLowerCase();
    if (!VALID_DEPARTMENTS.has(normalizedDept)) {
      return Response.json(
        { error: `Invalid department "${department}". Must be men, women, or kids.` },
        { status: 400 }
      );
    }
    productUpdates.department = normalizedDept;
  }

  // Validate Category
  if (category !== undefined) {
    if (typeof category !== "string" || category.trim() === "") {
      return Response.json({ error: "Category cannot be empty." }, { status: 400 });
    }
    productUpdates.category = category.trim();
  }

  // Validate Price
  const effectivePrice = price !== undefined ? Number(price) : Number(currentProduct.price);
  if (price !== undefined) {
    if (isNaN(effectivePrice) || effectivePrice < 0) {
      return Response.json({ error: "Price must be a non-negative number." }, { status: 400 });
    }
    productUpdates.price = effectivePrice;
  }

  // Validate Sale Price
  if (sale_price !== undefined) {
    if (sale_price === null || sale_price === 0) {
      productUpdates.sale_price = null;
    } else {
      const numSalePrice = Number(sale_price);
      if (isNaN(numSalePrice) || numSalePrice < 0) {
        return Response.json({ error: "Sale price must be a non-negative number." }, { status: 400 });
      }
      if (numSalePrice > effectivePrice) {
        return Response.json(
          { error: `Sale price (₹${numSalePrice}) cannot be greater than regular price (₹${effectivePrice}).` },
          { status: 400 }
        );
      }
      productUpdates.sale_price = numSalePrice;
    }
  }

  // Validate Description, Fabric, Fit
  if (description !== undefined) productUpdates.description = description ? String(description).trim() : null;
  if (fabric !== undefined) productUpdates.fabric = fabric ? String(fabric).trim() : null;
  if (fit !== undefined) productUpdates.fit = fit ? String(fit).trim() : null;

  // Validate Status (trim and lowercase)
  if (status !== undefined) {
    if (typeof status !== "string") {
      return Response.json({ error: "Status must be a string." }, { status: 400 });
    }
    const normalizedStatus = status.trim().toLowerCase();
    if (!VALID_STATUSES.has(normalizedStatus)) {
      return Response.json(
        { error: `Invalid status "${status}". Must be draft, published, or archived.` },
        { status: 400 }
      );
    }
    productUpdates.status = normalizedStatus;
  }

  // Validate is_featured
  if (is_featured !== undefined) {
    productUpdates.is_featured = Boolean(is_featured);
  }

  // Handle Slug Update & Uniqueness
  const candidateSlugInput = slug || (name && name.trim() !== currentProduct.name ? name : undefined);
  if (candidateSlugInput) {
    const normalizedCandidate = normalizeSlug(candidateSlugInput);
    if (!normalizedCandidate) {
      return Response.json({ error: "Provided slug is invalid." }, { status: 400 });
    }

    if (normalizedCandidate !== currentProduct.slug) {
      // Check if candidate slug is already claimed by ANOTHER product
      const { data: slugConflict } = await adminClient
        .from("products")
        .select("id")
        .eq("slug", normalizedCandidate)
        .neq("id", targetProductId)
        .maybeSingle();

      if (slugConflict) {
        // Resolve unique slug with numeric suffix
        try {
          productUpdates.slug = await resolveUniqueSlug(normalizedCandidate, adminClient);
        } catch (slugErr: unknown) {
          const msg = slugErr instanceof Error ? slugErr.message : "Slug resolution error.";
          return Response.json({ error: msg }, { status: 400 });
        }
      } else {
        productUpdates.slug = normalizedCandidate;
      }
    }
  }

  // Execute Product row update if there are field updates
  productUpdates.updated_at = new Date().toISOString();
  let updatedProductRecord = currentProduct;

  const { data: updatedData, error: updateProdError } = await adminClient
    .from("products")
    .update(productUpdates)
    .eq("id", targetProductId)
    .select()
    .single();

  if (updateProdError) {
    console.error(`[update-product] Failed updating product ${targetProductId}:`, updateProdError.message);
    return Response.json(
      { error: `Database error updating product: ${updateProdError.message}` },
      { status: 500 }
    );
  }

  updatedProductRecord = updatedData as Product;

  // 4. Update Variants (if provided)
  let updatedVariants = currentProduct.product_variants || [];

  if (size_configs !== undefined || variants !== undefined) {
    const finalVariants: Array<{
      id?: string;
      size: string;
      color: string;
      sku: string | null;
      stock_quantity: number;
      is_available: boolean;
    }> = [];

    if (Array.isArray(size_configs)) {
      const seenCombos = new Set<string>();
      for (const cfg of size_configs) {
        if (!cfg.size || typeof cfg.size !== "string" || cfg.size.trim() === "") {
          return Response.json({ error: "Size configuration missing size name." }, { status: 400 });
        }
        const cleanSize = cfg.size.trim();

        if (!Array.isArray(cfg.colors) || cfg.colors.length === 0) {
          return Response.json(
            { error: `Size "${cleanSize}": At least one color must be selected.` },
            { status: 400 }
          );
        }

        const normalizedColors: string[] = [];
        const seenColors = new Set<string>();
        for (const rawCol of cfg.colors) {
          if (!rawCol || typeof rawCol !== "string" || rawCol.trim() === "") continue;
          const norm = rawCol
            .trim()
            .split(/\s+/)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(" ");
          const lower = norm.toLowerCase();
          if (!seenColors.has(lower)) {
            seenColors.add(lower);
            normalizedColors.push(norm);
          }
        }

        const totalStock = Math.max(0, Math.floor(Number(cfg.total_stock) || 0));
        const stockPerColor = normalizedColors.length > 0 && totalStock > 0
          ? Math.floor(totalStock / normalizedColors.length)
          : 0;

        const skuPrefix = cfg.sku && typeof cfg.sku === "string" ? cfg.sku.trim() : "";

        for (const color of normalizedColors) {
          const comboKey = `${cleanSize.toLowerCase()}:::${color.toLowerCase()}`;
          if (seenCombos.has(comboKey)) {
            return Response.json(
              { error: `Duplicate variant detected for size "${cleanSize}" and color "${color}".` },
              { status: 400 }
            );
          }
          seenCombos.add(comboKey);

          let finalSku: string | null = null;
          if (skuPrefix) {
            const colorCode = color.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase() || "VAR";
            const sizeCode = cleanSize.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
            finalSku = `${skuPrefix}-${sizeCode}-${colorCode}`;
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
      const seenCombinations = new Set<string>();
      const existingVariantIds = new Set(
        (currentProduct.product_variants || []).map((v: { id: string }) => v.id)
      );

      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        if (!v.size || typeof v.size !== "string" || v.size.trim() === "") {
          return Response.json({ error: `Variant #${i + 1}: Size is required.` }, { status: 400 });
        }
        if (!v.color || typeof v.color !== "string" || v.color.trim() === "") {
          return Response.json({ error: `Variant #${i + 1}: Color is required.` }, { status: 400 });
        }

        // Security check: foreign variant ID prevention
        if (v.id && !existingVariantIds.has(v.id)) {
          return Response.json(
            { error: `Variant ID "${v.id}" does not belong to this product.` },
            { status: 400 }
          );
        }

        const comboKey = `${v.size.trim().toLowerCase()}:::${v.color.trim().toLowerCase()}`;
        if (seenCombinations.has(comboKey)) {
          return Response.json(
            { error: `Duplicate variant detected for size "${v.size.trim()}" and color "${v.color.trim()}".` },
            { status: 400 }
          );
        }
        seenCombinations.add(comboKey);

        const rawQty = v.stock_quantity !== undefined ? v.stock_quantity : v.qty;
        const qty = Number(rawQty);
        if (
          rawQty === undefined ||
          rawQty === null ||
          isNaN(qty) ||
          qty < 0 ||
          !Number.isInteger(qty) ||
          !isFinite(qty)
        ) {
          return Response.json(
            { error: `Variant #${i + 1} (${v.size}/${v.color}): Stock quantity must be a non-negative integer.` },
            { status: 400 }
          );
        }

        finalVariants.push({
          id: v.id,
          size: v.size.trim(),
          color: v.color.trim(),
          sku: v.sku && typeof v.sku === "string" && v.sku.trim() !== "" ? v.sku.trim() : null,
          stock_quantity: qty,
          is_available: v.is_available ?? (qty > 0),
        });
      }
    }

    // Safe non-destructive variant reconciliation:
    // 1. Separate into updates (records with existing id) and inserts (new records).
    // 2. Perform all inserts and updates FIRST so no existing data is deleted if a write fails.
    // 3. Delete only obsolete rows whose IDs were omitted from the update payload.
    if (finalVariants.length === 0) {
      if ((currentProduct.product_variants || []).length > 0) {
        const { error: delAllVarError } = await adminClient
          .from("product_variants")
          .delete()
          .eq("product_id", targetProductId);

        if (delAllVarError) {
          console.error(`[update-product] Error deleting variants for product ${targetProductId}:`, delAllVarError.message);
          return Response.json(
            { error: `Failed to remove product variants: ${delAllVarError.message}` },
            { status: 500 }
          );
        }
      }
      updatedVariants = [];
    } else {
      const existingComboToIdMap = new Map<string, string>(
        (currentProduct.product_variants || []).map((v: { id: string; size: string; color: string }) => [
          `${v.size.trim().toLowerCase()}:::${v.color.trim().toLowerCase()}`,
          v.id,
        ])
      );

      const variantsToUpdate: Array<{
        id: string;
        size: string;
        color: string;
        sku: string | null;
        stock_quantity: number;
        is_available: boolean;
      }> = [];

      const variantsToInsert: Array<{
        size: string;
        color: string;
        sku: string | null;
        stock_quantity: number;
        is_available: boolean;
      }> = [];

      for (const v of finalVariants) {
        const matchedId = v.id || existingComboToIdMap.get(`${v.size.toLowerCase()}:::${v.color.toLowerCase()}`);
        if (matchedId) {
          variantsToUpdate.push({ ...v, id: matchedId });
        } else {
          variantsToInsert.push(v);
        }
      }

      const writtenVariants: ProductVariant[] = [];

      // Step 1: Perform new variant inserts first
      if (variantsToInsert.length > 0) {
        const insertRows = variantsToInsert.map((v) => ({
          product_id: targetProductId,
          size: v.size,
          color: v.color,
          sku: v.sku,
          stock_quantity: v.stock_quantity,
          is_available: v.is_available,
        }));

        const { data: insertedData, error: insertError } = await adminClient
          .from("product_variants")
          .insert(insertRows)
          .select();

        if (insertError) {
          console.error(`[update-product] Error inserting variants for product ${targetProductId}:`, insertError.message);
          return Response.json(
            { error: `Failed to update product variants: ${insertError.message}` },
            { status: 500 }
          );
        }
        if (insertedData) {
          writtenVariants.push(...(insertedData as ProductVariant[]));
        }
      }

      // Step 2: Perform updates on existing rows
      for (const v of variantsToUpdate) {
        const { data: updatedData, error: updateError } = await adminClient
          .from("product_variants")
          .update({
            size: v.size,
            color: v.color,
            sku: v.sku,
            stock_quantity: v.stock_quantity,
            is_available: v.is_available,
            updated_at: new Date().toISOString(),
          })
          .eq("id", v.id)
          .eq("product_id", targetProductId)
          .select()
          .single();

        if (updateError) {
          console.error(`[update-product] Error updating variant ${v.id} for product ${targetProductId}:`, updateError.message);
          return Response.json(
            { error: `Failed to update product variant: ${updateError.message}` },
            { status: 500 }
          );
        }
        if (updatedData) {
          writtenVariants.push(updatedData as ProductVariant);
        }
      }

      // Step 3: Delete only obsolete rows
      const writtenVariantIds = new Set(writtenVariants.map((v) => v.id));
      const obsoleteVariantIds = (currentProduct.product_variants || [])
        .map((v: { id: string }) => v.id)
        .filter((id: string) => !writtenVariantIds.has(id));

      if (obsoleteVariantIds.length > 0) {
        const { error: delObsoleteError } = await adminClient
          .from("product_variants")
          .delete()
          .in("id", obsoleteVariantIds)
          .eq("product_id", targetProductId);

        if (delObsoleteError) {
          console.warn(`[update-product] Warning: failed cleaning up obsolete variants for product ${targetProductId}:`, delObsoleteError.message);
        }
      }

      updatedVariants = writtenVariants;
    }
  }

  // 5. Update Images (if provided)
  let updatedImages = currentProduct.product_images || [];

  if (Array.isArray(images)) {
    const existingImageIds = new Set(
      (currentProduct.product_images || []).map((img: { id: string }) => img.id)
    );

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

      // Security check: foreign image ID prevention
      if (img.id && !existingImageIds.has(img.id)) {
        return Response.json(
          { error: `Image ID "${img.id}" does not belong to this product.` },
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

    const hasExplicitPrimary = primaryCount === 1;

    // Safe non-destructive image reconciliation:
    // 1. Separate into updates and inserts.
    // 2. Perform all inserts and updates FIRST so no existing metadata is lost if a write fails.
    // 3. Delete only obsolete image metadata records whose IDs are not in the payload (NO R2 deletion).
    if (images.length === 0) {
      if ((currentProduct.product_images || []).length > 0) {
        const { error: delAllImgError } = await adminClient
          .from("product_images")
          .delete()
          .eq("product_id", targetProductId);

        if (delAllImgError) {
          console.error(`[update-product] Error deleting images for product ${targetProductId}:`, delAllImgError.message);
          return Response.json(
            { error: `Failed to remove product images: ${delAllImgError.message}` },
            { status: 500 }
          );
        }
      }
      updatedImages = [];
    } else {
      const existingStoragePathToIdMap = new Map<string, string>(
        (currentProduct.product_images || []).map((img: { id: string; storage_path: string }) => [
          img.storage_path,
          img.id,
        ])
      );

      const imagesToUpdate: Array<{
        id: string;
        storage_path: string;
        alt_text: string;
        display_order: number;
        is_primary: boolean;
        color: string | null;
        mime_type: string | null;
        file_size_bytes: number | null;
        width: number | null;
        height: number | null;
      }> = [];

      const imagesToInsert: Array<{
        storage_path: string;
        alt_text: string;
        display_order: number;
        is_primary: boolean;
        color: string | null;
        mime_type: string | null;
        file_size_bytes: number | null;
        width: number | null;
        height: number | null;
      }> = [];

      for (let idx = 0; idx < images.length; idx++) {
        const img = images[idx];
        const matchedId = img.id || existingStoragePathToIdMap.get(img.storage_path);
        const rowData = {
          storage_path: img.storage_path,
          alt_text:
            img.alt_text && typeof img.alt_text === "string" && img.alt_text.trim() !== ""
              ? img.alt_text.trim()
              : `${updatedProductRecord.name} image ${idx + 1}`,
          display_order: typeof img.display_order === "number" ? img.display_order : idx,
          is_primary: hasExplicitPrimary ? Boolean(img.is_primary) : idx === 0,
          color: img.color && typeof img.color === "string" && img.color.trim() !== "" ? img.color.trim() : null,
          mime_type: img.mime_type || null,
          file_size_bytes: img.file_size_bytes ? Number(img.file_size_bytes) : null,
          width: img.width ? Number(img.width) : null,
          height: img.height ? Number(img.height) : null,
        };

        if (matchedId) {
          imagesToUpdate.push({ ...rowData, id: matchedId });
        } else {
          imagesToInsert.push(rowData);
        }
      }

      const writtenImages: ProductImage[] = [];

      // Step 1: Perform new image inserts first
      if (imagesToInsert.length > 0) {
        const insertRows = imagesToInsert.map((img) => ({
          product_id: targetProductId,
          ...img,
        }));

        const { data: insertedData, error: insertError } = await adminClient
          .from("product_images")
          .insert(insertRows)
          .select();

        if (insertError) {
          console.error(`[update-product] Error inserting images for product ${targetProductId}:`, insertError.message);
          return Response.json(
            { error: `Failed to save product image metadata: ${insertError.message}` },
            { status: 500 }
          );
        }
        if (insertedData) {
          writtenImages.push(...(insertedData as ProductImage[]));
        }
      }

      // Step 2: Perform updates on existing image rows
      for (const img of imagesToUpdate) {
        const { data: updatedData, error: updateError } = await adminClient
          .from("product_images")
          .update({
            storage_path: img.storage_path,
            alt_text: img.alt_text,
            display_order: img.display_order,
            is_primary: img.is_primary,
            color: img.color,
            mime_type: img.mime_type,
            file_size_bytes: img.file_size_bytes,
            width: img.width,
            height: img.height,
            updated_at: new Date().toISOString(),
          })
          .eq("id", img.id)
          .eq("product_id", targetProductId)
          .select()
          .single();

        if (updateError) {
          console.error(`[update-product] Error updating image ${img.id} for product ${targetProductId}:`, updateError.message);
          return Response.json(
            { error: `Failed to update image metadata: ${updateError.message}` },
            { status: 500 }
          );
        }
        if (updatedData) {
          writtenImages.push(updatedData as ProductImage);
        }
      }

      // Step 3: Delete only obsolete images from metadata table (NO R2 deletion)
      const writtenImageIds = new Set(writtenImages.map((img) => img.id));
      const obsoleteImageIds = (currentProduct.product_images || [])
        .map((img: { id: string }) => img.id)
        .filter((id: string) => !writtenImageIds.has(id));

      if (obsoleteImageIds.length > 0) {
        const { error: delObsoleteError } = await adminClient
          .from("product_images")
          .delete()
          .in("id", obsoleteImageIds)
          .eq("product_id", targetProductId);

        if (delObsoleteError) {
          console.warn(`[update-product] Warning: failed cleaning up obsolete image records for product ${targetProductId}:`, delObsoleteError.message);
        }
      }

      // Sort by display_order ascending and enrich with proxyUrl
      updatedImages = writtenImages
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .map((img) => ({
          ...img,
          proxyUrl: `/api/images/${img.storage_path}`,
        }));
    }
  }

  // 6. Invalidate storefront and catalogue caches
  try {
    revalidatePath("/admin/products");
    revalidatePath("/shop");
    if (updatedProductRecord.department) {
      revalidatePath(`/shop/${updatedProductRecord.department.toLowerCase()}`);
    }
    if (updatedProductRecord.slug) {
      revalidatePath(`/product/${updatedProductRecord.slug}`);
    }
    if (currentProduct.slug && currentProduct.slug !== updatedProductRecord.slug) {
      revalidatePath(`/product/${currentProduct.slug}`);
    }
  } catch (revalErr) {
    console.warn("[update-product] revalidatePath warning:", revalErr);
  }

  const finalProductPayload = {
    ...updatedProductRecord,
    images: updatedImages,
    product_images: updatedImages,
    variants: updatedVariants,
    product_variants: updatedVariants,
  };

  // 7. Success response
  return Response.json({
    success: true,
    product: finalProductPayload,
    variants: updatedVariants,
    product_variants: updatedVariants,
    images: updatedImages,
    product_images: updatedImages,
  });
}

/**
 * PATCH /api/admin/products/[id]
 * Delegates to PUT handler to support both HTTP verbs cleanly.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PUT(request, context);
}

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

  const { id: rawId } = await params;
  if (!rawId || rawId.trim() === "") {
    return Response.json({ error: "Product identifier parameter is required." }, { status: 400 });
  }

  const adminClient = createSupabaseAdminClient();

  // 2. Confirm product exists
  const { data: product, error: fetchProductError } = await resolveProduct(adminClient, rawId);

  if (fetchProductError) {
    return Response.json(
      { error: `Database error querying product: ${fetchProductError.message}` },
      { status: 500 }
    );
  }

  if (!product) {
    return Response.json({ error: "Product not found." }, { status: 404 });
  }

  const productId = product.id as string;

  // 3. Fetch image storage paths belonging to this product
  const storageKeys = (product.product_images || [])
    .map((img: { storage_path?: string }) => img.storage_path)
    .filter((path: unknown): path is string => typeof path === "string" && path.length > 0);

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
      revalidatePath(`/shop/${String(product.department).toLowerCase()}`);
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
