import { redirect } from "next/navigation";

/**
 * Route: /admin/products
 *
 * Redirects to the dedicated Product Catalog Management section
 * on the main Admin management portal (/admin#products).
 */
export default function AdminProductsPage() {
  redirect("/admin#products");
}
