-- ============================================
-- RIVER-WALL PRO - Test Suite for 004_functions_triggers.sql
-- Run this in the Supabase SQL Editor (staging/test project only)
-- ============================================

-- This script creates test data, exercises the new RPC functions and triggers,
-- and reports PASS/FAIL for each check. It is self-contained and uses a temp table.

-- 1. Clean up any previous test run
DELETE FROM sales WHERE tenant_id IN (SELECT id FROM tenants WHERE name = 'TEST-004 Functions & Triggers');
DELETE FROM alerts WHERE tenant_id IN (SELECT id FROM tenants WHERE name = 'TEST-004 Functions & Triggers');
DELETE FROM inventory_movements WHERE tenant_id IN (SELECT id FROM tenants WHERE name = 'TEST-004 Functions & Triggers');
DELETE FROM crm_activities WHERE tenant_id IN (SELECT id FROM tenants WHERE name = 'TEST-004 Functions & Triggers');
DELETE FROM products WHERE tenant_id IN (SELECT id FROM tenants WHERE name = 'TEST-004 Functions & Triggers');
DELETE FROM clients WHERE tenant_id IN (SELECT id FROM tenants WHERE name = 'TEST-004 Functions & Triggers');
DELETE FROM tenant_users WHERE tenant_id IN (SELECT id FROM tenants WHERE name = 'TEST-004 Functions & Triggers');
DELETE FROM tenants WHERE name = 'TEST-004 Functions & Triggers';

-- 2. Results table
DROP TABLE IF EXISTS test_results;
CREATE TEMP TABLE test_results (
    test_name TEXT,
    expected TEXT,
    actual TEXT,
    passed BOOLEAN
);

-- 3. Run tests
DO $$
DECLARE
    v_tenant_id UUID;
    v_product_id UUID;
    v_low_stock_product_id UUID;
    v_client_id UUID;
    v_sale_id UUID;
    v_result_int INTEGER;
    v_result_json JSONB;
    v_result_bool BOOLEAN;
    v_stock INTEGER;
    v_points INTEGER;
    v_alert_count INTEGER;
    v_error TEXT;
BEGIN
    -- ==========================================
    -- SETUP
    -- ==========================================
    INSERT INTO tenants (name, business_name, plan)
    VALUES ('TEST-004 Functions & Triggers', 'Test Business', 'lite')
    RETURNING id INTO v_tenant_id;

    INSERT INTO products (tenant_id, name, price, stock, min_stock)
    VALUES (v_tenant_id, 'Coca Cola 350ml', 1000, 10, 5)
    RETURNING id INTO v_product_id;

    INSERT INTO products (tenant_id, name, price, stock, min_stock)
    VALUES (v_tenant_id, 'Papas Fritas', 500, 4, 5)
    RETURNING id INTO v_low_stock_product_id;

    INSERT INTO clients (tenant_id, first_name, loyalty_points)
    VALUES (v_tenant_id, 'Juan Perez', 0)
    RETURNING id INTO v_client_id;

    -- ==========================================
    -- TEST: decrement_stock normal
    -- ==========================================
    SELECT decrement_stock(v_tenant_id, v_product_id, 3) INTO v_result_int;
    INSERT INTO test_results VALUES (
        'decrement_stock normal',
        '7',
        v_result_int::TEXT,
        v_result_int = 7
    );

    -- ==========================================
    -- TEST: decrement_stock triggers alert
    -- ==========================================
    SELECT decrement_stock(v_tenant_id, v_low_stock_product_id, 1) INTO v_result_int;
    SELECT COUNT(*) INTO v_alert_count
    FROM alerts
    WHERE tenant_id = v_tenant_id AND product_id = v_low_stock_product_id AND is_read = false;

    INSERT INTO test_results VALUES (
        'decrement_stock triggers alert',
        'stock=3, alerts=1',
        'stock=' || v_result_int || ', alerts=' || v_alert_count,
        v_result_int = 3 AND v_alert_count = 1
    );

    -- ==========================================
    -- TEST: decrement_stock wrong tenant raises exception
    -- ==========================================
    BEGIN
        SELECT decrement_stock(gen_random_uuid(), v_product_id, 1) INTO v_result_int;
        INSERT INTO test_results VALUES (
            'decrement_stock wrong tenant raises exception',
            'ERROR',
            'NO ERROR',
            false
        );
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (
            'decrement_stock wrong tenant raises exception',
            'ERROR',
            SQLERRM,
            true
        );
    END;

    -- ==========================================
    -- TEST: increment_stock
    -- ==========================================
    SELECT increment_stock(v_tenant_id, v_product_id, 2) INTO v_result_int;
    INSERT INTO test_results VALUES (
        'increment_stock',
        '9',
        v_result_int::TEXT,
        v_result_int = 9
    );

    -- ==========================================
    -- TEST: add_loyalty_points
    -- ==========================================
    SELECT add_loyalty_points(v_tenant_id, v_client_id, 150) INTO v_result_int;
    SELECT loyalty_points INTO v_points FROM clients WHERE id = v_client_id;
    INSERT INTO test_results VALUES (
        'add_loyalty_points returns total',
        '150',
        v_result_int::TEXT,
        v_result_int = 150 AND v_points = 150
    );

    -- ==========================================
    -- TEST: add_loyalty_points wrong tenant raises exception
    -- ==========================================
    BEGIN
        SELECT add_loyalty_points(gen_random_uuid(), v_client_id, 10) INTO v_result_int;
        INSERT INTO test_results VALUES (
            'add_loyalty_points wrong tenant raises exception',
            'ERROR',
            'NO ERROR',
            false
        );
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO test_results VALUES (
            'add_loyalty_points wrong tenant raises exception',
            'ERROR',
            SQLERRM,
            true
        );
    END;

    -- ==========================================
    -- TEST: get_low_stock_products returns JSON array
    -- ==========================================
    SELECT get_low_stock_products(v_tenant_id) INTO v_result_json;
    INSERT INTO test_results VALUES (
        'get_low_stock_products JSON array',
        'array with Papas Fritas',
        v_result_json::TEXT,
        jsonb_array_length(v_result_json) = 1
          AND (v_result_json->0->>'name') = 'Papas Fritas'
    );

    -- ==========================================
    -- TEST: on_sale_insert with status = completed
    -- ==========================================
    INSERT INTO sales (tenant_id, items, total, payment_method, status)
    VALUES (
        v_tenant_id,
        jsonb_build_array(jsonb_build_object('productId', v_product_id, 'quantity', 2, 'subtotal', 2000)),
        2000,
        'cash',
        'completed'
    )
    RETURNING id INTO v_sale_id;

    SELECT stock INTO v_stock FROM products WHERE id = v_product_id;
    INSERT INTO test_results VALUES (
        'on_sale_insert completed decrements stock',
        '7',
        v_stock::TEXT,
        v_stock = 7
    );

    -- ==========================================
    -- TEST: on_sale_insert with status = pending does NOT decrement
    -- ==========================================
    INSERT INTO sales (tenant_id, items, total, payment_method, status)
    VALUES (
        v_tenant_id,
        jsonb_build_array(jsonb_build_object('productId', v_product_id, 'quantity', 2, 'subtotal', 2000)),
        2000,
        'cash',
        'pending'
    );

    SELECT stock INTO v_stock FROM products WHERE id = v_product_id;
    INSERT INTO test_results VALUES (
        'on_sale_insert pending does not decrement',
        '7',
        v_stock::TEXT,
        v_stock = 7
    );

    -- ==========================================
    -- TEST: on_sale_update pending -> completed
    -- ==========================================
    UPDATE sales
    SET status = 'completed'
    WHERE tenant_id = v_tenant_id
      AND status = 'pending'
      AND items->0->>'productId' = v_product_id::TEXT;

    SELECT stock INTO v_stock FROM products WHERE id = v_product_id;
    INSERT INTO test_results VALUES (
        'on_sale_update pending->completed decrements stock',
        '5',
        v_stock::TEXT,
        v_stock = 5
    );

    -- ==========================================
    -- TEST: on_sale_update completed -> cancelled returns stock
    -- ==========================================
    UPDATE sales
    SET status = 'cancelled'
    WHERE id = v_sale_id;

    SELECT stock INTO v_stock FROM products WHERE id = v_product_id;
    INSERT INTO test_results VALUES (
        'on_sale_update completed->cancelled returns stock',
        '7',
        v_stock::TEXT,
        v_stock = 7
    );

    -- ==========================================
    -- TEST: get_daily_sales JSON summary
    -- ==========================================
    SELECT get_daily_sales(v_tenant_id, CURRENT_DATE) INTO v_result_json;
    INSERT INTO test_results VALUES (
        'get_daily_sales JSON summary',
        'total_ventas=4000, cantidad_transacciones=2, total_efectivo=4000',
        v_result_json::TEXT,
        (v_result_json->>'total_ventas')::NUMERIC = 4000
          AND (v_result_json->>'cantidad_transacciones')::INTEGER = 2
          AND (v_result_json->>'total_efectivo')::NUMERIC = 4000
          AND (v_result_json->>'total_tarjeta')::NUMERIC = 0
          AND (v_result_json->>'total_wallet')::NUMERIC = 0
    );

    -- ==========================================
    -- TEST: process_complete_checkout does NOT double-decrement
    -- ==========================================
    SELECT stock INTO v_stock FROM products WHERE id = v_product_id;

    SELECT process_complete_checkout(jsonb_build_object(
        'tenant_id', v_tenant_id::TEXT,
        'items', jsonb_build_array(jsonb_build_object(
            'productId', v_product_id::TEXT,
            'quantity', 1,
            'subtotal', 1000
        )),
        'total', 1000,
        'payment_method', 'cash',
        'status', 'completed'
    )) INTO v_result_json;

    SELECT stock INTO v_points FROM products WHERE id = v_product_id; -- reuse variable
    INSERT INTO test_results VALUES (
        'process_complete_checkout no double decrement',
        '6',
        v_points::TEXT,
        v_points = 6
    );

END $$;

-- 4. Show results
SELECT
    test_name,
    expected,
    actual,
    CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS result
FROM test_results
ORDER BY test_name;

-- 5. Optional cleanup (uncomment to remove test data after inspection)
-- DELETE FROM sales WHERE tenant_id IN (SELECT id FROM tenants WHERE name = 'TEST-004 Functions & Triggers');
-- DELETE FROM alerts WHERE tenant_id IN (SELECT id FROM tenants WHERE name = 'TEST-004 Functions & Triggers');
-- DELETE FROM inventory_movements WHERE tenant_id IN (SELECT id FROM tenants WHERE name = 'TEST-004 Functions & Triggers');
-- DELETE FROM crm_activities WHERE tenant_id IN (SELECT id FROM tenants WHERE name = 'TEST-004 Functions & Triggers');
-- DELETE FROM products WHERE tenant_id IN (SELECT id FROM tenants WHERE name = 'TEST-004 Functions & Triggers');
-- DELETE FROM clients WHERE tenant_id IN (SELECT id FROM tenants WHERE name = 'TEST-004 Functions & Triggers');
-- DELETE FROM tenant_users WHERE tenant_id IN (SELECT id FROM tenants WHERE name = 'TEST-004 Functions & Triggers');
-- DELETE FROM tenants WHERE name = 'TEST-004 Functions & Triggers';
