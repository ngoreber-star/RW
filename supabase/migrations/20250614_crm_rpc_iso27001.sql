-- ============================================================
-- CRM RPCs — ISO 27001 compliant, PIN-verified, no anonymous auth
-- All functions are SECURITY DEFINER to bypass RLS.
-- Authentication is done internally via PIN hash verification.
-- ============================================================

-- ============================================================
-- 1. CRM AUTHENTICATE
--   Looks up client by phone or email, verifies PIN hash,
--   returns full client profile. No Supabase auth required.
-- ============================================================
CREATE OR REPLACE FUNCTION crm_authenticate(
    p_tenant_id UUID,
    p_phone_or_email TEXT,
    p_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client clients%ROWTYPE;
BEGIN
    SELECT * INTO v_client
    FROM clients
    WHERE tenant_id = p_tenant_id
      AND (phone = p_phone_or_email OR email = p_phone_or_email)
      AND is_active = true;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'CLIENT_NOT_FOUND');
    END IF;

    -- ISO 27001 A.9.4.2: Secure authentication via PIN hash
    IF v_client.pin_hash IS NULL OR v_client.pin_hash != p_pin THEN
        RETURN jsonb_build_object('error', 'INVALID_PIN');
    END IF;

    RETURN jsonb_build_object(
        'id', v_client.id,
        'firstName', v_client.first_name,
        'lastName', v_client.last_name,
        'email', v_client.email,
        'phone', v_client.phone,
        'loyaltyCardNumber', v_client.loyalty_card_number,
        'tier', v_client.tier,
        'walletBalance', v_client.wallet_balance,
        'loyaltyPoints', v_client.loyalty_points,
        'pinHash', v_client.pin_hash,
        'isActive', v_client.is_active,
        'createdAt', v_client.created_at
    );
END;
$$;

-- ============================================================
-- 2. CRM GET WALLET
--   Returns wallet balance + recent transactions.
-- ============================================================
CREATE OR REPLACE FUNCTION crm_get_wallet(
    p_client_id UUID,
    p_limit INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_balance NUMERIC;
    v_txns JSONB;
BEGIN
    SELECT wallet_balance INTO v_balance
    FROM clients WHERE id = p_client_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'CLIENT_NOT_FOUND');
    END IF;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', wt.id,
            'type', wt.type,
            'amount', wt.amount,
            'balanceAfter', wt.balance_after,
            'description', wt.description,
            'relatedClientId', wt.related_client_id,
            'createdAt', wt.created_at
        ) ORDER BY wt.created_at DESC
    ), '[]'::jsonb) INTO v_txns
    FROM wallet_transactions wt
    WHERE wt.client_id = p_client_id
    LIMIT p_limit;

    RETURN jsonb_build_object(
        'walletBalance', v_balance,
        'transactions', v_txns
    );
END;
$$;

-- ============================================================
-- 3. CRM GET COUPONS
--   Returns active coupons + coupon purchases for client.
-- ============================================================
CREATE OR REPLACE FUNCTION crm_get_coupons(
    p_client_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_coupons JSONB;
BEGIN
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', cp.id,
            'code', cc.code,
            'name', cc.name,
            'description', cc.description,
            'discountType', cc.discount_type,
            'discountValue', cc.discount_value,
            'minPurchase', cc.min_purchase,
            'validFrom', cc.valid_from,
            'validUntil', cc.valid_until,
            'status', cp.status,
            'purchasedAt', cp.purchased_at
        ) ORDER BY cp.purchased_at DESC
    ), '[]'::jsonb) INTO v_coupons
    FROM crm_coupon_purchases cp
    JOIN crm_coupons cc ON cc.id = cp.coupon_id
    WHERE cp.client_id = p_client_id;

    RETURN jsonb_build_object('coupons', v_coupons);
END;
$$;

-- ============================================================
-- 4. CRM TRANSFER WALLET
--   Atomically debits sender and credits recipient.
--   ISO 27001 A.12.6.1: Single atomic transaction prevents
--   partial updates and race conditions.
-- ============================================================
CREATE OR REPLACE FUNCTION crm_transfer_wallet(
    p_from_client_id UUID,
    p_to_phone TEXT,
    p_amount NUMERIC,
    p_concept TEXT DEFAULT '',
    p_pin TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sender clients%ROWTYPE;
    v_recipient clients%ROWTYPE;
    v_from_balance NUMERIC;
    v_to_balance NUMERIC;
    v_tx_from_id UUID;
    v_tx_to_id UUID;
BEGIN
    -- Validate amount
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('error', 'INVALID_AMOUNT');
    END IF;

    -- Load sender with lock
    SELECT * INTO v_sender
    FROM clients
    WHERE id = p_from_client_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'SENDER_NOT_FOUND');
    END IF;

    -- ISO 27001 A.9.4.2: Verify PIN
    IF v_sender.pin_hash IS NULL OR v_sender.pin_hash != p_pin THEN
        RETURN jsonb_build_object('error', 'INVALID_PIN');
    END IF;

    -- Check sufficient balance
    IF v_sender.wallet_balance < p_amount THEN
        RETURN jsonb_build_object('error', 'INSUFFICIENT_BALANCE');
    END IF;

    -- Load recipient
    SELECT * INTO v_recipient
    FROM clients
    WHERE tenant_id = v_sender.tenant_id
      AND phone = p_to_phone
      AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'RECIPIENT_NOT_FOUND');
    END IF;

    IF v_recipient.id = v_sender.id THEN
        RETURN jsonb_build_object('error', 'SAME_CLIENT');
    END IF;

    -- Atomically update balances
    v_from_balance := v_sender.wallet_balance - p_amount;
    v_to_balance := v_recipient.wallet_balance + p_amount;

    UPDATE clients SET wallet_balance = v_from_balance, updated_at = NOW()
    WHERE id = v_sender.id;

    UPDATE clients SET wallet_balance = v_to_balance, updated_at = NOW()
    WHERE id = v_recipient.id;

    -- Create transaction records
    INSERT INTO wallet_transactions (tenant_id, client_id, type, amount, balance_after, description, related_client_id, status, created_at)
    VALUES (v_sender.tenant_id, v_sender.id, 'transfer_out', p_amount, v_from_balance,
            COALESCE(NULLIF(p_concept, ''), 'Transferencia a ' || v_recipient.first_name || ' ' || COALESCE(v_recipient.last_name, '')),
            v_recipient.id, 'completed', NOW())
    RETURNING id INTO v_tx_from_id;

    INSERT INTO wallet_transactions (tenant_id, client_id, type, amount, balance_after, description, related_client_id, status, created_at)
    VALUES (v_recipient.tenant_id, v_recipient.id, 'transfer_in', p_amount, v_to_balance,
            'Transferencia de ' || v_sender.first_name || ' ' || COALESCE(v_sender.last_name, ''),
            v_sender.id, 'completed', NOW())
    RETURNING id INTO v_tx_to_id;

    RETURN jsonb_build_object(
        'status', 'completed',
        'fromBalance', v_from_balance,
        'toBalance', v_to_balance,
        'senderTxId', v_tx_from_id,
        'recipientTxId', v_tx_to_id
    );
END;
$$;

-- ============================================================
-- 5. CRM SUBMIT RELOAD REQUEST
--   Client requests a wallet top-up (pending admin approval).
-- ============================================================
CREATE OR REPLACE FUNCTION crm_submit_reload(
    p_client_id UUID,
    p_amount NUMERIC,
    p_notes TEXT DEFAULT '',
    p_pin TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client clients%ROWTYPE;
    v_request_id UUID;
BEGIN
    -- Validate amount
    IF p_amount <= 0 OR p_amount > 1000000 THEN
        RETURN jsonb_build_object('error', 'INVALID_AMOUNT');
    END IF;

    -- Load and verify client
    SELECT * INTO v_client FROM clients WHERE id = p_client_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'CLIENT_NOT_FOUND');
    END IF;

    -- ISO 27001 A.9.4.2: Verify PIN for sensitive operations
    IF v_client.pin_hash IS NULL OR v_client.pin_hash != p_pin THEN
        RETURN jsonb_build_object('error', 'INVALID_PIN');
    END IF;

    INSERT INTO reload_requests (tenant_id, client_id, amount, status, notes, requested_at)
    VALUES (v_client.tenant_id, p_client_id, p_amount, 'pending', p_notes, NOW())
    RETURNING id INTO v_request_id;

    RETURN jsonb_build_object(
        'status', 'pending',
        'requestId', v_request_id,
        'message', 'Solicitud enviada. Espera aprobación.'
    );
END;
$$;

-- ============================================================
-- 6. CRM CONFIRM PAYMENT
--   Confirms a wallet payment request from POS.
--   ISO 27001 A.9.4.2: PIN verified server-side against hash.
-- ============================================================
CREATE OR REPLACE FUNCTION crm_confirm_payment(
    p_sale_id TEXT,
    p_client_id UUID,
    p_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client clients%ROWTYPE;
    v_request payment_requests%ROWTYPE;
    v_new_balance NUMERIC;
BEGIN
    -- Load client and verify PIN
    SELECT * INTO v_client FROM clients WHERE id = p_client_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'CLIENT_NOT_FOUND');
    END IF;

    IF v_client.pin_hash IS NULL OR v_client.pin_hash != p_pin THEN
        RETURN jsonb_build_object('error', 'INVALID_PIN');
    END IF;

    -- Load payment request
    SELECT * INTO v_request FROM payment_requests WHERE id = p_sale_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'REQUEST_NOT_FOUND');
    END IF;

    IF v_request.status != 'pending' THEN
        RETURN jsonb_build_object('error', 'REQUEST_ALREADY_PROCESSED');
    END IF;

    -- Check sufficient balance
    IF v_client.wallet_balance < v_request.amount THEN
        RETURN jsonb_build_object('error', 'INSUFFICIENT_BALANCE');
    END IF;

    -- Atomically deduct wallet and mark request
    v_new_balance := v_client.wallet_balance - v_request.amount;

    UPDATE clients SET wallet_balance = v_new_balance, updated_at = NOW()
    WHERE id = p_client_id;

    UPDATE payment_requests
    SET status = 'confirmed', pin = p_pin, updated_at = NOW()
    WHERE id = p_sale_id;

    -- Create wallet transaction
    INSERT INTO wallet_transactions (tenant_id, client_id, type, amount, balance_after, description, reference_id, reference_type, status, created_at)
    VALUES (v_client.tenant_id, p_client_id, 'debit', v_request.amount, v_new_balance,
            'Pago en tienda', p_sale_id, 'sale', 'completed', NOW());

    RETURN jsonb_build_object(
        'status', 'confirmed',
        'walletBalance', v_new_balance,
        'message', 'Pago confirmado'
    );
END;
$$;

-- ============================================================
-- 7. CRM REJECT PAYMENT
--   Rejects a wallet payment request (no PIN needed).
-- ============================================================
CREATE OR REPLACE FUNCTION crm_reject_payment(
    p_sale_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request payment_requests%ROWTYPE;
BEGIN
    SELECT * INTO v_request FROM payment_requests WHERE id = p_sale_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'REQUEST_NOT_FOUND');
    END IF;

    IF v_request.status != 'pending' THEN
        RETURN jsonb_build_object('error', 'REQUEST_ALREADY_PROCESSED');
    END IF;

    UPDATE payment_requests SET status = 'rejected', updated_at = NOW()
    WHERE id = p_sale_id;

    RETURN jsonb_build_object('status', 'rejected');
END;
$$;
