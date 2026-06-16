-- ============================================
-- 016: Add missing columns to inventory_movements
-- for full Supabase sync from the app
-- ============================================

ALTER TABLE inventory_movements
    ADD COLUMN IF NOT EXISTS lot_number TEXT,
    ADD COLUMN IF NOT EXISTS expiry_date DATE,
    ADD COLUMN IF NOT EXISTS variant_key TEXT,
    ADD COLUMN IF NOT EXISTS running_balance INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS user_name TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN inventory_movements.lot_number IS 'Número de lote del producto';
COMMENT ON COLUMN inventory_movements.expiry_date IS 'Fecha de caducidad';
COMMENT ON COLUMN inventory_movements.variant_key IS 'Clave de variante (talla/color)';
COMMENT ON COLUMN inventory_movements.running_balance IS 'Saldo contable después del movimiento';
COMMENT ON COLUMN inventory_movements.notes IS 'Notas u observaciones del movimiento';
COMMENT ON COLUMN inventory_movements.user_name IS 'Nombre legible del usuario que realizó el movimiento';
COMMENT ON COLUMN inventory_movements.updated_at IS 'Fecha de última actualización';

-- Relax type CHECK constraint to include 'in'/'out' (already standard in app)
ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_type_check;
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_type_check
    CHECK (type IN ('in','out','transfer','adjustment','waste','purchase','sale','container-receipt'));
