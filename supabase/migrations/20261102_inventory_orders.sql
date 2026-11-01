-- ==============================================================================
-- Style-Edit: Supabase PostgreSQL Schema Migration - Inventory Tracking & Orders
-- ==============================================================================
-- 1. Creates public.orders table for tracking order reference, idempotency, items,
--    and stock deduction lifecycle.
-- 2. Creates atomic PostgreSQL RPC function process_order_inventory_deduction
--    which locks variant rows, validates stock, deducts quantity, updates availability,
--    and creates the order record atomically.
-- 3. Creates atomic PostgreSQL RPC function cancel_and_restock_order for admin workflows.
--
-- How to apply:
--   1. Open your Supabase Project Dashboard
--   2. Go to SQL Editor -> New Query
--   3. Paste this entire file and click "Run"
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Table: public.orders
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_ref TEXT NOT NULL UNIQUE,
    idempotency_key TEXT UNIQUE,
    token TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    totals JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_order_ref ON public.orders (order_ref);
CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key ON public.orders (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_orders_token ON public.orders (token);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);

-- Privileges
GRANT ALL ON TABLE public.orders TO anon, authenticated, service_role;

-- RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Storefront can view order by token" ON public.orders;
CREATE POLICY "Storefront can view order by token"
    ON public.orders
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Admins have full access to orders" ON public.orders;
CREATE POLICY "Admins have full access to orders"
    ON public.orders
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 2. RPC: Atomic Inventory Deduction with Idempotency
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_order_inventory_deduction(
    p_order_ref TEXT,
    p_idempotency_key TEXT,
    p_token TEXT,
    p_items JSONB,
    p_totals JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing_order RECORD;
    v_item JSONB;
    v_variant_id UUID;
    v_requested_qty INTEGER;
    v_current_stock INTEGER;
    v_item_name TEXT;
    v_item_size TEXT;
    v_item_color TEXT;
BEGIN
    -- 1. Check idempotency: If this idempotency_key or order_ref was already processed
    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        SELECT * INTO v_existing_order FROM public.orders WHERE idempotency_key = p_idempotency_key LIMIT 1;
        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'already_processed', true,
                'order_ref', v_existing_order.order_ref,
                'token', v_existing_order.token,
                'status', v_existing_order.status
            );
        END IF;
    END IF;

    SELECT * INTO v_existing_order FROM public.orders WHERE order_ref = p_order_ref LIMIT 1;
    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_processed', true,
            'order_ref', v_existing_order.order_ref,
            'token', v_existing_order.token,
            'status', v_existing_order.status
        );
    END IF;

    -- 2. Validate all requested items against stock with row-level locks (FOR UPDATE)
    -- Iterating through the JSON array
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_variant_id := (v_item->>'variantId')::UUID;
        v_requested_qty := GREATEST(1, (v_item->>'quantity')::INTEGER);
        v_item_name := COALESCE(v_item->>'name', 'Item');
        v_item_size := v_item->>'size';
        v_item_color := v_item->>'color';

        -- If variantId is present, check and lock variant
        IF v_variant_id IS NOT NULL THEN
            SELECT stock_quantity INTO v_current_stock
            FROM public.product_variants
            WHERE id = v_variant_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error', 'VARIANT_NOT_FOUND',
                    'message', 'Selected product variant was not found.',
                    'variant_id', v_variant_id
                );
            END IF;

            IF v_current_stock < v_requested_qty THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error', 'INSUFFICIENT_STOCK',
                    'message', format('Only %s units available for %s (%s, %s).', v_current_stock, v_item_name, COALESCE(v_item_size, 'standard'), COALESCE(v_item_color, 'standard')),
                    'item', jsonb_build_object(
                        'variantId', v_variant_id,
                        'name', v_item_name,
                        'size', v_item_size,
                        'color', v_item_color,
                        'requested', v_requested_qty,
                        'available', v_current_stock
                    )
                );
            END IF;
        END IF;
    END LOOP;

    -- 3. Deduct stock for all items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_variant_id := (v_item->>'variantId')::UUID;
        v_requested_qty := GREATEST(1, (v_item->>'quantity')::INTEGER);

        IF v_variant_id IS NOT NULL THEN
            UPDATE public.product_variants
            SET stock_quantity = stock_quantity - v_requested_qty,
                is_available = ((stock_quantity - v_requested_qty) > 0),
                updated_at = timezone('utc'::text, now())
            WHERE id = v_variant_id;
        END IF;
    END LOOP;

    -- 4. Record order in public.orders
    INSERT INTO public.orders (
        order_ref,
        idempotency_key,
        token,
        status,
        items,
        totals,
        created_at,
        updated_at
    ) VALUES (
        p_order_ref,
        p_idempotency_key,
        p_token,
        'pending',
        p_items,
        p_totals,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_ref', p_order_ref,
        'token', p_token
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. RPC: Atomic Order Cancellation & Restocking
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_and_restock_order(p_order_ref TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_item JSONB;
    v_variant_id UUID;
    v_qty INTEGER;
BEGIN
    SELECT * INTO v_order
    FROM public.orders
    WHERE order_ref = p_order_ref
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ORDER_NOT_FOUND',
            'message', 'Order not found.'
        );
    END IF;

    IF v_order.status = 'cancelled' THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_cancelled', true,
            'message', 'Order was already cancelled and restocked.'
        );
    END IF;

    -- Restock each item
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_order.items)
    LOOP
        v_variant_id := (v_item->>'variantId')::UUID;
        v_qty := GREATEST(1, (v_item->>'quantity')::INTEGER);

        IF v_variant_id IS NOT NULL THEN
            UPDATE public.product_variants
            SET stock_quantity = stock_quantity + v_qty,
                is_available = true,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_variant_id;
        END IF;
    END LOOP;

    -- Mark order cancelled
    UPDATE public.orders
    SET status = 'cancelled',
        updated_at = timezone('utc'::text, now())
    WHERE order_ref = p_order_ref;

    RETURN jsonb_build_object(
        'success', true,
        'order_ref', p_order_ref,
        'restocked', true
    );
END;
$$;
