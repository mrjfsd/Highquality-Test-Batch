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

-- Enable Row Level Security
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- 1. Public can read site_settings (for homepage promo banner and catalogue marquee ticker)
DROP POLICY IF EXISTS "Allow public read access to site_settings" ON public.site_settings;
CREATE POLICY "Allow public read access to site_settings"
    ON public.site_settings
    FOR SELECT
    TO public
    USING (true);

-- 2. Only authenticated admins can modify site_settings
DROP POLICY IF EXISTS "Allow admins to manage site_settings" ON public.site_settings;
CREATE POLICY "Allow admins to manage site_settings"
    ON public.site_settings
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Pre-seed default configuration keys if not already set
INSERT INTO public.site_settings (key, value)
VALUES
    ('promo_banner', '{"imageUrl": "/assets/image.png", "storagePath": null, "altText": "Diwali Sale Promotional Banner — Click to explore sale pieces"}'::jsonb),
    ('catalogue_marquee', '{"ads": ["BUY ANY 4 GET Rs.200 OFF", "BUY ANY 2 GET Rs.100 OFF", "10% OFF ON FIRST ORDER"]}'::jsonb)
ON CONFLICT (key) DO NOTHING;
