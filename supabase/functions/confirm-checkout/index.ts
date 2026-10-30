// Called when a member comes back from the checkout page: applies the payment if it went through
// (the webhook usually has already; this covers a slow or missing webhook).
import { adminClient, applyPaid, caller, cors, invoiceFor, isPaid, reply, xendit, type Invoice } from '../_shared/xendit.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = adminClient();
    const me = await caller(admin, req);
    if (!me) return reply({ error: 'Not signed in.' }, 401);
    const { id } = await req.json();
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{6,64}$/.test(id)) return reply({ error: 'Unknown checkout.' }, 400);

    const inv = (await xendit(`/v2/invoices/${id}`)) as Invoice;
    const { userId, kind } = invoiceFor(inv);
    if (userId !== me.id && me.role !== 'admin') return reply({ error: 'Not your checkout.' }, 403);
    if (!isPaid(inv)) return reply({ status: inv.status === 'EXPIRED' ? 'expired' : 'pending' });
    await applyPaid(admin, inv);
    return reply({ status: 'paid', kind });
  } catch (e) {
    return reply({ error: (e as Error).message }, 400);
  }
});
