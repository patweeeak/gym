// Xendit helpers shared by the payment functions (hosted invoices: GCash, Maya, cards, QR Ph, ...).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
export const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export const adminClient = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

/** The signed-in caller's profile, from the request's bearer token. */
export async function caller(admin: SupabaseClient, req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data } = await admin.auth.getUser(token);
  if (!data.user) return null;
  const { data: p } = await admin.from('profiles').select('id, role, name, email').eq('id', data.user.id).single();
  return p as { id: string; role: string; name: string; email: string } | null;
}

export async function xendit(path: string, init: { method?: string; body?: unknown } = {}) {
  const key = Deno.env.get('XENDIT_SECRET_KEY');
  if (!key) throw new Error('Online payments are not set up yet (missing Xendit key).');
  const res = await fetch(`https://api.xendit.co${path}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Basic ${btoa(`${key}:`)}`, 'Content-Type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? `Xendit error ${res.status}`);
  return json;
}

export interface Invoice {
  id: string; external_id: string; status: string; amount: number; paid_amount?: number;
  payment_channel?: string; payment_method?: string; metadata?: Record<string, string> | null;
}

/** The member and plan an invoice is for (metadata, with the external id as a fallback). */
export function invoiceFor(inv: Invoice) {
  const [, userId, kind] = inv.external_id.split('|'); // gym|<user>|<kind>|<time>
  return { userId: inv.metadata?.user_id ?? userId, kind: (inv.metadata?.kind ?? kind) as 'monthly' | 'daypass' };
}

export const isPaid = (inv: Invoice) => inv.status === 'PAID' || inv.status === 'SETTLED';

// the gym's calendar day (Philippines)
const manilaDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(d);
const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Records a paid invoice: the payment, and for a monthly plan 30 more days of membership.
 * Safe to call more than once (the webhook and the member's return page may both report it).
 */
export async function applyPaid(admin: SupabaseClient, inv: Invoice) {
  const { userId, kind } = invoiceFor(inv);
  if (!userId || (kind !== 'monthly' && kind !== 'daypass')) throw new Error('Invoice is missing its member.');
  const paymentId = `xi_${inv.id}`;
  const today = manilaDay();
  const doc = {
    id: paymentId, userId, amount: Number(inv.paid_amount ?? inv.amount), date: today, kind,
    method: (inv.payment_channel ?? inv.payment_method ?? 'online').toLowerCase(), ref: inv.id, online: true,
  };
  // the insert is the lock: a second report of the same invoice fails on the primary key
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
      if ((r.doc as { status?: string })?.status === 'pending') {
        await admin.from('records').update({ doc: { ...(r.doc as object), status: 'approved' } }).eq('collection', 'requests').eq('id', r.id);
      }
    }
  }
  return { already: false };
}
