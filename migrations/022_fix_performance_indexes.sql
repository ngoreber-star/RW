-- ============================================
-- RIVER-WALL PRO - Performance Indexes
-- ============================================
-- Índices faltantes para optimizar RLS, búsquedas
-- frecuentes y consultas analíticas.
-- ============================================

BEGIN;

-- ============================================
-- 1. SUPERADMINS (usado en cada policy check)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_superadmins_user_active
    ON superadmins(user_id, is_active);

-- ============================================
-- 2. TENANT_USERS (usado en RLS + tenant resolution)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_tenant_users_user_tenant
    ON tenant_users(user_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_users_role
    ON tenant_users(tenant_id, role);

-- ============================================
-- 3. PRODUCTS (búsquedas frecuentes en POS)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_products_name
    ON products(tenant_id, name);

CREATE INDEX IF NOT EXISTS idx_products_sku
    ON products(tenant_id, sku)
    WHERE sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_active
    ON products(tenant_id, is_active)
    WHERE is_active = true;

-- ============================================
-- 4. CLIENTS (búsqueda por teléfono + email)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_clients_email
    ON clients(tenant_id, email)
    WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_name
    ON clients(tenant_id, first_name, last_name);

CREATE INDEX IF NOT EXISTS idx_clients_tier
    ON clients(tenant_id, tier)
    WHERE tier IS NOT NULL;

-- ============================================
-- 5. SALES (consultas de reporting + fechas)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_sales_tenant_status
    ON sales(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_sales_tenant_payment
    ON sales(tenant_id, payment_method);

CREATE INDEX IF NOT EXISTS idx_sales_tenant_date
    ON sales(tenant_id, created_at DESC);

-- ============================================
-- 6. INVENTORY (consultas de stock)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_warehouse_stock_product
    ON warehouse_stock(tenant_id, product_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_stock_warehouse
    ON warehouse_stock(warehouse_id, product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_ref
    ON inventory_movements(tenant_id, reference_id, reference_type);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product
    ON inventory_movements(tenant_id, product_id, created_at DESC);

-- ============================================
-- 7. AUDIT_LOGS (consultas de auditoría)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_lookup
    ON audit_logs(tenant_id, resource, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action
    ON audit_logs(user_id, action, created_at DESC);

-- ============================================
-- 8. CRM (búsqueda por cliente)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_client
    ON wallet_transactions(tenant_id, client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_activities_client
    ON crm_activities(tenant_id, client_id, created_at DESC);

-- ============================================
-- 9. ANALYTICS (reportes de período)
-- ============================================

-- Para get_top_products y get_sales_summary
CREATE INDEX IF NOT EXISTS idx_sales_date_completed
    ON sales(tenant_id, created_at)
    WHERE status = 'completed';

-- Para búsqueda de productos por barcode
CREATE INDEX IF NOT EXISTS idx_products_barcode_lookup
    ON products(tenant_id, barcode)
    WHERE barcode IS NOT NULL;

COMMIT;
