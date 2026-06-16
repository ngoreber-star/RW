import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const { tenantId, plan, durationDays = 30, status = 'active' } = await req.json();
    if (!tenantId || !plan) {
      return new Response(JSON.stringify({ error: 'tenantId and plan required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { data, error } = await supabase.rpc('superadmin_assign_license', {
      p_tenant_id: tenantId,
      p_plan: plan,
      p_duration_days: durationDays,
      p_status: status
    });

    if (error) throw error;

    return new Response(JSON.stringify({ licenseId: data, success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
