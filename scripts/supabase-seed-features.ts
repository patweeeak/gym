/*
 * Adds the member-feature demo data (Maria's logged sets, body measurements, the two challenges and
 * their entries) to an existing Supabase project without wiping anything: `npm run db:seed:features`.
 * Needs VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { seed } from '../src/lib/seed';
import { toRows } from '../src/lib/rows';

const env: Record<string, string> = { ...process.env } as Record<string, string>;
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function main() {
  const db = seed();
  // demo ids → this project's account ids, by email
  const { data: profiles, error } = await sb.from('profiles').select('id, email');
  if (error) throw error;
  const byEmail = new Map(profiles.map((p) => [p.email, p.id]));
  const idMap = new Map(db.users.map((u) => [u.id, byEmail.get(u.email)]).filter((x): x is [string, string] => !!x[1]));
  let json = JSON.stringify({ ...db, users: [] });
  for (const [from, to] of idMap) json = json.split(`"${from}"`).join(`"${to}"`).split(`"${from}|`).join(`"${to}|`);
  const mapped = JSON.parse(json) as typeof db;

  const maria = idMap.get('u-maria');
  // Maria's old summary-only workout logs give way to the ones with sets
  if (maria) {
    const r = await sb.from('records').delete().eq('collection', 'workoutLogs').eq('user_id', maria);
    if (r.error) throw r.error;
  }
  const rows = [...toRows(mapped).values()].filter((r) =>
    ['measurements', 'challenges', 'entries'].includes(r.collection) || (r.collection === 'workoutLogs' && r.user_id === maria));
  const r = await sb.from('records').upsert(rows);
  if (r.error) throw r.error;
  console.log(`Added ${rows.length} rows (workout logs with sets, measurements, challenges, entries).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
