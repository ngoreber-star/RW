-- ============================================
-- RIVER-WALL PRO - Audit Logs Table
-- ISO 27001 A.12.4.1: Event logging
-- ============================================

-- 1. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,              -- INSERT, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT, etc.
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    resource TEXT,                     -- Table name or resource type
    resource_id TEXT,                  -- Record ID
    metadata JSONB DEFAULT '{}',       -- Extra context (changes, IP, etc.)
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource);

-- 3. Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS: Superadmins can read all, tenants can read their own
CREATE POLICY audit_logs_superadmin_select ON public.audit_logs
    FOR SELECT
    USING (is_superadmin(auth.uid()));

CREATE POLICY audit_logs_tenant_select ON public.audit_logs
    FOR SELECT
    USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- 5. RLS: Anyone authenticated can INSERT (for frontend audit)
CREATE POLICY audit_logs_insert ON public.audit_logs
    FOR INSERT
    WITH CHECK (true);

-- 6. RLS: No updates or deletes (immutable audit trail)
CREATE POLICY audit_logs_no_update ON public.audit_logs
    FOR UPDATE
    USING (false);

CREATE POLICY audit_logs_no_delete ON public.audit_logs
    FOR DELETE
    USING (false);

-- 7. Auto-cleanup: keep 90 days of logs
-- Run this periodically via pg_cron or a scheduled Edge Function
-- DELETE FROM public.audit_logs WHERE created_at < NOW() - INTERVAL '90 days';

-- 8. Trigger-based audit for critical tables (optional, for server-side logging)
CREATE OR REPLACE FUNCTION public.trigger_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_logs (action, user_id, tenant_id, resource, resource_id, metadata)
    VALUES (
        TG_OP,
        auth.uid(),
        COALESCE(NEW.tenant_id, OLD.tenant_id),
        TG_TABLE_NAME,
        COALESCE(NEW.id::TEXT, OLD.id::TEXT),
        jsonb_build_object(
            'old_data', CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)::JSONB ELSE NULL END,
            'new_data', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::JSONB ELSE NULL END
        )
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Apply triggers to specific tables as needed:
-- CREATE TRIGGER audit_tenants AFTER INSERT OR UPDATE OR DELETE ON public.tenants
--     FOR EACH ROW EXECUTE FUNCTION public.trigger_audit_log();
-- CREATE TRIGGER audit_tenant_users AFTER INSERT OR UPDATE OR DELETE ON public.tenant_users
--     FOR EACH ROW EXECUTE FUNCTION public.trigger_audit_log();

-- 9. Helper: get user's tenant IDs (used by RLS)
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids(p_user_id UUID)
RETURNS TABLE(tenant_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE;
