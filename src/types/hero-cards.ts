export interface HeroCardConfigItem {
  id: string; // "hero-0" ... "hero-6"
  slotIndex: number; // 0 to 6
  title: string;
  category: string;
  image: string; // effective image: customImage || defaultImage
  alt: string;
  defaultImage: string;
  defaultTitle: string;
  defaultCategory: string;
  defaultAlt: string;
  customImage?: string | null;
  customTitle?: string | null;
  customCategory?: string | null;
  customAlt?: string | null;
  storagePath?: string | null;
  isCustom?: boolean;
  displayOrder: number;
  updatedAt?: string;
}

export const DEFAULT_HERO_CARDS: HeroCardConfigItem[] = [
  {
    id: "hero-0",
    slotIndex: 0,
    title: "Fleece Zip Jacket",
    category: "Style Edit Capsule",
    image: "/assets/floating-garment-mobile.webp",
    alt: "Style Edit floating fleece zip jacket showcase",
    defaultImage: "/assets/floating-garment-mobile.webp",
    defaultTitle: "Fleece Zip Jacket",
    defaultCategory: "Style Edit Capsule",
    defaultAlt: "Style Edit floating fleece zip jacket showcase",
    customImage: null,
    isCustom: false,
    displayOrder: 0,
  },
  {
    id: "hero-1",
    slotIndex: 1,
    title: "Graphic Camera Tee",
    category: "Everyday Edit",
    image: "/assets/floating-tshirt-mobile.webp",
    alt: "Floating charcoal graphic camera t-shirt",
    defaultImage: "/assets/floating-tshirt-mobile.webp",
    defaultTitle: "Graphic Camera Tee",
    defaultCategory: "Everyday Edit",
    defaultAlt: "Floating charcoal graphic camera t-shirt",
    customImage: null,
    isCustom: false,
    displayOrder: 1,
  },
  {
    id: "hero-2",
    slotIndex: 2,
    title: "Textured Knitwear",
    category: "Men's Edit",
    image: "/carousal-default-img/cargo.jpg",
    alt: "Style Edit relaxed cargo trousers",
    defaultImage: "/carousal-default-img/cargo.jpg",
    defaultTitle: "Textured Knitwear",
    defaultCategory: "Men's Edit",
    defaultAlt: "Style Edit relaxed cargo trousers",
    customImage: null,
    isCustom: false,
    displayOrder: 2,
  },
  {
    id: "hero-3",
    slotIndex: 3,
    title: "Casual Outerwear",
    category: "Outerwear Capsule",
    image: "/carousal-default-img/puffer.jpg",
    alt: "Casual structured puffer jacket showcase",
    defaultImage: "/carousal-default-img/puffer.jpg",
    defaultTitle: "Casual Outerwear",
    defaultCategory: "Outerwear Capsule",
    defaultAlt: "Casual structured puffer jacket showcase",
    customImage: null,
    isCustom: false,
    displayOrder: 3,
  },
  {
    id: "hero-4",
    slotIndex: 4,
    title: "Tailored Linen Blazer",
    category: "Women's Edit",
    image: "/carousal-default-img/womens-hoodie.jpg",
    alt: "Women's oversized zip hoodie in washed blue",
    defaultImage: "/carousal-default-img/womens-hoodie.jpg",
    defaultTitle: "Tailored Linen Blazer",
    defaultCategory: "Women's Edit",
    defaultAlt: "Women's oversized zip hoodie in washed blue",
    customImage: null,
    isCustom: false,
    displayOrder: 4,
  },
  {
    id: "hero-5",
    slotIndex: 5,
    title: "Minimalist Ribbed Knit",
    category: "Men's Edit",
    image: "/carousal-default-img/floating-hoodie.jpg",
    alt: "Floating heavyweight brown zip hoodie profile view",
    defaultImage: "/carousal-default-img/floating-hoodie.jpg",
    defaultTitle: "Minimalist Ribbed Knit",
    defaultCategory: "Men's Edit",
    defaultAlt: "Floating heavyweight brown zip hoodie profile view",
    customImage: null,
    isCustom: false,
    displayOrder: 5,
  },
  {
    id: "hero-6",
    slotIndex: 6,
    title: "Classic Denim Jeans",
    category: "Everyday Denim",
    image: "/assets/floating-jeans-mobile.webp",
    alt: "Floating classic blue denim jeans showcase",
    defaultImage: "/assets/floating-jeans-mobile.webp",
    defaultTitle: "Classic Denim Jeans",
    defaultCategory: "Everyday Denim",
    defaultAlt: "Floating classic blue denim jeans showcase",
    customImage: null,
    isCustom: false,
    displayOrder: 6,
  },
];
