// Product detail page — /product/[slug]
// Server component. Fetches product from placeholder data by slug.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Dosis } from "next/font/google";
import { products, formatPrice } from "@/data/products";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { fetchProductBySlug, fetchRelatedProducts } from "@/lib/products/storefront";
import ProductCard from "@/components/ProductCard";
import ProductGallery from "@/components/ProductGallery";
import ProductSelectors from "@/components/ProductSelectors";
import SectionHeading from "@/components/SectionHeading";
import Icon from "@/components/Icon";

const dosis = Dosis({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-dosis",
});

// Generate static params for all published products and catalogue items at build time
export async function generateStaticParams() {
  const mockSlugs = products.map((p) => ({ slug: p.slug }));
  try {
    const supabase = createSupabaseAdminClient();
    const { data: dbProducts } = await supabase
      .from("products")
      .select("slug")
      .eq("status", "published");

    if (dbProducts && Array.isArray(dbProducts)) {
      const slugSet = new Set(mockSlugs.map((s) => s.slug));
      const dbSlugs = dbProducts
        .filter((p) => p.slug && !slugSet.has(p.slug))
        .map((p) => ({ slug: p.slug }));
      return [...mockSlugs, ...dbSlugs];
    }
  } catch (err) {
    console.warn("[generateStaticParams] Could not fetch published database slugs at build time:", err);
  }
  return mockSlugs;
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);
  if (!product) {
    return { title: "Product Not Found | Style-Edit" };
  }
  return {
    title: `${product.name} | Style-Edit`,
    description: `${product.name} — ${product.fabric}, ${product.fit}. Shop the ${product.department} collection at Style-Edit.`,
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const baseRelated = await fetchRelatedProducts(product, 4);
  const related: typeof baseRelated = [...baseRelated];
  if (related.length > 0) {
    while (related.length < 4) {
      related.push(baseRelated[related.length % baseRelated.length]);
    }
  }
  const displayRelated = related.slice(0, 4);

  return (
    <main className={`detail ${dosis.className} ${dosis.variable}`}>
      {/* Top navigation bar: Back button + Breadcrumb */}
      <div className="detail-top-nav">
        <Link
          href={`/shop/${product.department.toLowerCase()}`}
          className="back-btn-pill"
          aria-label={`Back to ${product.department} collection`}
          prefetch={true}
        >
          <span className="back-arrow" aria-hidden="true">
            <Icon name="arrow" size={14} />
          </span>
          <span>Back</span>
        </Link>

        <nav className="breadcrumb detail-breadcrumb" aria-label="Breadcrumb">
          <Link href="/" prefetch={true}>Home</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/shop/${product.department.toLowerCase()}`} prefetch={true}>
            {product.department}
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{product.name}</span>
        </nav>
      </div>

      {/* Main detail layout: Left Imagery + Right Product Info */}
      <div className="detail-layout">
        {/* Left Column — Product Imagery with Swipe Gallery */}
        <section className="product-imagery" aria-label="Product imagery">
          <ProductGallery
            images={product.images}
            fallbackImage={product.image}
            productName={product.name}
          />
        </section>

        {/* Right Column — Information, Selectors & Purchase Actions */}
        <aside className="product-info">
          <span className="eyebrow product-category-label">
            {product.department.toUpperCase()} / {product.category.toUpperCase()}
          </span>

          <h1 className="product-title">{product.name}</h1>

          {/* Single product price — no secondary offer pricing, crossed-out price, or tax labels */}
          <div className="detail-price">
            <span className="current-price">{formatPrice(product.price)}</span>
          </div>

          <hr className="detail-divider" />

          <p className="product-description">
            {product.description ||
              "An understated everyday piece with thoughtful proportions and an easy, versatile feel. Designed to wear on repeat."}
          </p>

          {/* Interactive color/size selectors + Quantity + Add to Cart / Buy it now */}
          <ProductSelectors product={product} />
        </aside>
      </div>

      {/* Related products */}
      {displayRelated.length > 0 && (
        <section className="related" aria-label="Related products">
          <SectionHeading
            eyebrow={`MORE FROM ${product.department.toUpperCase()}`}
            title="You may also like"
          />
          <div className="product-grid product-grid--related">
            {displayRelated.map((item, index) => (
              <ProductCard key={`${item.id}-${index}`} product={item} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
