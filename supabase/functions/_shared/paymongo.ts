// PayMongo helpers shared by the payment functions.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
export const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export const adminClient = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

/** The signed-in caller's id and role, from the request's bearer token. */
export async function caller(admin: SupabaseClient, req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data } = await admin.auth.getUser(token);
  if (!data.user) return null;
  const { data: p } = await admin.from('profiles').select('id, role, name, email, plan, subscription_end').eq('id', data.user.id).single();
  return p as { id: string; role: string; name: string; email: string; plan: string | null; subscription_end: string | null } | null;
}

export async function paymongo(path: string, init: { method?: string; body?: unknown } = {}) {
  const key = Deno.env.get('PAYMONGO_SECRET_KEY');
  if (!key) throw new Error('Online payments are not set up yet (missing PayMongo key).');
  const res = await fetch(`https://api.paymongo.com/v1${path}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Basic ${btoa(`${key}:`)}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.errors?.[0]?.detail ?? `PayMongo error ${res.status}`);
  return json;
}

// the gym's calendar day (Philippines)
const manilaDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(d);
const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

type Session = { id: string; attributes: Record<string, any> };

/** True when a checkout session has been paid. */
export const isPaid = (s: Session) =>
  s.attributes.payment_intent?.attributes?.status === 'succeeded' || (s.attributes.payments ?? []).some((p: any) => p.attributes?.status === 'paid');

/**
 * Records a paid checkout session: the payment, and for a monthly plan 30 more days of membership.
 * Safe to call more than once (the webhook and the member's return page may both report it).
 */
export async function applyPaid(admin: SupabaseClient, s: Session) {
  const meta = s.attributes.metadata ?? {};
  const userId = meta.user_id as string, kind = meta.kind as 'monthly' | 'daypass';
  if (!userId || (kind !== 'monthly' && kind !== 'daypass')) throw new Error('Checkout is missing its member.');
  const paymentId = `pm_${s.id}`;
  const { data: existing } = await admin.from('records').select('id').eq('collection', 'payments').eq('id', paymentId).maybeSingle();
  if (existing) return { already: true };

  const pay = (s.attributes.payments ?? [])[0]?.attributes ?? {};
  const amount = Math.round(Number(pay.amount ?? s.attributes.line_items?.[0]?.amount ?? 0)) / 100;
  const method = pay.source?.type ?? s.attributes.payment_method_used ?? 'online';
  const today = manilaDay();
  const doc = { id: paymentId, userId, amount, date: today, kind, method, ref: (s.attributes.payments ?? [])[0]?.id ?? s.id, online: true };
  // the insert is the lock: a second report of the same session fails on the primary key
  const { error } = await admin.from('records').insert({ collection: 'payments', id: paymentId, user_id: userId, coach_id: null, doc });
  if (error) {
    if (error.code === '23505') return { already: true };
    throw error;
  }

  if (kind === 'monthly') {
    const { data: p } = await admin.from('profiles').select('subscription_end').eq('id', userId).single();
    const end = p?.subscription_end as string | null;
    const base = end && end >= today ? end : today;
    await admin.from('profiles').update({ plan: 'monthly', subscription_end: addDays(base, 30) }).eq('id', userId);
    // any "upgrade / renewal" request at the front desk is now settled
    const { data: reqs } = await admin.from('records').select('id, doc').eq('collection', 'requests').eq('user_id', userId);
    for (const r of reqs ?? []) {
      if ((r.doc as any)?.status === 'pending') {
        await admin.from('records').update({ doc: { ...(r.doc as object), status: 'approved' } }).eq('collection', 'requests').eq('id', r.id);
      }
    }
  }
  return { already: false };
}

/** Checks the Paymongo-Signature header (t=…,te=…,li=…) against the raw request body. */
export async function verifySignature(header: string | null, raw: string, livemode: boolean) {
  const secret = Deno.env.get('PAYMONGO_WEBHOOK_SECRET');
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=') as [string, string]));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${parts.t}.${raw}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const expected = livemode ? parts.li : parts.te;
  if (!expected || expected.length !== hex.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
