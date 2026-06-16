-- ============================================
-- RIVER-WALL PRO - Granular RLS Policies
-- ============================================
-- Reemplaza policies FOR ALL únicas por
-- políticas separadas para SELECT/INSERT/UPDATE/DELETE
-- con restricciones por rol donde corresponde.
-- ============================================

BEGIN;

-- ============================================
-- Helper: cache de tenant_ids vía session variables
-- para evitar N+1 queries en RLS policies
-- ============================================

CREATE OR REPLACE FUNCTION get_session_tenant_ids()
RETURNS TABLE(tenant_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT tu.tenant_id FROM tenant_users tu WHERE tu.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- Helper: check role del usuario en tenant
-- ============================================

CREATE OR REPLACE FUNCTION get_user_role(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role
    FROM tenant_users
    WHERE user_id = auth.uid() AND tenant_id = p_tenant_id;
    RETURN v_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================
-- 1. PRODUCTS — policies granulares
-- ============================================

DROP POLICY IF EXISTS products_isolation ON products;

CREATE POLICY products_select ON products
    FOR SELECT USING (tenant_id IN (SELECT get_session_tenant_ids()));

CREATE POLICY products_insert ON products
    FOR INSERT WITH CHECK (
        tenant_id IN (SELECT get_session_tenant_ids())
        AND get_user_role(tenant_id) IN ('admin', 'manager', 'accountant')
    );

CREATE POLICY products_update ON products
    FOR UPDATE USING (tenant_id IN (SELECT get_session_tenant_ids()))
    WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));

CREATE POLICY products_delete ON products
    FOR DELETE USING (
        tenant_id IN (SELECT get_session_tenant_ids())
        AND get_user_role(tenant_id) IN ('admin', 'manager')
    );

-- ============================================
-- 2. CATEGORIES
-- ============================================

DROP POLICY IF EXISTS categories_isolation ON categories;

CREATE POLICY categories_select ON categories
    FOR SELECT USING (tenant_id IN (SELECT get_session_tenant_ids()));

CREATE POLICY categories_insert ON categories
    FOR INSERT WITH CHECK (
        tenant_id IN (SELECT get_session_tenant_ids())
        AND get_user_role(tenant_id) IN ('admin', 'manager')
    );

CREATE POLICY categories_update ON categories
    FOR UPDATE USING (tenant_id IN (SELECT get_session_tenant_ids()))
    WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));

CREATE POLICY categories_delete ON categories
    FOR DELETE USING (
        tenant_id IN (SELECT get_session_tenant_ids())
        AND get_user_role(tenant_id) IN ('admin')
    );

-- ============================================
-- 3. CLIENTS
-- ============================================

DROP POLICY IF EXISTS clients_isolation ON clients;

CREATE POLICY clients_select ON clients
    FOR SELECT USING (tenant_id IN (SELECT get_session_tenant_ids()));

CREATE POLICY clients_insert ON clients
    FOR INSERT WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));

CREATE POLICY clients_update ON clients
    FOR UPDATE USING (tenant_id IN (SELECT get_session_tenant_ids()))
    WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));

CREATE POLICY clients_delete ON clients
    FOR DELETE USING (
        tenant_id IN (SELECT get_session_tenant_ids())
        AND get_user_role(tenant_id) IN ('admin', 'manager')
    );

-- ============================================
-- 4. SALES
-- ============================================

DROP POLICY IF EXISTS sales_isolation ON sales;

CREATE POLICY sales_select ON sales
    FOR SELECT USING (tenant_id IN (SELECT get_session_tenant_ids()));

CREATE POLICY sales_insert ON sales
    FOR INSERT WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));

CREATE POLICY sales_update ON sales
    FOR UPDATE USING (tenant_id IN (SELECT get_session_tenant_ids()))
    WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));

CREATE POLICY sales_delete ON sales
    FOR DELETE USING (
        tenant_id IN (SELECT get_session_tenant_ids())
        AND get_user_role(tenant_id) IN ('admin')
    );

-- ============================================
-- 5. PURCHASES
-- ============================================

DROP POLICY IF EXISTS purchases_isolation ON purchases;

CREATE POLICY purchases_select ON purchases
    FOR SELECT USING (tenant_id IN (SELECT get_session_tenant_ids()));

CREATE POLICY purchases_insert ON purchases
    FOR INSERT WITH CHECK (
        tenant_id IN (SELECT get_session_tenant_ids())
        AND get_user_role(tenant_id) IN ('admin', 'manager', 'accountant')
    );

CREATE POLICY purchases_update ON purchases
    FOR UPDATE USING (tenant_id IN (SELECT get_session_tenant_ids()))
    WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));

CREATE POLICY purchases_delete ON purchases
    FOR DELETE USING (
        tenant_id IN (SELECT get_session_tenant_ids())
        AND get_user_role(tenant_id) IN ('admin')
    );

-- ============================================
-- 6. LOCALES, SUPPLIERS, TAXES, WAREHOUSES
-- ============================================

-- Locales
DROP POLICY IF EXISTS locales_isolation ON locales;
CREATE POLICY locales_select ON locales FOR SELECT USING (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY locales_insert ON locales FOR INSERT WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()) AND get_user_role(tenant_id) IN ('admin', 'manager'));
CREATE POLICY locales_update ON locales FOR UPDATE USING (tenant_id IN (SELECT get_session_tenant_ids())) WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY locales_delete ON locales FOR DELETE USING (tenant_id IN (SELECT get_session_tenant_ids()) AND get_user_role(tenant_id) IN ('admin'));

-- Suppliers
DROP POLICY IF EXISTS suppliers_isolation ON suppliers;
CREATE POLICY suppliers_select ON suppliers FOR SELECT USING (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY suppliers_insert ON suppliers FOR INSERT WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()) AND get_user_role(tenant_id) IN ('admin', 'manager', 'accountant'));
CREATE POLICY suppliers_update ON suppliers FOR UPDATE USING (tenant_id IN (SELECT get_session_tenant_ids())) WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY suppliers_delete ON suppliers FOR DELETE USING (tenant_id IN (SELECT get_session_tenant_ids()) AND get_user_role(tenant_id) IN ('admin'));

-- Taxes
DROP POLICY IF EXISTS taxes_isolation ON taxes;
CREATE POLICY taxes_select ON taxes FOR SELECT USING (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY taxes_insert ON taxes FOR INSERT WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()) AND get_user_role(tenant_id) IN ('admin', 'accountant'));
CREATE POLICY taxes_update ON taxes FOR UPDATE USING (tenant_id IN (SELECT get_session_tenant_ids())) WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY taxes_delete ON taxes FOR DELETE USING (tenant_id IN (SELECT get_session_tenant_ids()) AND get_user_role(tenant_id) IN ('admin'));

-- Warehouses
DROP POLICY IF EXISTS warehouses_isolation ON warehouses;
CREATE POLICY warehouses_select ON warehouses FOR SELECT USING (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY warehouses_insert ON warehouses FOR INSERT WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()) AND get_user_role(tenant_id) IN ('admin', 'manager'));
CREATE POLICY warehouses_update ON warehouses FOR UPDATE USING (tenant_id IN (SELECT get_session_tenant_ids())) WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY warehouses_delete ON warehouses FOR DELETE USING (tenant_id IN (SELECT get_session_tenant_ids()) AND get_user_role(tenant_id) IN ('admin'));

-- ============================================
-- 7. WAREHOUSE_STOCK (subquery indirecta)
-- ============================================

DROP POLICY IF EXISTS warehouse_stock_isolation ON warehouse_stock;
CREATE POLICY warehouse_stock_select ON warehouse_stock
    FOR SELECT USING (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY warehouse_stock_insert ON warehouse_stock
    FOR INSERT WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY warehouse_stock_update ON warehouse_stock
    FOR UPDATE USING (tenant_id IN (SELECT get_session_tenant_ids()))
    WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY warehouse_stock_delete ON warehouse_stock
    FOR DELETE USING (tenant_id IN (SELECT get_session_tenant_ids()));

-- ============================================
-- 8. INVENTORY_MOVEMENTS
-- ============================================

DROP POLICY IF EXISTS inventory_movements_isolation ON inventory_movements;
CREATE POLICY inventory_movements_select ON inventory_movements FOR SELECT USING (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY inventory_movements_insert ON inventory_movements FOR INSERT WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY inventory_movements_update ON inventory_movements FOR UPDATE USING (tenant_id IN (SELECT get_session_tenant_ids())) WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY inventory_movements_delete ON inventory_movements FOR DELETE USING (tenant_id IN (SELECT get_session_tenant_ids()) AND get_user_role(tenant_id) IN ('admin'));

-- ============================================
-- 9. TRANSFERS
-- ============================================

DROP POLICY IF EXISTS transfers_isolation ON transfers;
CREATE POLICY transfers_select ON transfers FOR SELECT USING (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY transfers_insert ON transfers FOR INSERT WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY transfers_update ON transfers FOR UPDATE USING (tenant_id IN (SELECT get_session_tenant_ids())) WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY transfers_delete ON transfers FOR DELETE USING (tenant_id IN (SELECT get_session_tenant_ids()) AND get_user_role(tenant_id) IN ('admin', 'manager'));

-- ============================================
-- 10. POS TERMINALS & CLOSURES
-- ============================================

DROP POLICY IF EXISTS pos_terminals_isolation ON pos_terminals;
CREATE POLICY pos_terminals_select ON pos_terminals FOR SELECT USING (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY pos_terminals_insert ON pos_terminals FOR INSERT WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()) AND get_user_role(tenant_id) IN ('admin'));
CREATE POLICY pos_terminals_update ON pos_terminals FOR UPDATE USING (tenant_id IN (SELECT get_session_tenant_ids())) WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY pos_terminals_delete ON pos_terminals FOR DELETE USING (tenant_id IN (SELECT get_session_tenant_ids()) AND get_user_role(tenant_id) IN ('admin'));

DROP POLICY IF EXISTS pos_terminal_closures_isolation ON pos_terminal_closures;
CREATE POLICY pos_terminal_closures_select ON pos_terminal_closures FOR SELECT USING (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY pos_terminal_closures_insert ON pos_terminal_closures FOR INSERT WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY pos_terminal_closures_update ON pos_terminal_closures FOR UPDATE USING (tenant_id IN (SELECT get_session_tenant_ids())) WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY pos_terminal_closures_delete ON pos_terminal_closures FOR DELETE USING (tenant_id IN (SELECT get_session_tenant_ids()) AND get_user_role(tenant_id) IN ('admin'));

-- ============================================
-- 11. CRM TABLES
-- ============================================

-- Loyalty cards
DROP POLICY IF EXISTS loyalty_cards_isolation ON loyalty_cards;
CREATE POLICY loyalty_cards_select ON loyalty_cards FOR SELECT USING (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY loyalty_cards_insert ON loyalty_cards FOR INSERT WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY loyalty_cards_update ON loyalty_cards FOR UPDATE USING (tenant_id IN (SELECT get_session_tenant_ids())) WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY loyalty_cards_delete ON loyalty_cards FOR DELETE USING (tenant_id IN (SELECT get_session_tenant_ids()) AND get_user_role(tenant_id) IN ('admin'));

-- Wallet transactions (immutable: solo INSERT + SELECT)
DROP POLICY IF EXISTS wallet_transactions_isolation ON wallet_transactions;
CREATE POLICY wallet_transactions_select ON wallet_transactions FOR SELECT USING (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY wallet_transactions_insert ON wallet_transactions FOR INSERT WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));
-- No UPDATE ni DELETE (immutable ledger)

-- CRM coupons
DROP POLICY IF EXISTS crm_coupons_isolation ON crm_coupons;
CREATE POLICY crm_coupons_select ON crm_coupons FOR SELECT USING (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY crm_coupons_insert ON crm_coupons FOR INSERT WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()) AND get_user_role(tenant_id) IN ('admin', 'manager'));
CREATE POLICY crm_coupons_update ON crm_coupons FOR UPDATE USING (tenant_id IN (SELECT get_session_tenant_ids())) WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY crm_coupons_delete ON crm_coupons FOR DELETE USING (tenant_id IN (SELECT get_session_tenant_ids()) AND get_user_role(tenant_id) IN ('admin'));

DROP POLICY IF EXISTS crm_coupon_purchases_isolation ON crm_coupon_purchases;
CREATE POLICY crm_coupon_purchases_select ON crm_coupon_purchases FOR SELECT USING (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY crm_coupon_purchases_insert ON crm_coupon_purchases FOR INSERT WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY crm_coupon_purchases_update ON crm_coupon_purchases FOR UPDATE USING (tenant_id IN (SELECT get_session_tenant_ids())) WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY crm_coupon_purchases_delete ON crm_coupon_purchases FOR DELETE USING (tenant_id IN (SELECT get_session_tenant_ids()) AND get_user_role(tenant_id) IN ('admin'));

DROP POLICY IF EXISTS reload_requests_isolation ON reload_requests;
CREATE POLICY reload_requests_select ON reload_requests FOR SELECT USING (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY reload_requests_insert ON reload_requests FOR INSERT WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY reload_requests_update ON reload_requests FOR UPDATE USING (tenant_id IN (SELECT get_session_tenant_ids())) WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY reload_requests_delete ON reload_requests FOR DELETE USING (tenant_id IN (SELECT get_session_tenant_ids()) AND get_user_role(tenant_id) IN ('admin'));

DROP POLICY IF EXISTS discount_campaigns_isolation ON discount_campaigns;
CREATE POLICY discount_campaigns_select ON discount_campaigns FOR SELECT USING (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY discount_campaigns_insert ON discount_campaigns FOR INSERT WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()) AND get_user_role(tenant_id) IN ('admin', 'manager'));
CREATE POLICY discount_campaigns_update ON discount_campaigns FOR UPDATE USING (tenant_id IN (SELECT get_session_tenant_ids())) WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY discount_campaigns_delete ON discount_campaigns FOR DELETE USING (tenant_id IN (SELECT get_session_tenant_ids()) AND get_user_role(tenant_id) IN ('admin'));

DROP POLICY IF EXISTS crm_activities_isolation ON crm_activities;
CREATE POLICY crm_activities_select ON crm_activities FOR SELECT USING (tenant_id IN (SELECT get_session_tenant_ids()));
CREATE POLICY crm_activities_insert ON crm_activities FOR INSERT WITH CHECK (tenant_id IN (SELECT get_session_tenant_ids()));
-- No UPDATE ni DELETE (immutable activity log)

-- ============================================
-- 12. TENANT_USERS (política especial)
-- ============================================

DROP POLICY IF EXISTS tenant_users_isolation ON tenant_users;
CREATE POLICY tenant_users_select ON tenant_users
    FOR SELECT USING (
        user_id = auth.uid()
        OR tenant_id IN (SELECT get_session_tenant_ids())
    );
CREATE POLICY tenant_users_insert ON tenant_users
    FOR INSERT WITH CHECK (
        get_user_role(tenant_id) IN ('admin', 'superadmin')
        OR user_id = auth.uid()
    );
CREATE POLICY tenant_users_update ON tenant_users
    FOR UPDATE USING (
        user_id = auth.uid()
        OR get_user_role(tenant_id) IN ('admin')
    );
CREATE POLICY tenant_users_delete ON tenant_users
    FOR DELETE USING (
        get_user_role(tenant_id) IN ('admin')
    );

-- ============================================
-- 13. TENANTS (solo superadmin puede ver todo)
-- ============================================

DROP POLICY IF EXISTS tenants_isolation ON tenants;
CREATE POLICY tenants_select ON tenants
    FOR SELECT USING (
        id IN (SELECT get_session_tenant_ids())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );
-- Solo superadmin puede modificar tenants
CREATE POLICY tenants_insert ON tenants
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );
CREATE POLICY tenants_update ON tenants
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );
CREATE POLICY tenants_delete ON tenants
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- ============================================
-- 14. AUDIT_LOGS (inmutables, solo INSERT + SELECT)
-- ============================================

DROP POLICY IF EXISTS audit_logs_isolation ON audit_logs;
DROP POLICY IF EXISTS audit_logs_superadmin_select ON audit_logs;
DROP POLICY IF EXISTS audit_logs_tenant_select ON audit_logs;
DROP POLICY IF EXISTS audit_logs_insert ON audit_logs;
DROP POLICY IF EXISTS audit_logs_no_update ON audit_logs;
DROP POLICY IF EXISTS audit_logs_no_delete ON audit_logs;

CREATE POLICY audit_logs_select ON audit_logs
    FOR SELECT USING (
        tenant_id IN (SELECT get_session_tenant_ids())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );
CREATE POLICY audit_logs_insert ON audit_logs
    FOR INSERT WITH CHECK (true);
-- Sin UPDATE ni DELETE (inmutable)

COMMIT;
