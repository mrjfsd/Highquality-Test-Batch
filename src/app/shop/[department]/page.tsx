// Department listing page — /shop/[department]
// Server component. Validates department param; renders DepartmentListingContent (client) for filter state.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Department } from "@/data/products";
import { VALID_DEPARTMENTS } from "@/data/products";
import { fetchPublishedProductsByDepartment } from "@/lib/products/storefront";
import DepartmentListingContent from "@/components/DepartmentListingContent";

// Tells Next.js which department params exist at build time (SSG).
export function generateStaticParams() {
  return VALID_DEPARTMENTS.map((d) => ({ department: d.toLowerCase() }));
}

export const instant = false;

interface Props {
  params: Promise<{ department: string }>;
}

// Normalize param to the typed Department union (e.g. "women" → "Women")
function normalizeParam(raw: string): Department | null {
  const normalized =
    raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  if (VALID_DEPARTMENTS.includes(normalized as Department)) {
    return normalized as Department;
  }
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { department: raw } = await params;
  const dept = normalizeParam(raw);
  if (!dept) {
    return { title: "Department Not Found | Style-Edit" };
  }
  return {
    title: `${dept} | Style-Edit`,
    description: `Shop the ${dept} collection — modern wardrobe foundations, considered in shape, feel and function.`,
  };
}

export default async function DepartmentPage({ params }: Props) {
  const { department: raw } = await params;
  const department = normalizeParam(raw);

  // Unsupported departments render Next.js 404
  if (!department) {
    notFound();
  }

  const departmentProducts = await fetchPublishedProductsByDepartment(department);

  return (
    <main className="collection-page">
      <h1 className="sr-only">{department} Collection</h1>

      {/* Main Collection Layout: 30% Filter Sidebar + 70% Product Area */}
      <DepartmentListingContent
        key={department}
        department={department}
        products={departmentProducts}
      />
    </main>
  );
}
