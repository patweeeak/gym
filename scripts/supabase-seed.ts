/*
 * Fills the Supabase project with the demo gym (same data as local mode): `npm run db:seed`.
 * Deletes every account and record first; the gym's name and prices are kept.
 * Needs VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (the service key must never
 * be given a VITE_ prefix: that would ship it to browsers).
 */
import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { seed } from '../src/lib/seed';
import { toRows, userToProfile } from '../src/lib/rows';

const env: Record<string, string> = { ...process.env } as Record<string, string>;
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const url = env.VITE_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  // 1. wipe: records, then every account (profiles go with them)
  let r = await sb.from('records').delete().neq('collection', '');
  if (r.error) throw r.error;
  for (;;) {
    const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;
    if (!data.users.length) break;
    for (const u of data.users) {
      const { error: e } = await sb.auth.admin.deleteUser(u.id);
      if (e) throw e;
    }
  }

  // 2. accounts: the demo users get real auth ids; every reference to the demo ids is rewritten
  const db = seed();
  const idMap = new Map<string, string>();
  for (const u of db.users) {
    const { data, error } = await sb.auth.admin.createUser({ email: u.email, password: u.password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error(`could not create ${u.email}`);
    idMap.set(u.id, data.user.id);
  }
  let json = JSON.stringify(db);
  for (const [from, to] of idMap) json = json.split(`"${from}"`).join(`"${to}"`).split(`"${from}|`).join(`"${to}|`);
  const mapped = JSON.parse(json) as typeof db;

  // instructors first: members point at them
  const profiles = mapped.users.map(userToProfile).sort((a, b) => (a.role === 'member' ? 1 : 0) - (b.role === 'member' ? 1 : 0));
  r = await sb.from('profiles').insert(profiles);
  if (r.error) throw r.error;

  // 3. records, in batches
  const rows = [...toRows(mapped).values()];
  for (let i = 0; i < rows.length; i += 500) {
    r = await sb.from('records').insert(rows.slice(i, i + 500));
    if (r.error) throw r.error;
  }
  console.log(`Seeded ${profiles.length} accounts and ${rows.length} records.`);
  console.log('Sign in with owner@gym.com / admin123, coach@gym.com / coach123, maria@gym.com / member123, juan@gym.com / member123.');
}

main().catch((e) => { console.error(e); process.exit(1); });
