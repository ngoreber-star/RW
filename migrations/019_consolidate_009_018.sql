-- ============================================
-- RIVER-WALL PRO - Consolidación 009→018
-- Reemplaza: 009-018 en una migración idempotente
-- Eliminado: 013 (test user), 014 (link user) → ad-hoc DO blocks
-- ============================================
-- Ejecutar DESPUÉS de 008 en instalaciones nuevas.
-- Instalaciones existentes (009-018 ya aplicados): es seguro re-ejecutar.
-- ============================================

BEGIN;

-- ============================================
-- 1. FIX RLS RECURSION (era 009)
-- Reemplaza chequeo recursivo tenant_users → superadmins
-- ============================================

ALTER TABLE tenant_users DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_users_isolation ON tenant_users;
CREATE POLICY tenant_users_isolation ON tenant_users
    FOR ALL USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;

ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenants_isolation ON tenants;
CREATE POLICY tenants_isolation ON tenants
    FOR ALL USING (
        id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'categories','products','clients','locales','sales','purchases',
        'suppliers','warehouses','warehouse_stock','inventory_movements',
        'transfers','pos_terminals','pos_terminal_closures','taxes',
        'audit_logs','loyalty_cards','wallet_transactions',
        'crm_coupons','crm_coupon_purchases','reload_requests',
        'discount_campaigns','crm_activities'
    ];
    subq_tables TEXT[] := ARRAY[
        'warehouse_stock'  -- usa warehouse_id → warehouses → tenant_id
    ];
    subq_terminal TEXT[] := ARRAY[
        'pos_terminal_closures'  -- usa terminal_id → pos_terminals → tenant_id
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('
            DROP POLICY IF EXISTS %I_isolation ON %I;
            CREATE POLICY %I_isolation ON %I
                FOR ALL USING (
                    tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
                    OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
                );
        ', tbl, tbl, tbl, tbl);
    END LOOP;

    -- Tablas con subquery indirecta
    EXECUTE '
        DROP POLICY IF EXISTS warehouse_stock_isolation ON warehouse_stock;
        CREATE POLICY warehouse_stock_isolation ON warehouse_stock
            FOR ALL USING (
                warehouse_id IN (SELECT id FROM warehouses WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()))
                OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
            );
    ';

    EXECUTE '
        DROP POLICY IF EXISTS pos_terminal_closures_isolation ON pos_terminal_closures;
        CREATE POLICY pos_terminal_closures_isolation ON pos_terminal_closures
            FOR ALL USING (
                terminal_id IN (SELECT id FROM pos_terminals WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()))
                OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
            );
    ';
END $$;

-- ============================================
-- 2. BYPASS RLS PARA TENANT RESOLUTION (era 010)
-- SECURITY DEFINER para saltar RLS
-- ============================================

DROP FUNCTION IF EXISTS get_user_tenant(UUID) CASCADE;

CREATE OR REPLACE FUNCTION get_user_tenant(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'tenant_id', tu.tenant_id,
        'role', tu.role,
        'tenant', to_jsonb(t.*)
    ) INTO result
    FROM tenant_users tu
    JOIN tenants t ON t.id = tu.tenant_id
    WHERE tu.user_id = p_user_id
    LIMIT 1;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS get_user_tenants(UUID) CASCADE;

CREATE OR REPLACE FUNCTION get_user_tenants(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'tenant_id', tu.tenant_id,
            'role', tu.role,
            'tenant', to_jsonb(t.*)
        )
    ) INTO result
    FROM tenant_users tu
    JOIN tenants t ON t.id = tu.tenant_id
    WHERE tu.user_id = p_user_id;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. BOOTSTRAP SUPERADMIN (era 011)
-- ============================================

DROP FUNCTION IF EXISTS bootstrap_superadmin(UUID) CASCADE;

CREATE OR REPLACE FUNCTION bootstrap_superadmin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM superadmins WHERE is_active = true) THEN
        RETURN false;
    END IF;

    INSERT INTO superadmins (user_id, is_active)
    VALUES (p_user_id, true)
    ON CONFLICT (user_id) DO UPDATE SET
        is_active = true,
        updated_at = NOW();

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. TENANT CREATION V2 (era 012)
-- Sin crypt(), usa admin_user_id directo
-- ============================================

DROP FUNCTION IF EXISTS superadmin_create_tenant_v2(TEXT, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS superadmin_create_tenant_v2(TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS link_user_to_tenant(UUID, UUID, TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS link_user_to_tenant(UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION superadmin_create_tenant_v2(
    p_business_name TEXT,
    p_admin_user_id UUID,
    p_plan TEXT DEFAULT 'lite'
)
RETURNS JSONB AS $$
DECLARE
    new_tenant_id UUID;
BEGIN
    IF NOT is_superadmin(auth.uid()) THEN
        RAISE EXCEPTION 'SuperAdmin access required';
    END IF;

    INSERT INTO tenants (name, business_name, plan)
    VALUES (p_business_name, p_business_name, p_plan)
    RETURNING id INTO new_tenant_id;

    INSERT INTO tenant_users (user_id, tenant_id, role, is_owner)
    VALUES (p_admin_user_id, new_tenant_id, 'admin', true)
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET
        role = 'admin', is_owner = true, updated_at = NOW();

    INSERT INTO categories (tenant_id, name, color, icon) VALUES
        (new_tenant_id, 'Bebidas', 'blue', 'fa-wine-bottle'),
        (new_tenant_id, 'Alimentos', 'emerald', 'fa-hamburger'),
        (new_tenant_id, 'General', 'gray', 'fa-box');

    INSERT INTO taxes (tenant_id, name, rate, type, is_default) VALUES
        (new_tenant_id, 'TVA', 19.25, 'vat', true);

    INSERT INTO licenses (tenant_id, plan, status, expires_at)
    VALUES (new_tenant_id, p_plan, 'trial', NOW() + INTERVAL '14 days');

    RETURN jsonb_build_object(
        'tenant_id', new_tenant_id,
        'admin_user_id', p_admin_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- ============================================
-- 5. AUDIT LOGS ENHANCED (era 015)
-- Migra esquema existente a columnas ISO 27001
-- ============================================

-- Agregar nuevas columnas al audit_logs existente (creado en 001)
ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS resource TEXT,
    ADD COLUMN IF NOT EXISTS resource_id TEXT,
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Relajar CHECK constraint de action si existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'audit_logs' AND column_name = 'action'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE audit_logs ALTER COLUMN action DROP NOT NULL;
    END IF;
END $$;

-- Índices adicionales
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);

-- RLS: audit_logs policies (reemplaza las de 009 para esta tabla)
DROP POLICY IF EXISTS audit_logs_isolation ON audit_logs;
DROP POLICY IF EXISTS audit_logs_superadmin_select ON audit_logs;
DROP POLICY IF EXISTS audit_logs_tenant_select ON audit_logs;
DROP POLICY IF EXISTS audit_logs_insert ON audit_logs;
DROP POLICY IF EXISTS audit_logs_no_update ON audit_logs;
DROP POLICY IF EXISTS audit_logs_no_delete ON audit_logs;

CREATE POLICY audit_logs_superadmin_select ON audit_logs
    FOR SELECT
    USING (is_superadmin(auth.uid()));

CREATE POLICY audit_logs_tenant_select ON audit_logs
    FOR SELECT
    USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

CREATE POLICY audit_logs_insert ON audit_logs
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY audit_logs_no_update ON audit_logs
    FOR UPDATE
    USING (false);

CREATE POLICY audit_logs_no_delete ON audit_logs
    FOR DELETE
    USING (false);

-- Trigger function para audit logs (ISO 27001 A.12.4.1)
CREATE OR REPLACE FUNCTION trigger_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (action, user_id, tenant_id, resource, resource_id, metadata)
    VALUES (
        TG_OP,
        auth.uid(),
        COALESCE(NEW.tenant_id, OLD.tenant_id),
        TG_TABLE_NAME,
        COALESCE(NEW.id::TEXT, OLD.id::TEXT),
        jsonb_build_object(
            'old_data', CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)::JSONB ELSE NULL END,
            'new_data', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::JSONB ELSE NULL END
        )
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: get user's tenant IDs (usado por RLS)
CREATE OR REPLACE FUNCTION get_user_tenant_ids(p_user_id UUID)
RETURNS TABLE(tenant_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 6. INVENTORY MOVEMENTS COLUMNS (era 016)
-- ============================================

ALTER TABLE inventory_movements
    ADD COLUMN IF NOT EXISTS lot_number TEXT,
    ADD COLUMN IF NOT EXISTS expiry_date DATE,
    ADD COLUMN IF NOT EXISTS variant_key TEXT,
    ADD COLUMN IF NOT EXISTS running_balance INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS user_name TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN inventory_movements.lot_number IS 'Número de lote del producto';
COMMENT ON COLUMN inventory_movements.expiry_date IS 'Fecha de caducidad';
COMMENT ON COLUMN inventory_movements.variant_key IS 'Clave de variante (talla/color)';
COMMENT ON COLUMN inventory_movements.running_balance IS 'Saldo contable después del movimiento';
COMMENT ON COLUMN inventory_movements.notes IS 'Notas u observaciones del movimiento';
COMMENT ON COLUMN inventory_movements.user_name IS 'Nombre legible del usuario que realizó el movimiento';
COMMENT ON COLUMN inventory_movements.updated_at IS 'Fecha de última actualización';

ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_type_check;
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_type_check
    CHECK (type IN ('in','out','transfer','adjustment','waste','purchase','sale','container-receipt'));

-- ============================================
-- 7. CHECKOUT ATÓMICO + STOCK TRANSFER (era 017)
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

CREATE INDEX IF NOT EXISTS idx_sales_number ON sales(tenant_id, sale_number);
CREATE INDEX IF NOT EXISTS idx_sales_local_id ON sales(tenant_id, sale_local_id);
CREATE INDEX IF NOT EXISTS idx_inventory_ref ON inventory_movements(tenant_id, reference_id, reference_type);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_ref ON wallet_transactions(tenant_id, reference_id, reference_type);

-- ============================================
-- 8. CONFIRM WALLET PAYMENT (era 018)
-- ============================================

CREATE OR REPLACE FUNCTION confirm_wallet_payment(
    p_request_id TEXT,
    p_tenant_id UUID,
    p_pin TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_request RECORD;
    v_client RECORD;
BEGIN
    SELECT * INTO v_request
    FROM payment_requests
    WHERE id = p_request_id AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment request not found';
    END IF;

    IF v_request.status != 'pending' THEN
        RAISE EXCEPTION 'Payment request already processed';
    END IF;

    IF v_request.expires_at IS NOT NULL AND v_request.expires_at < NOW() THEN
        UPDATE payment_requests SET status = 'expired', updated_at = NOW()
        WHERE id = p_request_id;
        RETURN false;
    END IF;

    SELECT * INTO v_client
    FROM clients
    WHERE id = v_request.client_id AND tenant_id = p_tenant_id;

    IF v_client IS NULL OR v_client.pin_hash IS NULL THEN
        RAISE EXCEPTION 'Client PIN not configured';
    END IF;

    UPDATE payment_requests
    SET status = 'confirmed',
        updated_at = NOW()
    WHERE id = p_request_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. REALTIME PUBLICATION (realtime throttling)
-- ============================================
-- Limita a 50 eventos/seg por tabla (configurable en supabase/config.toml)
-- Las tablas listadas son las que el cliente escucha via postgres_changes

DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE
    products (tenant_id),
    categories (tenant_id),
    clients (tenant_id),
    sales (tenant_id),
    purchases (tenant_id),
    suppliers (tenant_id),
    warehouses (tenant_id),
    warehouse_stock (tenant_id),
    inventory_movements (tenant_id),
    transfers (tenant_id),
    pos_terminals (tenant_id),
    taxes (tenant_id),
    locales (tenant_id),
    loyalty_cards (tenant_id),
    wallet_transactions (tenant_id),
    crm_coupons (tenant_id),
    crm_coupon_purchases (tenant_id),
    reload_requests (tenant_id),
    discount_campaigns (tenant_id),
    crm_activities (tenant_id)
WITH (publish = 'insert,update,delete');

COMMENT ON PUBLICATION supabase_realtime IS
    'Realtime publication for POS tables. Rate limited to 50 events/sec/table via config.toml';

COMMIT;
