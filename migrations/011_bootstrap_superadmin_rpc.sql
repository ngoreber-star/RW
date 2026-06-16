-- ============================================
-- RIVER-WALL PRO - Bootstrap superadmin RPC
-- ============================================
-- Auto-promotes the first user to superadmin if no active superadmins exist.
-- Used by superadmin.html handleAuth() for first-time setup.
-- ============================================

CREATE OR REPLACE FUNCTION bootstrap_superadmin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Only allow if no active superadmins exist
    IF EXISTS (SELECT 1 FROM superadmins WHERE is_active = true) THEN
        RETURN false;
    END IF;

    -- Insert the user as superadmin (or reactivate if previously deactivated)
    INSERT INTO superadmins (user_id, is_active)
    VALUES (p_user_id, true)
    ON CONFLICT (user_id) DO UPDATE SET
        is_active = true,
        updated_at = NOW();

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
