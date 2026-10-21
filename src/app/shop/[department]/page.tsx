// Department listing page — /shop/[department]
// Server component. Validates department param; renders DepartmentListingContent (client) for filter state.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import type { Department } from "@/data/products";
import {
  VALID_DEPARTMENTS,
  getProductsByDepartment,
} from "@/data/products";
import DepartmentListingContent from "@/components/DepartmentListingContent";

// Tells Next.js which department params exist at build time (SSG).
// New params beyond this list will still be rendered on-demand (ISR).
export function generateStaticParams() {
  return VALID_DEPARTMENTS.map((d) => ({ department: d.toLowerCase() }));
}

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

  const departmentProducts = getProductsByDepartment(department);

  return (
    <main className="listing">
      {/* Breadcrumb */}
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{department}</span>
      </nav>

      {/* Department header */}
      <header className="listing-header">
        <span className="eyebrow">
          DEPARTMENT / {department.toUpperCase()}
        </span>
        <h1>{department}</h1>
        <p>
          Modern wardrobe foundations—considered in shape, feel and function.
        </p>
      </header>

      {/* Interactive category bar + product grid — client component */}
      <DepartmentListingContent
        department={department}
        products={departmentProducts}
      />
    </main>
  );
}
