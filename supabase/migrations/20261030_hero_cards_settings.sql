-- ==============================================================================
-- Style-Edit: Supabase PostgreSQL Schema Migration - Hero Cards Configuration
-- ==============================================================================
-- Seeds the initial 7 homepage hero cards in public.site_settings.
-- Safe, idempotent, non-destructive migration.
-- ==============================================================================

INSERT INTO public.site_settings (key, value)
VALUES (
    'hero_cards',
    '[
      {"id": "hero-0", "title": "Fleece Zip Jacket", "category": "Style Edit Capsule", "image": "/assets/floating-garment-mobile.webp", "alt": "Style Edit floating fleece zip jacket showcase", "displayOrder": 0},
      {"id": "hero-1", "title": "Graphic Camera Tee", "category": "Everyday Edit", "image": "/assets/floating-tshirt-mobile.webp", "alt": "Floating charcoal graphic camera t-shirt", "displayOrder": 1},
      {"id": "hero-2", "title": "Textured Knitwear", "category": "Men''s Edit", "image": "/assets/dummy-products/men/men-knit-front.jpg", "alt": "Textured charcoal everyday knitwear", "displayOrder": 2},
      {"id": "hero-3", "title": "Casual Outerwear", "category": "Outerwear Capsule", "image": "/assets/dummy-products/kids/kids-jacket-front.jpg", "alt": "Casual structured mustard outerwear jacket", "displayOrder": 3},
      {"id": "hero-4", "title": "Tailored Linen Blazer", "category": "Women''s Edit", "image": "/assets/dummy-products/women/women-blazer-front.jpg", "alt": "Tailored relaxed linen blazer in stone", "displayOrder": 4},
      {"id": "hero-5", "title": "Minimalist Ribbed Knit", "category": "Men''s Edit", "image": "/assets/dummy-products/men/men-knit-side.jpg", "alt": "Minimalist ribbed knitwear profile view", "displayOrder": 5},
      {"id": "hero-6", "title": "Quilted Jacket", "category": "Outerwear Capsule", "image": "/assets/dummy-products/kids/kids-jacket-side.jpg", "alt": "Quilted mustard jacket profile view", "displayOrder": 6}
    ]'::jsonb
)
ON CONFLICT (key) DO NOTHING;
