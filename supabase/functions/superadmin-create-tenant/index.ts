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
    );

    // Verify caller is superadmin
    const { data: { user } } = await supabase.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    const { data: isSuper } = await supabase.rpc('is_superadmin', { p_user_id: user.id });
    if (!isSuper) {
      return new Response(JSON.stringify({ error: 'SuperAdmin access required' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    const { businessName, adminEmail, adminPassword, plan = 'lite' } = await req.json();
    if (!businessName || !adminEmail || !adminPassword) {
      return new Response(JSON.stringify({ error: 'businessName, adminEmail and adminPassword required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Step 1: Create the admin auth user via admin API (service_role)
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { name: businessName }
    });
    if (createErr) throw createErr;
    if (!newUser?.user?.id) throw new Error('Failed to create user');

    // Step 2: Create tenant via v2 RPC (links existing user)
    const { data, error } = await supabase.rpc('superadmin_create_tenant_v2', {
      p_business_name: businessName,
      p_admin_user_id: newUser.user.id,
      p_plan: plan
    });
    if (error) throw error;

    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
