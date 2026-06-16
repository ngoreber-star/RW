-- ============================================================
-- FIX: Columnas faltantes en sales + tablas contables
-- ============================================================

-- 1. Añadir columnas faltantes a sales (para evitar 400 Bad Request en sync)
ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS client_name TEXT,
    ADD COLUMN IF NOT EXISTS discount NUMERIC(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS promotion_discount NUMERIC(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS manual_discount NUMERIC(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS campaign_discount NUMERIC(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS applied_coupon_code TEXT,
    ADD COLUMN IF NOT EXISTS applied_campaign_id UUID REFERENCES discount_campaigns(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tax NUMERIC(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tax_summary JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS split_payments JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS paid NUMERIC(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sale_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS pos_terminal_name TEXT,
    ADD COLUMN IF NOT EXISTS pos_terminal_code TEXT;

CREATE INDEX IF NOT EXISTS idx_sales_campaign ON sales(applied_campaign_id);

-- 2. Tablas contables (para evitar 404 Not Found en sync)
CREATE TABLE IF NOT EXISTS accounting_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    nature TEXT,
    class_id TEXT,
    description TEXT,
    balance NUMERIC(15,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounting_accounts_tenant ON accounting_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_accounting_accounts_code ON accounting_accounts(tenant_id, code);

CREATE TABLE IF NOT EXISTS accounting_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    date DATE NOT NULL,
    document_date DATE,
    concept TEXT NOT NULL,
    document_ref TEXT,
    sale_id TEXT,
    lines JSONB DEFAULT '[]'::jsonb,
    total_debe NUMERIC(15,2) DEFAULT 0,
    total_haber NUMERIC(15,2) DEFAULT 0,
    status TEXT DEFAULT 'posted',
    source TEXT DEFAULT 'manual',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounting_entries_tenant ON accounting_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_number ON accounting_entries(tenant_id, number);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_sale ON accounting_entries(sale_id);

-- 3. Trigger updated_at para tablas contables
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_accounting_accounts_updated_at ON accounting_accounts;
CREATE TRIGGER trigger_accounting_accounts_updated_at
    BEFORE UPDATE ON accounting_accounts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_accounting_entries_updated_at ON accounting_entries;
CREATE TRIGGER trigger_accounting_entries_updated_at
    BEFORE UPDATE ON accounting_entries
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. RLS policies para tablas contables (mismo patrón que otras tablas)
ALTER TABLE accounting_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_accounting_accounts" ON accounting_accounts
    FOR ALL USING (tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    ));

CREATE POLICY "tenant_isolation_accounting_entries" ON accounting_entries
    FOR ALL USING (tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    ));
