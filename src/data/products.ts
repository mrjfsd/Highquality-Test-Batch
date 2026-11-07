// Placeholder product data matching the reference design's schema.
// This is skeleton data — real product data will be fetched from Supabase later.

export type Department = "Women" | "Men" | "Kids";

export type StorefrontVariantOption = {
  id?: string;
  size: string;
  color: string;
  is_available: boolean;
  stock_quantity?: number;
};

export type ProductGalleryImage = {
  id?: string;
  url: string;
  alt?: string;
  is_primary?: boolean;
  display_order?: number;
  color?: string | null;
};

export type Product = {
  id: number | string;
  slug: string;
  department: Department;
  category: string;
  name: string;
  price: number;
  sale?: number;
  image: string;
  images?: ProductGalleryImage[];
  alt: string;
  colors: string[];
  fabric: string;
  fit: string;
  description?: string;
  created_at?: string;
  variants?: StorefrontVariantOption[];
  is_database?: boolean;
  offers?: import("@/types/offers").ProductQuantityOffer[];
};

export const products: Product[] = [];

export const VALID_DEPARTMENTS: Department[] = ["Women", "Men", "Kids"];

export function getProductsByDepartment(department: Department): Product[] {
  return products.filter((p) => p.department === department);
}

export function getProductBySlug(slug: string): Product | undefined {
  const prod = products.find((p) => p.slug === slug);
  if (!prod) return undefined;
  return {
    ...prod,
    images: prod.images || [{ url: prod.image, alt: prod.alt, is_primary: true }],
  };
}

export function getRelatedProducts(product: Product, limit = 3): Product[] {
  return products
    .filter((p) => p.department === product.department && p.id !== product.id)
    .slice(0, limit);
}

export function formatPrice(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}
