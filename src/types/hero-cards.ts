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
    image: "/assets/dummy-products/men/men-knit-front.jpg",
    alt: "Textured charcoal everyday knitwear",
    defaultImage: "/assets/dummy-products/men/men-knit-front.jpg",
    defaultTitle: "Textured Knitwear",
    defaultCategory: "Men's Edit",
    defaultAlt: "Textured charcoal everyday knitwear",
    customImage: null,
    isCustom: false,
    displayOrder: 2,
  },
  {
    id: "hero-3",
    slotIndex: 3,
    title: "Casual Outerwear",
    category: "Outerwear Capsule",
    image: "/assets/dummy-products/kids/kids-jacket-front.jpg",
    alt: "Casual structured mustard outerwear jacket",
    defaultImage: "/assets/dummy-products/kids/kids-jacket-front.jpg",
    defaultTitle: "Casual Outerwear",
    defaultCategory: "Outerwear Capsule",
    defaultAlt: "Casual structured mustard outerwear jacket",
    customImage: null,
    isCustom: false,
    displayOrder: 3,
  },
  {
    id: "hero-4",
    slotIndex: 4,
    title: "Tailored Linen Blazer",
    category: "Women's Edit",
    image: "/assets/dummy-products/women/women-blazer-front.jpg",
    alt: "Tailored relaxed linen blazer in stone",
    defaultImage: "/assets/dummy-products/women/women-blazer-front.jpg",
    defaultTitle: "Tailored Linen Blazer",
    defaultCategory: "Women's Edit",
    defaultAlt: "Tailored relaxed linen blazer in stone",
    customImage: null,
    isCustom: false,
    displayOrder: 4,
  },
  {
    id: "hero-5",
    slotIndex: 5,
    title: "Minimalist Ribbed Knit",
    category: "Men's Edit",
    image: "/assets/dummy-products/men/men-knit-side.jpg",
    alt: "Minimalist ribbed knitwear profile view",
    defaultImage: "/assets/dummy-products/men/men-knit-side.jpg",
    defaultTitle: "Minimalist Ribbed Knit",
    defaultCategory: "Men's Edit",
    defaultAlt: "Minimalist ribbed knitwear profile view",
    customImage: null,
    isCustom: false,
    displayOrder: 5,
  },
  {
    id: "hero-6",
    slotIndex: 6,
    title: "Quilted Jacket",
    category: "Outerwear Capsule",
    image: "/assets/dummy-products/kids/kids-jacket-side.jpg",
    alt: "Quilted mustard jacket profile view",
    defaultImage: "/assets/dummy-products/kids/kids-jacket-side.jpg",
    defaultTitle: "Quilted Jacket",
    defaultCategory: "Outerwear Capsule",
    defaultAlt: "Quilted mustard jacket profile view",
    customImage: null,
    isCustom: false,
    displayOrder: 6,
  },
];
