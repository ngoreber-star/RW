-- ============================================
-- RIVER-WALL PRO - SuperAdmin Panel RPCs
-- Functions needed by superadmin.html
-- ============================================

-- 1. Get all users with tenant and auth info
DROP FUNCTION IF EXISTS get_all_users();
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE(
    id UUID,
    email TEXT,
    name TEXT,
    tenant_id UUID,
    tenant_name TEXT,
    role TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    IF NOT is_superadmin(auth.uid()) THEN
        RAISE EXCEPTION 'SuperAdmin access required';
    END IF;

    RETURN QUERY
    SELECT 
        tu.user_id AS id,
        au.email::TEXT,
        COALESCE(au.raw_user_meta_data->>'name', au.email) AS name,
        tu.tenant_id,
        t.name AS tenant_name,
        tu.role,
        tu.created_at
    FROM tenant_users tu
    JOIN auth.users au ON au.id = tu.user_id
    JOIN tenants t ON t.id = tu.tenant_id
    ORDER BY tu.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Get all licenses with tenant info
DROP FUNCTION IF EXISTS get_all_licenses();
CREATE OR REPLACE FUNCTION get_all_licenses()
RETURNS TABLE(
    id UUID,
    tenant_id UUID,
    tenant_name TEXT,
    plan TEXT,
    status TEXT,
    started_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    max_users INTEGER,
    max_locales INTEGER,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    IF NOT is_superadmin(auth.uid()) THEN
        RAISE EXCEPTION 'SuperAdmin access required';
    END IF;

    RETURN QUERY
    SELECT 
        l.id,
        l.tenant_id,
        t.name AS tenant_name,
        l.plan,
        l.status,
        l.started_at,
        l.expires_at,
        l.max_users,
        l.max_locales,
        l.created_at
    FROM licenses l
    JOIN tenants t ON t.id = l.tenant_id
    ORDER BY l.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update tenant (superadmin only)
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
        max_users = COALESCE(p_max_users, max_users),
        max_locales = COALESCE(p_max_locales, max_locales),
        metadata = COALESCE(p_metadata, metadata),
        updated_at = NOW()
    WHERE id = p_tenant_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update user name (superadmin only)
DROP FUNCTION IF EXISTS update_tenant_user_name(UUID, TEXT);
CREATE OR REPLACE FUNCTION update_tenant_user_name(
    p_user_id UUID,
    p_name TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    IF NOT is_superadmin(auth.uid()) THEN
        RAISE EXCEPTION 'SuperAdmin access required';
    END IF;

    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('name', p_name),
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. SuperAdmin create user (bypasses tenant admin check)
DROP FUNCTION IF EXISTS superadmin_create_user(UUID, TEXT, TEXT, TEXT, TEXT, JSONB);
CREATE OR REPLACE FUNCTION superadmin_create_user(
    p_tenant_id UUID,
    p_email TEXT,
    p_password TEXT,
    p_name TEXT,
    p_role TEXT DEFAULT 'seller',
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
BEGIN
    IF NOT is_superadmin(auth.uid()) THEN
        RAISE EXCEPTION 'SuperAdmin access required';
    END IF;

    SELECT id INTO new_user_id FROM auth.users WHERE email = p_email;
    IF new_user_id IS NOT NULL THEN
        INSERT INTO tenant_users (user_id, tenant_id, role, metadata)
        VALUES (new_user_id, p_tenant_id, p_role, p_metadata)
        ON CONFLICT (user_id, tenant_id) DO UPDATE SET
            role = EXCLUDED.role,
            metadata = EXCLUDED.metadata,
            updated_at = NOW();
        RETURN new_user_id;
    END IF;

    INSERT INTO auth.users (
        id, email, encrypted_password, email_confirmed_at,
        raw_user_meta_data, created_at, updated_at
    ) VALUES (
        uuid_generate_v4(), p_email, crypt(p_password, gen_salt('bf')), NOW(),
        jsonb_build_object('name', p_name, 'role', p_role), NOW(), NOW()
    )
    RETURNING id INTO new_user_id;

    INSERT INTO tenant_users (user_id, tenant_id, role, metadata)
    VALUES (new_user_id, p_tenant_id, p_role, p_metadata);

    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. SuperAdmin delete user from tenant (does NOT delete auth.user)
DROP FUNCTION IF EXISTS superadmin_delete_user(UUID);
CREATE OR REPLACE FUNCTION superadmin_delete_user(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF NOT is_superadmin(auth.uid()) THEN
        RAISE EXCEPTION 'SuperAdmin access required';
    END IF;

    DELETE FROM tenant_users WHERE user_id = p_user_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Get recent activity for superadmin dashboard
DROP FUNCTION IF EXISTS get_superadmin_activity(INTEGER);
CREATE OR REPLACE FUNCTION get_superadmin_activity(p_limit INTEGER DEFAULT 20)
RETURNS TABLE(
    action TEXT,
    target_type TEXT,
    target_name TEXT,
    details JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    IF NOT is_superadmin(auth.uid()) THEN
        RAISE EXCEPTION 'SuperAdmin access required';
    END IF;

    RETURN QUERY
    SELECT 
        sa.action,
        sa.target_type,
        COALESCE(t.name, sa.target_id) AS target_name,
        sa.details,
        sa.created_at
    FROM superadmin_audit sa
    LEFT JOIN tenants t ON t.id = sa.target_id::UUID
    ORDER BY sa.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
