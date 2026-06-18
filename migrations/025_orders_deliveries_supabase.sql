-- ============================================
-- Migration 025: Orders + Deliveries tables for Supabase backend
-- Replaces Firestore collections:
--   rw_tenants/{tenantId}/incoming_orders  -> orders
--   deliveries (already used by JS sync)    -> deliveries
--   public_deliveries (portal tracking)     -> public_deliveries
-- ============================================

-- ============================================
-- 1. ORDERS (formerly incoming_orders / Order-Pill)
-- ============================================

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_order_id TEXT,
    customer JSONB DEFAULT '{}',
    customer_name TEXT,
    items JSONB NOT NULL DEFAULT '[]',
    totals JSONB DEFAULT '{}',
    payment_method TEXT DEFAULT 'mobile' CHECK (payment_method IN ('cash','card','mobile','credit','wallet')),
    status TEXT DEFAULT 'received' CHECK (status IN ('received','ready_to_invoice','invoiced','pending','cancelled')),
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    linked_sale_id TEXT,
    invoiced_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_external_order_id ON orders(tenant_id, external_order_id);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS orders_isolation ON orders;
CREATE POLICY orders_isolation ON orders
    FOR ALL USING (is_tenant_member(tenant_id));

-- ============================================
-- 2. DELIVERIES
-- ============================================

CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id UUID,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    client_name TEXT,
    client_phone TEXT,
    address TEXT,
    delivery_notes TEXT,
    status TEXT DEFAULT 'pending',
    delivery_person TEXT,
    estimated_time TEXT,
    tracking_code TEXT,
    timeline JSONB DEFAULT '[]',
    scheduled_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_tenant ON deliveries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_tracking ON deliveries(tenant_id, tracking_code);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(tenant_id, status);

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deliveries_isolation ON deliveries;
CREATE POLICY deliveries_isolation ON deliveries
    FOR ALL USING (is_tenant_member(tenant_id));

-- ============================================
-- 3. PUBLIC DELIVERIES (tracking portal)
-- ============================================

CREATE TABLE IF NOT EXISTS public_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
    tracking_code TEXT NOT NULL,
    invoice_id UUID,
    client_name TEXT,
    client_phone TEXT,
    address TEXT,
    status TEXT DEFAULT 'pending',
    delivery_person TEXT,
    estimated_time TEXT,
    timeline JSONB DEFAULT '[]',
    scheduled_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_deliveries_tracking ON public_deliveries(tracking_code);
CREATE INDEX IF NOT EXISTS idx_public_deliveries_tenant ON public_deliveries(tenant_id);

-- Ensure delivery_id column exists in case the table was created by an earlier partial run
ALTER TABLE public_deliveries ADD COLUMN IF NOT EXISTS delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE;

ALTER TABLE public_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_deliveries_tracking ON public_deliveries;
CREATE POLICY public_deliveries_tracking ON public_deliveries
    FOR SELECT USING (true);

-- Restrict mutations to authenticated tenant members
DROP POLICY IF EXISTS public_deliveries_isolation ON public_deliveries;
CREATE POLICY public_deliveries_isolation ON public_deliveries
    FOR ALL USING (is_tenant_member(tenant_id));

-- ============================================
-- 4. TRIGGER: keep public_deliveries in sync with deliveries
-- ============================================

CREATE OR REPLACE FUNCTION sync_public_delivery()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'entregada' OR NEW.status = 'delivered' THEN
        INSERT INTO public_deliveries (
            id, tenant_id, delivery_id, tracking_code, invoice_id, client_name,
            client_phone, address, status, delivery_person, estimated_time,
            timeline, scheduled_at, delivered_at, updated_at
        )
        VALUES (
            NEW.id, NEW.tenant_id, NEW.id, NEW.tracking_code, NEW.invoice_id,
            NEW.client_name, NEW.client_phone, NEW.address, NEW.status,
            NEW.delivery_person, NEW.estimated_time, NEW.timeline, NEW.scheduled_at,
            NEW.delivered_at, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            tracking_code = EXCLUDED.tracking_code,
            invoice_id = EXCLUDED.invoice_id,
            client_name = EXCLUDED.client_name,
            client_phone = EXCLUDED.client_phone,
            address = EXCLUDED.address,
            status = EXCLUDED.status,
            delivery_person = EXCLUDED.delivery_person,
            estimated_time = EXCLUDED.estimated_time,
            timeline = EXCLUDED.timeline,
            scheduled_at = EXCLUDED.scheduled_at,
            delivered_at = EXCLUDED.delivered_at,
            updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_public_delivery ON deliveries;
CREATE TRIGGER trg_sync_public_delivery
    AFTER INSERT OR UPDATE ON deliveries
    FOR EACH ROW
    EXECUTE FUNCTION sync_public_delivery();

-- ============================================
-- 5. ADD TABLES TO REALTIME PUBLICATION
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE deliveries;
ALTER PUBLICATION supabase_realtime ADD TABLE public_deliveries;

-- ============================================
-- 6. RPC: get_public_delivery_by_tracking (for portal)
-- ============================================

CREATE OR REPLACE FUNCTION get_public_delivery_by_tracking(p_tracking_code TEXT)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT to_jsonb(pd) INTO v_result
    FROM public_deliveries pd
    WHERE pd.tracking_code = p_tracking_code
    ORDER BY pd.updated_at DESC
    LIMIT 1;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
