-- ============================================================
-- MIGRACIÓN: CRM, Tienda Web, Portal de Entregas
-- ============================================================
-- Añade tablas y columnas faltantes para CRM, public store,
-- order tracking, delivery portal y app cliente.

-- ============================================================
-- 1. COLUMNAS ADICIONALES EN TABLAS EXISTENTES
-- ============================================================

ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS first_name TEXT,
    ADD COLUMN IF NOT EXISTS last_name TEXT,
    ADD COLUMN IF NOT EXISTS pin_hash TEXT,
    ADD COLUMN IF NOT EXISTS loyalty_card_number TEXT,
    ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'bronze',
    ADD COLUMN IF NOT EXISTS credit DECIMAL(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS purchases INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_clients_loyalty_card ON clients(loyalty_card_number);
CREATE INDEX IF NOT EXISTS idx_clients_pin_lookup ON clients(tenant_id, phone, email);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deliveries') THEN
        ALTER TABLE deliveries
            ADD COLUMN IF NOT EXISTS tracking_code TEXT,
            ADD COLUMN IF NOT EXISTS timeline JSONB DEFAULT '[]'::jsonb;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_deliveries_tracking_code ON deliveries(tracking_code) WHERE tracking_code IS NOT NULL;
    END IF;
END $$;

-- ============================================================
-- 2. TABLAS CRM
-- ============================================================

CREATE TABLE IF NOT EXISTS loyalty_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    card_number TEXT,
    tier TEXT DEFAULT 'bronze',
    points INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    type TEXT,
    amount DECIMAL(12,2),
    balance_after DECIMAL(12,2),
    description TEXT,
    related_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT,
    description TEXT,
    discount_type TEXT,
    discount_value DECIMAL(12,2),
    min_purchase DECIMAL(12,2),
    max_uses INTEGER,
    uses_count INTEGER DEFAULT 0,
    valid_from DATE,
    valid_until DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS discount_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT,
    description TEXT,
    discount_type TEXT,
    discount_value DECIMAL(12,2),
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    target_tiers TEXT[],
    min_purchase DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    action TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reload_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    amount DECIMAL(12,2),
    status TEXT DEFAULT 'pending',
    notes TEXT,
    requested_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crm_coupon_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    coupon_id UUID,
    purchased_at TIMESTAMP DEFAULT NOW(),
    discount_applied DECIMAL(12,2),
    status TEXT DEFAULT 'active'
);

-- ============================================================
-- 3. TABLAS PÚBLICAS (Tienda Web, Tracking, Entregas)
-- ============================================================

CREATE TABLE IF NOT EXISTS public_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    order_code TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    customer_email TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    total DECIMAL(12,2),
    status TEXT DEFAULT 'pending',
    payment_method TEXT,
    delivery_address TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public_order_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID,
    code TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public_order_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID,
    sender TEXT,
    sender_name TEXT,
    text TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    tracking_code TEXT UNIQUE,
    invoice_id UUID,
    client_name TEXT,
    client_phone TEXT,
    address TEXT,
    status TEXT DEFAULT 'pending',
    delivery_person TEXT,
    estimated_time INTEGER,
    timeline JSONB DEFAULT '[]'::jsonb,
    scheduled_at TIMESTAMP,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 4. RLS POLICIES
-- ============================================================

-- CRM tables (authenticated tenant users)
ALTER TABLE loyalty_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE reload_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_coupon_purchases ENABLE ROW LEVEL SECURITY;

-- Public tables (anonymous access)
ALTER TABLE public_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_order_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_order_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_deliveries ENABLE ROW LEVEL SECURITY;

-- Helper function for tenant isolation (authenticated)
CREATE OR REPLACE FUNCTION get_auth_tenant_ids()
RETURNS TABLE(tenant_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies for CRM tables
DROP POLICY IF EXISTS loyalty_cards_isolation ON loyalty_cards;
CREATE POLICY loyalty_cards_isolation ON loyalty_cards
    FOR ALL USING (tenant_id IN (SELECT get_auth_tenant_ids()));
DROP POLICY IF EXISTS wallet_tx_isolation ON wallet_transactions;
CREATE POLICY wallet_tx_isolation ON wallet_transactions
    FOR ALL USING (tenant_id IN (SELECT get_auth_tenant_ids()));
DROP POLICY IF EXISTS crm_coupons_isolation ON crm_coupons;
CREATE POLICY crm_coupons_isolation ON crm_coupons
    FOR ALL USING (tenant_id IN (SELECT get_auth_tenant_ids()));
DROP POLICY IF EXISTS discount_campaigns_isolation ON discount_campaigns;
CREATE POLICY discount_campaigns_isolation ON discount_campaigns
    FOR ALL USING (tenant_id IN (SELECT get_auth_tenant_ids()));
DROP POLICY IF EXISTS crm_activities_isolation ON crm_activities;
CREATE POLICY crm_activities_isolation ON crm_activities
    FOR ALL USING (tenant_id IN (SELECT get_auth_tenant_ids()));
DROP POLICY IF EXISTS reload_requests_isolation ON reload_requests;
CREATE POLICY reload_requests_isolation ON reload_requests
    FOR ALL USING (tenant_id IN (SELECT get_auth_tenant_ids()));
DROP POLICY IF EXISTS coupon_purchases_isolation ON crm_coupon_purchases;
CREATE POLICY coupon_purchases_isolation ON crm_coupon_purchases
    FOR ALL USING (tenant_id IN (SELECT get_auth_tenant_ids()));

-- Public policies (no auth required)
DROP POLICY IF EXISTS public_orders_select ON public_orders;
CREATE POLICY public_orders_select ON public_orders FOR SELECT USING (true);
DROP POLICY IF EXISTS public_orders_insert ON public_orders;
CREATE POLICY public_orders_insert ON public_orders FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS public_order_codes_select ON public_order_codes;
CREATE POLICY public_order_codes_select ON public_order_codes FOR SELECT USING (true);
DROP POLICY IF EXISTS public_order_codes_insert ON public_order_codes;
CREATE POLICY public_order_codes_insert ON public_order_codes FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS public_messages_select ON public_order_messages;
CREATE POLICY public_messages_select ON public_order_messages FOR SELECT USING (true);
DROP POLICY IF EXISTS public_messages_insert ON public_order_messages;
CREATE POLICY public_messages_insert ON public_order_messages FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS public_deliveries_select ON public_deliveries;
CREATE POLICY public_deliveries_select ON public_deliveries FOR SELECT USING (true);

-- Allow public read on products/categories for store (only if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
        DROP POLICY IF EXISTS products_public_select ON products;
        CREATE POLICY products_public_select ON products FOR SELECT USING (true);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories') THEN
        DROP POLICY IF EXISTS categories_public_select ON categories;
        CREATE POLICY categories_public_select ON categories FOR SELECT USING (true);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_settings') THEN
        DROP POLICY IF EXISTS tenant_settings_public_select ON tenant_settings;
        CREATE POLICY tenant_settings_public_select ON tenant_settings FOR SELECT USING (true);
    END IF;
END $$;

-- ============================================================
-- 5. FUNCIONES RPC (SECURITY DEFINER)
-- ============================================================

-- CRM Client Login: busca cliente por teléfono/email/tarjeta y verifica PIN
CREATE OR REPLACE FUNCTION crm_client_login(
    p_tenant_id UUID,
    p_input TEXT,
    p_pin TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_client RECORD;
BEGIN
    SELECT * INTO v_client FROM clients
    WHERE tenant_id = p_tenant_id
      AND (
          LOWER(REPLACE(phone, ' ', '')) = LOWER(REPLACE(p_input, ' ', ''))
          OR LOWER(email) = LOWER(p_input)
          OR LOWER(loyalty_card_number) = LOWER(REPLACE(p_input, ' ', ''))
      )
    LIMIT 1;

    IF v_client IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cliente no encontrado');
    END IF;

    IF v_client.pin_hash IS NULL OR v_client.pin_hash = '' THEN
        -- Primer login: establecer PIN
        UPDATE clients SET pin_hash = p_pin, updated_at = NOW()
        WHERE id = v_client.id;
        RETURN jsonb_build_object('success', true, 'client', row_to_json(v_client));
    END IF;

    IF v_client.pin_hash <> p_pin THEN
        RETURN jsonb_build_object('success', false, 'error', 'PIN incorrecto');
    END IF;

    RETURN jsonb_build_object('success', true, 'client', row_to_json(v_client));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get wallet transactions for a client
CREATE OR REPLACE FUNCTION crm_client_get_transactions(
    p_tenant_id UUID,
    p_client_id UUID
)
RETURNS SETOF wallet_transactions AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM wallet_transactions
    WHERE tenant_id = p_tenant_id AND client_id = p_client_id
    ORDER BY created_at DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get coupon purchases for a client
CREATE OR REPLACE FUNCTION crm_client_get_coupons(
    p_tenant_id UUID,
    p_client_id UUID
)
RETURNS SETOF crm_coupon_purchases AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM crm_coupon_purchases
    WHERE tenant_id = p_tenant_id AND client_id = p_client_id
    ORDER BY purchased_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Submit reload request
CREATE OR REPLACE FUNCTION crm_client_submit_reload(
    p_tenant_id UUID,
    p_client_id UUID,
    p_amount DECIMAL,
    p_notes TEXT DEFAULT ''
)
RETURNS JSONB AS $$
DECLARE
    v_req_id UUID;
BEGIN
    IF p_amount <= 0 OR p_amount > 1000000 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Monto inválido');
    END IF;

    INSERT INTO reload_requests (tenant_id, client_id, amount, status, notes)
    VALUES (p_tenant_id, p_client_id, p_amount, 'pending', p_notes)
    RETURNING id INTO v_req_id;

    RETURN jsonb_build_object('success', true, 'request_id', v_req_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Transfer between clients
CREATE OR REPLACE FUNCTION crm_client_transfer(
    p_tenant_id UUID,
    p_from_client_id UUID,
    p_to_phone TEXT,
    p_amount DECIMAL,
    p_concept TEXT DEFAULT '',
    p_pin TEXT DEFAULT ''
)
RETURNS JSONB AS $$
DECLARE
    v_from clients%ROWTYPE;
    v_to clients%ROWTYPE;
    v_from_balance DECIMAL;
    v_to_balance DECIMAL;
BEGIN
    -- Verify sender PIN
    SELECT * INTO v_from FROM clients WHERE id = p_from_client_id AND tenant_id = p_tenant_id;
    IF v_from IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cliente origen no encontrado');
    END IF;
    IF COALESCE(v_from.pin_hash, '') <> COALESCE(p_pin, '') THEN
        RETURN jsonb_build_object('success', false, 'error', 'PIN incorrecto');
    END IF;

    -- Find recipient by phone
    SELECT * INTO v_to FROM clients
    WHERE tenant_id = p_tenant_id AND REPLACE(phone, ' ', '') = REPLACE(p_to_phone, ' ', '')
    LIMIT 1;
    IF v_to IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Destinatario no encontrado');
    END IF;
    IF v_to.id = v_from.id THEN
        RETURN jsonb_build_object('success', false, 'error', 'No puedes transferirte a ti mismo');
    END IF;

    -- Check balance
    v_from_balance := COALESCE(v_from.wallet_balance, 0) - p_amount;
    IF v_from_balance < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Saldo insuficiente');
    END IF;
    v_to_balance := COALESCE(v_to.wallet_balance, 0) + p_amount;

    -- Update balances
    UPDATE clients SET wallet_balance = v_from_balance, updated_at = NOW() WHERE id = v_from.id;
    UPDATE clients SET wallet_balance = v_to_balance, updated_at = NOW() WHERE id = v_to.id;

    -- Record transactions
    INSERT INTO wallet_transactions (tenant_id, client_id, type, amount, balance_after, description, related_client_id, status, created_at)
    VALUES (p_tenant_id, v_from.id, 'transfer_out', p_amount, v_from_balance, COALESCE(p_concept, 'Transferencia a ' || v_to.first_name), v_to.id, 'completed', NOW());

    INSERT INTO wallet_transactions (tenant_id, client_id, type, amount, balance_after, description, related_client_id, status, created_at)
    VALUES (p_tenant_id, v_to.id, 'transfer_in', p_amount, v_to_balance, 'Transferencia de ' || v_from.first_name, v_from.id, 'completed', NOW());

    RETURN jsonb_build_object('success', true, 'from_balance', v_from_balance, 'to_balance', v_to_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Public store: get catalog for a tenant
CREATE OR REPLACE FUNCTION public_store_get_catalog(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_products JSONB;
    v_categories JSONB;
BEGIN
    SELECT jsonb_agg(row_to_json(p)) INTO v_products
    FROM products p WHERE p.tenant_id = p_tenant_id AND p.is_active = true;

    SELECT jsonb_agg(row_to_json(c)) INTO v_categories
    FROM categories c WHERE c.tenant_id = p_tenant_id;

    RETURN jsonb_build_object('products', COALESCE(v_products, '[]'::jsonb), 'categories', COALESCE(v_categories, '[]'::jsonb));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Public store: create order atomically
CREATE OR REPLACE FUNCTION public_store_create_order(
    p_tenant_id UUID,
    p_order_code TEXT,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_customer_email TEXT,
    p_items JSONB,
    p_total DECIMAL,
    p_payment_method TEXT,
    p_delivery_address TEXT,
    p_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_order_id UUID;
BEGIN
    INSERT INTO public_orders (tenant_id, order_code, customer_name, customer_phone, customer_email, items, total, payment_method, delivery_address, notes)
    VALUES (p_tenant_id, p_order_code, p_customer_name, p_customer_phone, p_customer_email, p_items, p_total, p_payment_method, p_delivery_address, p_notes)
    RETURNING id INTO v_order_id;

    INSERT INTO public_order_codes (tenant_id, order_id, code)
    VALUES (p_tenant_id, v_order_id, p_order_code);

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'order_code', p_order_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Track delivery by tracking code
CREATE OR REPLACE FUNCTION track_delivery(p_tracking_code TEXT)
RETURNS JSONB AS $$
DECLARE
    v_delivery RECORD;
BEGIN
    SELECT * INTO v_delivery FROM public_deliveries WHERE tracking_code = p_tracking_code LIMIT 1;
    IF v_delivery IS NULL THEN
        RETURN jsonb_build_object('found', false);
    END IF;
    RETURN jsonb_build_object('found', true, 'delivery', row_to_json(v_delivery));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
