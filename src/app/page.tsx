import {
  getOptimizedImageUrl,
  getResponsiveImageSrcSet,
  isUnsplashUrl,
  RESPONSIVE_SIZES,
} from "@/lib/images/responsive";
import type { Metadata } from "next";
import Link from "next/link";
import HomeScrollAnimator from "@/components/HomeScrollAnimator";
import HeroGarmentFan from "@/components/HeroGarmentFan";
import { getPromoBannerConfig, PromoBannerConfig } from "@/lib/settings/site-settings";

export const metadata: Metadata = {
  title: "Style-Edit | Considered Everyday Fashion",
  description:
    "Discover your next favourite look at Style-Edit. Curated everyday fashion for Men, Women, and Kids, chosen in Mysuru.",
};

type ImageProps = {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  sizes?: string;
  priority?: boolean;
  width?: number;
  height?: number;
};

const images = {
  men: "https://images.unsplash.com/photo-1592409039573-5a135408dcc4?auto=format&fit=crop&w=900&q=86",
  women: "https://images.unsplash.com/photo-1590399830217-8db7489f911e?auto=format&fit=crop&w=900&q=86",
  kids: "https://images.unsplash.com/photo-1758851552775-7353c60e4906?auto=format&fit=crop&w=900&q=86",
  productOne: "https://images.unsplash.com/photo-1676165303734-5c2b9dd394af?auto=format&fit=crop&w=800&q=85",
  productTwo: "https://images.unsplash.com/photo-1585685674190-5b11f080af33?auto=format&fit=crop&w=800&q=85",
  productThree: "https://images.unsplash.com/photo-1701844778607-3fe61e2f6e82?auto=format&fit=crop&w=800&q=85",
  productFour: "https://images.unsplash.com/photo-1706823934334-9fec8177bb4f?auto=format&fit=crop&w=800&q=85",
  editorial: "https://images.unsplash.com/photo-1697659991852-d700e2fd4098?auto=format&fit=crop&w=1400&q=88",
  essentials: "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=1800&q=88",
};

const departments = [
  {
    title: "MEN",
    detail: "Everyday essentials",
    image: images.men,
    alt: "Man in a clean casual white T-shirt",
    href: "/shop/men",
  },
  {
    title: "WOMEN",
    detail: "Styles for every mood",
    image: images.women,
    alt: "Woman in a black blazer and relaxed white trousers",
    href: "/shop/women",
  },
  {
    title: "KIDS",
    detail: "Little looks, big style",
    image: images.kids,
    alt: "Young boy in a casual jacket and beanie",
    href: "/shop/kids",
  },
];

const sampleProducts = [
  {
    name: "Relaxed Fit Cotton T-Shirt",
    price: "₹899",
    image: images.productOne,
    alt: "Model wearing a relaxed monochrome outfit",
    href: "/product/heavyweight-crew-tee",
  },
  {
    name: "Everyday Oversized Shirt",
    price: "₹1,299",
    image: images.productTwo,
    alt: "Woman wearing an oversized white shirt",
    href: "/product/studio-overshirt",
  },
  {
    name: "Classic Straight-Fit Trousers",
    price: "₹1,499",
    image: images.productThree,
    alt: "Woman wearing straight-fit jeans and a black jacket",
    href: "/product/pleated-easy-trouser",
  },
  {
    name: "Essential Casual Sweatshirt",
    price: "₹1,199",
    image: images.productFour,
    alt: "Model in an understated casual top",
    href: "/product/everyday-oxford-shirt",
  },
];

function SmartImage({
  src,
  alt,
  className = "",
  loading = "lazy",
  sizes,
  priority = false,
  width,
  height,
}: ImageProps) {
  const isPriority = priority || loading === "eager";
  const srcSet = getResponsiveImageSrcSet(src);
  const optimizedSrc = isUnsplashUrl(src) ? getOptimizedImageUrl(src, 800, 82) : src;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={optimizedSrc}
      srcSet={srcSet}
      sizes={sizes || (srcSet ? RESPONSIVE_SIZES.departmentCard : undefined)}
      alt={alt}
      className={className}
      loading={isPriority ? "eager" : "lazy"}
      fetchPriority={isPriority ? "high" : "auto"}
      decoding="async"
      width={width}
      height={height}
    />
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="15" height="15">
      <path d="M5 12h14M14 7l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TextLink({
  children,
  href = "#",
  className = "",
}: {
  children: React.ReactNode;
  href?: string;
  className?: string;
}) {
  return (
    <Link className={`text-link ${className}`} href={href} prefetch={true}>
      <span>{children}</span>
      <ArrowIcon />
    </Link>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-heading reveal-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action && <div className="section-action">{action}</div>}
    </div>
  );
}

function getBannerResponsiveSources(url: string) {
  if (url.startsWith("/api/images/")) {
    return {
      mobileSrcSet: `${url}?w=640&q=80`,
      desktopSrcSet: `${url}?w=1600&q=82`,
      fallbackSrc: `${url}?w=1600&q=82`,
    };
  }
  if (url === "/assets/image.png" || url === "/assets/image.webp") {
    return {
      mobileSrcSet: "/assets/image-mobile.webp",
      desktopSrcSet: "/assets/image.webp",
      fallbackSrc: "/assets/image.webp",
    };
  }
  return {
    mobileSrcSet: url,
    desktopSrcSet: url,
    fallbackSrc: url,
  };
}

/* ── Section 2: Promotional Banner ── */
function HomePromotionalBanner({ banner }: { banner?: PromoBannerConfig | null }) {
  // If explicitly disabled, remove the entire section from layout with zero margin/height
  if (banner && banner.enabled === false) {
    return null;
  }

  const imageUrl = banner?.imageUrl || "/assets/image.webp";
  const altText = banner?.altText || "Promotional Banner — Click to explore sale pieces";
  const posX = typeof banner?.positionX === "number" ? banner.positionX : 50;
  const posY = typeof banner?.positionY === "number" ? banner.positionY : 46;
  const zoom = typeof banner?.zoom === "number" ? banner.zoom : 1.0;
  const sources = getBannerResponsiveSources(imageUrl);

  return (
    <section className="home-promo-banner" aria-label="Festive Promotion">
      <Link
        href="/sale"
        className="home-promo-banner-link"
        aria-label="Promotional Sale — Shop The Sale Edit"
        prefetch={true}
      >
        <picture>
          <source
            media="(max-width: 640px)"
            srcSet={sources.mobileSrcSet}
            type="image/webp"
          />
          <source
            srcSet={sources.desktopSrcSet}
            type="image/webp"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sources.fallbackSrc}
            alt={altText}
            className="home-promo-banner-image"
            style={{
              objectPosition: `${posX}% ${posY}%`,
              ...(zoom > 1
                ? {
                    transform: `scale(${zoom})`,
                    transformOrigin: `${posX}% ${posY}%`,
                  }
                : {}),
            }}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            width={1600}
            height={200}
          />
        </picture>
      </Link>
    </section>
  );
}

/* ── Section 3: Editorial Hero ── */
function HeroBanner({ isBannerActive = true }: { isBannerActive?: boolean }) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-overlay" />
      <div className="hero-content">
        <h1 id="hero-title" className="hero-fade-1">Your Style. Your Edit.</h1>

        {/* Interactive Six-Card Circular Fan Carousel */}
        <HeroGarmentFan isBannerActive={isBannerActive} />

        <p className="hero-fade-2 hero-description">
          Everyday style, thoughtfully chosen.
        </p>
        
        {/* Refined editorial hero buttons with sophisticated solid/outline pairing */}
        <div className="hero-actions hero-fade-4">
          <Link className="hero-btn hero-btn-primary" href="/shop/women" prefetch={true}>
            <span>Shop Women</span>
            <ArrowIcon />
          </Link>
          <Link className="hero-btn hero-btn-secondary" href="/shop/men" prefetch={true}>
            <span>Shop Men</span>
            <ArrowIcon />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Section 4: Shop by Department ── */
function DepartmentCard({
  title,
  detail,
  image,
  alt,
  href,
  index,
}: (typeof departments)[number] & { index: number }) {
  return (
    <article className={`department-card reveal-item stagger-${index + 1}`}>
      <Link className="department-image-wrap" href={href} aria-label={`Explore ${title}`} prefetch={true}>
        <SmartImage src={image} alt={alt} className="department-image" sizes={RESPONSIVE_SIZES.departmentCard} width={400} height={500} />
        <span className="department-number">0{index + 1}</span>
      </Link>
      <div className="department-meta">
        <div>
          <h3>{title}</h3>
          <p>{detail}</p>
        </div>
        <TextLink href={href} className="department-explore-link">Explore collection</TextLink>
      </div>
    </article>
  );
}

function ShopByDepartment() {
  return (
    <section className="section departments" id="departments">
      <SectionHeading
        eyebrow="CURATED FOR YOU"
        title="Shop by Department"
        description="Find your style, your way."
      />
      <div className="department-grid">
        {departments.map((department, index) => (
          <DepartmentCard key={department.title} {...department} index={index} />
        ))}
      </div>
    </section>
  );
}

/* ── Section 5: The Current Favourites ── */
function HomeProductCard({
  product,
  index = 0,
}: {
  product: (typeof sampleProducts)[number];
  index?: number;
}) {
  return (
    <article className={`product-card reveal-item stagger-${(index % 4) + 1}`}>
      <Link className="product-image-wrap" href={product.href} aria-label={product.name} prefetch={true}>
        <SmartImage src={product.image} alt={product.alt} className="product-image" sizes={RESPONSIVE_SIZES.favouriteCard} width={320} height={416} />
        <span className="product-tag">THE EDIT</span>
      </Link>
      <div className="product-meta">
        <div>
          <h3>{product.name}</h3>
          <p className="sample-label">Illustrative price</p>
        </div>
        <p className="price">{product.price}</p>
      </div>
    </article>
  );
}

function FeaturedProducts() {
  return (
    <section className="section favourites" id="favourites">
      <SectionHeading
        eyebrow="STYLE-EDIT PICKS"
        title="The Current Favourites"
        description="Pieces worth making room for."
        action={<TextLink href="/shop/women">View all</TextLink>}
      />
      <div className="product-grid">
        {sampleProducts.map((product, index) => (
          <HomeProductCard product={product} index={index} key={product.name} />
        ))}
      </div>
    </section>
  );
}

/* ── Section 6: Editorial Scroll Showcase (2-Pair Scroll Transition) ── */
function EditorialScrollShowcase() {
  return (
    <section className="editorial-showcase" id="editorial" aria-label="Editorial Capsule">
      <div className="editorial-scroll-container">
        <div className="editorial-scroll-sticky">
          <div className="editorial-scroll-header">
            <div className="editorial-header-text">
              <p className="eyebrow">THE EVERYDAY EDIT</p>
              <h2>Form & Perspective</h2>
              <p className="editorial-subtitle">
                Two perspectives. Everyday versatility. Scroll to reveal the shift in detail.
              </p>
            </div>
            <div className="editorial-header-action">
              <TextLink href="/shop/women">Explore the Collection</TextLink>
            </div>
          </div>

          <div className="editorial-stage">
            {/* Pair 1: Base Front Silhouette */}
            <div className="editorial-pair editorial-pair--base" aria-hidden="false">
              <Link
                href="/shop/women"
                className="editorial-card"
                aria-label="Women's collection — Relaxed Linen Blazer"
                prefetch={true}
              >
                <div className="editorial-image-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/dummy-products/women/women-blazer-front.jpg"
                    alt="Relaxed Linen Silhouette in natural stone"
                    className="editorial-image"
                    loading="lazy"
                    decoding="async"
                    width={896}
                    height={1200}
                  />
                  <div className="editorial-card-tag">
                    <span className="editorial-tag-num">01</span>
                    <span className="editorial-tag-label">SILHOUETTE</span>
                  </div>
                </div>
                <div className="editorial-card-info">
                  <h4>The Tailored Blazer</h4>
                  <p>Women · Relaxed Cut</p>
                </div>
              </Link>

              <Link
                href="/shop/men"
                className="editorial-card"
                aria-label="Men's collection — Textured Knitwear"
                prefetch={true}
              >
                <div className="editorial-image-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/dummy-products/men/men-knit-front.jpg"
                    alt="Textured Everyday Knitwear in charcoal black"
                    className="editorial-image"
                    loading="lazy"
                    decoding="async"
                    width={896}
                    height={1200}
                  />
                  <div className="editorial-card-tag">
                    <span className="editorial-tag-num">02</span>
                    <span className="editorial-tag-label">TEXTURE</span>
                  </div>
                </div>
                <div className="editorial-card-info">
                  <h4>The Considered Knit</h4>
                  <p>Men · Heavyweight Weave</p>
                </div>
              </Link>
            </div>

            {/* Pair 2: Transition / Profile & Craft (rises up as user scrolls) */}
            <div className="editorial-pair editorial-pair--overlay" aria-hidden="false">
              <Link
                href="/shop/women"
                className="editorial-card"
                aria-label="Women's collection — Blazer Profile View"
                prefetch={true}
              >
                <div className="editorial-image-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/dummy-products/women/women-blazer-side.jpg"
                    alt="Relaxed Linen Blazer profile line"
                    className="editorial-image"
                    loading="lazy"
                    decoding="async"
                    width={896}
                    height={1200}
                  />
                  <div className="editorial-card-tag">
                    <span className="editorial-tag-num">01</span>
                    <span className="editorial-tag-label">PROFILE</span>
                  </div>
                </div>
                <div className="editorial-card-info">
                  <h4>Profile & Line</h4>
                  <p>Structured shoulder drape</p>
                </div>
              </Link>

              <Link
                href="/shop/men"
                className="editorial-card"
                aria-label="Men's collection — Knit Detail View"
                prefetch={true}
              >
                <div className="editorial-image-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/dummy-products/men/men-knit-detail.jpg"
                    alt="Considered Knitwear tactile rib detail"
                    className="editorial-image"
                    loading="lazy"
                    decoding="async"
                    width={896}
                    height={1200}
                  />
                  <div className="editorial-card-tag">
                    <span className="editorial-tag-num">02</span>
                    <span className="editorial-tag-label">CRAFT</span>
                  </div>
                </div>
                <div className="editorial-card-info">
                  <h4>Tactile Depth</h4>
                  <p>Ribbed collar & seam craft</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Section 7: Everyday Essentials Feature ── */
function CuratedCollection() {
  return (
    <section className="section essentials" id="essentials">
      <div className="essentials-banner reveal-item">
        <SmartImage
          src={images.essentials}
          alt="A carefully curated rail of timeless everyday clothing"
          className="essentials-image"
          sizes={RESPONSIVE_SIZES.fullBanner}
          width={1200}
          height={600}
        />
        <div className="essentials-overlay" />
        <div className="essentials-copy reveal-item stagger-1">
          <p className="eyebrow light">A WARDROBE FOUNDATION</p>
          <h2>Everyday Essentials</h2>
          <p>Discover versatile pieces for your everyday wardrobe.</p>
          <TextLink href="/shop/men" className="light-link">
            Explore the edit
          </TextLink>
        </div>
        <p className="essentials-side-note">SELECTED WITH INTENTION</p>
      </div>
    </section>
  );
}

/* ── Section 8: Oversized STYLE EDIT Brand Statement ── */
function BrandStatement() {
  return (
    <section className="brand-statement reveal-item" aria-label="Style Edit brand statement">
      <div className="gold-rule" />
      <div className="brand-statement-top">
        <p>Style that feels like you.</p>
        <span>MYSURU / INDIA</span>
      </div>
      <p className="giant-wordmark">STYLE EDIT</p>
    </section>
  );
}

export default async function HomePage() {
  const banner = await getPromoBannerConfig();
  const isBannerActive = banner ? banner.enabled !== false : true;

  return (
    <main className="site-shell">
      <HomeScrollAnimator />
      <HomePromotionalBanner banner={banner} />
      <HeroBanner isBannerActive={isBannerActive} />
      <ShopByDepartment />
      <FeaturedProducts />
      <EditorialScrollShowcase />
      <CuratedCollection />
      <BrandStatement />
    </main>
  );
}
