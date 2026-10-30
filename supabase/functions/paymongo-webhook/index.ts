// PayMongo calls this when a checkout is paid. Deployed without JWT checks: the request is
// authenticated by its Paymongo-Signature instead.
import { adminClient, applyPaid, isPaid, reply, verifySignature } from '../_shared/paymongo.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply({ error: 'POST only' }, 405);
  const raw = await req.text();
  let event: any;
  try { event = JSON.parse(raw); } catch { return reply({ error: 'Bad JSON' }, 400); }

  const attrs = event?.data?.attributes ?? {};
  if (!(await verifySignature(req.headers.get('Paymongo-Signature'), raw, !!attrs.livemode))) {
    return reply({ error: 'Bad signature' }, 401);
  }
  if (attrs.type !== 'checkout_session.payment.paid') return reply({ ignored: attrs.type });

  const session = attrs.data;
  if (!session?.id || !isPaid(session)) return reply({ ignored: 'not paid' });
  try {
    const r = await applyPaid(adminClient(), session);
    return reply({ ok: true, ...r });
  } catch (e) {
    // a non-2xx makes PayMongo retry later
    return reply({ error: (e as Error).message }, 500);
  }
});
