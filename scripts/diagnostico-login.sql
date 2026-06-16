-- ============================================
-- RIVER-WALL PRO - Diagnóstico Completo de Login
-- ⚠️ Reemplaza '{{ADMIN_EMAIL}}' con el email del superadmin real
-- Ejecutar esto en Supabase SQL Editor
-- ============================================

-- 1. VERIFICAR TABLAS
SELECT 'tenants' as tabla, COUNT(*) as filas FROM tenants
UNION ALL SELECT 'tenant_users', COUNT(*) FROM tenant_users
UNION ALL SELECT 'superadmins', COUNT(*) FROM superadmins
UNION ALL SELECT 'auth.users', COUNT(*) FROM auth.users
UNION ALL SELECT 'licenses', COUNT(*) FROM licenses;

-- 2. VERIFICAR SI EL USUARIO EXISTE EN AUTH
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    raw_user_meta_data->>'name' as name
FROM auth.users 
WHERE email = '{{ADMIN_EMAIL}}';

-- 3. VERIFICAR VINCULO EN TENANT_USERS
SELECT tu.*, t.name as tenant_name
FROM tenant_users tu
JOIN tenants t ON t.id = tu.tenant_id
WHERE tu.user_id = (SELECT id FROM auth.users WHERE email = '{{ADMIN_EMAIL}}');

-- 4. VERIFICAR SUPERADMIN
SELECT * FROM superadmins 
WHERE user_id = (SELECT id FROM auth.users WHERE email = '{{ADMIN_EMAIL}}');

-- 5. VERIFICAR FUNCIONES CRITICAS
SELECT 
    proname as funcion,
    prosrc IS NOT NULL as existe
FROM pg_proc 
WHERE proname IN ('is_superadmin', 'get_all_tenants', 'superadmin_create_tenant', 'create_user_for_tenant', 'get_user_tenant_ids');

-- 6. CREAR/REPARAR TODO SI FALTA ALGO
DO $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
BEGIN
    -- Buscar usuario
    SELECT id INTO v_user_id FROM auth.users WHERE email = '{{ADMIN_EMAIL}}';

    IF v_user_id IS NULL THEN
        RAISE NOTICE 'Usuario {{ADMIN_EMAIL}} NO existe en auth.users';
        RETURN;
    END IF;
    
    -- Crear tenant si no existe
    SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
    IF v_tenant_id IS NULL THEN
        INSERT INTO tenants (name, business_name, plan, status)
        VALUES ('Mi Negocio', 'Mi Negocio', 'lite', 'active')
        RETURNING id INTO v_tenant_id;
        RAISE NOTICE 'Tenant creado: %', v_tenant_id;
    END IF;
    
    -- Vincular usuario a tenant
    INSERT INTO tenant_users (user_id, tenant_id, role, is_owner)
    VALUES (v_user_id, v_tenant_id, 'admin', true)
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET
        role = 'admin',
        is_owner = true,
        updated_at = NOW();
    RAISE NOTICE 'Usuario vinculado a tenant';
    
    -- Hacer superadmin
    INSERT INTO superadmins (user_id, name, email, is_active)
    VALUES (v_user_id, 'Super Admin', '{{ADMIN_EMAIL}}', true)
    ON CONFLICT (user_id) DO UPDATE SET
        is_active = true,
        name = 'Super Admin';
    RAISE NOTICE 'Superadmin creado/actualizado';
END $$;

-- 7. VERIFICAR RLS (las politicas pueden bloquear)
SELECT 
    schemaname, 
    tablename, 
    rowsecurity as rls_activado
FROM pg_tables 
WHERE tablename IN ('tenants', 'tenant_users', 'superadmins')
AND schemaname = 'public';

-- 8. RESULTADO FINAL
SELECT 
    u.email,
    u.id as user_id,
    t.name as tenant_name,
    tu.role,
    tu.is_owner,
    s.is_active as is_superadmin,
    l.plan as license_plan,
    l.status as license_status
FROM auth.users u
LEFT JOIN tenant_users tu ON tu.user_id = u.id
LEFT JOIN tenants t ON t.id = tu.tenant_id
LEFT JOIN superadmins s ON s.user_id = u.id
LEFT JOIN licenses l ON l.tenant_id = t.id
WHERE u.email = '{{ADMIN_EMAIL}}';
