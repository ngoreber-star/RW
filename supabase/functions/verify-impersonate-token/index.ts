import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: 'token required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const secret = Deno.env.get('IMPERSONATE_SECRET');
    if (!secret) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const [payloadB64, sigHex] = token.split('.');
    if (!payloadB64 || !sigHex) {
      return new Response(JSON.stringify({ error: 'Invalid token format' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sig = new Uint8Array(sigHex.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)));
    const valid = await crypto.subtle.verify('HMAC', key, sig, encoder.encode(payloadB64));

    if (!valid) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    const payload = JSON.parse(atob(payloadB64));
    if (payload.exp < Date.now()) {
      return new Response(JSON.stringify({ error: 'Token expired' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ valid: true, payload }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
