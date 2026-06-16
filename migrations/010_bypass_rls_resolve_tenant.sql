-- ============================================
-- RIVER-WALL PRO - Bypass RLS for tenant resolution
-- ============================================
-- resolveTenant fails because RLS policies on tenant_users
-- prevent the authenticated user from reading their own row.
-- This RPC uses SECURITY DEFINER to bypass RLS entirely.
-- ============================================

CREATE OR REPLACE FUNCTION get_user_tenant(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'tenant_id', tu.tenant_id,
        'role', tu.role,
        'tenant', to_jsonb(t.*)
    ) INTO result
    FROM tenant_users tu
    JOIN tenants t ON t.id = tu.tenant_id
    WHERE tu.user_id = p_user_id
    LIMIT 1;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also create a version that returns ALL tenants for multi-tenant support
CREATE OR REPLACE FUNCTION get_user_tenants(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'tenant_id', tu.tenant_id,
            'role', tu.role,
            'tenant', to_jsonb(t.*)
        )
    ) INTO result
    FROM tenant_users tu
    JOIN tenants t ON t.id = tu.tenant_id
    WHERE tu.user_id = p_user_id;
    
    RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
