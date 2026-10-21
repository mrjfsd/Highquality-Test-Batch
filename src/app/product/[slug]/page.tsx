// Product detail page — /product/[slug]
// Server component. Fetches product from placeholder data by slug.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { products, getProductBySlug, getRelatedProducts, formatPrice } from "@/data/products";
import ProductCard from "@/components/ProductCard";
import ProductSelectors from "@/components/ProductSelectors";
import SectionHeading from "@/components/SectionHeading";

// Generate static params for all placeholder products at build time
export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
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
  const product = getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const related = getRelatedProducts(product, 3);
  const displayPrice = product.sale ?? product.price;

  return (
    <main className="detail">
      {/* Breadcrumb */}
      <nav className="breadcrumb detail-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/shop/${product.department.toLowerCase()}`}>
          {product.department}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      {/* Main detail layout: gallery + product info panel */}
      <div className="detail-layout">
        {/* Image gallery */}
        <div className="gallery" aria-label="Product images">
          <div className="gallery-main">
            <span className="image-counter" aria-label="Image 1 of 3">
              1 / 3
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.image} alt={product.alt} />
          </div>
          <div className="gallery-secondary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image}
              alt={`${product.name}, alternate crop`}
              loading="lazy"
            />
            <div className="detail-placeholder" aria-hidden="true">
              <span>DETAIL VIEW</span>
              <div className="stitch-line" />
            </div>
          </div>
        </div>

        {/* Sticky product info sidebar */}
        <aside className="product-info">
          <span className="eyebrow">
            {product.department.toUpperCase()} /{" "}
            {product.category.toUpperCase()}
          </span>
          <h1>{product.name}</h1>

          <div className="detail-price">
            {product.sale && (
              <span className="old-price">{formatPrice(product.price)}</span>
            )}{" "}
            {formatPrice(displayPrice)}{" "}
            <small>MRP incl. taxes</small>
          </div>

          <p className="product-description">
            An understated everyday piece with thoughtful proportions and an
            easy, versatile feel. Designed to wear on repeat.
          </p>

          {/* Interactive color/size selectors + Add to Bag (client component) */}
          <ProductSelectors product={product} />
        </aside>
      </div>

      {/* Related products */}
      {related.length > 0 && (
        <section className="related" aria-label="Related products">
          <SectionHeading
            eyebrow={`MORE FROM ${product.department.toUpperCase()}`}
            title="You may also like"
          />
          <div className="product-grid product-grid--related">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
