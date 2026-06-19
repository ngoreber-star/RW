-- ============================================
-- RIVER-WALL PRO v3.4 - Add locale_id support
-- Optional multi-local filtering per tenant
-- ============================================

-- Helper: add locale_id only if it does not exist
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'products',
        'categories',
        'clients',
        'suppliers',
        'warehouses',
        'sales',
        'purchases',
        'taxes',
        'locales',
        'pos_terminals',
        'pos_terminal_closures',
        'inventory_movements',
        'warehouse_stock',
        'transfers',
        'crm_coupons',
        'crm_coupon_purchases',
        'reload_requests',
        'discount_campaigns',
        'crm_activities',
        'loyalty_cards',
        'wallet_transactions'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables
    LOOP
        EXECUTE format(
            'ALTER TABLE %I ADD COLUMN IF NOT EXISTS locale_id UUID REFERENCES locales(id) ON DELETE SET NULL',
            tbl
        );
    END LOOP;
END $$;

-- Indexes for tenant + locale queries
CREATE INDEX IF NOT EXISTS idx_products_tenant_locale ON products(tenant_id, locale_id);
CREATE INDEX IF NOT EXISTS idx_categories_tenant_locale ON categories(tenant_id, locale_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_locale ON clients(tenant_id, locale_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_locale ON suppliers(tenant_id, locale_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_tenant_locale ON warehouses(tenant_id, locale_id);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_locale ON sales(tenant_id, locale_id);
CREATE INDEX IF NOT EXISTS idx_purchases_tenant_locale ON purchases(tenant_id, locale_id);
CREATE INDEX IF NOT EXISTS idx_taxes_tenant_locale ON taxes(tenant_id, locale_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_tenant_locale ON inventory_movements(tenant_id, locale_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_tenant_locale ON warehouse_stock(tenant_id, locale_id);
CREATE INDEX IF NOT EXISTS idx_transfers_tenant_locale ON transfers(tenant_id, locale_id);

-- Optional index on locale_id alone for joins
CREATE INDEX IF NOT EXISTS idx_sales_locale ON sales(locale_id);
CREATE INDEX IF NOT EXISTS idx_products_locale ON products(locale_id);
CREATE INDEX IF NOT EXISTS idx_clients_locale ON clients(locale_id);

-- Update RLS policies to include locale_id transparently.
-- The application filters by locale_id; RLS still enforces tenant isolation.
-- Drop and recreate SELECT/INSERT/UPDATE/DELETE policies for core tables.

-- Products
DROP POLICY IF EXISTS products_tenant_isolation ON products;
CREATE POLICY products_tenant_isolation ON products
    FOR ALL
    USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
    WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Categories
DROP POLICY IF EXISTS categories_tenant_isolation ON categories;
CREATE POLICY categories_tenant_isolation ON categories
    FOR ALL
    USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
    WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Clients
DROP POLICY IF EXISTS clients_tenant_isolation ON clients;
CREATE POLICY clients_tenant_isolation ON clients
    FOR ALL
    USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
    WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Suppliers
DROP POLICY IF EXISTS suppliers_tenant_isolation ON suppliers;
CREATE POLICY suppliers_tenant_isolation ON suppliers
    FOR ALL
    USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
    WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Warehouses
DROP POLICY IF EXISTS warehouses_tenant_isolation ON warehouses;
CREATE POLICY warehouses_tenant_isolation ON warehouses
    FOR ALL
    USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
    WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Sales
DROP POLICY IF EXISTS sales_tenant_isolation ON sales;
CREATE POLICY sales_tenant_isolation ON sales
    FOR ALL
    USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
    WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Purchases
DROP POLICY IF EXISTS purchases_tenant_isolation ON purchases;
CREATE POLICY purchases_tenant_isolation ON purchases
    FOR ALL
    USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
    WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Taxes
DROP POLICY IF EXISTS taxes_tenant_isolation ON taxes;
CREATE POLICY taxes_tenant_isolation ON taxes
    FOR ALL
    USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
    WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Warehouse stock
DROP POLICY IF EXISTS warehouse_stock_tenant_isolation ON warehouse_stock;
CREATE POLICY warehouse_stock_tenant_isolation ON warehouse_stock
    FOR ALL
    USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
    WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Inventory movements
DROP POLICY IF EXISTS inventory_movements_tenant_isolation ON inventory_movements;
CREATE POLICY inventory_movements_tenant_isolation ON inventory_movements
    FOR ALL
    USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
    WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- Transfers
DROP POLICY IF EXISTS transfers_tenant_isolation ON transfers;
CREATE POLICY transfers_tenant_isolation ON transfers
    FOR ALL
    USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())))
    WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
