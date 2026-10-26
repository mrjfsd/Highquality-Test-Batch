-- ==============================================================================
-- Style-Edit: Supabase PostgreSQL Schema Migration - Site Settings
-- ==============================================================================
-- Creates public.site_settings table for homepage banner and catalogue marquee ads.
-- Safe, idempotent, non-destructive migration.
--
-- How to apply:
--   1. Open your Supabase Project Dashboard
--   2. Go to SQL Editor -> New Query
--   3. Paste this entire file and click "Run"
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.site_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Grant table privileges to PostgREST roles (CRITICAL: without this, PostgREST returns 42501 permission denied)
GRANT ALL ON TABLE public.site_settings TO anon, authenticated, service_role;

-- Enable Row Level Security
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- 1. Public can read site_settings (for homepage promo banner and catalogue marquee ticker)
DROP POLICY IF EXISTS "Allow public read access to site_settings" ON public.site_settings;
CREATE POLICY "Allow public read access to site_settings"
    ON public.site_settings
    FOR SELECT
    TO public
    USING (true);

-- 2. Authenticated admins can modify site_settings (service_role bypasses RLS automatically)
DROP POLICY IF EXISTS "Allow admins to manage site_settings" ON public.site_settings;
CREATE POLICY "Allow admins to manage site_settings"
    ON public.site_settings
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Pre-seed current configuration keys with the published Winter Edit banner
INSERT INTO public.site_settings (key, value)
VALUES
    ('promo_banner', '{"imageUrl": "/api/images/products/banner/1793050624287-6dcfb957-4857-430d-b2ff-af47ae3f43c0.png", "storagePath": "products/banner/1793050624287-6dcfb957-4857-430d-b2ff-af47ae3f43c0.png", "altText": "Homepage Promotional Banner — Click to explore sale pieces", "enabled": true, "positionX": 51, "positionY": 0, "zoom": 1}'::jsonb),
    ('catalogue_marquee', '{"ads": ["BUY ANY 4 GET Rs.200 OFF", "BUY ANY 2 GET Rs.100 OFF", "10% OFF ON FIRST ORDER"]}'::jsonb),
    ('navbar', '{"showSaleLink": true}'::jsonb)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = timezone('utc'::text, now());

