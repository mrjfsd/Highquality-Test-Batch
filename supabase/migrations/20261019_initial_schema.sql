-- ==============================================================================
-- Style-Edit: Supabase PostgreSQL Schema & Security Migration
-- ==============================================================================
-- Safe, idempotent, non-destructive migration for Supabase PostgreSQL.
-- Can be rerun safely multiple times without duplicate errors.
--
-- How to apply:
--   1. Open your Supabase Project Dashboard
--   2. Go to SQL Editor -> New Query
--   3. Paste this entire file and click "Run"
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Table: public.app_admins (Administrative Roster)
-- ------------------------------------------------------------------------------
-- Tracks users authorized to access administrative interfaces and perform mutations.
CREATE TABLE IF NOT EXISTS public.app_admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. Helper Function: public.is_admin()
-- ------------------------------------------------------------------------------
-- SECURITY DEFINER function to prevent infinite RLS recursion on public.app_admins.
-- Checks both:
--   1. JWT app_metadata -> role = 'admin' (tamper-proof claims)
--   2. Explicit record in public.app_admins
-- Executes with owner privileges, safely bypassing RLS when checking membership.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()
    ),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. RLS Policies: public.app_admins
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins and self can view admin roster" ON public.app_admins;
DROP POLICY IF EXISTS "Admins can view admin roster" ON public.app_admins;
CREATE POLICY "Admins and self can view admin roster"
    ON public.app_admins
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id OR public.is_admin()
    );

DROP POLICY IF EXISTS "Admins can manage admin roster" ON public.app_admins;
CREATE POLICY "Admins can manage admin roster"
    ON public.app_admins
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 4. Table: public.products
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    sale_price NUMERIC(10, 2) CHECK (sale_price IS NULL OR (sale_price >= 0 AND sale_price <= price)),
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Backwards compatibility: add columns if table already existed
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10, 2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Indexes for storefront queries, pagination, and slug lookups
CREATE INDEX IF NOT EXISTS idx_products_status_created_at
    ON public.products (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_category
    ON public.products (category);

CREATE INDEX IF NOT EXISTS idx_products_slug
    ON public.products (slug);

-- RLS: Storefront reads published products; admins see all statuses
DROP POLICY IF EXISTS "Storefront can view published products" ON public.products;
CREATE POLICY "Storefront can view published products"
    ON public.products
    FOR SELECT
    TO anon, authenticated
    USING (
        status = 'published' OR public.is_admin()
    );

-- RLS: Admin mutations
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
CREATE POLICY "Admins can insert products"
    ON public.products
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update products" ON public.products;
CREATE POLICY "Admins can update products"
    ON public.products
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
CREATE POLICY "Admins can delete products"
    ON public.products
    FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 5. Table: public.product_variants
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    size TEXT NOT NULL,
    color TEXT NOT NULL,
    sku TEXT UNIQUE,
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Backwards compatibility: add columns if table already existed
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id
    ON public.product_variants (product_id);

-- RLS: Storefront view
DROP POLICY IF EXISTS "Storefront can view variants of published products" ON public.product_variants;
CREATE POLICY "Storefront can view variants of published products"
    ON public.product_variants
    FOR SELECT
    TO anon, authenticated
    USING (
        public.is_admin() OR
        EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = product_variants.product_id
              AND p.status = 'published'
        )
    );

-- RLS: Admin mutations
DROP POLICY IF EXISTS "Admins can insert variants" ON public.product_variants;
CREATE POLICY "Admins can insert variants"
    ON public.product_variants
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update variants" ON public.product_variants;
CREATE POLICY "Admins can update variants"
    ON public.product_variants
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete variants" ON public.product_variants;
CREATE POLICY "Admins can delete variants"
    ON public.product_variants
    FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 6. Table: public.product_images
-- ------------------------------------------------------------------------------
-- References private Cloudflare R2 object keys in `storage_path` (e.g. products/<product_id>/<file>.jpg).
-- Image binaries are NOT stored in Supabase.
CREATE TABLE IF NOT EXISTS public.product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL UNIQUE,
    alt_text TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    color TEXT,
    mime_type TEXT,
    file_size_bytes BIGINT,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Backwards compatibility: add metadata columns if table already existed
ALTER TABLE public.product_images ADD COLUMN IF NOT EXISTS alt_text TEXT;
ALTER TABLE public.product_images ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE public.product_images ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;
ALTER TABLE public.product_images ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE public.product_images ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE public.product_images ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;
ALTER TABLE public.product_images ADD COLUMN IF NOT EXISTS width INTEGER;
ALTER TABLE public.product_images ADD COLUMN IF NOT EXISTS height INTEGER;

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- Indexes for performance across 500-600+ images
CREATE INDEX IF NOT EXISTS idx_product_images_product_id
    ON public.product_images (product_id);

CREATE INDEX IF NOT EXISTS idx_product_images_order
    ON public.product_images (product_id, display_order ASC);

CREATE INDEX IF NOT EXISTS idx_product_images_storage_path
    ON public.product_images (storage_path);

CREATE INDEX IF NOT EXISTS idx_product_images_primary
    ON public.product_images (product_id)
    WHERE is_primary = true;

-- RLS: Storefront view
DROP POLICY IF EXISTS "Storefront can view images of published products" ON public.product_images;
CREATE POLICY "Storefront can view images of published products"
    ON public.product_images
    FOR SELECT
    TO anon, authenticated
    USING (
        public.is_admin() OR
        EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = product_images.product_id
              AND p.status = 'published'
        )
    );

-- RLS: Admin mutations
DROP POLICY IF EXISTS "Admins can insert images" ON public.product_images;
CREATE POLICY "Admins can insert images"
    ON public.product_images
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update images" ON public.product_images;
CREATE POLICY "Admins can update images"
    ON public.product_images
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete images" ON public.product_images;
CREATE POLICY "Admins can delete images"
    ON public.product_images
    FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 7. Updated At Trigger Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_products_updated_at ON public.products;
CREATE TRIGGER set_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_product_variants_updated_at ON public.product_variants;
CREATE TRIGGER set_product_variants_updated_at
    BEFORE UPDATE ON public.product_variants
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_product_images_updated_at ON public.product_images;
CREATE TRIGGER set_product_images_updated_at
    BEFORE UPDATE ON public.product_images
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
