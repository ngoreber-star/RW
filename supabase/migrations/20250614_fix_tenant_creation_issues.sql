-- ============================================================
-- FIX: superadmin_update_tenant redirects max_users/max_locales
--      to licenses table (they don't exist on tenants)
-- ============================================================

DROP FUNCTION IF EXISTS superadmin_update_tenant(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, JSONB);
CREATE OR REPLACE FUNCTION superadmin_update_tenant(
    p_tenant_id UUID,
    p_name TEXT DEFAULT NULL,
    p_business_name TEXT DEFAULT NULL,
    p_plan TEXT DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_tax_id TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
    p_max_users INTEGER DEFAULT NULL,
    p_max_locales INTEGER DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    IF NOT is_superadmin(auth.uid()) THEN
        RAISE EXCEPTION 'SuperAdmin access required';
    END IF;

    UPDATE tenants
    SET
        name = COALESCE(p_name, name),
        business_name = COALESCE(p_business_name, business_name),
        plan = COALESCE(p_plan, plan),
        status = COALESCE(p_status, status),
        phone = COALESCE(p_phone, phone),
        tax_id = COALESCE(p_tax_id, tax_id),
        address = COALESCE(p_address, address),
        metadata = COALESCE(p_metadata, metadata),
        updated_at = NOW()
    WHERE id = p_tenant_id;

    -- max_users / max_locales live on the licenses table, not tenants
    IF p_max_users IS NOT NULL OR p_max_locales IS NOT NULL THEN
        UPDATE licenses
        SET
            max_users = COALESCE(p_max_users, max_users),
            max_locales = COALESCE(p_max_locales, max_locales),
            updated_at = NOW()
        WHERE tenant_id = p_tenant_id;
    END IF;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX: add trial license + default locale to create_tenant_for_user
-- ============================================================

CREATE OR REPLACE FUNCTION create_tenant_for_user(
    p_user_id UUID,
    p_business_name TEXT,
    p_email TEXT,
    p_plan TEXT DEFAULT 'lite'
)
RETURNS UUID AS $$
DECLARE
    new_tenant_id UUID;
BEGIN
    INSERT INTO tenants (name, business_name, plan)
    VALUES (p_business_name, p_business_name, p_plan)
    RETURNING id INTO new_tenant_id;

    INSERT INTO tenant_users (user_id, tenant_id, role, is_owner)
    VALUES (p_user_id, new_tenant_id, 'admin', true);

    INSERT INTO categories (tenant_id, name, color, icon) VALUES
        (new_tenant_id, 'Bebidas', 'blue', 'fa-wine-bottle'),
        (new_tenant_id, 'Alimentos', 'emerald', 'fa-hamburger'),
        (new_tenant_id, 'General', 'gray', 'fa-box');

    INSERT INTO taxes (tenant_id, name, rate, type, is_default) VALUES
        (new_tenant_id, 'TVA', 19.25, 'vat', true);

    -- Create default locale
    INSERT INTO locales (tenant_id, name, code, is_main, is_active)
    VALUES (new_tenant_id, 'Principal', 'main', true, true);

    -- Create trial license
    INSERT INTO licenses (tenant_id, plan, status, expires_at)
    VALUES (new_tenant_id, p_plan, 'trial', NOW() + INTERVAL '14 days');

    RETURN new_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX: add default locale to superadmin_create_tenant_v2
-- ============================================================

CREATE OR REPLACE FUNCTION superadmin_create_tenant_v2(
    p_business_name TEXT,
    p_admin_user_id UUID,
    p_plan TEXT DEFAULT 'lite'
)
RETURNS JSONB AS $$
DECLARE
    new_tenant_id UUID;
BEGIN
    IF NOT is_superadmin(auth.uid()) THEN
        RAISE EXCEPTION 'SuperAdmin access required';
    END IF;

    INSERT INTO tenants (name, business_name, plan)
    VALUES (p_business_name, p_business_name, p_plan)
    RETURNING id INTO new_tenant_id;

    INSERT INTO tenant_users (user_id, tenant_id, role, is_owner)
    VALUES (p_admin_user_id, new_tenant_id, 'admin', true)
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET
        role = 'admin', is_owner = true, updated_at = NOW();

    INSERT INTO categories (tenant_id, name, color, icon) VALUES
        (new_tenant_id, 'Bebidas', 'blue', 'fa-wine-bottle'),
        (new_tenant_id, 'Alimentos', 'emerald', 'fa-hamburger'),
        (new_tenant_id, 'General', 'gray', 'fa-box');

    INSERT INTO taxes (tenant_id, name, rate, type, is_default) VALUES
        (new_tenant_id, 'TVA', 19.25, 'vat', true);

    -- Create default locale
    INSERT INTO locales (tenant_id, name, code, is_main, is_active)
    VALUES (new_tenant_id, 'Principal', 'main', true, true);

    INSERT INTO licenses (tenant_id, plan, status, expires_at)
    VALUES (new_tenant_id, p_plan, 'trial', NOW() + INTERVAL '14 days');

    RETURN jsonb_build_object(
        'tenant_id', new_tenant_id,
        'admin_user_id', p_admin_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
