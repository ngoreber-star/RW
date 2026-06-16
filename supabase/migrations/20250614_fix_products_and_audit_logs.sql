-- ============================================================
-- Fix missing columns in products and audit_logs tables
-- ============================================================

-- 1. products: add all columns the app sends but the table doesn't have
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS box_price NUMERIC(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS half_box_price NUMERIC(15,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS units_per_box INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS cost_source TEXT DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS cost_calculation JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS sale_account_code TEXT DEFAULT '701',
    ADD COLUMN IF NOT EXISTS purchase_account_code TEXT DEFAULT '601',
    ADD COLUMN IF NOT EXISTS sizes TEXT[],
    ADD COLUMN IF NOT EXISTS colors TEXT[],
    ADD COLUMN IF NOT EXISTS lot_number TEXT,
    ADD COLUMN IF NOT EXISTS expiry_date DATE,
    ADD COLUMN IF NOT EXISTS tax_id UUID REFERENCES taxes(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS supplier_ids UUID[],
    ADD COLUMN IF NOT EXISTS has_expiry BOOLEAN DEFAULT false;

-- 2. audit_logs: add metadata column (referenced by security-utils.js logAudit)
ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 3. audit_logs: drop restrictive CHECK constraint on action column
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;

-- 4. Add updated_at trigger to audit_logs if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        WHERE c.relname = 'audit_logs' AND t.tgname = 'trg_audit_logs_updated_at'
    ) THEN
        CREATE TRIGGER trg_audit_logs_updated_at
            BEFORE UPDATE ON audit_logs
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
