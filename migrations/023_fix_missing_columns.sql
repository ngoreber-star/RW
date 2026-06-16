-- ============================================
-- RIVER-WALL PRO - Missing Columns Fix
-- ============================================
-- Agrega columnas que el frontend envía pero
-- no existen en el esquema de la base de datos.
-- ============================================

BEGIN;

-- ============================================
-- 1. PURCHASES — columnas faltantes
-- ============================================

ALTER TABLE purchases
    ADD COLUMN IF NOT EXISTS order_number TEXT,
    ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS purchase_number TEXT,
    ADD COLUMN IF NOT EXISTS batch_id UUID,
    ADD COLUMN IF NOT EXISTS is_master BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS child_purchase_ids UUID[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;

-- ============================================
-- 2. WAREHOUSES — columnas faltantes
-- ============================================

ALTER TABLE warehouses
    ADD COLUMN IF NOT EXISTS location TEXT,
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS min_stock_alert INTEGER DEFAULT 0;

-- ============================================
-- 3. LOCALES — columnas faltantes
-- ============================================

ALTER TABLE locales
    ADD COLUMN IF NOT EXISTS email TEXT;

-- ============================================
-- 4. SUPPLIERS — columnas faltantes
-- ============================================

ALTER TABLE suppliers
    ADD COLUMN IF NOT EXISTS total_purchases NUMERIC(15,2) DEFAULT 0;

-- ============================================
-- 5. TAXES — columnas faltantes
-- ============================================

ALTER TABLE taxes
    ADD COLUMN IF NOT EXISTS description TEXT;

-- ============================================
-- 6. POS TERMINALS — columnas faltantes
-- ============================================

ALTER TABLE pos_terminals
    ADD COLUMN IF NOT EXISTS printer_width INTEGER DEFAULT 48,
    ADD COLUMN IF NOT EXISTS open_drawer BOOLEAN DEFAULT true;

-- ============================================
-- 7. LOYALTY CARDS — columnas faltantes
-- ============================================

ALTER TABLE loyalty_cards
    ADD COLUMN IF NOT EXISTS total_spent NUMERIC(15,2) DEFAULT 0;

-- ============================================
-- 8. CLIENTS — alias is_main para locales sync
-- ============================================

-- locales.is_main ya existe; agregamos is_default como alias virtual
-- para que toSnake isDefault→is_default funcione correctamente.
-- (is_default es manejado via aplicación, no como columna en locales)

-- ============================================
-- 9. Índices para nuevas columnas
-- ============================================

CREATE INDEX IF NOT EXISTS idx_purchases_warehouse ON purchases(tenant_id, warehouse_id)
    WHERE warehouse_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchases_order ON purchases(tenant_id, order_number)
    WHERE order_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_warehouses_default ON warehouses(tenant_id, is_default)
    WHERE is_default = true;

COMMIT;
