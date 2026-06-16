-- ============================================
-- RIVER-WALL PRO - Create SuperAdmin
-- ⚠️ CAMBIA las credenciales antes de ejecutar en producción
-- Ejecutar esto en Supabase SQL Editor (New query)
-- ============================================

-- 1. Asegurar que la tabla superadmins existe
CREATE TABLE IF NOT EXISTS superadmins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Funcion helper para crear el primer superadmin de forma segura
CREATE OR REPLACE FUNCTION bootstrap_superadmin(
    p_email TEXT,
    p_password TEXT,
    p_name TEXT DEFAULT 'Super Admin'
)
RETURNS JSONB AS $$
DECLARE
    new_user_id UUID;
    existing_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO existing_count FROM superadmins;
    
    IF existing_count > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Ya existen superadmins en el sistema. Usa INSERT manual si necesitas agregar mas.'
        );
    END IF;

    SELECT id INTO new_user_id FROM auth.users WHERE email = p_email;
    
    IF new_user_id IS NULL THEN
        INSERT INTO auth.users (
            id, email, encrypted_password, email_confirmed_at,
            raw_user_meta_data, created_at, updated_at
        ) VALUES (
            uuid_generate_v4(),
            p_email,
            crypt(p_password, gen_salt('bf')),
            NOW(),
            jsonb_build_object('name', p_name),
            NOW(),
            NOW()
        )
        RETURNING id INTO new_user_id;
    END IF;

    INSERT INTO superadmins (user_id, name, email, is_active)
    VALUES (new_user_id, p_name, p_email, true)
    ON CONFLICT (user_id) DO UPDATE SET
        is_active = true,
        name = EXCLUDED.name;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', new_user_id,
        'email', p_email,
        'message', 'SuperAdmin creado exitosamente'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear el SuperAdmin con TUS credenciales
-- ⚠️ CAMBIA el email y la contraseña ANTES de ejecutar
-- Reemplaza 'admin@tudominio.com' y 'TuClaveSegura2024!' con tus credenciales reales
SELECT bootstrap_superadmin(
    '{{SUPERADMIN_EMAIL}}',     -- ← REEMPLAZA: admin@tudominio.com
    '{{SUPERADMIN_PASSWORD}}',  -- ← REEMPLAZA: TuClaveSegura2024!
    'Super Admin'
);

-- 4. Verificar que se creo correctamente
-- ⚠️ Reemplaza '{{SUPERADMIN_EMAIL}}' con el mismo email usado arriba
SELECT 
    s.id AS superadmin_id,
    s.user_id,
    s.name,
    s.email,
    s.is_active,
    s.created_at
FROM superadmins s
WHERE s.email = '{{SUPERADMIN_EMAIL}}';
