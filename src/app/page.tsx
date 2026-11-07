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
import HeroMotion from "@/components/HeroMotion";
import {
  getPromoBannerConfig,
  PromoBannerConfig,
  getHeroCardsConfig,
  getHomepageFavouritesConfig,
  getHomepageFormPerspectiveConfig,
} from "@/lib/settings/site-settings";
import type {
  HeroCardConfigItem,
  HomepageFavouriteItem,
  HomepageFormPerspectiveItem,
} from "@/types/homepage-images";

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
  men: "https://plus.unsplash.com/premium_photo-1727942420153-8573424d2a83?q=80&w=735&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
  women: "https://images.unsplash.com/photo-1673610178158-1c4c5b7e4d98?q=80&w=627&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
  kids: "https://images.unsplash.com/photo-1758851552775-7353c60e4906?auto=format&fit=crop&w=900&q=86",
  productOne: "https://images.unsplash.com/photo-1676165303734-5c2b9dd394af?auto=format&fit=crop&w=800&q=85",
  productTwo: "https://plus.unsplash.com/premium_photo-1671656349240-c2dac4acfc2d?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D?auto=format&fit=crop&w=800&q=85",
  productThree: "https://plus.unsplash.com/premium_photo-1786947409407-c695bb4e5ef6?q=80&w=715&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D?auto=format&fit=crop&w=800&q=85",
  productFour: "https://images.unsplash.com/photo-1706823934334-9fec8177bb4f?auto=format&fit=crop&w=800&q=85",
  editorial: "https://images.unsplash.com/photo-1697659991852-d700e2fd4098?auto=format&fit=crop&w=1400&q=88",
  essentials: "/assets/storefront-banner.jpg",
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
    href: "/shop/women",
  },
  {
    name: "Everyday Oversized Shirt",
    price: "₹1,299",
    image: images.productTwo,
    alt: "Woman wearing an oversized white shirt",
    href: "/shop/women",
  },
  {
    name: "Classic Straight-Fit Trousers",
    price: "₹1,499",
    image: images.productThree,
    alt: "Woman wearing straight-fit jeans and a black jacket",
    href: "/shop/women",
  },
  {
    name: "Essential Casual Sweatshirt",
    price: "₹1,199",
    image: images.productFour,
    alt: "Model in an understated casual top",
    href: "/shop/women",
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
  const optimizedSrc = getOptimizedImageUrl(src, 800, 82);

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
const HERO_SCROLL_ID = "hero-scroll-outer";

function HeroBanner({
  isBannerActive = true,
  heroCards,
}: {
  isBannerActive?: boolean;
  heroCards?: HeroCardConfigItem[];
}) {
  return (
    <div id={HERO_SCROLL_ID} className="hero-scroll-outer" aria-label="Hero scroll section">
      <div className="hero-scroll-sticky">
        <section className="hero" aria-labelledby="hero-title">
          <HeroMotion />
          <div className="hero-overlay" />
          <div className="hero-content">
            <h1 id="hero-title" className="hero-fade-1 hero-motion-h1">Your Style. Your Edit.</h1>

            {/* Interactive Seven-Card Circular Fan Carousel */}
            <HeroGarmentFan
              isBannerActive={isBannerActive}
              cards={heroCards}
              scrollContainerId={HERO_SCROLL_ID}
            />

            <p className="hero-fade-2 hero-motion-sub hero-description">
              Everyday style, thoughtfully chosen.
            </p>

            {/* Refined editorial hero buttons with sophisticated solid/outline pairing */}
            <div className="hero-actions hero-fade-4 hero-motion-btns">
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
      </div>
    </div>
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
  product: {
    image: string;
    alt: string;
  };
  index?: number;
}) {
  return (
    <article className={`favourite-card reveal-item stagger-${(index % 4) + 1}`}>
      <div className="product-image-wrap">
        <SmartImage
          src={product.image}
          alt={product.alt}
          className="product-image"
          sizes={RESPONSIVE_SIZES.favouriteCard}
          width={320}
          height={416}
        />
      </div>
    </article>
  );
}

function FeaturedProducts({ favourites }: { favourites?: HomepageFavouriteItem[] }) {
  const products = sampleProducts.map((sp, idx) => {
    const fav = favourites && favourites[idx] ? favourites[idx] : null;
    return {
      image: fav?.image || sp.image,
      alt: fav?.alt || sp.alt,
    };
  });

  return (
    <section className="section favourites" id="favourites">
      <SectionHeading
        eyebrow="STYLE-EDIT PICKS"
        title="The Current Favourites"
        description="Pieces worth making room for."
      />
      <div className="product-grid">
        {products.map((product, index) => (
          <HomeProductCard product={product} index={index} key={index} />
        ))}
      </div>
    </section>
  );
}

/* ── Section 6: Editorial Scroll Showcase (2-Pair Scroll Transition) ── */
function EditorialScrollShowcase({ items }: { items?: HomepageFormPerspectiveItem[] }) {
  const imgSilhouette = items?.[0]?.image || "/assets/dummy-products/women/women-blazer-front.jpg";
  const altSilhouette = items?.[0]?.alt || "Relaxed Linen Silhouette in natural stone";

  const imgTexture = items?.[1]?.image || "/assets/dummy-products/men/men-knit-front.jpg";
  const altTexture = items?.[1]?.alt || "Textured Everyday Knitwear in charcoal black";

  const imgProfile = items?.[2]?.image || "/assets/dummy-products/women/women-blazer-side.jpg";
  const altProfile = items?.[2]?.alt || "Relaxed Linen Blazer profile line";

  const imgCraft = items?.[3]?.image || "/assets/dummy-products/men/men-knit-detail.jpg";
  const altCraft = items?.[3]?.alt || "Considered Knitwear tactile rib detail";

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
          </div>

          <div className="editorial-stage">
            {/* Pair 1: Base Front Silhouette */}
            <div className="editorial-pair editorial-pair--base" aria-hidden="false">
              <div className="editorial-card">
                <div className="editorial-image-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgSilhouette}
                    alt={altSilhouette}
                    className="editorial-image"
                    loading="lazy"
                    decoding="async"
                    width={896}
                    height={1200}
                  />
                </div>
              </div>

              <div className="editorial-card">
                <div className="editorial-image-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgTexture}
                    alt={altTexture}
                    className="editorial-image"
                    loading="lazy"
                    decoding="async"
                    width={896}
                    height={1200}
                  />
                </div>
              </div>
            </div>

            {/* Pair 2: Transition / Profile & Craft (rises up as user scrolls) */}
            <div className="editorial-pair editorial-pair--overlay" aria-hidden="false">
              <div className="editorial-card">
                <div className="editorial-image-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgProfile}
                    alt={altProfile}
                    className="editorial-image"
                    loading="lazy"
                    decoding="async"
                    width={896}
                    height={1200}
                  />
                </div>
              </div>

              <div className="editorial-card">
                <div className="editorial-image-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgCraft}
                    alt={altCraft}
                    className="editorial-image"
                    loading="lazy"
                    decoding="async"
                    width={896}
                    height={1200}
                  />
                </div>
              </div>
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
          alt="STYLE EDIT store showcase in Mysuru — Everyday Essentials"
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
  const [banner, heroCards, favourites, formPerspective] = await Promise.all([
    getPromoBannerConfig(),
    getHeroCardsConfig(),
    getHomepageFavouritesConfig(),
    getHomepageFormPerspectiveConfig(),
  ]);
  const isBannerActive = banner ? banner.enabled !== false : true;

  return (
    <main className="site-shell">
      <HomeScrollAnimator />
      <HomePromotionalBanner banner={banner} />
      <HeroBanner isBannerActive={isBannerActive} heroCards={heroCards} />
      <ShopByDepartment />
      <FeaturedProducts favourites={favourites} />
      <EditorialScrollShowcase items={formPerspective} />
      <CuratedCollection />
      <BrandStatement />
    </main>
  );
}
