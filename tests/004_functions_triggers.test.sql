-- ============================================
-- RIVER-WALL PRO - Test Suite for 004_functions_triggers.sql
-- Run this in the Supabase SQL Editor (staging/test project only)
-- ============================================

-- This script creates an isolated test tenant, exercises the new RPC functions
-- and triggers, and reports PASS/FAIL for each check.
--
-- NOTE: This script intentionally does NOT use DELETE on tables that may be
-- included in a Realtime publication (sales, inventory_movements, alerts, etc.)
-- because Supabase's logical replication can reject DELETE when the publication
-- column list does not cover the replica identity. Each run creates a brand-new
-- tenant with a unique name, so tests are isolated from previous runs.

-- 1. Results table
DROP TABLE IF EXISTS test_results;
CREATE TEMP TABLE test_results (
    test_name TEXT,
    expected TEXT,
    actual TEXT,
    passed BOOLEAN
);

-- 2. Run tests
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
    v_stock_before INTEGER;
    v_stock_after INTEGER;
    v_points INTEGER;
    v_alert_count INTEGER;
    v_daily_before JSONB;
    v_daily_after JSONB;
    v_low_before JSONB;
    v_low_after JSONB;
    v_test_prefix TEXT;
BEGIN
    -- Unique prefix so each run is isolated and cleanup is not required
    v_test_prefix := 'TEST-004-' || gen_random_uuid()::TEXT;

    -- ==========================================
    -- SETUP
    -- ==========================================
    INSERT INTO tenants (name, business_name, plan)
    VALUES (v_test_prefix, 'Test Business', 'lite')
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
        'stock=3, alerts>=1',
        'stock=' || v_result_int || ', alerts=' || v_alert_count,
        v_result_int = 3 AND v_alert_count >= 1
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
    -- TEST: get_low_stock_products returns JSON array containing test product
    -- ==========================================
    SELECT get_low_stock_products(v_tenant_id) INTO v_result_json;
    INSERT INTO test_results VALUES (
        'get_low_stock_products JSON array',
        'contains Papas Fritas',
        v_result_json::TEXT,
        jsonb_array_length(v_result_json) >= 1
          AND EXISTS (
              SELECT 1 FROM jsonb_array_elements(v_result_json) AS elem
              WHERE elem->>'name' = 'Papas Fritas'
          )
    );

    -- ==========================================
    -- TEST: on_sale_insert with status = completed
    -- ==========================================
    SELECT stock INTO v_stock_before FROM products WHERE id = v_product_id;

    INSERT INTO sales (tenant_id, items, total, payment_method, status)
    VALUES (
        v_tenant_id,
        jsonb_build_array(jsonb_build_object('productId', v_product_id, 'quantity', 2, 'subtotal', 2000)),
        2000,
        'cash',
        'completed'
    )
    RETURNING id INTO v_sale_id;

    SELECT stock INTO v_stock_after FROM products WHERE id = v_product_id;
    INSERT INTO test_results VALUES (
        'on_sale_insert completed decrements stock',
        'decrement by 2',
        v_stock_before || ' -> ' || v_stock_after,
        v_stock_after = v_stock_before - 2
    );

    -- ==========================================
    -- TEST: on_sale_insert with status = pending does NOT decrement
    -- ==========================================
    SELECT stock INTO v_stock_before FROM products WHERE id = v_product_id;

    INSERT INTO sales (tenant_id, items, total, payment_method, status)
    VALUES (
        v_tenant_id,
        jsonb_build_array(jsonb_build_object('productId', v_product_id, 'quantity', 2, 'subtotal', 2000)),
        2000,
        'cash',
        'pending'
    );

    SELECT stock INTO v_stock_after FROM products WHERE id = v_product_id;
    INSERT INTO test_results VALUES (
        'on_sale_insert pending does not decrement',
        'no change',
        v_stock_before || ' -> ' || v_stock_after,
        v_stock_after = v_stock_before
    );

    -- ==========================================
    -- TEST: on_sale_update pending -> completed
    -- ==========================================
    SELECT stock INTO v_stock_before FROM products WHERE id = v_product_id;

    UPDATE sales
    SET status = 'completed'
    WHERE tenant_id = v_tenant_id
      AND status = 'pending'
      AND items->0->>'productId' = v_product_id::TEXT;

    SELECT stock INTO v_stock_after FROM products WHERE id = v_product_id;
    INSERT INTO test_results VALUES (
        'on_sale_update pending->completed decrements stock',
        'decrement by 2',
        v_stock_before || ' -> ' || v_stock_after,
        v_stock_after = v_stock_before - 2
    );

    -- ==========================================
    -- TEST: on_sale_update completed -> cancelled returns stock
    -- ==========================================
    SELECT stock INTO v_stock_before FROM products WHERE id = v_product_id;

    UPDATE sales
    SET status = 'cancelled'
    WHERE id = v_sale_id;

    SELECT stock INTO v_stock_after FROM products WHERE id = v_product_id;
    INSERT INTO test_results VALUES (
        'on_sale_update completed->cancelled returns stock',
        'increment by 2',
        v_stock_before || ' -> ' || v_stock_after,
        v_stock_after = v_stock_before + 2
    );

    -- ==========================================
    -- TEST: get_daily_sales JSON summary
    -- ==========================================
    SELECT get_daily_sales(v_tenant_id, CURRENT_DATE) INTO v_daily_before;

    INSERT INTO sales (tenant_id, items, total, payment_method, status)
    VALUES (
        v_tenant_id,
        jsonb_build_array(jsonb_build_object('productId', v_product_id, 'quantity', 1, 'subtotal', 1000)),
        1000,
        'card',
        'completed'
    );

    SELECT get_daily_sales(v_tenant_id, CURRENT_DATE) INTO v_daily_after;
    INSERT INTO test_results VALUES (
        'get_daily_sales JSON summary',
        'totals increased correctly',
        v_daily_after::TEXT,
        (v_daily_after->>'total_ventas')::NUMERIC >= (v_daily_before->>'total_ventas')::NUMERIC + 1000
          AND (v_daily_after->>'cantidad_transacciones')::INTEGER >= (v_daily_before->>'cantidad_transacciones')::INTEGER + 1
          AND (v_daily_after->>'total_tarjeta')::NUMERIC >= (v_daily_before->>'total_tarjeta')::NUMERIC + 1000
    );

    -- ==========================================
    -- TEST: process_complete_checkout does NOT double-decrement
    -- ==========================================
    SELECT stock INTO v_stock_before FROM products WHERE id = v_product_id;

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

    SELECT stock INTO v_stock_after FROM products WHERE id = v_product_id;
    INSERT INTO test_results VALUES (
        'process_complete_checkout no double decrement',
        'decrement by 1',
        v_stock_before || ' -> ' || v_stock_after,
        v_stock_after = v_stock_before - 1
    );

END $$;

-- 3. Show results
SELECT
    test_name,
    expected,
    actual,
    CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS result
FROM test_results
ORDER BY test_name;
