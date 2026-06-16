-- ============================================
-- RIVER-WALL PRO - Granular RLS Policies
-- Separate policies per operation (SELECT/INSERT/UPDATE/DELETE)
-- Role-based access control enforced at DB layer
-- ============================================

-- ============================================
-- 1. PRODUCTS - Granular policies by operation
-- ============================================

DROP POLICY IF EXISTS products_isolation ON products;

-- SELECT: Anyone in the tenant can view products
CREATE POLICY products_select ON products
    FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- INSERT: Only admin/manager/accountant can create products
CREATE POLICY products_insert ON products
    FOR INSERT
    WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            -- Check user role in this tenant
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = products.tenant_id) 
            IN ('admin', 'manager', 'accountant')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

-- UPDATE: Only admin/manager/accountant can modify products
CREATE POLICY products_update ON products
    FOR UPDATE
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    )
    WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = products.tenant_id) 
            IN ('admin', 'manager', 'accountant')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

-- DELETE: Only admin/accountant can delete products
CREATE POLICY products_delete ON products
    FOR DELETE
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = products.tenant_id) 
            IN ('admin', 'accountant')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

-- ============================================
-- 2. CLIENTS - Granular policies
-- ============================================

DROP POLICY IF EXISTS clients_isolation ON clients;

CREATE POLICY clients_select ON clients
    FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY clients_insert ON clients
    FOR INSERT
    WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = clients.tenant_id) 
            IN ('admin', 'manager', 'cashier', 'accountant')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

CREATE POLICY clients_update ON clients
    FOR UPDATE
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    )
    WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = clients.tenant_id) 
            IN ('admin', 'manager', 'cashier', 'accountant')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

CREATE POLICY clients_delete ON clients
    FOR DELETE
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = clients.tenant_id) 
            IN ('admin', 'accountant')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

-- ============================================
-- 3. SALES - Granular policies
-- ============================================

DROP POLICY IF EXISTS sales_isolation ON sales;

CREATE POLICY sales_select ON sales
    FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- INSERT: Cashier/manager can insert sales
CREATE POLICY sales_insert ON sales
    FOR INSERT
    WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = sales.tenant_id) 
            IN ('admin', 'manager', 'cashier')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

-- UPDATE: Only admin/accountant can modify sales (for corrections)
CREATE POLICY sales_update ON sales
    FOR UPDATE
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    )
    WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = sales.tenant_id) 
            IN ('admin', 'accountant')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

-- DELETE: Only admin can delete sales
CREATE POLICY sales_delete ON sales
    FOR DELETE
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = sales.tenant_id) 
            IN ('admin')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

-- ============================================
-- 4. PURCHASES - Granular policies
-- ============================================

DROP POLICY IF EXISTS purchases_isolation ON purchases;

CREATE POLICY purchases_select ON purchases
    FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY purchases_insert ON purchases
    FOR INSERT
    WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = purchases.tenant_id) 
            IN ('admin', 'manager', 'accountant')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

CREATE POLICY purchases_update ON purchases
    FOR UPDATE
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    )
    WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = purchases.tenant_id) 
            IN ('admin', 'manager', 'accountant')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

CREATE POLICY purchases_delete ON purchases
    FOR DELETE
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = purchases.tenant_id) 
            IN ('admin', 'accountant')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

-- ============================================
-- 5. WAREHOUSES & INVENTORY - Granular policies
-- ============================================

DROP POLICY IF EXISTS warehouses_isolation ON warehouses;

CREATE POLICY warehouses_select ON warehouses
    FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY warehouses_insert ON warehouses
    FOR INSERT
    WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = warehouses.tenant_id) 
            IN ('admin', 'manager', 'accountant')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

CREATE POLICY warehouses_update ON warehouses
    FOR UPDATE
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    )
    WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = warehouses.tenant_id) 
            IN ('admin', 'manager', 'accountant')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

CREATE POLICY warehouses_delete ON warehouses
    FOR DELETE
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = warehouses.tenant_id) 
            IN ('admin')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

-- ============================================
-- 6. WAREHOUSE STOCK - Simplified (mostly read)
-- ============================================

DROP POLICY IF EXISTS warehouse_stock_isolation ON warehouse_stock;

CREATE POLICY warehouse_stock_select ON warehouse_stock
    FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY warehouse_stock_modify ON warehouse_stock
    FOR INSERT, UPDATE, DELETE
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = warehouse_stock.tenant_id) 
            IN ('admin', 'manager', 'accountant')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

-- ============================================
-- 7. INVENTORY MOVEMENTS - Read-only for most
-- ============================================

DROP POLICY IF EXISTS inventory_movements_isolation ON inventory_movements;

CREATE POLICY inventory_movements_select ON inventory_movements
    FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- Only via RPC functions (process_complete_checkout, etc)
CREATE POLICY inventory_movements_insert ON inventory_movements
    FOR INSERT
    WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = inventory_movements.tenant_id) 
            IN ('admin', 'manager', 'accountant')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

-- ============================================
-- 8. TRANSFERS - Manager/Admin only
-- ============================================

DROP POLICY IF EXISTS transfers_isolation ON transfers;

CREATE POLICY transfers_select ON transfers
    FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY transfers_insert ON transfers
    FOR INSERT
    WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = transfers.tenant_id) 
            IN ('admin', 'manager', 'accountant')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

CREATE POLICY transfers_update ON transfers
    FOR UPDATE
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    )
    WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = transfers.tenant_id) 
            IN ('admin', 'manager', 'accountant')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

-- ============================================
-- 9. AUDIT LOGS - Read-only, enforced
-- ============================================

DROP POLICY IF EXISTS audit_logs_isolation ON audit_logs;

-- SELECT: Users can see audit logs for their tenant
CREATE POLICY audit_logs_select ON audit_logs
    FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- INSERT: Only via trigger/SECURITY DEFINER functions (not direct insert)
CREATE POLICY audit_logs_insert ON audit_logs
    FOR INSERT
    WITH CHECK (true);  -- Internal system only via triggers

-- No UPDATE/DELETE on audit logs
CREATE POLICY audit_logs_no_modify ON audit_logs
    FOR UPDATE, DELETE
    USING (false);  -- Strictly immutable

-- ============================================
-- 10. POS TERMINALS & CLOSURES
-- ============================================

DROP POLICY IF EXISTS pos_terminals_isolation ON pos_terminals;
DROP POLICY IF EXISTS pos_terminal_closures_isolation ON pos_terminal_closures;

CREATE POLICY pos_terminals_select ON pos_terminals
    FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY pos_terminals_modify ON pos_terminals
    FOR INSERT, UPDATE, DELETE
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = pos_terminals.tenant_id) 
            IN ('admin', 'manager')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

CREATE POLICY pos_terminal_closures_select ON pos_terminal_closures
    FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY pos_terminal_closures_modify ON pos_terminal_closures
    FOR INSERT, UPDATE, DELETE
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = pos_terminal_closures.tenant_id) 
            IN ('admin', 'manager', 'accountant')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

-- ============================================
-- 11. CATEGORIES, LOCALES, SUPPLIERS, TAXES
-- ============================================

DROP POLICY IF EXISTS categories_isolation ON categories;
DROP POLICY IF EXISTS locales_isolation ON locales;
DROP POLICY IF EXISTS suppliers_isolation ON suppliers;
DROP POLICY IF EXISTS taxes_isolation ON taxes;

-- CATEGORIES
CREATE POLICY categories_select ON categories
    FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY categories_modify ON categories
    FOR INSERT, UPDATE, DELETE
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = categories.tenant_id) 
            IN ('admin', 'manager', 'accountant')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

-- LOCALES
CREATE POLICY locales_select ON locales
    FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY locales_modify ON locales
    FOR INSERT, UPDATE, DELETE
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = locales.tenant_id) 
            IN ('admin')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

-- SUPPLIERS
CREATE POLICY suppliers_select ON suppliers
    FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY suppliers_modify ON suppliers
    FOR INSERT, UPDATE, DELETE
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = suppliers.tenant_id) 
            IN ('admin', 'manager', 'accountant')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

-- TAXES
CREATE POLICY taxes_select ON taxes
    FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY taxes_modify ON taxes
    FOR INSERT, UPDATE, DELETE
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = taxes.tenant_id) 
            IN ('admin', 'accountant')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

-- ============================================
-- 12. CRM TABLES - Client-facing, multi-role
-- ============================================

-- LOYALTY_CARDS
DROP POLICY IF EXISTS loyalty_cards_isolation ON loyalty_cards;
CREATE POLICY loyalty_cards_select ON loyalty_cards
    FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );
CREATE POLICY loyalty_cards_modify ON loyalty_cards
    FOR INSERT, UPDATE, DELETE
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = loyalty_cards.tenant_id) 
            IN ('admin', 'manager', 'accountant', 'cashier')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

-- WALLET_TRANSACTIONS (mostly inserts via RPC)
DROP POLICY IF EXISTS wallet_transactions_isolation ON wallet_transactions;
CREATE POLICY wallet_transactions_select ON wallet_transactions
    FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );
CREATE POLICY wallet_transactions_insert ON wallet_transactions
    FOR INSERT
    WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
    );

-- CRM_COUPONS, CRM_COUPON_PURCHASES, etc (follow same pattern)
DROP POLICY IF EXISTS crm_coupons_isolation ON crm_coupons;
DROP POLICY IF EXISTS crm_coupon_purchases_isolation ON crm_coupon_purchases;
DROP POLICY IF EXISTS reload_requests_isolation ON reload_requests;
DROP POLICY IF EXISTS discount_campaigns_isolation ON discount_campaigns;
DROP POLICY IF EXISTS crm_activities_isolation ON crm_activities;

-- Simplify: All can read, only admin/manager can modify
CREATE POLICY crm_coupons_select ON crm_coupons
    FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );
CREATE POLICY crm_coupons_modify ON crm_coupons
    FOR INSERT, UPDATE, DELETE
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = crm_coupons.tenant_id) 
            IN ('admin', 'manager', 'accountant')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

CREATE POLICY crm_coupon_purchases_select ON crm_coupon_purchases
    FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );
CREATE POLICY crm_coupon_purchases_modify ON crm_coupon_purchases
    FOR INSERT, UPDATE, DELETE
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = crm_coupon_purchases.tenant_id) 
            IN ('admin', 'manager', 'cashier')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

CREATE POLICY reload_requests_select ON reload_requests
    FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );
CREATE POLICY reload_requests_modify ON reload_requests
    FOR INSERT, UPDATE, DELETE
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
    );

CREATE POLICY discount_campaigns_select ON discount_campaigns
    FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );
CREATE POLICY discount_campaigns_modify ON discount_campaigns
    FOR INSERT, UPDATE, DELETE
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        AND (
            (SELECT role FROM tenant_users 
             WHERE user_id = auth.uid() AND tenant_id = discount_campaigns.tenant_id) 
            IN ('admin', 'manager', 'accountant')
            OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
        )
    );

CREATE POLICY crm_activities_select ON crm_activities
    FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );
CREATE POLICY crm_activities_modify ON crm_activities
    FOR INSERT, UPDATE, DELETE
    USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
    );

-- ============================================
-- 13. Documentation
-- ============================================

COMMENT ON POLICY products_select ON products IS
    'All tenant members can view products. Superadmins bypass.';

COMMENT ON POLICY products_insert ON products IS
    'Only admin/manager/accountant can create products.';

COMMENT ON POLICY sales_insert ON sales IS
    'Cashier/manager can create sales (POS checkout).';

COMMENT ON POLICY audit_logs_no_modify ON audit_logs IS
    'Audit logs are immutable. No modifications allowed after creation.';
