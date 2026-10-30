// Called when a member comes back from PayMongo: applies the payment if it went through
// (the webhook usually has already; this covers a slow or missing webhook).
import { adminClient, applyPaid, caller, cors, isPaid, paymongo, reply } from '../_shared/paymongo.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = adminClient();
    const me = await caller(admin, req);
    if (!me) return reply({ error: 'Not signed in.' }, 401);
    const { id } = await req.json();
    if (typeof id !== 'string' || !id.startsWith('cs_')) return reply({ error: 'Unknown checkout.' }, 400);

    const { data: s } = await paymongo(`/checkout_sessions/${id}`);
    if (s.attributes.metadata?.user_id !== me.id && me.role !== 'admin') return reply({ error: 'Not your checkout.' }, 403);
    if (!isPaid(s)) return reply({ status: s.attributes.status === 'expired' ? 'expired' : 'pending' });
    await applyPaid(admin, s);
    return reply({ status: 'paid', kind: s.attributes.metadata.kind });
  } catch (e) {
    return reply({ error: (e as Error).message }, 400);
  }
});
