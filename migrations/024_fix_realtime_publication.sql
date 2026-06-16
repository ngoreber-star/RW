-- Migration 024: Fix Realtime publication for all client-subscribed tables
-- ============================================================
-- El adapter se suscribe a 20 tablas de negocio, pero la publicación
-- supabase_realtime solo incluía products, sales, clients y warehouse_stock.
-- Esto hacía que los cambios en categories, purchases, suppliers, etc. no
-- se propagaran en tiempo real a otros navegadores.
--
-- Se recrea la publicación con la lista completa de tablas.

DROP PUBLICATION IF EXISTS supabase_realtime;

CREATE PUBLICATION supabase_realtime FOR TABLE
    products (tenant_id),
    categories (tenant_id),
    clients (tenant_id),
    sales (tenant_id),
    purchases (tenant_id),
    suppliers (tenant_id),
    warehouses (tenant_id),
    warehouse_stock (tenant_id),
    inventory_movements (tenant_id),
    transfers (tenant_id),
    pos_terminals (tenant_id),
    taxes (tenant_id),
    locales (tenant_id),
    loyalty_cards (tenant_id),
    wallet_transactions (tenant_id),
    crm_coupons (tenant_id),
    crm_coupon_purchases (tenant_id),
    reload_requests (tenant_id),
    discount_campaigns (tenant_id),
    crm_activities (tenant_id)
WITH (publish = 'insert,update,delete');

COMMENT ON PUBLICATION supabase_realtime IS
    'Realtime publication for all POS tables synced by the client. Rate limited to 50 events/sec/table via config.toml';
