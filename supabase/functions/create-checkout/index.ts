// Starts a PayMongo checkout for the signed-in member: a month of Premium, or one day pass.
import { adminClient, caller, cors, paymongo, reply } from '../_shared/paymongo.ts';

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

    const res = await paymongo('/checkout_sessions', {
      method: 'POST',
      body: {
        data: {
          attributes: {
            line_items: [{ name, amount: Math.round(price * 100), currency: 'PHP', quantity: 1 }],
            payment_method_types: ['gcash', 'paymaya', 'card', 'qrph'],
            description: name,
            billing: { name: me.name, email: me.email },
            success_url: back('success'),
            cancel_url: back('cancelled'),
            send_email_receipt: false,
            show_description: true,
            show_line_items: true,
            metadata: { user_id: me.id, kind },
          },
        },
      },
    });
    return reply({ id: res.data.id, url: res.data.attributes.checkout_url });
  } catch (e) {
    return reply({ error: (e as Error).message }, 400);
  }
});
