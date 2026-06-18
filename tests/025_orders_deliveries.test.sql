-- ============================================
-- RIVER-WALL PRO - Test Suite for 025_orders_deliveries_supabase.sql
-- Run this in the Supabase SQL Editor (staging/test project only)
-- ============================================

-- This script validates the orders and deliveries tables, RLS, and helper RPC.
-- It is self-contained and uses a temp table for results.

DROP TABLE IF EXISTS test_results;
CREATE TEMP TABLE test_results (
    test_name TEXT,
    expected TEXT,
    actual TEXT,
    passed BOOLEAN
);

DO $$
DECLARE
    v_tenant_id UUID;
    v_order_id UUID;
    v_delivery_id UUID;
    v_result_json JSONB;
    v_count INTEGER;
    v_status TEXT;
BEGIN
    -- Unique test tenant
    INSERT INTO tenants (name, business_name, plan)
    VALUES ('TEST-025 Orders & Deliveries', 'Test Business', 'lite')
    RETURNING id INTO v_tenant_id;

    -- ==========================================
    -- TEST: Insert order
    -- ==========================================
    INSERT INTO orders (
        tenant_id, external_order_id, customer, customer_name, items, totals,
        payment_method, status, metadata
    ) VALUES (
        v_tenant_id,
        'ORD-001',
        '{"id": null, "name": "Juan Perez"}'::jsonb,
        'Juan Perez',
        '[{"productId": "p1", "name": "Coca Cola", "qty": 2, "price": 1000}]'::jsonb,
        '{"subtotal": 2000, "discount": 0, "tax": 0, "total": 2000}'::jsonb,
        'mobile',
        'received',
        '{}'::jsonb
    )
    RETURNING id INTO v_order_id;

    SELECT COUNT(*) INTO v_count FROM orders WHERE tenant_id = v_tenant_id;
    INSERT INTO test_results VALUES (
        'Insert order',
        '1',
        v_count::TEXT,
        v_count = 1
    );

    -- ==========================================
    -- TEST: Update order status to invoiced
    -- ==========================================
    UPDATE orders
    SET status = 'invoiced', linked_sale_id = 'sale_123', invoiced_at = NOW(), updated_at = NOW()
    WHERE id = v_order_id;

    SELECT status INTO v_status FROM orders WHERE id = v_order_id;
    INSERT INTO test_results VALUES (
        'Update order to invoiced',
        'invoiced',
        v_status,
        v_status = 'invoiced'
    );

    -- ==========================================
    -- TEST: Insert delivery
    -- ==========================================
    INSERT INTO deliveries (
        tenant_id, invoice_id, client_name, client_phone, address,
        status, tracking_code, scheduled_at, metadata
    ) VALUES (
        v_tenant_id,
        NULL,
        'Maria Lopez',
        '666777888',
        'Calle 123',
        'pending',
        'TRACK-001',
        NOW(),
        '{}'::jsonb
    )
    RETURNING id INTO v_delivery_id;

    SELECT COUNT(*) INTO v_count FROM deliveries WHERE tenant_id = v_tenant_id;
    INSERT INTO test_results VALUES (
        'Insert delivery',
        '1',
        v_count::TEXT,
        v_count = 1
    );

    -- ==========================================
    -- TEST: Public delivery created after status update
    -- ==========================================
    UPDATE deliveries
    SET status = 'entregada', delivered_at = NOW(), updated_at = NOW()
    WHERE id = v_delivery_id;

    SELECT COUNT(*) INTO v_count
    FROM public_deliveries
    WHERE tracking_code = 'TRACK-001' AND status = 'entregada';

    INSERT INTO test_results VALUES (
        'Public delivery sync on delivered',
        '1',
        v_count::TEXT,
        v_count = 1
    );

    -- ==========================================
    -- TEST: get_public_delivery_by_tracking RPC
    -- ==========================================
    SELECT get_public_delivery_by_tracking('TRACK-001') INTO v_result_json;
    INSERT INTO test_results VALUES (
        'get_public_delivery_by_tracking RPC',
        'contains TRACK-001',
        v_result_json::TEXT,
        v_result_json IS NOT NULL AND (v_result_json->>'tracking_code') = 'TRACK-001'
    );

END $$;

SELECT
    test_name,
    expected,
    actual,
    CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS result
FROM test_results
ORDER BY test_name;
