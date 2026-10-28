// Placeholder product data matching the reference design's schema.
// This is skeleton data — real product data will be fetched from Supabase later.

export type Department = "Women" | "Men" | "Kids";

export type StorefrontVariantOption = {
  id?: string;
  size: string;
  color: string;
  is_available: boolean;
};

export type ProductGalleryImage = {
  id?: string;
  url: string;
  alt?: string;
  is_primary?: boolean;
  display_order?: number;
  color?: string | null;
};

export type Product = {
  id: number | string;
  slug: string;
  department: Department;
  category: string;
  name: string;
  price: number;
  sale?: number;
  image: string;
  images?: ProductGalleryImage[];
  alt: string;
  colors: string[];
  fabric: string;
  fit: string;
  description?: string;
  created_at?: string;
  variants?: StorefrontVariantOption[];
  is_database?: boolean;
};

const photos = {
  blazer:
    "https://images.unsplash.com/photo-1613915617430-8ab0fd7c6baf?auto=format&fit=crop&w=1200&q=80",
  silhouette:
    "https://images.unsplash.com/photo-1603189343302-e603f7add05a?auto=format&fit=crop&w=1200&q=80",
  trench:
    "https://images.unsplash.com/photo-1601762603339-fd61e28b698a?auto=format&fit=crop&w=1200&q=80",
  dress:
    "https://images.unsplash.com/photo-1664076458686-3449062080ac?auto=format&fit=crop&w=1200&q=80",
  whiteDress:
    "https://images.unsplash.com/photo-1659522761084-79196b64abe4?auto=format&fit=crop&w=1200&q=80",
  seated:
    "https://images.unsplash.com/photo-1629511565591-a1d494ad6c58?auto=format&fit=crop&w=1200&q=80",
  duo: "https://images.unsplash.com/flagged/photo-1570733117311-d990c3816c47?auto=format&fit=crop&w=1200&q=80",
  suit: "https://images.unsplash.com/photo-1673610178158-1c4c5b7e4d98?auto=format&fit=crop&w=1200&q=80",
  boy: "https://images.unsplash.com/photo-1759313560190-d160c3567170?auto=format&fit=crop&w=1200&q=80",
  girl: "https://images.unsplash.com/photo-1759313560250-3bb4bc1d10bc?auto=format&fit=crop&w=1200&q=80",
};

export const products: Product[] = [
  {
    id: 1,
    slug: "relaxed-linen-blazer",
    department: "Women",
    category: "Jackets",
    name: "Relaxed Linen Blazer",
    price: 4490,
    sale: 3790,
    image: photos.blazer,
    alt: "Model wearing a relaxed neutral blazer",
    colors: ["#343434", "#c2b8a8", "#e7e3dc"],
    fabric: "Linen-cotton blend",
    fit: "Relaxed, true to size",
  },
  {
    id: 2,
    slug: "column-midi-dress",
    department: "Women",
    category: "Dresses",
    name: "Column Midi Dress",
    price: 3290,
    image: photos.dress,
    alt: "Model wearing a simple column dress",
    colors: ["#262626", "#827c74"],
    fabric: "Viscose twill",
    fit: "Close fit",
  },
  {
    id: 3,
    slug: "soft-drape-dress",
    department: "Women",
    category: "Dresses",
    name: "Soft Drape Dress",
    price: 3890,
    image: photos.whiteDress,
    alt: "Model wearing a white drape dress",
    colors: ["#ece9e2", "#5f625e"],
    fabric: "Textured cotton",
    fit: "Easy fit",
  },
  {
    id: 4,
    slug: "longline-trench",
    department: "Women",
    category: "Jackets",
    name: "Longline Trench",
    price: 5990,
    sale: 4990,
    image: photos.trench,
    alt: "Model wearing a grey trench coat",
    colors: ["#8c8983", "#232323"],
    fabric: "Cotton gabardine",
    fit: "Oversized",
  },
  {
    id: 5,
    slug: "studio-overshirt",
    department: "Men",
    category: "Jackets",
    name: "Studio Overshirt",
    price: 3490,
    image: photos.silhouette,
    alt: "Model wearing a wide sleeved dark jacket",
    colors: ["#222222", "#b3aa9d"],
    fabric: "Heavy cotton canvas",
    fit: "Boxy fit",
  },
  {
    id: 6,
    slug: "everyday-oxford-shirt",
    department: "Men",
    category: "Shirts",
    name: "Everyday Oxford Shirt",
    price: 2290,
    image: photos.duo,
    alt: "White relaxed shirts in a studio",
    colors: ["#e9e9e7", "#a5adb4"],
    fabric: "Organic cotton",
    fit: "Regular fit",
  },
  {
    id: 7,
    slug: "heavyweight-crew-tee",
    department: "Men",
    category: "T-shirts",
    name: "Heavyweight Crew Tee",
    price: 1490,
    image: photos.seated,
    alt: "Model in a neutral studio outfit",
    colors: ["#202020", "#e7e3da"],
    fabric: "240 GSM cotton",
    fit: "Relaxed fit",
  },
  {
    id: 8,
    slug: "pleated-easy-trouser",
    department: "Men",
    category: "Trousers",
    name: "Pleated Easy Trouser",
    price: 2890,
    image: photos.suit,
    alt: "Model wearing a white tailored suit",
    colors: ["#d9d6cf", "#252525"],
    fabric: "Cotton twill",
    fit: "Tapered fit",
  },
  {
    id: 9,
    slug: "play-all-day-tee",
    department: "Kids",
    category: "T-shirts",
    name: "Play All Day Tee",
    price: 990,
    image: photos.boy,
    alt: "Child in a casual studio outfit",
    colors: ["#d5cda7", "#50616c"],
    fabric: "Soft jersey cotton",
    fit: "Comfort fit",
  },
  {
    id: 10,
    slug: "weekend-star-dress",
    department: "Kids",
    category: "Dresses",
    name: "Weekend Star Dress",
    price: 1790,
    image: photos.girl,
    alt: "Child wearing a patterned dress",
    colors: ["#c6b7a7", "#6c6c72"],
    fabric: "Cotton poplin",
    fit: "Easy fit",
  },
  {
    id: 11,
    slug: "mini-utility-jacket",
    department: "Kids",
    category: "Jackets",
    name: "Mini Utility Jacket",
    price: 2490,
    image: photos.blazer,
    alt: "Neutral utility-style jacket",
    colors: ["#a49b8b", "#39423d"],
    fabric: "Washed cotton",
    fit: "Relaxed fit",
  },
  {
    id: 12,
    slug: "everyday-pull-on-pant",
    department: "Kids",
    category: "Trousers",
    name: "Everyday Pull-on Pant",
    price: 1390,
    image: photos.suit,
    alt: "Neutral pull-on trousers",
    colors: ["#c8c2b6", "#444a4b"],
    fabric: "Cotton twill",
    fit: "Roomy fit",
  },
  {
    id: "dummy-prod-women-1",
    slug: "dummy-women-tailored-blazer",
    department: "Women",
    category: "Jackets",
    name: "Oatmeal Tailored Wool Blazer",
    price: 5490,
    image: "/assets/dummy-products/women/women-blazer-front.jpg",
    images: [
      {
        id: "img-w-0",
        url: "/assets/dummy-products/women/women-blazer-front.jpg",
        alt: "Oatmeal tailored wool blazer front view",
        is_primary: true,
        display_order: 0,
      },
      {
        id: "img-w-1",
        url: "/assets/dummy-products/women/women-blazer-back.jpg",
        alt: "Oatmeal tailored wool blazer back view",
        is_primary: false,
        display_order: 1,
      },
      {
        id: "img-w-2",
        url: "/assets/dummy-products/women/women-blazer-side.jpg",
        alt: "Oatmeal tailored wool blazer side profile",
        is_primary: false,
        display_order: 2,
      },
      {
        id: "img-w-3",
        url: "/assets/dummy-products/women/women-blazer-detail.jpg",
        alt: "Oatmeal tailored wool blazer fabric and lapel detail",
        is_primary: false,
        display_order: 3,
      },
    ],
    alt: "Oatmeal tailored wool blazer front view",
    colors: ["#d6d0c4", "#2c2b29"],
    fabric: "100% Virgin Wool",
    fit: "Oversized tailored fit",
    description: "Architecturally tailored blazer crafted from premium virgin wool with structured shoulders and horn buttons.",
    variants: [
      { id: "var-w-1", size: "XS", color: "#d6d0c4", is_available: true },
      { id: "var-w-2", size: "S", color: "#d6d0c4", is_available: true },
      { id: "var-w-3", size: "M", color: "#d6d0c4", is_available: true },
      { id: "var-w-4", size: "L", color: "#d6d0c4", is_available: true },
    ],
  },
  {
    id: "dummy-prod-men-1",
    slug: "dummy-men-merino-crewneck",
    department: "Men",
    category: "Knitwear",
    name: "Charcoal Ribbed Merino Crewneck",
    price: 4890,
    image: "/assets/dummy-products/men/men-knit-front.jpg",
    images: [
      {
        id: "img-m-0",
        url: "/assets/dummy-products/men/men-knit-front.jpg",
        alt: "Charcoal ribbed merino crewneck front view",
        is_primary: true,
        display_order: 0,
      },
      {
        id: "img-m-1",
        url: "/assets/dummy-products/men/men-knit-back.jpg",
        alt: "Charcoal ribbed merino crewneck back view",
        is_primary: false,
        display_order: 1,
      },
      {
        id: "img-m-2",
        url: "/assets/dummy-products/men/men-knit-side.jpg",
        alt: "Charcoal ribbed merino crewneck side profile",
        is_primary: false,
        display_order: 2,
      },
      {
        id: "img-m-3",
        url: "/assets/dummy-products/men/men-knit-detail.jpg",
        alt: "Charcoal ribbed merino crewneck knit texture detail",
        is_primary: false,
        display_order: 3,
      },
    ],
    alt: "Charcoal ribbed merino crewneck front view",
    colors: ["#37393b", "#1a1a1c"],
    fabric: "100% Extra-Fine Merino Wool",
    fit: "Regular relaxed fit",
    description: "Luxurious 7-gauge ribbed knit sweater spun from pure Australian merino wool with seamless shoulder construction.",
    variants: [
      { id: "var-m-1", size: "S", color: "#37393b", is_available: true },
      { id: "var-m-2", size: "M", color: "#37393b", is_available: true },
      { id: "var-m-3", size: "L", color: "#37393b", is_available: true },
      { id: "var-m-4", size: "XL", color: "#37393b", is_available: true },
    ],
  },
  {
    id: "dummy-prod-kids-1",
    slug: "dummy-kids-quilted-jacket",
    department: "Kids",
    category: "Jackets",
    name: "Ochre Quilted Cotton Jacket",
    price: 3290,
    image: "/assets/dummy-products/kids/kids-jacket-front.jpg",
    images: [
      {
        id: "img-k-0",
        url: "/assets/dummy-products/kids/kids-jacket-front.jpg",
        alt: "Ochre quilted cotton jacket front view",
        is_primary: true,
        display_order: 0,
      },
      {
        id: "img-k-1",
        url: "/assets/dummy-products/kids/kids-jacket-back.jpg",
        alt: "Ochre quilted cotton jacket back view",
        is_primary: false,
        display_order: 1,
      },
      {
        id: "img-k-2",
        url: "/assets/dummy-products/kids/kids-jacket-side.jpg",
        alt: "Ochre quilted cotton jacket side profile",
        is_primary: false,
        display_order: 2,
      },
      {
        id: "img-k-3",
        url: "/assets/dummy-products/kids/kids-jacket-detail.jpg",
        alt: "Ochre quilted cotton jacket stitching detail",
        is_primary: false,
        display_order: 3,
      },
    ],
    alt: "Ochre quilted cotton jacket front view",
    colors: ["#c98939", "#3b4737"],
    fabric: "100% Organic Quilted Cotton",
    fit: "Comfortable boxy fit",
    description: "Lightweight diamond-quilted seasonal jacket with soft contrast binding and durable snap closures.",
    variants: [
      { id: "var-k-1", size: "3-4Y", color: "#c98939", is_available: true },
      { id: "var-k-2", size: "5-6Y", color: "#c98939", is_available: true },
      { id: "var-k-3", size: "7-8Y", color: "#c98939", is_available: true },
      { id: "var-k-4", size: "9-10Y", color: "#c98939", is_available: true },
    ],
  },
];

export const VALID_DEPARTMENTS: Department[] = ["Women", "Men", "Kids"];

export function getProductsByDepartment(department: Department): Product[] {
  return products.filter((p) => p.department === department);
}

export function getProductBySlug(slug: string): Product | undefined {
  const prod = products.find((p) => p.slug === slug);
  if (!prod) return undefined;
  return {
    ...prod,
    images: prod.images || [{ url: prod.image, alt: prod.alt, is_primary: true }],
  };
}

export function getRelatedProducts(product: Product, limit = 3): Product[] {
  return products
    .filter((p) => p.department === product.department && p.id !== product.id)
    .slice(0, limit);
}

export function formatPrice(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}
