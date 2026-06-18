-- ============================================
-- RIVER-WALL PRO - JSON Validation + Overflow Fix
-- ============================================
-- 1. CHECK constraints for JSONB array fields
-- 2. Overflow protection en loyalty_points
-- 3. Warehouse validation en checkout RPC
-- 4. Validate items format en RPCs existentes
-- ============================================

BEGIN;

-- ============================================
-- 1. CHECK CONSTRAINTS: JSONB format
-- ============================================

ALTER TABLE sales
    DROP CONSTRAINT IF EXISTS check_sales_items_format,
    ADD CONSTRAINT check_sales_items_format CHECK (jsonb_typeof(items) = 'array');

ALTER TABLE purchases
    DROP CONSTRAINT IF EXISTS check_purchases_items_format,
    ADD CONSTRAINT check_purchases_items_format CHECK (jsonb_typeof(items) = 'array');

ALTER TABLE transfers
    DROP CONSTRAINT IF EXISTS check_transfers_items_format,
    ADD CONSTRAINT check_transfers_items_format CHECK (jsonb_typeof(items) = 'array');

-- payment_details también debe ser objeto, no array
ALTER TABLE sales
    DROP CONSTRAINT IF EXISTS check_sales_payment_details_format,
    ADD CONSTRAINT check_sales_payment_details_format CHECK (
        payment_details IS NULL OR jsonb_typeof(payment_details) = 'object'
    );

-- ============================================
-- 2. OVERFLOW PROTECTION: loyalty_points
-- ============================================

CREATE OR REPLACE FUNCTION add_loyalty_points(
    p_client_id UUID,
    p_points INTEGER,
    p_tenant_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE clients
    SET loyalty_points = LEAST(COALESCE(loyalty_points, 0) + p_points, 2147483647),
        updated_at = NOW()
    WHERE id = p_client_id AND tenant_id = p_tenant_id;

    INSERT INTO crm_activities (tenant_id, client_id, activity_type, description, points)
    VALUES (p_tenant_id, p_client_id, 'points_earned', 'Puntos ganados por compra', p_points);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. FIX process_complete_checkout: warehouse validation
-- ============================================

CREATE OR REPLACE FUNCTION process_complete_checkout(
    p_sale_payload JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_sale_id UUID;
    v_client_id UUID;
    v_user_id UUID;
    v_locale_id UUID;
    v_total NUMERIC(15,2);
    v_payment_method TEXT;
    v_items JSONB;
    v_item JSONB;
    v_product_id UUID;
    v_qty INTEGER;
    v_existing_sale UUID;
    v_points INTEGER;
    v_wallet_amount NUMERIC(15,2);
    v_sale_number TEXT;
    v_year_prefix TEXT;
    v_next_num INTEGER;
    v_warehouse_id UUID;
    v_result JSONB;
BEGIN
    -- Validación temprana de formato items
    v_items := COALESCE(p_sale_payload->'items', '[]'::JSONB);
    IF jsonb_typeof(v_items) != 'array' THEN
        RAISE EXCEPTION 'items debe ser un array JSON, recibido: %', jsonb_typeof(v_items);
    END IF;

    v_tenant_id := (p_sale_payload->>'tenant_id')::UUID;
    v_sale_id := COALESCE((p_sale_payload->>'id')::UUID, gen_random_uuid());
    v_client_id := NULLIF(p_sale_payload->>'client_id', '')::UUID;
    v_user_id := NULLIF(p_sale_payload->>'user_id', '')::UUID;
    v_locale_id := NULLIF(p_sale_payload->>'locale_id', '')::UUID;
    v_total := COALESCE((p_sale_payload->>'total')::NUMERIC, 0);
    v_payment_method := COALESCE(p_sale_payload->>'payment_method', 'cash');
    v_wallet_amount := COALESCE((p_sale_payload->>'wallet_amount')::NUMERIC, 0);

    -- Validar warehouse_id: si se envía, debe existir
    v_warehouse_id := NULLIF(p_sale_payload->>'warehouse_id', '')::UUID;
    IF v_warehouse_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM warehouses WHERE id = v_warehouse_id AND tenant_id = v_tenant_id) THEN
            RAISE EXCEPTION 'Warehouse % not found for tenant %', v_warehouse_id, v_tenant_id;
        END IF;
    END IF;

    SELECT id INTO v_existing_sale
    FROM sales
    WHERE id = v_sale_id AND tenant_id = v_tenant_id;

    IF v_existing_sale IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'sale_id', v_sale_id,
            'sale_number', (SELECT sale_number FROM sales WHERE id = v_sale_id),
            'message', 'Sale already processed (idempotent)',
            'idempotent', true
        );
    END IF;

    v_year_prefix := 'S' || TO_CHAR(NOW(), 'YYYY');
    PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::TEXT || v_year_prefix));

    SELECT COALESCE(MAX(NULLIF(regexp_replace(sale_number, '^S\d{4}', ''), '')), '0')::INTEGER + 1
    INTO v_next_num
    FROM sales
    WHERE tenant_id = v_tenant_id AND sale_number LIKE v_year_prefix || '%';

    v_sale_number := v_year_prefix || LPAD(v_next_num::TEXT, 6, '0');

    -- Skip automatic stock triggers; we handle stock and inventory movements manually here
    PERFORM set_config('app.skip_sale_stock_trigger', 'true', true);

    INSERT INTO sales (
        id, tenant_id, sale_local_id, sale_number, client_id, user_id, locale_id,
        items, subtotal, tax_total, discount_total, total,
        payment_method, payment_details, status, balance, notes, pos_terminal_id,
        created_at, updated_at
    ) VALUES (
        v_sale_id, v_tenant_id,
        p_sale_payload->>'sale_local_id',
        v_sale_number,
        v_client_id,
        v_user_id,
        v_locale_id,
        v_items,
        COALESCE((p_sale_payload->>'subtotal')::NUMERIC, 0),
        COALESCE((p_sale_payload->>'tax_total')::NUMERIC, 0),
        COALESCE((p_sale_payload->>'discount_total')::NUMERIC, 0),
        v_total,
        v_payment_method,
        COALESCE(p_sale_payload->'payment_details', '{}'::JSONB),
        COALESCE(p_sale_payload->>'status', 'completed'),
        COALESCE((p_sale_payload->>'balance')::NUMERIC, 0),
        p_sale_payload->>'notes',
        p_sale_payload->>'pos_terminal_id',
        COALESCE((p_sale_payload->>'created_at')::TIMESTAMPTZ, NOW()),
        NOW()
    );

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_product_id := (v_item->>'productId')::UUID;
        v_qty := COALESCE((v_item->>'quantity')::INTEGER, (v_item->>'qty')::INTEGER, 0);

        IF v_product_id IS NOT NULL AND v_qty > 0 THEN
            UPDATE products
            SET stock = GREATEST(stock - v_qty, 0),
                updated_at = NOW()
            WHERE id = v_product_id AND tenant_id = v_tenant_id;

            INSERT INTO inventory_movements (
                tenant_id, warehouse_id, product_id, type, quantity,
                reference_id, reference_type, user_id, reason, created_at
            ) VALUES (
                v_tenant_id,
                v_warehouse_id,
                v_product_id,
                'out',
                v_qty,
                v_sale_id,
                'sale',
                v_user_id,
                'Venta ' || v_sale_number,
                NOW()
            );
        END IF;
    END LOOP;

    -- Restore automatic stock triggers for other operations in the same transaction
    PERFORM set_config('app.skip_sale_stock_trigger', 'false', true);

    IF v_payment_method = 'wallet' AND v_client_id IS NOT NULL AND v_wallet_amount > 0 THEN
        IF NOT EXISTS (
            SELECT 1 FROM clients
            WHERE id = v_client_id AND tenant_id = v_tenant_id
            AND wallet_balance >= v_wallet_amount
        ) THEN
            RAISE EXCEPTION 'Insufficient wallet balance for client %', v_client_id;
        END IF;

        UPDATE clients
        SET wallet_balance = wallet_balance - v_wallet_amount,
            updated_at = NOW()
        WHERE id = v_client_id AND tenant_id = v_tenant_id;

        INSERT INTO wallet_transactions (
            tenant_id, client_id, type, amount, balance_after,
            description, reference_id, reference_type, user_id, created_at
        ) VALUES (
            v_tenant_id, v_client_id, 'debit', v_wallet_amount,
            (SELECT wallet_balance FROM clients WHERE id = v_client_id),
            'Compra ' || v_sale_number,
            v_sale_id, 'sale', v_user_id, NOW()
        );
    END IF;

    v_points := FLOOR(v_total / 1000);
    IF v_points > 0 AND v_client_id IS NOT NULL THEN
        UPDATE clients
        SET loyalty_points = LEAST(COALESCE(loyalty_points, 0) + v_points, 2147483647),
            total_spent = COALESCE(total_spent, 0) + v_total,
            updated_at = NOW()
        WHERE id = v_client_id AND tenant_id = v_tenant_id;

        INSERT INTO crm_activities (
            tenant_id, client_id, activity_type, amount, points,
            reference_id, reference_type, user_id, description, created_at
        ) VALUES (
            v_tenant_id, v_client_id, 'points_earned', v_total, v_points,
            v_sale_id, 'sale', v_user_id,
            'Puntos ganados en compra ' || v_sale_number,
            NOW()
        );
    END IF;

    IF v_payment_method = 'credit' AND v_client_id IS NOT NULL THEN
        UPDATE clients
        SET total_credit = COALESCE(total_credit, 0) + v_total,
            updated_at = NOW()
        WHERE id = v_client_id AND tenant_id = v_tenant_id;
    END IF;

    v_result := jsonb_build_object(
        'success', true,
        'sale_id', v_sale_id,
        'sale_number', v_sale_number,
        'message', 'Checkout completed successfully',
        'idempotent', false
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
