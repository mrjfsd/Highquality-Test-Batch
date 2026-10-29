-- ==============================================================================
-- Style-Edit: Supabase PostgreSQL Schema Migration - Product Quantity Offers
-- ==============================================================================
-- Creates public.product_quantity_offers table for product-specific bundle pricing
-- (e.g. "Buy 3 for ₹1,000").
-- Supports multiple offer tiers per product (e.g. Tier 1: 3 for ₹1,000; Tier 2: 6 for ₹1,800).
-- Safe, idempotent, non-destructive migration.
--
-- How to apply:
--   1. Open your Supabase Project Dashboard
--   2. Go to SQL Editor -> New Query
--   3. Paste this entire file and click "Run"
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Table: public.product_quantity_offers
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_quantity_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    qualifying_quantity INTEGER NOT NULL CHECK (qualifying_quantity > 1),
    bundle_price NUMERIC(10, 2) NOT NULL CHECK (bundle_price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Prevent duplicate conflicting offers for the exact same product and qualifying threshold
    CONSTRAINT uq_product_quantity_offers_tier UNIQUE (product_id, qualifying_quantity)
);

-- Backwards compatibility if table already existed
ALTER TABLE public.product_quantity_offers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.product_quantity_offers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- ------------------------------------------------------------------------------
-- 2. Indexes for Query Performance
-- ------------------------------------------------------------------------------
-- Lookups by product ID
CREATE INDEX IF NOT EXISTS idx_product_quantity_offers_product_id
    ON public.product_quantity_offers (product_id);

-- Filtered index for active offers ordered by quantity threshold
CREATE INDEX IF NOT EXISTS idx_product_quantity_offers_active
    ON public.product_quantity_offers (product_id, qualifying_quantity)
    WHERE is_active = true;

-- ------------------------------------------------------------------------------
-- 3. PostgREST Role Privileges
-- ------------------------------------------------------------------------------
-- (CRITICAL: without GRANT, PostgREST returns 42501 permission denied)
GRANT ALL ON TABLE public.product_quantity_offers TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. Row Level Security (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.product_quantity_offers ENABLE ROW LEVEL SECURITY;

-- Storefront (anon & authenticated): Read active offers for published products
DROP POLICY IF EXISTS "Storefront can view active offers for published products" ON public.product_quantity_offers;
CREATE POLICY "Storefront can view active offers for published products"
    ON public.product_quantity_offers
    FOR SELECT
    TO anon, authenticated
    USING (
        public.is_admin() OR (
            is_active = true AND
            EXISTS (
                SELECT 1 FROM public.products p
                WHERE p.id = product_quantity_offers.product_id
                  AND p.status = 'published'
            )
        )
    );

-- Admins: Full management permissions (INSERT, UPDATE, DELETE, SELECT all)
DROP POLICY IF EXISTS "Admins can manage quantity offers" ON public.product_quantity_offers;
CREATE POLICY "Admins can manage quantity offers"
    ON public.product_quantity_offers
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 5. Updated At Trigger
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_product_quantity_offers_updated_at ON public.product_quantity_offers;
CREATE TRIGGER set_product_quantity_offers_updated_at
    BEFORE UPDATE ON public.product_quantity_offers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
