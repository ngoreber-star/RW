import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { tenantId, name, email } = await req.json();
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'tenantId required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const secret = Deno.env.get('IMPERSONATE_SECRET');
    if (!secret) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const payload = { tenantId, exp: Date.now() + 3600000, name: name || 'SuperAdmin', email: email || 'super@admin.com' };
    const payloadB64 = btoa(JSON.stringify(payload));

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
    const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');

    const token = `${payloadB64}.${sigHex}`;
    return new Response(JSON.stringify({ token }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
