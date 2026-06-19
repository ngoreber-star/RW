-- ============================================
-- Test SQL for 026_add_locale_id migration
-- Run manually in Supabase SQL Editor or psql
-- ============================================

-- Test 1: locale_id column exists on core tables
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'products','categories','clients','suppliers','warehouses',
        'sales','purchases','taxes','inventory_movements','warehouse_stock','transfers'
    ];
    missing text[] := ARRAY[]::text[];
BEGIN
    FOREACH tbl IN ARRAY tables
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = tbl AND column_name = 'locale_id'
        ) THEN
            missing := array_append(missing, tbl);
        END IF;
    END LOOP;

    IF array_length(missing, 1) > 0 THEN
        RAISE EXCEPTION 'Missing locale_id on tables: %', missing;
    END IF;

    RAISE NOTICE 'Test 1 PASSED: locale_id exists on all core tables';
END $$;

-- Test 2: tenant + locale indexes exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_products_tenant_locale'
    ) THEN
        RAISE EXCEPTION 'Missing index idx_products_tenant_locale';
    END IF;
    RAISE NOTICE 'Test 2 PASSED: tenant+locale indexes exist';
END $$;

-- Test 3: Insert product with locale_id works
DO $$
DECLARE
    v_tenant_id UUID;
    v_locale_id UUID;
    v_product_id UUID;
BEGIN
    -- Use an existing tenant or create a test one
    SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
    IF v_tenant_id IS NULL THEN
        INSERT INTO tenants (name, business_name) VALUES ('TEST TENANT', 'TEST') RETURNING id INTO v_tenant_id;
    END IF;

    INSERT INTO locales (tenant_id, name, code) VALUES (v_tenant_id, 'TEST LOCAL', 'TEST') RETURNING id INTO v_locale_id;

    INSERT INTO products (tenant_id, locale_id, name, price)
    VALUES (v_tenant_id, v_locale_id, 'Test Product', 100)
    RETURNING id INTO v_product_id;

    IF v_product_id IS NULL THEN
        RAISE EXCEPTION 'Failed to insert product with locale_id';
    END IF;

    -- Cleanup
    DELETE FROM products WHERE id = v_product_id;
    DELETE FROM locales WHERE id = v_locale_id;

    RAISE NOTICE 'Test 3 PASSED: product insert with locale_id works';
END $$;

-- Test 4: Query by tenant_id + locale_id returns expected row
DO $$
DECLARE
    v_tenant_id UUID;
    v_locale_id UUID;
    v_count INTEGER;
BEGIN
    SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
    INSERT INTO locales (tenant_id, name, code) VALUES (v_tenant_id, 'TEST LOCAL 2', 'TEST2') RETURNING id INTO v_locale_id;

    INSERT INTO products (tenant_id, locale_id, name, price)
    VALUES (v_tenant_id, v_locale_id, 'Filtered Product', 200);

    SELECT COUNT(*) INTO v_count
    FROM products
    WHERE tenant_id = v_tenant_id AND locale_id = v_locale_id;

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'Expected 1 product for tenant+locale, got %', v_count;
    END IF;

    -- Cleanup
    DELETE FROM products WHERE tenant_id = v_tenant_id AND locale_id = v_locale_id;
    DELETE FROM locales WHERE id = v_locale_id;

    RAISE NOTICE 'Test 4 PASSED: tenant_id + locale_id filtering works';
END $$;
