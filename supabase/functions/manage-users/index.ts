// Creates and deletes accounts. Needs the service role, so it runs here and checks the caller is the owner.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller.user) return reply({ error: 'Not signed in.' }, 401);
  const { data: me } = await admin.from('profiles').select('role').eq('id', caller.user.id).single();
  if (me?.role !== 'admin') return reply({ error: 'Only the owner can manage accounts.' }, 403);

  const body = await req.json();
  if (body.action === 'create') {
    const { email, password, profile } = body;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) return reply({ error: error?.message ?? 'Could not create the account.' }, 400);
    const { error: pErr } = await admin.from('profiles').insert({ ...profile, id: data.user.id, email });
    if (pErr) {
      await admin.auth.admin.deleteUser(data.user.id);
      return reply({ error: pErr.message }, 400);
    }
    return reply({ id: data.user.id });
  }
  if (body.action === 'delete') {
    if (body.id === caller.user.id) return reply({ error: 'You cannot delete your own account.' }, 400);
    const { error } = await admin.auth.admin.deleteUser(body.id);
    return error ? reply({ error: error.message }, 400) : reply({ ok: true });
  }
  return reply({ error: 'Unknown action.' }, 400);
});
