// Xendit calls this when an invoice is paid. Deployed without JWT checks: the request carries the
// account's callback token instead, and the invoice is re-read from Xendit before anything is recorded.
import { adminClient, applyPaid, isPaid, reply, xendit, type Invoice } from '../_shared/xendit.ts';

const sameText = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply({ error: 'POST only' }, 405);
  const expected = Deno.env.get('XENDIT_CALLBACK_TOKEN') ?? '';
  if (!expected || !sameText(req.headers.get('x-callback-token') ?? '', expected)) return reply({ error: 'Bad token' }, 401);

  let body: { id?: string };
  try { body = await req.json(); } catch { return reply({ error: 'Bad JSON' }, 400); }
  if (!body.id) return reply({ ignored: 'no invoice id' });
  try {
    const inv = (await xendit(`/v2/invoices/${body.id}`)) as Invoice;
    if (!isPaid(inv)) return reply({ ignored: inv.status });
    const r = await applyPaid(adminClient(), inv);
    return reply({ ok: true, ...r });
  } catch (e) {
    // a non-2xx makes Xendit retry later
    return reply({ error: (e as Error).message }, 500);
  }
});
