// Home page — / route
// Server component. All data is static placeholder; real data from Supabase is a future phase.

import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/Icon";
import SectionHeading from "@/components/SectionHeading";
import ProductCard from "@/components/ProductCard";
import { products } from "@/data/products";

export const metadata: Metadata = {
  title: "Style-Edit | Considered Clothing for Everyday Life",
  description:
    "A considered wardrobe of quiet essentials, cut for real life. Shop Women, Men, and Kids.",
};

// Photos from the reference — Unsplash, same URLs
const photos = {
  duo: "https://images.unsplash.com/flagged/photo-1570733117311-d990c3816c47?auto=format&fit=crop&w=1200&q=80",
  trench:
    "https://images.unsplash.com/photo-1601762603339-fd61e28b698a?auto=format&fit=crop&w=1200&q=80",
  silhouette:
    "https://images.unsplash.com/photo-1603189343302-e603f7add05a?auto=format&fit=crop&w=1200&q=80",
  boy: "https://images.unsplash.com/photo-1759313560190-d160c3567170?auto=format&fit=crop&w=1200&q=80",
  seated:
    "https://images.unsplash.com/photo-1629511565591-a1d494ad6c58?auto=format&fit=crop&w=1200&q=80",
};

const departmentCards = [
  {
    slug: "women",
    label: "Women",
    image: photos.trench,
    line: "Refined shapes, easy layers",
  },
  {
    slug: "men",
    label: "Men",
    image: photos.silhouette,
    line: "Modern staples, simply done",
  },
  {
    slug: "kids",
    label: "Kids",
    image: photos.boy,
    line: "Built for every small adventure",
  },
];

const flowSteps = [
  ["01", "Home", "Discover the edit"],
  ["02", "Department", "Browse & filter"],
  ["03", "Product", "Choose options"],
  ["04", "Cart", "Review items"],
  ["05", "WhatsApp", "Send order"],
];

export default function HomePage() {
  // Featured: first 4 products from the placeholder data
  const featured = products.slice(0, 4);

  return (
    <main>
      {/* ── Hero ── */}
      <section className="hero" aria-label="Hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photos.duo} alt="Models in crisp white shirts" />
        <div className="hero-overlay" aria-hidden="true" />
        <div className="hero-copy">
          <span className="eyebrow eyebrow--light">THE EVERYDAY EDIT / 25</span>
          <h1>
            Less noise.
            <br />
            More style.
          </h1>
          <p>A considered wardrobe of quiet essentials, cut for real life.</p>
          <div className="hero-actions">
            <Link href="/shop/women" className="button button--light">
              Shop women
            </Link>
            <Link href="/shop/men" className="button button--light">
              Shop men
            </Link>
          </div>
        </div>
        <div className="hero-index" aria-hidden="true">
          01 <span /> 04
        </div>
      </section>

      {/* ── Featured products ── */}
      <section className="content-section" aria-label="Featured products">
        <SectionHeading
          eyebrow="CURATED FOR NOW"
          title="The quiet essentials"
          actionLabel="View the edit"
          actionHref="/shop/women"
        />
        <div className="product-grid product-grid--featured">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* ── Department cards ── */}
      <section className="department-section" aria-label="Shop by department">
        <SectionHeading eyebrow="FIND YOUR EDIT" title="Shop by department" />
        <div className="department-grid">
          {departmentCards.map((item, i) => (
            <Link
              key={item.slug}
              href={`/shop/${item.slug}`}
              className="department-card"
              aria-label={`Shop ${item.label}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image}
                alt={`${item.label} clothing collection`}
                loading="lazy"
              />
              <span className="department-number">0{i + 1}</span>
              <span className="department-copy">
                <strong>{item.label}</strong>
                <small>{item.line}</small>
                <span className="circle-arrow" aria-hidden="true">
                  <Icon name="arrow" />
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Brand story / editorial section ── */}
      <section className="story-section" aria-label="Our approach">
        <div className="story-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos.seated}
            alt="Relaxed tailoring in a minimal room"
            loading="lazy"
          />
        </div>
        <div className="story-copy">
          <span className="eyebrow">THE STYLE—EDIT APPROACH</span>
          <h2>
            Wear more.
            <br />
            Choose well.
          </h2>
          <p>
            We focus on versatile pieces with considered details—clothes
            designed to work together and live beyond a season.
          </p>
          <span className="text-link">
            Read our approach <Icon name="arrow" />
          </span>
        </div>
      </section>

      {/* ── Customer journey / flow section ── */}
      <section className="flow-section" aria-label="How it works">
        <div className="flow-intro">
          <span className="eyebrow">CUSTOMER JOURNEY</span>
          <h2>
            From first look
            <br />
            to WhatsApp
          </h2>
          <p>
            A simple ordering flow with no account, checkout, or payment
            gateway.
          </p>
        </div>
        <div className="flow-map" role="list">
          {flowSteps.map(([num, label, desc], index) => (
            <div className="flow-step" key={num} role="listitem">
              <span>{num}</span>
              <strong>{label}</strong>
              <small>{desc}</small>
              {index < 4 && <Icon name="chevron" />}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
