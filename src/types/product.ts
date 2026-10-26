/**
 * Core product record schema matching public.products table
 */
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  department: "men" | "women" | "kids" | "Men" | "Women" | "Kids";
  category: string;
  price: number;
  sale_price: number | null;
  discount_percent?: number | null;
  fabric: string | null;
  fit: string | null;
  status: "draft" | "published" | "archived";
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Product variant record matching public.product_variants table
 */
export interface ProductVariant {
  id: string;
  product_id: string;
  size: string;
  color: string;
  sku: string | null;
  stock_quantity: number;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Product image asset reference matching public.product_images table.
 *
 * storage_path is the full R2 object key (e.g. "products/<uuid>/timestamp-uuid.jpg").
 * Images are stored in a private Cloudflare R2 bucket — never in a public bucket.
 * Access is provided through the server-side /api/images/[...key] proxy which
 * generates a time-limited presigned GET URL.
 */
export interface ProductImage {
  id: string;
  product_id: string;
  storage_path: string; // R2 object key (e.g. products/<product_id>/<uuid>.jpg)
  alt_text: string | null;
  display_order: number;
  is_primary: boolean;
  color: string | null;
  mime_type: string | null;         // MIME type stored at upload time
  file_size_bytes: number | null;   // File size in bytes
  width: number | null;             // Image width in pixels (optional)
  height: number | null;            // Image height in pixels (optional)
  /**
   * Resolved at runtime by calling /api/images/<storage_path>.
   * This is NOT persisted in the database — it is a derived, time-limited URL.
   * Never store this value in the database.
   */
  proxyUrl?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Composite product entity with its variants and image assets
 */
export interface ProductComplete extends Product {
  variants: ProductVariant[];
  images: ProductImage[];
}
