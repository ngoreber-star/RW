-- ============================================================
-- MIGRATION: Accounting constraints, period locks, validations
-- ============================================================

-- 1. Table for locked accounting periods (server-side)
CREATE TABLE IF NOT EXISTS accounting_locked_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period TEXT NOT NULL,  -- Format: 'YYYY-MM'
    locked_by TEXT,
    locked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, period)
);

CREATE INDEX IF NOT EXISTS idx_accounting_locked_periods_tenant ON accounting_locked_periods(tenant_id);

ALTER TABLE accounting_locked_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_locked_periods" ON accounting_locked_periods
    FOR ALL USING (tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    ));

-- 2. Add server-side validation columns to accounting_entries
ALTER TABLE accounting_entries
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS validated BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS error_message TEXT,
    ADD COLUMN IF NOT EXISTS hash TEXT;  -- SHA256 hash for integrity

-- 3. Function: Validate accounting entry before insert/update
CREATE OR REPLACE FUNCTION validate_accounting_entry()
RETURNS TRIGGER AS $$
DECLARE
    period_key TEXT;
    is_locked BOOLEAN;
    line_data JSONB;
    line_debe NUMERIC;
    line_haber NUMERIC;
    calc_total_debe NUMERIC := 0;
    calc_total_haber NUMERIC := 0;
    valid_accounts TEXT[];
    invalid_account TEXT;
BEGIN
    -- 3a. Check period is not locked
    period_key := TO_CHAR(NEW.date, 'YYYY-MM');
    SELECT EXISTS(
        SELECT 1 FROM accounting_locked_periods
        WHERE tenant_id = NEW.tenant_id AND period = period_key
    ) INTO is_locked;
    
    IF is_locked THEN
        RAISE EXCEPTION 'Period % is locked. Cannot modify entries.', period_key
            USING HINT = 'Unlock the period first or contact administrator.';
    END IF;

    -- 3b. Validate concept
    IF NEW.concept IS NULL OR length(trim(NEW.concept)) = 0 THEN
        RAISE EXCEPTION 'Entry concept cannot be empty';
    END IF;

    -- 3c. Validate lines is non-empty JSONB array
    IF NEW.lines IS NULL OR jsonb_typeof(NEW.lines) != 'array' OR jsonb_array_length(NEW.lines) < 2 THEN
        RAISE EXCEPTION 'Entry must have at least 2 lines';
    END IF;

    -- 3d. Validate each line and calculate totals
    FOR line_data IN SELECT * FROM jsonb_array_elements(NEW.lines)
    LOOP
        -- Check account code exists
        IF (line_data->>'accountCode') IS NULL OR length(trim(line_data->>'accountCode')) = 0 THEN
            RAISE EXCEPTION 'Each line must have an account code';
        END IF;

        -- Check account exists in chart of accounts
        IF NOT EXISTS(
            SELECT 1 FROM accounting_accounts
            WHERE tenant_id = NEW.tenant_id AND code = (line_data->>'accountCode') AND is_active = true
        ) THEN
            RAISE EXCEPTION 'Account % does not exist or is inactive', (line_data->>'accountCode');
        END IF;

        -- No negative amounts
        line_debe := COALESCE((line_data->>'debe')::NUMERIC, 0);
        line_haber := COALESCE((line_data->>'haber')::NUMERIC, 0);
        
        IF line_debe < 0 OR line_haber < 0 THEN
            RAISE EXCEPTION 'Negative amounts are not allowed in entry lines';
        END IF;

        -- Each line must have debe OR haber, not both zero
        IF line_debe = 0 AND line_haber = 0 THEN
            RAISE EXCEPTION 'Each line must have a debit or credit amount';
        END IF;

        calc_total_debe := calc_total_debe + line_debe;
        calc_total_haber := calc_total_haber + line_haber;
    END LOOP;

    -- 3e. Validate entry is balanced
    IF calc_total_debe != calc_total_haber THEN
        RAISE EXCEPTION 'Entry is not balanced: Debe=%, Haber=%', calc_total_debe, calc_total_haber;
    END IF;

    -- Set calculated totals
    NEW.total_debe := calc_total_debe;
    NEW.total_haber := calc_total_haber;

    -- 3f. Set created_by on insert
    IF TG_OP = 'INSERT' THEN
        NEW.created_by := auth.uid();
        NEW.created_at := NOW();
    END IF;
    NEW.updated_at := NOW();
    NEW.validated := true;
    NEW.error_message := NULL;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger for INSERT/UPDATE validation
DROP TRIGGER IF EXISTS trigger_validate_accounting_entry ON accounting_entries;
CREATE TRIGGER trigger_validate_accounting_entry
    BEFORE INSERT OR UPDATE ON accounting_entries
    FOR EACH ROW EXECUTE FUNCTION validate_accounting_entry();

-- 5. Function: Lock/unlock period (RPC for frontend)
CREATE OR REPLACE FUNCTION toggle_accounting_period_lock(
    p_tenant_id UUID,
    p_period TEXT,
    p_lock BOOLEAN
)
RETURNS VOID AS $$
BEGIN
    IF p_lock THEN
        INSERT INTO accounting_locked_periods (tenant_id, period, locked_by)
        VALUES (p_tenant_id, p_period, auth.uid())
        ON CONFLICT (tenant_id, period) DO NOTHING;
    ELSE
        DELETE FROM accounting_locked_periods
        WHERE tenant_id = p_tenant_id AND period = p_period;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Function: Get locked periods for a tenant
CREATE OR REPLACE FUNCTION get_locked_accounting_periods(p_tenant_id UUID)
RETURNS TABLE(period TEXT, locked_at TIMESTAMPTZ) AS $$
BEGIN
    RETURN QUERY
    SELECT alp.period, alp.locked_at
    FROM accounting_locked_periods alp
    WHERE alp.tenant_id = p_tenant_id
    ORDER BY alp.period;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. CHECK constraint on accounting_entries (additional safety)
ALTER TABLE accounting_entries DROP CONSTRAINT IF EXISTS check_accounting_entries_balanced;
ALTER TABLE accounting_entries ADD CONSTRAINT check_accounting_entries_balanced
    CHECK (total_debe IS NOT NULL AND total_haber IS NOT NULL);

ALTER TABLE accounting_entries DROP CONSTRAINT IF EXISTS check_accounting_entries_dates;
ALTER TABLE accounting_entries ADD CONSTRAINT check_accounting_entries_dates
    CHECK (date IS NOT NULL);

ALTER TABLE accounting_entries DROP CONSTRAINT IF EXISTS check_accounting_entries_concept;
ALTER TABLE accounting_entries ADD CONSTRAINT check_accounting_entries_concept
    CHECK (concept IS NOT NULL AND length(trim(concept)) > 0);

-- 8. Function: Bulk import with server-side validation and rollback
CREATE OR REPLACE FUNCTION batch_import_accounting_entries(
    p_tenant_id UUID,
    p_entries JSONB
)
RETURNS TABLE(entry_number TEXT, status TEXT, error TEXT) AS $$
DECLARE
    entry_data JSONB;
    result RECORD;
BEGIN
    FOR entry_data IN SELECT * FROM jsonb_array_elements(p_entries)
    LOOP
        BEGIN
            INSERT INTO accounting_entries (
                tenant_id, number, date, concept, document_ref, lines,
                total_debe, total_haber, status, source, sale_id
            ) VALUES (
                p_tenant_id,
                (entry_data->>'number')::INTEGER,
                (entry_data->>'date')::DATE,
                entry_data->>'concept',
                entry_data->>'document_ref',
                entry_data->'lines',
                0, 0,  -- Will be calculated by trigger
                'posted',
                COALESCE(entry_data->>'source', 'batch'),
                entry_data->>'sale_id'
            )
            RETURNING number::TEXT INTO result;
            
            entry_number := result.number;
            status := 'imported';
            error := NULL;
            RETURN NEXT;
        EXCEPTION WHEN OTHERS THEN
            entry_number := entry_data->>'number';
            status := 'failed';
            error := SQLERRM;
            RETURN NEXT;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
