-- ==========================================
-- Crear usuario auth + vincular a tenant (bypass signup rate limit)
-- ==========================================

DO $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_email TEXT := 'test@wabo.com';
    v_password TEXT := '12345678';
BEGIN
    -- 1. Verificar si el usuario ya existe
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
    
    IF v_user_id IS NULL THEN
        -- Crear nuevo usuario
        INSERT INTO auth.users (
            id, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, 
            created_at, updated_at, confirmation_token,
            recovery_token, email_change_token_new, email_change
        ) VALUES (
            gen_random_uuid(),
            v_email,
            crypt(v_password, gen_salt('bf', 10)),
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"name":"Test User"}'::jsonb,
            NOW(), NOW(),
            '', '', '', ''
        )
        RETURNING id INTO v_user_id;
    ELSE
        -- Actualizar contraseña del usuario existente
        UPDATE auth.users 
        SET encrypted_password = crypt(v_password, gen_salt('bf', 10)),
            email_confirmed_at = NOW(),
            updated_at = NOW()
        WHERE id = v_user_id;
    END IF;

    -- 2. Obtener el primer tenant existente
    SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No hay tenants. Crea uno primero desde superadmin.html';
    END IF;

    -- 3. Vincular usuario al tenant
    INSERT INTO tenant_users (user_id, tenant_id, role, is_owner)
    VALUES (v_user_id, v_tenant_id, 'admin', true)
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET
        role = 'admin', is_owner = true, updated_at = NOW();

    -- 4. Hacer superadmin
    INSERT INTO superadmins (user_id, is_active)
    VALUES (v_user_id, true)
    ON CONFLICT (user_id) DO UPDATE SET is_active = true;

    RAISE NOTICE 'OK - Usuario: % | Tenant: %', v_user_id, v_tenant_id;
END $$;
