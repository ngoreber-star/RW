-- ============================================
-- RIVER-WALL PRO - Row Level Security (RLS)
-- Every table filtered by tenant_id
-- ============================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE locales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_terminal_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_coupon_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE reload_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Helper: Is the current user a member of the tenant?
-- ============================================

CREATE OR REPLACE FUNCTION is_tenant_member(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM tenant_users
        WHERE user_id = auth.uid() AND tenant_id = p_tenant_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TENANTS (users can see their own tenants)
-- ============================================

CREATE POLICY tenants_isolation ON tenants
    FOR ALL USING (
        id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM tenant_users WHERE user_id = auth.uid() AND role = 'superadmin')
    );

-- ============================================
-- TENANT_USERS
-- ============================================

CREATE POLICY tenant_users_isolation ON tenant_users
    FOR ALL USING (
        tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
        OR EXISTS (SELECT 1 FROM tenant_users WHERE user_id = auth.uid() AND role = 'superadmin')
    );

-- ============================================
-- PRODUCTS
-- ============================================

CREATE POLICY products_isolation ON products
    FOR ALL USING (is_tenant_member(tenant_id));

-- ============================================
-- CATEGORIES
-- ============================================

CREATE POLICY categories_isolation ON categories
    FOR ALL USING (is_tenant_member(tenant_id));

-- ============================================
-- CLIENTS
-- ============================================

CREATE POLICY clients_isolation ON clients
    FOR ALL USING (is_tenant_member(tenant_id));

-- ============================================
-- LOCALES
-- ============================================

CREATE POLICY locales_isolation ON locales
    FOR ALL USING (is_tenant_member(tenant_id));

-- ============================================
-- SALES
-- ============================================

CREATE POLICY sales_isolation ON sales
    FOR ALL USING (is_tenant_member(tenant_id));

-- ============================================
-- PURCHASES
-- ============================================

CREATE POLICY purchases_isolation ON purchases
    FOR ALL USING (is_tenant_member(tenant_id));

-- ============================================
-- SUPPLIERS
-- ============================================

CREATE POLICY suppliers_isolation ON suppliers
    FOR ALL USING (is_tenant_member(tenant_id));

-- ============================================
-- WAREHOUSES
-- ============================================

CREATE POLICY warehouses_isolation ON warehouses
    FOR ALL USING (is_tenant_member(tenant_id));

-- ============================================
-- WAREHOUSE_STOCK
-- ============================================

CREATE POLICY warehouse_stock_isolation ON warehouse_stock
    FOR ALL USING (is_tenant_member(tenant_id));

-- ============================================
-- INVENTORY_MOVEMENTS
-- ============================================

CREATE POLICY inventory_movements_isolation ON inventory_movements
    FOR ALL USING (is_tenant_member(tenant_id));

-- ============================================
-- TRANSFERS
-- ============================================

CREATE POLICY transfers_isolation ON transfers
    FOR ALL USING (is_tenant_member(tenant_id));

-- ============================================
-- POS_TERMINALS
-- ============================================

CREATE POLICY pos_terminals_isolation ON pos_terminals
    FOR ALL USING (is_tenant_member(tenant_id));

-- ============================================
-- POS_TERMINAL_CLOSURES
-- ============================================

CREATE POLICY pos_terminal_closures_isolation ON pos_terminal_closures
    FOR ALL USING (is_tenant_member(tenant_id));

-- ============================================
-- TAXES
-- ============================================

CREATE POLICY taxes_isolation ON taxes
    FOR ALL USING (is_tenant_member(tenant_id));

-- ============================================
-- AUDIT_LOGS
-- ============================================

CREATE POLICY audit_logs_isolation ON audit_logs
    FOR ALL USING (is_tenant_member(tenant_id));

-- ============================================
-- CRM TABLES
-- ============================================

CREATE POLICY loyalty_cards_isolation ON loyalty_cards
    FOR ALL USING (is_tenant_member(tenant_id));

CREATE POLICY wallet_transactions_isolation ON wallet_transactions
    FOR ALL USING (is_tenant_member(tenant_id));

CREATE POLICY crm_coupons_isolation ON crm_coupons
    FOR ALL USING (is_tenant_member(tenant_id));

CREATE POLICY crm_coupon_purchases_isolation ON crm_coupon_purchases
    FOR ALL USING (is_tenant_member(tenant_id));

CREATE POLICY reload_requests_isolation ON reload_requests
    FOR ALL USING (is_tenant_member(tenant_id));

CREATE POLICY discount_campaigns_isolation ON discount_campaigns
    FOR ALL USING (is_tenant_member(tenant_id));

CREATE POLICY crm_activities_isolation ON crm_activities
    FOR ALL USING (is_tenant_member(tenant_id));

-- ============================================
-- SUPERADMIN BYPASS POLICIES (Optional)
-- For admin dashboards that need to see all tenants
-- ============================================

-- Create a service role policy for the superadmin edge function
-- Note: In Supabase, service_role key bypasses RLS automatically.
-- For client-side superadmin views, use RPC functions with SECURITY DEFINER.
