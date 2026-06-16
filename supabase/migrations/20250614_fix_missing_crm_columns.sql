-- ============================================================
-- Fix missing columns in existing tables
-- Tables were created by 002_crm_schema.sql without certain
-- columns that 003_crm_and_public_schema.sql expected.
-- Since CREATE TABLE IF NOT EXISTS skips existing tables,
-- these columns were never added.
--
-- Also fix missing updated_at columns that triggers reference.
-- ============================================================

-- 1. Add missing updated_at columns (triggers reference them)
ALTER TABLE crm_activities
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE wallet_transactions
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE crm_coupon_purchases
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. wallet_transactions: add related_client_id
ALTER TABLE wallet_transactions
    ADD COLUMN IF NOT EXISTS related_client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- 3. crm_coupon_purchases: add purchased_at
ALTER TABLE crm_coupon_purchases
    ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMPTZ DEFAULT NOW();

-- 4. crm_activities: add action column (alias for activity_type)
ALTER TABLE crm_activities
    ADD COLUMN IF NOT EXISTS action TEXT;

-- 5. discount_campaigns: add discount_type column (new schema uses this)
ALTER TABLE discount_campaigns
    ADD COLUMN IF NOT EXISTS discount_type TEXT;

-- 6. crm_coupons: relax CHECK constraint to accept 'fixed' as well
ALTER TABLE crm_coupons DROP CONSTRAINT IF EXISTS crm_coupons_discount_type_check;
ALTER TABLE crm_coupons ADD CONSTRAINT crm_coupons_discount_type_check
    CHECK (discount_type IN ('percentage', 'fixed_amount', 'fixed', 'free_product'));

-- 7. Now populate the new columns (updated_at triggers now have the column)
UPDATE crm_activities SET action = activity_type WHERE action IS NULL AND activity_type IS NOT NULL;
UPDATE discount_campaigns SET discount_type = campaign_type WHERE discount_type IS NULL AND campaign_type IS NOT NULL;
