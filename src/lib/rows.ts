/*
 * Mapping between the app's in-memory DB and the Supabase tables (see supabase/migrations).
 * Pure functions, shared by the browser store and the seed script.
 */
import type { DB, Settings, User } from './types';

export type ArrayCol = 'goals' | 'weights' | 'meals' | 'sessions' | 'plans' | 'workoutLogs' | 'classes'
  | 'announcements' | 'checkins' | 'payments' | 'requests' | 'notes';
export type MapCol = 'water' | 'bodyLab';
export const ARRAY_COLS: ArrayCol[] = ['goals', 'weights', 'meals', 'sessions', 'plans', 'workoutLogs', 'classes',
  'announcements', 'checkins', 'payments', 'requests', 'notes'];
export const MAP_COLS: MapCol[] = ['water', 'bodyLab'];

export interface RecordRow { collection: string; id: string; user_id: string | null; coach_id: string | null; doc: unknown }
export interface ProfileRow {
  id: string; role: User['role']; name: string; email: string; phone: string | null; color: string; created_at: string;
  plan: User['plan'] | null; subscription_end: string | null; instructor_id: string | null; specialty: string | null;
}
export interface SettingsRow { id: number; gym_name: string; monthly_price: number; day_pass_price: number; currency: string }

type Item = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

/** Row key and scope columns of one item of a collection. */
function rowOf(col: ArrayCol | MapCol, key: string, item: unknown): RecordRow {
  const o = (item ?? {}) as Item;
  switch (col) {
    case 'goals': return { collection: col, id: key, user_id: str(o.userId), coach_id: null, doc: item };
    case 'plans':
    case 'notes': return { collection: col, id: key, user_id: str(o.memberId), coach_id: str(o.instructorId), doc: item };
    case 'classes': return { collection: col, id: key, user_id: null, coach_id: str(o.instructorId), doc: item };
    case 'announcements': return { collection: col, id: key, user_id: null, coach_id: null, doc: item };
    case 'water': return { collection: col, id: key, user_id: key.split('|')[0] || null, coach_id: null, doc: item };
    case 'bodyLab': return { collection: col, id: key, user_id: key, coach_id: null, doc: item };
    default: return { collection: col, id: key, user_id: str(o.userId), coach_id: null, doc: item };
  }
}

const keyOf = (col: ArrayCol, item: Item) => String(col === 'goals' ? item.userId : item.id);

/** Every record row of a DB, keyed by `collection|id`. */
export function toRows(db: DB): Map<string, RecordRow> {
  const out = new Map<string, RecordRow>();
  for (const col of ARRAY_COLS) {
    for (const item of db[col] as unknown as Item[]) {
      const r = rowOf(col, keyOf(col, item), item);
      out.set(`${col}|${r.id}`, r);
    }
  }
  for (const col of MAP_COLS) {
    for (const [k, v] of Object.entries(db[col] ?? {})) out.set(`${col}|${k}`, rowOf(col, k, v));
  }
  return out;
}

/** Puts a row into (or removes it from) a DB, in place. */
export function applyRow(db: DB, row: Pick<RecordRow, 'collection' | 'id' | 'doc'>, removed = false) {
  const col = row.collection as ArrayCol | MapCol;
  if ((MAP_COLS as string[]).includes(col)) {
    const map = { ...((db[col as MapCol] ?? {}) as Record<string, unknown>) };
    if (removed) delete map[row.id]; else map[row.id] = row.doc;
    (db as unknown as Record<string, unknown>)[col] = map;
    return;
  }
  if (!(ARRAY_COLS as string[]).includes(col)) return;
  const list = (db[col as ArrayCol] as unknown as Item[]).filter((x) => keyOf(col as ArrayCol, x) !== row.id);
  if (!removed) list.push(row.doc as Item);
  (db as unknown as Record<string, unknown>)[col] = list;
}

export const profileToUser = (p: ProfileRow): User => ({
  id: p.id, role: p.role, name: p.name, email: p.email, password: '', phone: p.phone ?? undefined, color: p.color,
  createdAt: p.created_at, plan: p.plan ?? undefined, subscriptionEnd: p.subscription_end ?? undefined,
  instructorId: p.instructor_id ?? undefined, specialty: p.specialty ?? undefined,
});

export const userToProfile = (u: User): ProfileRow => ({
  id: u.id, role: u.role, name: u.name, email: u.email, phone: u.phone ?? null, color: u.color, created_at: u.createdAt,
  plan: u.plan ?? null, subscription_end: u.subscriptionEnd ?? null, instructor_id: u.instructorId ?? null, specialty: u.specialty ?? null,
});

export const rowToSettings = (r: SettingsRow): Settings => ({
  gymName: r.gym_name, monthlyPrice: Number(r.monthly_price), dayPassPrice: Number(r.day_pass_price), currency: r.currency,
});

export const settingsToRow = (s: Settings): SettingsRow => ({
  id: 1, gym_name: s.gymName, monthly_price: s.monthlyPrice, day_pass_price: s.dayPassPrice, currency: s.currency,
});

export const emptyDB = (settings: Settings): DB => ({
  users: [], goals: [], weights: [], meals: [], water: {}, sessions: [], plans: [], workoutLogs: [], classes: [],
  announcements: [], checkins: [], payments: [], requests: [], notes: [], settings, bodyLab: {},
});
