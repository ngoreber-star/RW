-- ============================================
-- RIVER-WALL PRO - Confirm Wallet Payment RPC
-- Adaptado al esquema existente de payment_requests (id TEXT)
-- ============================================

CREATE OR REPLACE FUNCTION confirm_wallet_payment(
    p_request_id TEXT,
    p_tenant_id UUID,
    p_pin TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_request RECORD;
    v_client RECORD;
BEGIN
    SELECT * INTO v_request
    FROM payment_requests
    WHERE id = p_request_id AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment request not found';
    END IF;

    IF v_request.status != 'pending' THEN
        RAISE EXCEPTION 'Payment request already processed';
    END IF;

    IF v_request.expires_at IS NOT NULL AND v_request.expires_at < NOW() THEN
        UPDATE payment_requests SET status = 'expired', updated_at = NOW()
        WHERE id = p_request_id;
        RETURN false;
    END IF;

    SELECT * INTO v_client
    FROM clients
    WHERE id = v_request.client_id AND tenant_id = p_tenant_id;

    IF v_client IS NULL OR v_client.pin_hash IS NULL THEN
        RAISE EXCEPTION 'Client PIN not configured';
    END IF;

    UPDATE payment_requests
    SET status = 'confirmed',
        updated_at = NOW()
    WHERE id = p_request_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
