-- ============================================================
-- FIX: superadmin_create_tenant_v2 fails with 409 due to RLS
-- ============================================================
-- SECURITY DEFINER causes auth.uid() to be NULL inside RLS
-- policies because the function owner (postgres) is not an
-- authenticated Supabase Auth user. Switching to SECURITY INVOKER
-- makes the function run as the calling superadmin, whose UID
-- passes the superadmins RLS check.
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

    -- Create tenant
    INSERT INTO tenants (name, business_name, plan)
    VALUES (p_business_name, p_business_name, p_plan)
    RETURNING id INTO new_tenant_id;

    -- Link admin to tenant
    INSERT INTO tenant_users (user_id, tenant_id, role, is_owner)
    VALUES (p_admin_user_id, new_tenant_id, 'admin', true)
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
        'admin_user_id', p_admin_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
