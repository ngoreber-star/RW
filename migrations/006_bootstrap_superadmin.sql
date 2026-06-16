-- ============================================
-- RIVER-WALL PRO - Bootstrap SuperAdmin
-- Run this ONCE in Supabase SQL Editor to create the first superadmin
-- ============================================

-- Option 1: Safe bootstrap function (creates superadmin ONLY if none exist)
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
    -- Check if any superadmin already exists
    SELECT COUNT(*) INTO existing_count FROM superadmins;
    
    IF existing_count > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Superadmins already exist. Use manual INSERT if you need to add more.'
        );
    END IF;

    -- Check if user already exists in auth.users
    SELECT id INTO new_user_id FROM auth.users WHERE email = p_email;
    
    IF new_user_id IS NULL THEN
        -- Create new auth user
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

    -- Insert into superadmins
    INSERT INTO superadmins (user_id, name, email, is_active)
    VALUES (new_user_id, p_name, p_email, true)
    ON CONFLICT (user_id) DO UPDATE SET
        is_active = true,
        name = EXCLUDED.name;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', new_user_id,
        'message', 'First superadmin created successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- HOW TO USE:
-- ============================================
-- Run this in Supabase SQL Editor to create your first superadmin:
--
-- SELECT bootstrap_superadmin('tu-email@ejemplo.com', 'TuContraseñaSegura123');
--
-- ============================================
-- Option 2: Manual INSERT (if you already have a user in auth.users)
-- ============================================
--
-- INSERT INTO superadmins (user_id, name, email, is_active)
-- VALUES (
--     (SELECT id FROM auth.users WHERE email = 'tu-email@ejemplo.com'),
--     'Super Admin',
--     'tu-email@ejemplo.com',
--     true
-- );
--
-- ============================================
-- To check existing superadmins:
-- ============================================
-- SELECT s.*, u.email FROM superadmins s JOIN auth.users u ON s.user_id = u.id;
