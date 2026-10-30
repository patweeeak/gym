// Starts a Xendit hosted checkout (invoice) for the signed-in member: a month of Premium, or one day pass.
import { adminClient, caller, cors, reply, xendit } from '../_shared/xendit.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = adminClient();
    const me = await caller(admin, req);
    if (!me) return reply({ error: 'Not signed in.' }, 401);
    if (me.role !== 'member') return reply({ error: 'Only members pay online.' }, 403);

    const { kind, returnUrl } = await req.json();
    if (kind !== 'monthly' && kind !== 'daypass') return reply({ error: 'Unknown payment.' }, 400);
    if (typeof returnUrl !== 'string' || !/^https?:\/\//.test(returnUrl)) return reply({ error: 'Missing return address.' }, 400);

    const { data: s } = await admin.from('settings').select('gym_name, monthly_price, day_pass_price').eq('id', 1).single();
    const price = Number(kind === 'monthly' ? s!.monthly_price : s!.day_pass_price);
    const name = kind === 'monthly' ? `${s!.gym_name} Premium — 30 days` : `${s!.gym_name} day pass`;
    const back = (state: string) => `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}checkout=${state}`;

    const inv = await xendit('/v2/invoices', {
      method: 'POST',
      body: {
        external_id: `gym|${me.id}|${kind}|${Date.now()}`,
        amount: price,
        currency: 'PHP',
        description: name,
        payer_email: me.email,
        customer: { given_names: me.name, email: me.email },
        items: [{ name, quantity: 1, price }],
        success_redirect_url: back('success'),
        failure_redirect_url: back('cancelled'),
        invoice_duration: 3600,
        metadata: { user_id: me.id, kind },
      },
    });
    return reply({ id: inv.id, url: inv.invoice_url });
  } catch (e) {
    return reply({ error: (e as Error).message }, 400);
  }
});
