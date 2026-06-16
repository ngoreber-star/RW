-- ============================================
-- RIVER-WALL PRO - SuperAdmin Schema
-- Edge Functions support + admin tables
-- ============================================

-- ============================================
-- 1. SUPERADMINS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS superadmins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE superadmins IS 'Global super administrators who can manage all tenants.';

-- ============================================
-- 2. LICENSES TABLE (subscription tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'lite' CHECK (plan IN ('lite','pro','enterprise')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active','expired','cancelled','trial')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    max_users INTEGER,
    max_locales INTEGER,
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_licenses_tenant ON licenses(tenant_id);

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS trg_licenses_updated_at ON licenses;
CREATE TRIGGER trg_licenses_updated_at
    BEFORE UPDATE ON licenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. SUPERADMIN HELPER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION is_superadmin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM superadmins
        WHERE user_id = p_user_id AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. SUPERADMIN RPC FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION get_all_tenants(p_search TEXT DEFAULT NULL)
RETURNS TABLE(
    id UUID,
    name TEXT,
    business_name TEXT,
    plan TEXT,
    status TEXT,
    created_at TIMESTAMPTZ,
    user_count BIGINT,
    license_status TEXT,
    license_expires TIMESTAMPTZ
) AS $$
BEGIN
    IF NOT is_superadmin(auth.uid()) THEN
        RAISE EXCEPTION 'SuperAdmin access required';
    END IF;

    RETURN QUERY
    SELECT
        t.id,
        t.name,
        t.business_name,
        t.plan,
        t.status,
        t.created_at,
        (SELECT COUNT(*) FROM tenant_users tu WHERE tu.tenant_id = t.id) AS user_count,
        (SELECT l.status FROM licenses l WHERE l.tenant_id = t.id ORDER BY l.created_at DESC LIMIT 1) AS license_status,
        (SELECT l.expires_at FROM licenses l WHERE l.tenant_id = t.id ORDER BY l.created_at DESC LIMIT 1) AS license_expires
    FROM tenants t
    WHERE p_search IS NULL
       OR t.name ILIKE '%' || p_search || '%'
       OR t.business_name ILIKE '%' || p_search || '%'
    ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION superadmin_create_tenant(
    p_business_name TEXT,
    p_admin_email TEXT,
    p_admin_password TEXT,
    p_plan TEXT DEFAULT 'lite'
)
RETURNS JSONB AS $$
DECLARE
    new_tenant_id UUID;
    admin_user_id UUID;
BEGIN
    IF NOT is_superadmin(auth.uid()) THEN
        RAISE EXCEPTION 'SuperAdmin access required';
    END IF;

    -- Create tenant
    INSERT INTO tenants (name, business_name, plan)
    VALUES (p_business_name, p_business_name, p_plan)
    RETURNING id INTO new_tenant_id;

    -- Create or find admin user
    SELECT id INTO admin_user_id FROM auth.users WHERE email = p_admin_email;
    IF admin_user_id IS NULL THEN
        INSERT INTO auth.users (
            id, email, encrypted_password, email_confirmed_at,
            raw_user_meta_data, created_at, updated_at
        ) VALUES (
            uuid_generate_v4(), p_admin_email, crypt(p_admin_password, gen_salt('bf')), NOW(),
            jsonb_build_object('name', p_business_name, 'role', 'admin'), NOW(), NOW()
        )
        RETURNING id INTO admin_user_id;
    END IF;

    -- Link admin to tenant
    INSERT INTO tenant_users (user_id, tenant_id, role, is_owner)
    VALUES (admin_user_id, new_tenant_id, 'admin', true)
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET
        role = 'admin', is_owner = true, updated_at = NOW();

    -- Seed defaults
    INSERT INTO categories (tenant_id, name, color, icon) VALUES
        (new_tenant_id, 'Bebidas', 'blue', 'fa-wine-bottle'),
        (new_tenant_id, 'Alimentos', 'emerald', 'fa-hamburger'),
        (new_tenant_id, 'General', 'gray', 'fa-box');

    INSERT INTO taxes (tenant_id, name, rate, type, is_default) VALUES
        (new_tenant_id, 'TVA', 19.25, 'vat', true);

    -- Create initial license
    INSERT INTO licenses (tenant_id, plan, status, expires_at)
    VALUES (new_tenant_id, p_plan, 'trial', NOW() + INTERVAL '14 days');

    RETURN jsonb_build_object(
        'tenant_id', new_tenant_id,
        'admin_user_id', admin_user_id,
        'message', 'Tenant created successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION superadmin_assign_license(
    p_tenant_id UUID,
    p_plan TEXT,
    p_duration_days INTEGER DEFAULT 30,
    p_status TEXT DEFAULT 'active'
)
RETURNS UUID AS $$
DECLARE
    new_license_id UUID;
BEGIN
    IF NOT is_superadmin(auth.uid()) THEN
        RAISE EXCEPTION 'SuperAdmin access required';
    END IF;

    -- Cancel any active license
    UPDATE licenses SET status = 'cancelled', updated_at = NOW()
    WHERE tenant_id = p_tenant_id AND status = 'active';

    -- Update tenant plan
    UPDATE tenants SET plan = p_plan, updated_at = NOW() WHERE id = p_tenant_id;

    -- Create new license
    INSERT INTO licenses (tenant_id, plan, status, expires_at, created_by)
    VALUES (p_tenant_id, p_plan, p_status, NOW() + (p_duration_days || ' days')::INTERVAL, auth.uid())
    RETURNING id INTO new_license_id;

    RETURN new_license_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION superadmin_delete_tenant(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF NOT is_superadmin(auth.uid()) THEN
        RAISE EXCEPTION 'SuperAdmin access required';
    END IF;

    -- Delete tenant (cascades to all related data via FK constraints)
    DELETE FROM tenants WHERE id = p_tenant_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. AUDIT LOG FOR SUPERADMIN ACTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS superadmin_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    details JSONB DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_superadmin_audit_user ON superadmin_audit(user_id);
CREATE INDEX idx_superadmin_audit_created ON superadmin_audit(created_at DESC);
