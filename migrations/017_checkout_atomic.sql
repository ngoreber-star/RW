-- ============================================
-- RIVER-WALL PRO - Checkout Atómico & Mejoras
-- Añade: process_complete_checkout, process_stock_transfer
--        índices adicionales de rendimiento
-- ============================================

-- ============================================
-- 1. ATOMIC CHECKOUT (1 sola RPC, transaccional)
-- Resuelve: atomicidad, N+1 queries, idempotencia
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
    v_result JSONB;
BEGIN
    v_tenant_id := (p_sale_payload->>'tenant_id')::UUID;
    v_sale_id := COALESCE((p_sale_payload->>'id')::UUID, gen_random_uuid());
    v_client_id := NULLIF(p_sale_payload->>'client_id', '')::UUID;
    v_user_id := NULLIF(p_sale_payload->>'user_id', '')::UUID;
    v_locale_id := NULLIF(p_sale_payload->>'locale_id', '')::UUID;
    v_total := COALESCE((p_sale_payload->>'total')::NUMERIC, 0);
    v_payment_method := COALESCE(p_sale_payload->>'payment_method', 'cash');
    v_items := COALESCE(p_sale_payload->'items', '[]'::JSONB);
    v_wallet_amount := COALESCE((p_sale_payload->>'wallet_amount')::NUMERIC, 0);

    -- Idempotencia: si la venta ya existe, retorna éxito sin duplicar
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

    -- Generar número de venta atómicamente (con bloqueo)
    v_year_prefix := 'S' || TO_CHAR(NOW(), 'YYYY');
    SELECT COALESCE(MAX(NULLIF(regexp_replace(sale_number, '^S\d{4}', ''), '')), '0')::INTEGER + 1
    INTO v_next_num
    FROM sales
    WHERE tenant_id = v_tenant_id AND sale_number LIKE v_year_prefix || '%'
    FOR UPDATE;

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

    -- Stock: decrementar dentro de la misma transacción
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
                NULLIF(p_sale_payload->>'warehouse_id', '')::UUID,
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

    -- Wallet
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

    -- Puntos de fidelización
    v_points := FLOOR(v_total / 1000);
    IF v_points > 0 AND v_client_id IS NOT NULL THEN
        UPDATE clients
        SET loyalty_points = loyalty_points + v_points,
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

    -- Crédito
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

-- ============================================
-- 2. FUNCIÓN DE TRANSFERENCIA DE STOCK
-- ============================================

CREATE OR REPLACE FUNCTION process_stock_transfer(
    p_transfer_id UUID,
    p_tenant_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_items JSONB;
    v_item JSONB;
    v_product_id UUID;
    v_qty INTEGER;
    v_from_wh UUID;
    v_to_wh UUID;
    v_status TEXT;
BEGIN
    SELECT from_warehouse_id, to_warehouse_id, items, status
    INTO v_from_wh, v_to_wh, v_items, v_status
    FROM transfers
    WHERE id = p_transfer_id AND tenant_id = p_tenant_id;

    IF v_status != 'pending' THEN
        RAISE EXCEPTION 'Transfer already processed';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_product_id := (v_item->>'productId')::UUID;
        v_qty := COALESCE((v_item->>'quantity')::INTEGER, 0);

        UPDATE warehouse_stock
        SET quantity = GREATEST(quantity - v_qty, 0),
            updated_at = NOW()
        WHERE warehouse_id = v_from_wh AND product_id = v_product_id AND tenant_id = p_tenant_id;

        INSERT INTO warehouse_stock (tenant_id, warehouse_id, product_id, quantity)
        VALUES (p_tenant_id, v_to_wh, v_product_id, v_qty)
        ON CONFLICT (warehouse_id, product_id, lot_number, variant_key)
        DO UPDATE SET quantity = warehouse_stock.quantity + EXCLUDED.quantity,
                      updated_at = NOW();
    END LOOP;

    UPDATE transfers
    SET status = 'received',
        updated_at = NOW()
    WHERE id = p_transfer_id AND tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. ÍNDICES DE RENDIMIENTO
-- ============================================

CREATE INDEX IF NOT EXISTS idx_sales_number ON sales(tenant_id, sale_number);
CREATE INDEX IF NOT EXISTS idx_sales_local_id ON sales(tenant_id, sale_local_id);
CREATE INDEX IF NOT EXISTS idx_inventory_ref ON inventory_movements(tenant_id, reference_id, reference_type);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_ref ON wallet_transactions(tenant_id, reference_id, reference_type);
