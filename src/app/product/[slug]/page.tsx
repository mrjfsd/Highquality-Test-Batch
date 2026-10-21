// Product detail page — /product/[slug]
// Server component. Fetches product from placeholder data by slug.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Dosis } from "next/font/google";
import { products, getProductBySlug, getRelatedProducts, formatPrice } from "@/data/products";
import ProductCard from "@/components/ProductCard";
import ProductSelectors from "@/components/ProductSelectors";
import SectionHeading from "@/components/SectionHeading";
import Icon from "@/components/Icon";

const dosis = Dosis({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-dosis",
});

export const instant = false;

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

  const baseRelated = getRelatedProducts(product, 4);
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
        >
          <span className="back-arrow" aria-hidden="true">
            <Icon name="arrow" size={14} />
          </span>
          <span>Back</span>
        </Link>

        <nav className="breadcrumb detail-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/shop/${product.department.toLowerCase()}`}>
            {product.department}
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{product.name}</span>
        </nav>
      </div>

      {/* Main detail layout: Left Imagery + Right Product Info */}
      <div className="detail-layout">
        {/* Left Column — Primary Product Imagery */}
        <section className="product-imagery" aria-label="Product image">
          <div className="imagery-frame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image}
              alt={product.alt || product.name}
              className="imagery-main-img"
            />
          </div>
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
            An understated everyday piece with thoughtful proportions and an
            easy, versatile feel. Designed to wear on repeat.
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
