-- Vincular usuario creado desde Dashboard a tenant y superadmin
DO $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'test@wabo.com';
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado. Crealo primero en Authentication -> Users';
    END IF;

    SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No hay tenants. Crea uno primero en superadmin.html';
    END IF;

    -- Vincular a tenant
    INSERT INTO tenant_users (user_id, tenant_id, role, is_owner)
    VALUES (v_user_id, v_tenant_id, 'admin', true)
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET
        role = 'admin', is_owner = true, updated_at = NOW();

    -- Hacer superadmin
    INSERT INTO superadmins (user_id, is_active)
    VALUES (v_user_id, true)
    ON CONFLICT (user_id) DO UPDATE SET
        is_active = true;

    RAISE NOTICE 'OK - Usuario vinculado a tenant % como admin + superadmin', v_tenant_id;
END $$;
