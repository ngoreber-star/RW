-- ============================================
-- RIVER-WALL PRO - Fix user creation
-- Replace crypt() based creation with clean tenant linking
-- ============================================

-- 1. Simple function to link an existing auth.user to a tenant
-- (The auth user should be created via supabase.auth.signUp from frontend)
CREATE OR REPLACE FUNCTION link_user_to_tenant(
    p_user_id UUID,
    p_tenant_id UUID,
    p_role TEXT DEFAULT 'seller',
    p_metadata JSONB DEFAULT '{}'
)
RETURNS BOOLEAN AS $$
BEGIN
    IF NOT is_superadmin(auth.uid()) THEN
        RAISE EXCEPTION 'SuperAdmin access required';
    END IF;

    INSERT INTO tenant_users (user_id, tenant_id, role, metadata)
    VALUES (p_user_id, p_tenant_id, p_role, p_metadata)
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET
        role = EXCLUDED.role,
        metadata = EXCLUDED.metadata,
        updated_at = NOW();

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Get auth user by email (superadmin only)
CREATE OR REPLACE FUNCTION get_auth_user_by_email(p_email TEXT)
RETURNS TABLE(id UUID, email TEXT, created_at TIMESTAMPTZ) AS $$
BEGIN
    IF NOT is_superadmin(auth.uid()) THEN
        RAISE EXCEPTION 'SuperAdmin access required';
    END IF;

    RETURN QUERY
    SELECT au.id, au.email::TEXT, au.created_at
    FROM auth.users au
    WHERE au.email = p_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fix existing user password if needed
-- ⚠️ Reemplaza '{{ADMIN_EMAIL}}' y '{{ADMIN_PASSWORD}}' con las credenciales reales
-- Note: This updates the encrypted_password directly. 
-- If this still doesn't work with GoTrue, the password MUST be reset from Supabase Dashboard.
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = '{{ADMIN_EMAIL}}';
    IF v_user_id IS NOT NULL THEN
        UPDATE auth.users
        SET encrypted_password = crypt('{{ADMIN_PASSWORD}}', gen_salt('bf'))
        WHERE id = v_user_id;
    END IF;
END $$;
