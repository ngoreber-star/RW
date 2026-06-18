-- Migration 024: Fix Realtime publication for all client-subscribed tables
-- ============================================================
-- El adapter se suscribe a 20 tablas de negocio, pero la publicación
-- supabase_realtime solo incluía products, sales, clients y warehouse_stock.
-- Esto hacía que los cambios en categories, purchases, suppliers, etc. no
-- se propagaran en tiempo real a otros navegadores.
--
-- Se recrea la publicación con la lista completa de tablas.
-- IMPORTANTE: NO se debe especificar una lista de columnas. Cuando se listan
-- columnas, PostgreSQL exige que la publicación cubra la replica identity para
-- operaciones UPDATE/DELETE; de lo contrario, las funciones RPC y triggers que
-- modifican estas tablas fallan con el error 42P10. Publicar todas las columnas
-- es el comportamiento estándar de Supabase Realtime.

DROP PUBLICATION IF EXISTS supabase_realtime;

CREATE PUBLICATION supabase_realtime FOR TABLE
    products,
    categories,
    clients,
    sales,
    purchases,
    suppliers,
    warehouses,
    warehouse_stock,
    inventory_movements,
    transfers,
    pos_terminals,
    taxes,
    locales,
    loyalty_cards,
    wallet_transactions,
    crm_coupons,
    crm_coupon_purchases,
    reload_requests,
    discount_campaigns,
    crm_activities,
    alerts
WITH (publish = 'insert,update,delete');

COMMENT ON PUBLICATION supabase_realtime IS
    'Realtime publication for all POS tables synced by the client. Rate limited to 50 events/sec/table via config.toml';
