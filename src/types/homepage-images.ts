export {
  type HeroCardConfigItem,
  DEFAULT_HERO_CARDS,
} from "./hero-cards";

export interface HomepageFavouriteItem {
  id: string; // "fav-0" ... "fav-3"
  slotIndex: number; // 0 to 3
  title: string;
  price: string;
  href: string;
  image: string; // effective image: customImage || defaultImage
  alt: string;
  defaultImage: string;
  defaultAlt: string;
  customImage?: string | null;
  storagePath?: string | null;
  isCustom?: boolean;
  updatedAt?: string;
}

export const DEFAULT_HOMEPAGE_FAVOURITES: HomepageFavouriteItem[] = [
  {
    id: "fav-0",
    slotIndex: 0,
    title: "Relaxed Fit Cotton T-Shirt",
    price: "₹899",
    href: "/shop/women",
    image: "https://images.unsplash.com/photo-1676165303734-5c2b9dd394af?auto=format&fit=crop&w=800&q=85",
    alt: "Model wearing a relaxed monochrome outfit",
    defaultImage: "https://images.unsplash.com/photo-1676165303734-5c2b9dd394af?auto=format&fit=crop&w=800&q=85",
    defaultAlt: "Model wearing a relaxed monochrome outfit",
    customImage: null,
    isCustom: false,
  },
  {
    id: "fav-1",
    slotIndex: 1,
    title: "Everyday Oversized Shirt",
    price: "₹1,299",
    href: "/shop/women",
    image: "https://images.unsplash.com/photo-1585685674190-5b11f080af33?auto=format&fit=crop&w=800&q=85",
    alt: "Woman wearing an oversized white shirt",
    defaultImage: "https://images.unsplash.com/photo-1585685674190-5b11f080af33?auto=format&fit=crop&w=800&q=85",
    defaultAlt: "Woman wearing an oversized white shirt",
    customImage: null,
    isCustom: false,
  },
  {
    id: "fav-2",
    slotIndex: 2,
    title: "Classic Straight-Fit Trousers",
    price: "₹1,499",
    href: "/shop/women",
    image: "https://images.unsplash.com/photo-1701844778607-3fe61e2f6e82?auto=format&fit=crop&w=800&q=85",
    alt: "Woman wearing straight-fit jeans and a black jacket",
    defaultImage: "https://images.unsplash.com/photo-1701844778607-3fe61e2f6e82?auto=format&fit=crop&w=800&q=85",
    defaultAlt: "Woman wearing straight-fit jeans and a black jacket",
    customImage: null,
    isCustom: false,
  },
  {
    id: "fav-3",
    slotIndex: 3,
    title: "Essential Casual Sweatshirt",
    price: "₹1,199",
    href: "/shop/women",
    image: "https://images.unsplash.com/photo-1706823934334-9fec8177bb4f?auto=format&fit=crop&w=800&q=85",
    alt: "Model in an understated casual top",
    defaultImage: "https://images.unsplash.com/photo-1706823934334-9fec8177bb4f?auto=format&fit=crop&w=800&q=85",
    defaultAlt: "Model in an understated casual top",
    customImage: null,
    isCustom: false,
  },
];

export interface HomepageFormPerspectiveItem {
  id: string; // "fp-0" ... "fp-3"
  slotIndex: number; // 0 to 3
  position: "Silhouette" | "Texture" | "Profile" | "Craft";
  title: string;
  subtitle: string;
  tagNum: string;
  tagLabel: string;
  href: string;
  image: string; // effective image: customImage || defaultImage
  alt: string;
  defaultImage: string;
  defaultAlt: string;
  customImage?: string | null;
  storagePath?: string | null;
  isCustom?: boolean;
  updatedAt?: string;
}

export const DEFAULT_HOMEPAGE_FORM_PERSPECTIVE: HomepageFormPerspectiveItem[] = [
  {
    id: "fp-0",
    slotIndex: 0,
    position: "Silhouette",
    title: "The Tailored Blazer",
    subtitle: "Women · Relaxed Cut",
    tagNum: "01",
    tagLabel: "SILHOUETTE",
    href: "/shop/women",
    image: "/assets/dummy-products/women/women-blazer-front.jpg",
    alt: "Relaxed Linen Silhouette in natural stone",
    defaultImage: "/assets/dummy-products/women/women-blazer-front.jpg",
    defaultAlt: "Relaxed Linen Silhouette in natural stone",
    customImage: null,
    isCustom: false,
  },
  {
    id: "fp-1",
    slotIndex: 1,
    position: "Texture",
    title: "The Considered Knit",
    subtitle: "Men · Heavyweight Weave",
    tagNum: "02",
    tagLabel: "TEXTURE",
    href: "/shop/men",
    image: "/assets/dummy-products/men/men-knit-front.jpg",
    alt: "Textured Everyday Knitwear in charcoal black",
    defaultImage: "/assets/dummy-products/men/men-knit-front.jpg",
    defaultAlt: "Textured Everyday Knitwear in charcoal black",
    customImage: null,
    isCustom: false,
  },
  {
    id: "fp-2",
    slotIndex: 2,
    position: "Profile",
    title: "Profile & Line",
    subtitle: "Structured shoulder drape",
    tagNum: "01",
    tagLabel: "PROFILE",
    href: "/shop/women",
    image: "/assets/dummy-products/women/women-blazer-side.jpg",
    alt: "Relaxed Linen Blazer profile line",
    defaultImage: "/assets/dummy-products/women/women-blazer-side.jpg",
    defaultAlt: "Relaxed Linen Blazer profile line",
    customImage: null,
    isCustom: false,
  },
  {
    id: "fp-3",
    slotIndex: 3,
    position: "Craft",
    title: "Tactile Depth",
    subtitle: "Ribbed collar & seam craft",
    tagNum: "02",
    tagLabel: "CRAFT",
    href: "/shop/men",
    image: "/assets/dummy-products/men/men-knit-detail.jpg",
    alt: "Considered Knitwear tactile rib detail",
    defaultImage: "/assets/dummy-products/men/men-knit-detail.jpg",
    defaultAlt: "Considered Knitwear tactile rib detail",
    customImage: null,
    isCustom: false,
  },
];
