-- ============================================
-- RIVER-WALL PRO CRM Schema
-- Loyalty, Wallet, Coupons, Campaigns
-- ============================================

-- ============================================
-- 1. LOYALTY CARDS
-- ============================================

CREATE TABLE IF NOT EXISTS loyalty_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    card_number TEXT NOT NULL,
    tier TEXT DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','platinum')),
    points INTEGER DEFAULT 0,
    total_spent NUMERIC(15,2) DEFAULT 0,
    issue_date DATE DEFAULT CURRENT_DATE,
    expiry_date DATE,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, card_number)
);

CREATE INDEX idx_loyalty_cards_tenant ON loyalty_cards(tenant_id);
CREATE INDEX idx_loyalty_cards_client ON loyalty_cards(client_id);
CREATE INDEX idx_loyalty_cards_number ON loyalty_cards(card_number);

-- ============================================
-- 2. WALLET TRANSACTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('credit','debit','transfer_in','transfer_out','reload','refund','points_redemption')),
    amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    balance_after NUMERIC(15,2) DEFAULT 0,
    points INTEGER DEFAULT 0,
    description TEXT,
    reference_id UUID, -- sale_id, reload_request_id, etc.
    reference_type TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- cashier who processed
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wallet_tx_tenant ON wallet_transactions(tenant_id);
CREATE INDEX idx_wallet_tx_client ON wallet_transactions(client_id);
CREATE INDEX idx_wallet_tx_created ON wallet_transactions(created_at DESC);

-- ============================================
-- 3. CRM COUPONS (Discount coupons)
-- ============================================

CREATE TABLE IF NOT EXISTS crm_coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT,
    description TEXT,
    discount_type TEXT DEFAULT 'percentage' CHECK (discount_type IN ('percentage','fixed_amount','free_product')),
    discount_value NUMERIC(15,2) DEFAULT 0,
    min_purchase NUMERIC(15,2) DEFAULT 0,
    max_uses INTEGER, -- NULL = unlimited
    uses_count INTEGER DEFAULT 0,
    max_uses_per_client INTEGER DEFAULT 1,
    valid_from DATE,
    valid_until DATE,
    applicable_products JSONB DEFAULT '[]', -- empty = all products
    applicable_categories JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

CREATE INDEX idx_crm_coupons_tenant ON crm_coupons(tenant_id);
CREATE INDEX idx_crm_coupons_code ON crm_coupons(code);

-- ============================================
-- 4. CRM COUPON PURCHASES / USAGE
-- ============================================

CREATE TABLE IF NOT EXISTS crm_coupon_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    coupon_id UUID NOT NULL REFERENCES crm_coupons(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    discount_applied NUMERIC(15,2) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coupon_purchases_tenant ON crm_coupon_purchases(tenant_id);
CREATE INDEX idx_coupon_purchases_coupon ON crm_coupon_purchases(coupon_id);

-- ============================================
-- 5. RELOAD REQUESTS (Wallet top-ups)
-- ============================================

CREATE TABLE IF NOT EXISTS reload_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash','card','mobile_money','bank_transfer')),
    payment_reference TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
    processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reload_requests_tenant ON reload_requests(tenant_id);
CREATE INDEX idx_reload_requests_client ON reload_requests(client_id);
CREATE INDEX idx_reload_requests_status ON reload_requests(status);

-- ============================================
-- 6. DISCOUNT CAMPAIGNS (Automatic discounts)
-- ============================================

CREATE TABLE IF NOT EXISTS discount_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    campaign_type TEXT DEFAULT 'percentage' CHECK (campaign_type IN ('percentage','fixed_amount','buy_x_get_y','points_multiplier')),
    discount_value NUMERIC(15,2) DEFAULT 0,
    min_purchase NUMERIC(15,2) DEFAULT 0,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    applicable_client_tiers JSONB DEFAULT '["bronze","silver","gold","platinum"]', -- which tiers qualify
    applicable_products JSONB DEFAULT '[]',
    applicable_categories JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_discount_campaigns_tenant ON discount_campaigns(tenant_id);
CREATE INDEX idx_discount_campaigns_active ON discount_campaigns(is_active, valid_from, valid_until);

-- ============================================
-- 7. CRM ACTIVITIES (Log)
-- ============================================

CREATE TABLE IF NOT EXISTS crm_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('sale','wallet_change','points_earned','points_redeemed','coupon_used','tier_change','reload','transfer','login','profile_update')),
    description TEXT,
    amount NUMERIC(15,2),
    points INTEGER,
    reference_id UUID,
    reference_type TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crm_activities_tenant ON crm_activities(tenant_id);
CREATE INDEX idx_crm_activities_client ON crm_activities(client_id);
CREATE INDEX idx_crm_activities_created ON crm_activities(created_at DESC);

-- ============================================
-- 8. TRIGGER: Auto-update client wallet/points on transaction
-- ============================================

CREATE OR REPLACE FUNCTION process_wallet_transaction()
RETURNS TRIGGER AS $$
DECLARE
    current_balance NUMERIC(15,2);
    current_points INTEGER;
BEGIN
    -- Get current values
    SELECT wallet_balance, loyalty_points INTO current_balance, current_points
    FROM clients WHERE id = NEW.client_id;

    -- Update client balance
    IF NEW.type IN ('credit', 'reload', 'transfer_in', 'refund') THEN
        UPDATE clients SET
            wallet_balance = COALESCE(current_balance, 0) + NEW.amount,
            loyalty_points = COALESCE(current_points, 0) + COALESCE(NEW.points, 0),
            updated_at = NOW()
        WHERE id = NEW.client_id;
        NEW.balance_after := COALESCE(current_balance, 0) + NEW.amount;
    ELSIF NEW.type IN ('debit', 'transfer_out', 'points_redemption') THEN
        UPDATE clients SET
            wallet_balance = COALESCE(current_balance, 0) - NEW.amount,
            loyalty_points = COALESCE(current_points, 0) - COALESCE(NEW.points, 0),
            updated_at = NOW()
        WHERE id = NEW.client_id;
        NEW.balance_after := COALESCE(current_balance, 0) - NEW.amount;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wallet_transaction
    BEFORE INSERT ON wallet_transactions
    FOR EACH ROW
    EXECUTE FUNCTION process_wallet_transaction();

-- ============================================
-- 9. TRIGGER: Update coupon uses count
-- ============================================

CREATE OR REPLACE FUNCTION increment_coupon_usage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE crm_coupons
    SET uses_count = uses_count + 1,
        updated_at = NOW()
    WHERE id = NEW.coupon_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_coupon_usage
    AFTER INSERT ON crm_coupon_purchases
    FOR EACH ROW
    EXECUTE FUNCTION increment_coupon_usage();

-- ============================================
-- 10. Apply updated_at triggers
-- ============================================

DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'loyalty_cards','wallet_transactions','crm_coupons',
        'crm_coupon_purchases','reload_requests','discount_campaigns','crm_activities'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', tbl, tbl);
        EXECUTE format('CREATE TRIGGER trg_%s_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
            tbl, tbl);
    END LOOP;
END $$;
