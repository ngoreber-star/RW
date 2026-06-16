-- ============================================
-- RIVER-WALL PRO - Fix RLS Infinite Recursion
-- ============================================
-- The original policies queried tenant_users inside tenant_users policy,
-- causing PostgreSQL to throw:
--   42P17: infinite recursion detected in policy for relation "tenant_users"
--
-- Fix: Use superadmins table for superadmin checks instead of tenant_users.
-- ============================================

-- 1. Fix tenant_users policy
ALTER TABLE tenant_users DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_users_isolation ON tenant_users;
CREATE POLICY tenant_users_isolation ON tenant_users
    FOR ALL USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;

-- 2. Fix tenants policy
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenants_isolation ON tenants;
CREATE POLICY tenants_isolation ON tenants
    FOR ALL USING (
        id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- 3. Fix other policies that may have similar issues (replace superadmin check via tenant_users)
-- Categories
DROP POLICY IF EXISTS categories_isolation ON categories;
CREATE POLICY categories_isolation ON categories
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- Products
DROP POLICY IF EXISTS products_isolation ON products;
CREATE POLICY products_isolation ON products
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- Clients
DROP POLICY IF EXISTS clients_isolation ON clients;
CREATE POLICY clients_isolation ON clients
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- Locales
DROP POLICY IF EXISTS locales_isolation ON locales;
CREATE POLICY locales_isolation ON locales
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- Sales
DROP POLICY IF EXISTS sales_isolation ON sales;
CREATE POLICY sales_isolation ON sales
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- Purchases
DROP POLICY IF EXISTS purchases_isolation ON purchases;
CREATE POLICY purchases_isolation ON purchases
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- Suppliers
DROP POLICY IF EXISTS suppliers_isolation ON suppliers;
CREATE POLICY suppliers_isolation ON suppliers
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- Warehouses
DROP POLICY IF EXISTS warehouses_isolation ON warehouses;
CREATE POLICY warehouses_isolation ON warehouses
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- Warehouse stock
DROP POLICY IF EXISTS warehouse_stock_isolation ON warehouse_stock;
CREATE POLICY warehouse_stock_isolation ON warehouse_stock
    FOR ALL USING (
        warehouse_id IN (SELECT id FROM warehouses WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()))
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- Inventory movements
DROP POLICY IF EXISTS inventory_movements_isolation ON inventory_movements;
CREATE POLICY inventory_movements_isolation ON inventory_movements
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- Transfers
DROP POLICY IF EXISTS transfers_isolation ON transfers;
CREATE POLICY transfers_isolation ON transfers
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- POS terminals
DROP POLICY IF EXISTS pos_terminals_isolation ON pos_terminals;
CREATE POLICY pos_terminals_isolation ON pos_terminals
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- POS terminal closures
DROP POLICY IF EXISTS pos_terminal_closures_isolation ON pos_terminal_closures;
CREATE POLICY pos_terminal_closures_isolation ON pos_terminal_closures
    FOR ALL USING (
        terminal_id IN (SELECT id FROM pos_terminals WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()))
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- Taxes
DROP POLICY IF EXISTS taxes_isolation ON taxes;
CREATE POLICY taxes_isolation ON taxes
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- Audit logs
DROP POLICY IF EXISTS audit_logs_isolation ON audit_logs;
CREATE POLICY audit_logs_isolation ON audit_logs
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- Loyalty cards
DROP POLICY IF EXISTS loyalty_cards_isolation ON loyalty_cards;
CREATE POLICY loyalty_cards_isolation ON loyalty_cards
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- Wallet transactions
DROP POLICY IF EXISTS wallet_transactions_isolation ON wallet_transactions;
CREATE POLICY wallet_transactions_isolation ON wallet_transactions
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- CRM coupons
DROP POLICY IF EXISTS crm_coupons_isolation ON crm_coupons;
CREATE POLICY crm_coupons_isolation ON crm_coupons
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- CRM coupon purchases
DROP POLICY IF EXISTS crm_coupon_purchases_isolation ON crm_coupon_purchases;
CREATE POLICY crm_coupon_purchases_isolation ON crm_coupon_purchases
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- Reload requests
DROP POLICY IF EXISTS reload_requests_isolation ON reload_requests;
CREATE POLICY reload_requests_isolation ON reload_requests
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- Discount campaigns
DROP POLICY IF EXISTS discount_campaigns_isolation ON discount_campaigns;
CREATE POLICY discount_campaigns_isolation ON discount_campaigns
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );

-- CRM activities
DROP POLICY IF EXISTS crm_activities_isolation ON crm_activities;
CREATE POLICY crm_activities_isolation ON crm_activities
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid() AND is_active = true)
    );
