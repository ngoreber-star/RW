-- ============================================================
-- FIX: superadmin_create_tenant_v2 403 al crear tenants
-- ============================================================
-- Causa: SECURITY DEFINER hace que RLS vea auth.uid() = NULL
-- porque corre como postgres, no como el superadmin autenticado.
-- 
-- Solución: SECURITY INVOKER → corre con identidad del caller.
-- auth.uid() funciona correctamente dentro de RLS.
--
-- Afecta también: link_user_to_tenant (mismo patrón)
-- ============================================================

BEGIN;

-- 1. Fix superadmin_create_tenant_v2
DROP FUNCTION IF EXISTS superadmin_create_tenant_v2(TEXT, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS superadmin_create_tenant_v2(TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS link_user_to_tenant(UUID, UUID, TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS link_user_to_tenant(UUID, UUID) CASCADE;

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

    INSERT INTO licenses (tenant_id, plan, status, expires_at)
    VALUES (new_tenant_id, p_plan, 'trial', NOW() + INTERVAL '14 days');

    RETURN jsonb_build_object(
        'tenant_id', new_tenant_id,
        'admin_user_id', p_admin_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 2. Fix link_user_to_tenant (mismo bug, migration 008)
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
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 3. Asegurar EXECUTE grant para authenticated role
GRANT EXECUTE ON FUNCTION superadmin_create_tenant_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION link_user_to_tenant TO authenticated;

COMMIT;

-- Verificación:
-- SELECT * FROM information_schema.routine_routines
-- WHERE routine_name IN ('superadmin_create_tenant_v2', 'link_user_to_tenant')
--   AND routine_type = 'FUNCTION';
