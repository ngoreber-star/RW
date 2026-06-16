-- ============================================
-- RIVER-WALL PRO v3.3 - Supabase Schema
-- Base: Multi-tenant POS with offline-first support
-- Adapted from Lake-Wall architecture
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. TENANTS & MULTI-TENANCY
-- ============================================

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    business_name TEXT,
    tax_id TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'CM',
    currency TEXT DEFAULT 'XAF',
    timezone TEXT DEFAULT 'Africa/Douala',
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    syscohada_enabled BOOLEAN DEFAULT false,
    plan TEXT DEFAULT 'lite' CHECK (plan IN ('lite','pro','enterprise')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active','suspended','cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE tenants IS 'Multi-tenant root. Each business gets one row.';

-- ============================================
-- 2. USER-TENANT LINKAGE (RBAC)
-- ============================================

CREATE TABLE IF NOT EXISTS tenant_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('admin','manager','cashier','waiter','kitchen','accountant','superadmin')),
    pin_hash TEXT, -- For offline POS login
    is_owner BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}', -- localIds, allLocals, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, tenant_id)
);

COMMENT ON TABLE tenant_users IS 'Links Supabase Auth users to tenants with roles.';

-- Helper: get tenant_ids for current user
CREATE OR REPLACE FUNCTION get_user_tenant_ids(p_user_id UUID)
RETURNS TABLE(tenant_id UUID) AS $$
BEGIN
    RETURN QUERY SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. PRODUCTS & CATALOG
-- ============================================

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT 'blue',
    icon TEXT DEFAULT 'fa-tag',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    sku TEXT,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(15,2) NOT NULL DEFAULT 0,
    cost NUMERIC(15,2) DEFAULT 0,
    stock INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    unit TEXT DEFAULT 'unidad',
    barcode TEXT,
    image_url TEXT,
    tax_rate NUMERIC(5,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    has_variants BOOLEAN DEFAULT false,
    variants JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_tenant ON products(tenant_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_barcode ON products(barcode);

-- ============================================
-- 4. CLIENTS (CRM fields included)
-- ============================================

CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    tax_id TEXT,
    notes TEXT,
    -- CRM fields
    loyalty_card_number TEXT UNIQUE,
    tier TEXT DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','platinum')),
    wallet_balance NUMERIC(15,2) DEFAULT 0,
    loyalty_points INTEGER DEFAULT 0,
    pin_hash TEXT, -- 4-digit PIN for wallet payments
    credit_limit NUMERIC(15,2) DEFAULT 0,
    total_credit NUMERIC(15,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clients_tenant ON clients(tenant_id);
CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_clients_loyalty ON clients(loyalty_card_number);

-- ============================================
-- 5. LOCALES / STORES
-- ============================================

CREATE TABLE IF NOT EXISTS locales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    address TEXT,
    phone TEXT,
    is_main BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. SALES (POS transactions)
-- ============================================

CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sale_local_id TEXT, -- Original local ID for sync matching
    sale_number TEXT,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    locale_id UUID REFERENCES locales(id) ON DELETE SET NULL,
    items JSONB NOT NULL DEFAULT '[]',
    subtotal NUMERIC(15,2) DEFAULT 0,
    tax_total NUMERIC(15,2) DEFAULT 0,
    discount_total NUMERIC(15,2) DEFAULT 0,
    total NUMERIC(15,2) NOT NULL DEFAULT 0,
    payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash','card','wallet','mobile_money','credit','mixed')),
    payment_details JSONB DEFAULT '{}',
    status TEXT DEFAULT 'completed' CHECK (status IN ('completed','credit','cancelled','refunded')),
    balance NUMERIC(15,2) DEFAULT 0, -- For credit sales
    notes TEXT,
    pos_terminal_id TEXT,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sales_tenant ON sales(tenant_id);
CREATE INDEX idx_sales_created ON sales(created_at DESC);
CREATE INDEX idx_sales_client ON sales(client_id);

-- Auto-increment sale number per tenant
CREATE OR REPLACE FUNCTION generate_sale_number()
RETURNS TRIGGER AS $$
DECLARE
    year_prefix TEXT;
    next_num INTEGER;
BEGIN
    year_prefix := 'S' || TO_CHAR(NEW.created_at, 'YYYY');
    SELECT COALESCE(MAX(NULLIF(regexp_replace(sale_number, '^S\d{4}', ''), '')), '0')::INTEGER + 1
    INTO next_num
    FROM sales
    WHERE tenant_id = NEW.tenant_id AND sale_number LIKE year_prefix || '%';
    NEW.sale_number := year_prefix || LPAD(next_num::TEXT, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_sale_number
    BEFORE INSERT ON sales
    FOR EACH ROW
    WHEN (NEW.sale_number IS NULL)
    EXECUTE FUNCTION generate_sale_number();

-- ============================================
-- 7. PURCHASES
-- ============================================

CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    supplier_id UUID,
    locale_id UUID REFERENCES locales(id) ON DELETE SET NULL,
    invoice_number TEXT,
    items JSONB NOT NULL DEFAULT '[]',
    subtotal NUMERIC(15,2) DEFAULT 0,
    tax_total NUMERIC(15,2) DEFAULT 0,
    total NUMERIC(15,2) DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','received','partial','cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_purchases_tenant ON purchases(tenant_id);

-- ============================================
-- 8. SUPPLIERS
-- ============================================

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    tax_id TEXT,
    payment_terms TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. WAREHOUSES & STOCK
-- ============================================

CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    type TEXT DEFAULT 'store' CHECK (type IN ('store','general','cold','transit')),
    locale_id UUID REFERENCES locales(id) ON DELETE SET NULL,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse_stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 0,
    lot_number TEXT,
    expiry_date DATE,
    variant_key TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(warehouse_id, product_id, lot_number, variant_key)
);

CREATE INDEX idx_warehouse_stock_tenant ON warehouse_stock(tenant_id);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('in','out','transfer','adjustment','waste')),
    quantity INTEGER NOT NULL,
    reason TEXT,
    reference_id UUID,
    reference_type TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inv_movements_tenant ON inventory_movements(tenant_id);

-- ============================================
-- 10. TRANSFERS
-- ============================================

CREATE TABLE IF NOT EXISTS transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    from_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    to_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    items JSONB NOT NULL DEFAULT '[]',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_transit','received','cancelled')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. POS TERMINALS & CLOSURES
-- ============================================

CREATE TABLE IF NOT EXISTS pos_terminals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    locale_id UUID REFERENCES locales(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    current_session JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pos_terminal_closures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    terminal_id UUID REFERENCES pos_terminals(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    opened_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    opening_amount NUMERIC(15,2) DEFAULT 0,
    closing_amount NUMERIC(15,2) DEFAULT 0,
    expected_amount NUMERIC(15,2) DEFAULT 0,
    difference NUMERIC(15,2) DEFAULT 0,
    sales_count INTEGER DEFAULT 0,
    sales_total NUMERIC(15,2) DEFAULT 0,
    payment_totals JSONB DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 12. TAXES
-- ============================================

CREATE TABLE IF NOT EXISTS taxes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    type TEXT DEFAULT 'vat' CHECK (type IN ('vat','sales','service','custom')),
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 13. AUDIT LOGS
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('CREATE','UPDATE','DELETE','LOGIN','LOGOUT','EXPORT','IMPORT')),
    table_name TEXT,
    record_id TEXT,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_logs (tenant_id, action, table_name, record_id, old_data)
        VALUES (OLD.tenant_id, 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO audit_logs (tenant_id, action, table_name, record_id, old_data, new_data)
        VALUES (NEW.tenant_id, 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_logs (tenant_id, action, table_name, record_id, new_data)
        VALUES (NEW.tenant_id, 'CREATE', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 14. UPDATED_AT trigger helper
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at to all tables
DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'tenants','tenant_users','categories','products','clients','locales',
        'sales','purchases','suppliers','warehouses','warehouse_stock',
        'inventory_movements','transfers','pos_terminals','pos_terminal_closures',
        'taxes'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', tbl, tbl);
        EXECUTE format('CREATE TRIGGER trg_%s_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
            tbl, tbl);
    END LOOP;
END $$;

-- Apply audit triggers to sensitive tables
CREATE TRIGGER trg_products_audit AFTER INSERT OR UPDATE OR DELETE ON products
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER trg_clients_audit AFTER INSERT OR UPDATE OR DELETE ON clients
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER trg_sales_audit AFTER INSERT OR UPDATE OR DELETE ON sales
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
