-- ============================================
-- RIVER-WALL PRO - RPC Functions & Triggers
-- Helper functions for POS operations
-- Adapted to the real schema: sales.items JSONB, sales.status, etc.
-- ============================================

-- ============================================
-- 0. ALERTS TABLE (for low-stock notifications)
-- ============================================

CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL DEFAULT 'low_stock' CHECK (alert_type IN ('low_stock','out_of_stock','expiration','system')),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_tenant ON alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON alerts(tenant_id, is_read) WHERE is_read = false;

-- Enable RLS on alerts and add tenant isolation
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alerts_isolation ON alerts;
CREATE POLICY alerts_isolation ON alerts
    FOR ALL USING (is_tenant_member(tenant_id));

-- ============================================
-- 1. STOCK MANAGEMENT
-- ============================================

-- New canonical signature requested by the user:
-- decrement_stock(p_tenant_id, p_product_id, p_quantity)
CREATE OR REPLACE FUNCTION decrement_stock(
    p_tenant_id UUID,
    p_product_id UUID,
    p_quantity INTEGER
)
RETURNS INTEGER AS $$
DECLARE
    v_new_stock INTEGER;
    v_min_stock INTEGER;
    v_product_name TEXT;
BEGIN
    -- Verify the product belongs to the tenant
    IF NOT EXISTS (
        SELECT 1 FROM products
        WHERE id = p_product_id AND tenant_id = p_tenant_id
    ) THEN
        RAISE EXCEPTION 'Product % does not belong to tenant %', p_product_id, p_tenant_id;
    END IF;

    -- Decrement stock (do not go below 0)
    UPDATE products
    SET stock = GREATEST(stock - p_quantity, 0),
        updated_at = NOW()
    WHERE id = p_product_id AND tenant_id = p_tenant_id
    RETURNING stock, min_stock, name
    INTO v_new_stock, v_min_stock, v_product_name;

    -- Insert a low-stock alert if needed (avoid duplicate unread alerts)
    IF v_new_stock < v_min_stock THEN
        IF NOT EXISTS (
            SELECT 1 FROM alerts
            WHERE tenant_id = p_tenant_id
              AND product_id = p_product_id
              AND alert_type IN ('low_stock', 'out_of_stock')
              AND is_read = false
        ) THEN
            INSERT INTO alerts (tenant_id, product_id, alert_type, message, metadata)
            VALUES (
                p_tenant_id,
                p_product_id,
                CASE WHEN v_new_stock = 0 THEN 'out_of_stock' ELSE 'low_stock' END,
                'Stock bajo para ' || v_product_name || ': ' || v_new_stock || ' unidades (min: ' || v_min_stock || ')',
                jsonb_build_object('current_stock', v_new_stock, 'min_stock', v_min_stock)
            );
        END IF;
    END IF;

    RETURN v_new_stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backward-compatible signature used by legacy code
CREATE OR REPLACE FUNCTION decrement_stock(
    p_product_id UUID,
    p_quantity INTEGER,
    p_tenant_id UUID
)
RETURNS VOID AS $$
BEGIN
    PERFORM decrement_stock(p_tenant_id, p_product_id, p_quantity);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- New canonical signature requested by the user
CREATE OR REPLACE FUNCTION increment_stock(
    p_tenant_id UUID,
    p_product_id UUID,
    p_quantity INTEGER
)
RETURNS INTEGER AS $$
DECLARE
    v_new_stock INTEGER;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM products
        WHERE id = p_product_id AND tenant_id = p_tenant_id
    ) THEN
        RAISE EXCEPTION 'Product % does not belong to tenant %', p_product_id, p_tenant_id;
    END IF;

    UPDATE products
    SET stock = stock + p_quantity,
        updated_at = NOW()
    WHERE id = p_product_id AND tenant_id = p_tenant_id
    RETURNING stock INTO v_new_stock;

    RETURN v_new_stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backward-compatible signature used by legacy code
CREATE OR REPLACE FUNCTION increment_stock(
    p_product_id UUID,
    p_quantity INTEGER,
    p_tenant_id UUID
)
RETURNS VOID AS $$
BEGIN
    PERFORM increment_stock(p_tenant_id, p_product_id, p_quantity);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_warehouse_stock(
    p_warehouse_id UUID,
    p_product_id UUID,
    p_quantity INTEGER,
    p_tenant_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE warehouse_stock
    SET quantity = GREATEST(quantity - p_quantity, 0),
        updated_at = NOW()
    WHERE warehouse_id = p_warehouse_id
      AND product_id = p_product_id
      AND tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. LOYALTY & WALLET
-- ============================================

-- New canonical signature requested by the user
CREATE OR REPLACE FUNCTION add_loyalty_points(
    p_tenant_id UUID,
    p_client_id UUID,
    p_points INTEGER
)
RETURNS INTEGER AS $$
DECLARE
    v_total_points INTEGER;
BEGIN
    -- Verify the client belongs to the tenant
    IF NOT EXISTS (
        SELECT 1 FROM clients
        WHERE id = p_client_id AND tenant_id = p_tenant_id
    ) THEN
        RAISE EXCEPTION 'Client % does not belong to tenant %', p_client_id, p_tenant_id;
    END IF;

    UPDATE clients
    SET loyalty_points = LEAST(COALESCE(loyalty_points, 0) + p_points, 2147483647),
        updated_at = NOW()
    WHERE id = p_client_id AND tenant_id = p_tenant_id
    RETURNING loyalty_points INTO v_total_points;

    -- Log activity
    INSERT INTO crm_activities (tenant_id, client_id, activity_type, description, points)
    VALUES (p_tenant_id, p_client_id, 'points_earned', 'Puntos ganados por compra', p_points);

    RETURN v_total_points;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backward-compatible signature used by legacy code
CREATE OR REPLACE FUNCTION add_loyalty_points(
    p_client_id UUID,
    p_points INTEGER,
    p_tenant_id UUID
)
RETURNS VOID AS $$
BEGIN
    PERFORM add_loyalty_points(p_tenant_id, p_client_id, p_points);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION redeem_loyalty_points(
    p_client_id UUID,
    p_points INTEGER,
    p_tenant_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    current_points INTEGER;
BEGIN
    SELECT loyalty_points INTO current_points
    FROM clients WHERE id = p_client_id AND tenant_id = p_tenant_id;

    IF current_points IS NULL OR current_points < p_points THEN
        RETURN FALSE;
    END IF;

    UPDATE clients
    SET loyalty_points = loyalty_points - p_points,
        updated_at = NOW()
    WHERE id = p_client_id AND tenant_id = p_tenant_id;

    INSERT INTO crm_activities (tenant_id, client_id, activity_type, description, points)
    VALUES (p_tenant_id, p_client_id, 'points_redeemed', 'Puntos canjeados', -p_points);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. CREDIT SALES
-- ============================================

CREATE OR REPLACE FUNCTION register_credit_payment(
    p_sale_id UUID,
    p_amount NUMERIC,
    p_tenant_id UUID
)
RETURNS NUMERIC AS $$
DECLARE
    current_balance NUMERIC;
    new_balance NUMERIC;
BEGIN
    SELECT balance INTO current_balance
    FROM sales WHERE id = p_sale_id AND tenant_id = p_tenant_id;

    IF current_balance IS NULL THEN
        RAISE EXCEPTION 'Sale not found';
    END IF;

    new_balance := GREATEST(current_balance - p_amount, 0);

    UPDATE sales
    SET balance = new_balance,
        status = CASE WHEN new_balance <= 0 THEN 'completed' ELSE 'credit' END,
        payment_details = COALESCE(payment_details, '{}') || jsonb_build_object(
            'credit_payment_' || extract(epoch from now()), p_amount
        ),
        updated_at = NOW()
    WHERE id = p_sale_id AND tenant_id = p_tenant_id;

    RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. REPORTING / DASHBOARD
-- ============================================

CREATE OR REPLACE FUNCTION get_sales_summary(
    p_tenant_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE(
    total_sales NUMERIC,
    total_revenue NUMERIC,
    total_tax NUMERIC,
    total_discount NUMERIC,
    avg_sale NUMERIC,
    payment_methods JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::NUMERIC as total_sales,
        COALESCE(SUM(total), 0) as total_revenue,
        COALESCE(SUM(tax_total), 0) as total_tax,
        COALESCE(SUM(discount_total), 0) as total_discount,
        COALESCE(AVG(total), 0) as avg_sale,
        COALESCE(
            jsonb_object_agg(payment_method, cnt),
            '{}'::jsonb
        ) as payment_methods
    FROM sales
    WHERE tenant_id = p_tenant_id
      AND status = 'completed'
      AND DATE(created_at) BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_top_products(
    p_tenant_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    product_id UUID,
    product_name TEXT,
    total_quantity BIGINT,
    total_revenue NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (item->>'productId')::UUID as product_id,
        MAX(item->>'productName') as product_name,
        SUM((item->>'quantity')::INTEGER) as total_quantity,
        SUM((item->>'subtotal')::NUMERIC) as total_revenue
    FROM sales, jsonb_array_elements(items) as item
    WHERE tenant_id = p_tenant_id
      AND status = 'completed'
      AND DATE(created_at) BETWEEN p_start_date AND p_end_date
    GROUP BY item->>'productId'
    ORDER BY total_revenue DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Daily sales summary as JSON
CREATE OR REPLACE FUNCTION get_daily_sales(
    p_tenant_id UUID,
    p_date DATE
)
RETURNS JSONB AS $$
DECLARE
    v_total_ventas NUMERIC;
    v_cantidad_transacciones BIGINT;
    v_total_efectivo NUMERIC;
    v_total_tarjeta NUMERIC;
    v_total_wallet NUMERIC;
BEGIN
    SELECT
        COALESCE(SUM(total), 0),
        COUNT(*),
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_method = 'wallet' THEN total ELSE 0 END), 0)
    INTO
        v_total_ventas,
        v_cantidad_transacciones,
        v_total_efectivo,
        v_total_tarjeta,
        v_total_wallet
    FROM sales
    WHERE tenant_id = p_tenant_id
      AND status = 'completed'
      AND DATE(created_at) = p_date;

    RETURN jsonb_build_object(
        'total_ventas', v_total_ventas,
        'cantidad_transacciones', v_cantidad_transacciones,
        'total_efectivo', v_total_efectivo,
        'total_tarjeta', v_total_tarjeta,
        'total_wallet', v_total_wallet
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Low stock products as a JSON array
CREATE OR REPLACE FUNCTION get_low_stock_products(p_tenant_id UUID)
RETURNS JSONB AS $$
BEGIN
    RETURN (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'stock', p.stock,
                'min_stock', p.min_stock,
                'category_id', p.category_id,
                'price', p.price
            )
            ORDER BY p.stock ASC
        ), '[]'::jsonb)
        FROM products p
        WHERE p.tenant_id = p_tenant_id
          AND p.stock <= p.min_stock
          AND p.is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. TENANT MANAGEMENT (SuperAdmin)
-- ============================================

CREATE OR REPLACE FUNCTION create_tenant_for_user(
    p_user_id UUID,
    p_business_name TEXT,
    p_email TEXT,
    p_plan TEXT DEFAULT 'lite'
)
RETURNS UUID AS $$
DECLARE
    new_tenant_id UUID;
BEGIN
    -- Create tenant
    INSERT INTO tenants (name, business_name, plan)
    VALUES (p_business_name, p_business_name, p_plan)
    RETURNING id INTO new_tenant_id;

    -- Link user as owner
    INSERT INTO tenant_users (user_id, tenant_id, role, is_owner)
    VALUES (p_user_id, new_tenant_id, 'admin', true);

    -- Create default categories
    INSERT INTO categories (tenant_id, name, color, icon) VALUES
        (new_tenant_id, 'Bebidas', 'blue', 'fa-wine-bottle'),
        (new_tenant_id, 'Alimentos', 'emerald', 'fa-hamburger'),
        (new_tenant_id, 'General', 'gray', 'fa-box');

    -- Create default tax
    INSERT INTO taxes (tenant_id, name, rate, type, is_default) VALUES
        (new_tenant_id, 'TVA', 19.25, 'vat', true);

    RETURN new_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. SALES TRIGGERS (stock automation)
-- ============================================

-- Allow 'pending' status for unpaid tickets/orders
ALTER TABLE sales
    DROP CONSTRAINT IF EXISTS sales_status_check,
    ADD CONSTRAINT sales_status_check
    CHECK (status IN ('pending','completed','credit','cancelled','refunded'));

-- Helper to safely read the session flag that skips automatic stock handling
CREATE OR REPLACE FUNCTION _should_skip_sale_stock_trigger()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(current_setting('app.skip_sale_stock_trigger', true), 'false') = 'true';
EXCEPTION WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function: on_sale_insert
CREATE OR REPLACE FUNCTION trg_on_sale_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_item JSONB;
    v_product_id UUID;
    v_qty INTEGER;
BEGIN
    -- Skip if the caller already handled stock manually (e.g. process_complete_checkout)
    IF _should_skip_sale_stock_trigger() THEN
        RETURN NEW;
    END IF;

    -- Skip unpaid/pending tickets
    IF NEW.status = 'pending' THEN
        RETURN NEW;
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::JSONB))
    LOOP
        v_product_id := (v_item->>'productId')::UUID;
        v_qty := COALESCE((v_item->>'quantity')::INTEGER, (v_item->>'qty')::INTEGER, 0);

        IF v_product_id IS NOT NULL AND v_qty > 0 THEN
            PERFORM decrement_stock(NEW.tenant_id, v_product_id, v_qty);
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_sale_insert ON sales;
CREATE TRIGGER on_sale_insert
    AFTER INSERT ON sales
    FOR EACH ROW
    EXECUTE FUNCTION trg_on_sale_insert();

-- Trigger function: on_sale_update
CREATE OR REPLACE FUNCTION trg_on_sale_update()
RETURNS TRIGGER AS $$
DECLARE
    v_item JSONB;
    v_product_id UUID;
    v_qty INTEGER;
BEGIN
    IF _should_skip_sale_stock_trigger() THEN
        RETURN NEW;
    END IF;

    -- pending -> completed (equivalent to pending -> paid)
    IF OLD.status = 'pending' AND NEW.status = 'completed' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::JSONB))
        LOOP
            v_product_id := (v_item->>'productId')::UUID;
            v_qty := COALESCE((v_item->>'quantity')::INTEGER, (v_item->>'qty')::INTEGER, 0);
            IF v_product_id IS NOT NULL AND v_qty > 0 THEN
                PERFORM decrement_stock(NEW.tenant_id, v_product_id, v_qty);
            END IF;
        END LOOP;
    END IF;

    -- completed -> cancelled or refunded
    IF OLD.status = 'completed' AND NEW.status IN ('cancelled', 'refunded') THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::JSONB))
        LOOP
            v_product_id := (v_item->>'productId')::UUID;
            v_qty := COALESCE((v_item->>'quantity')::INTEGER, (v_item->>'qty')::INTEGER, 0);
            IF v_product_id IS NOT NULL AND v_qty > 0 THEN
                PERFORM increment_stock(NEW.tenant_id, v_product_id, v_qty);
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_sale_update ON sales;
CREATE TRIGGER on_sale_update
    AFTER UPDATE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION trg_on_sale_update();

-- ============================================
-- 7. TRIGGER: Auto-update client tier based on spending
-- ============================================

CREATE OR REPLACE FUNCTION update_client_tier()
RETURNS TRIGGER AS $$
DECLARE
    total_spent NUMERIC;
    new_tier TEXT;
BEGIN
    -- Calculate total spent by client
    SELECT COALESCE(SUM(total), 0) INTO total_spent
    FROM sales
    WHERE client_id = NEW.client_id
      AND tenant_id = NEW.tenant_id
      AND status = 'completed';

    -- Determine tier
    new_tier := CASE
        WHEN total_spent >= 1000000 THEN 'platinum'
        WHEN total_spent >= 500000 THEN 'gold'
        WHEN total_spent >= 100000 THEN 'silver'
        ELSE 'bronze'
    END;

    UPDATE clients
    SET tier = new_tier,
        updated_at = NOW()
    WHERE id = NEW.client_id AND tenant_id = NEW.tenant_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_client_tier ON sales;
CREATE TRIGGER trg_update_client_tier
    AFTER INSERT ON sales
    FOR EACH ROW
    WHEN (NEW.client_id IS NOT NULL AND NEW.status = 'completed')
    EXECUTE FUNCTION update_client_tier();

-- ============================================
-- 8. USER MANAGEMENT (Admin-only RPC)
-- ============================================

CREATE OR REPLACE FUNCTION create_user_for_tenant(
    p_tenant_id UUID,
    p_email TEXT,
    p_password TEXT,
    p_name TEXT,
    p_role TEXT DEFAULT 'seller',
    p_pin_hash TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
    caller_id UUID;
    caller_role TEXT;
BEGIN
    caller_id := auth.uid();
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT role INTO caller_role
    FROM tenant_users
    WHERE user_id = caller_id AND tenant_id = p_tenant_id;

    IF caller_role IS NULL OR (caller_role <> 'admin' AND caller_role <> 'superadmin') THEN
        RAISE EXCEPTION 'Admin privileges required';
    END IF;

    SELECT id INTO new_user_id FROM auth.users WHERE email = p_email;
    IF new_user_id IS NOT NULL THEN
        INSERT INTO tenant_users (user_id, tenant_id, role, pin_hash, metadata)
        VALUES (new_user_id, p_tenant_id, p_role, p_pin_hash, p_metadata)
        ON CONFLICT (user_id, tenant_id) DO UPDATE SET
            role = EXCLUDED.role,
            pin_hash = EXCLUDED.pin_hash,
            metadata = EXCLUDED.metadata,
            updated_at = NOW();
        RETURN new_user_id;
    END IF;

    INSERT INTO auth.users (
        id, email, encrypted_password, email_confirmed_at,
        raw_user_meta_data, created_at, updated_at
    ) VALUES (
        uuid_generate_v4(), p_email, crypt(p_password, gen_salt('bf')), NOW(),
        jsonb_build_object('name', p_name, 'role', p_role), NOW(), NOW()
    )
    RETURNING id INTO new_user_id;

    INSERT INTO tenant_users (user_id, tenant_id, role, pin_hash, metadata)
    VALUES (new_user_id, p_tenant_id, p_role, p_pin_hash, p_metadata);

    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_tenant_user(
    p_tenant_id UUID,
    p_user_id UUID,
    p_role TEXT DEFAULT NULL,
    p_pin_hash TEXT DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    caller_id UUID;
    caller_role TEXT;
BEGIN
    caller_id := auth.uid();
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT role INTO caller_role
    FROM tenant_users
    WHERE user_id = caller_id AND tenant_id = p_tenant_id;

    IF caller_role IS NULL OR (caller_role <> 'admin' AND caller_role <> 'superadmin') THEN
        RAISE EXCEPTION 'Admin privileges required';
    END IF;

    UPDATE tenant_users
    SET
        role = COALESCE(p_role, role),
        pin_hash = COALESCE(p_pin_hash, pin_hash),
        is_active = COALESCE(p_is_active, is_active),
        metadata = COALESCE(p_metadata, metadata),
        updated_at = NOW()
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION delete_tenant_user(
    p_tenant_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    caller_id UUID;
    caller_role TEXT;
BEGIN
    caller_id := auth.uid();
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT role INTO caller_role
    FROM tenant_users
    WHERE user_id = caller_id AND tenant_id = p_tenant_id;

    IF caller_role IS NULL OR (caller_role <> 'admin' AND caller_role <> 'superadmin') THEN
        RAISE EXCEPTION 'Admin privileges required';
    END IF;

    -- Prevent self-deletion
    IF caller_id = p_user_id THEN
        RAISE EXCEPTION 'Cannot delete yourself';
    END IF;

    -- Remove tenant linkage (keep auth.user for audit/history)
    DELETE FROM tenant_users
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_tenant_users(p_tenant_id UUID)
RETURNS TABLE(
    user_id UUID,
    email TEXT,
    name TEXT,
    role TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id AS user_id,
        u.email::TEXT,
        COALESCE(u.raw_user_meta_data->>'name', '')::TEXT AS name,
        tu.role,
        tu.is_active,
        tu.created_at
    FROM auth.users u
    INNER JOIN tenant_users tu ON tu.user_id = u.id
    WHERE tu.tenant_id = p_tenant_id
    ORDER BY tu.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. RPC SECURITY: only authenticated users
-- ============================================

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Ensure future functions created in this schema are also restricted
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- Service role (used by edge functions) can still execute everything by default
-- because it bypasses RLS and role grants in Supabase.
