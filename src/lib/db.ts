/*
 * Data store. All screens read through useDB() and write through update().
 * - Local mode (no Supabase configured): the whole DB lives in localStorage, seeded with demo data.
 * - Remote mode: the DB is loaded from Supabase after sign-in (only what the user may see), every
 *   update() is diffed into row writes, and changes from other devices arrive over realtime.
 * Accounts are created and deleted with createAccount() / deleteAccount(), not update().
 */
import { useSyncExternalStore } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { DB, Settings, User } from './types';
import { seed } from './seed';
import { supabase } from './supabase';
import { uid } from './utils';
import { toast } from './fx';
import {
  applyRow, emptyDB, profileToUser, rowToSettings, settingsToRow, toRows, userToProfile,
  type ProfileRow, type RecordRow, type SettingsRow,
} from './rows';

export const remote = !!supabase;

const KEY = 'ironpulse-db-v1';
const DEFAULT_SETTINGS: Settings = { gymName: 'IronPulse Gym', monthlyPrice: 1500, dayPassPrice: 100, currency: '₱' };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

let state: DB = remote ? emptyDB(DEFAULT_SETTINGS) : loadLocal();

function loadLocal(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DB;
  } catch { /* fall through to seed */ }
  const s = seed();
  persist(s);
  return s;
}

function persist(s: DB) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full or blocked */ }
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const getDB = () => state;
export const useDB = () => useSyncExternalStore(subscribe, getDB);

// the browser tab (and a pinned / installed app's window) shows the current gym name
const syncTitle = () => { if (state.settings?.gymName) document.title = state.settings.gymName; };
syncTitle();
listeners.add(syncTitle);

export function update(fn: (d: DB) => void) {
  const prev = state;
  const next = structuredClone(state);
  fn(next);
  state = next;
  emit();
  if (remote) queueSync(prev, next);
  else persist(state);
}

export function resetDemo() {
  if (remote) return; // the online database is reset with `npm run db:seed`
  // the gym's name is the owner's choice, not demo data: it stays until they change it again
  const gymName = state.settings.gymName;
  state = seed();
  state.settings.gymName = gymName;
  persist(state);
  emit();
}

export interface NewAccount {
  role: User['role']; name: string; email: string; password: string; phone?: string; color: string;
  plan?: User['plan']; subscriptionEnd?: string; instructorId?: string; specialty?: string;
}

/** Registers a member or instructor; resolves to their id. */
export async function createAccount(a: NewAccount): Promise<string> {
  const createdAt = new Date().toISOString();
  if (!supabase) {
    const id = uid();
    update((d) => { d.users.push({ ...a, id, createdAt }); });
    return id;
  }
  const { password, ...rest } = a;
  const profile = userToProfile({ ...rest, id: '', password: '', createdAt });
  const { id: _omit, ...profileFields } = profile;
  const { data, error } = await supabase.functions.invoke('manage-users', { body: { action: 'create', email: a.email, password, profile: profileFields } });
  if (error || !data?.id) throw new Error(await fnError(error, data));
  const user: User = { ...rest, id: data.id, password: '', createdAt };
  state = { ...state, users: [...state.users.filter((u) => u.id !== user.id), user] };
  emit();
  return data.id;
}

/** Deletes an account and everything that belongs to it. */
export async function deleteAccount(id: string) {
  if (supabase) {
    const { data, error } = await supabase.functions.invoke('manage-users', { body: { action: 'delete', id } });
    if (error) throw new Error(await fnError(error, data));
  }
  const next = structuredClone(state);
  next.users = next.users.filter((u) => u.id !== id);
  if (supabase) {
    // the database already removed their rows; mirror that locally without writing again
    for (const [, r] of toRows(next)) if (r.user_id === id) applyRow(next, r, true);
    state = next;
    emit();
  } else {
    state = next;
    persist(state);
    emit();
  }
}

async function fnError(error: unknown, data: unknown) {
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === 'function') {
    try { const b = await ctx.json(); if (b?.error) return b.error as string; } catch { /* not JSON */ }
  }
  return (data as { error?: string } | null)?.error ?? (error as Error | null)?.message ?? 'Something went wrong.';
}

/* ---------------- remote mode ---------------- */

let channel: RealtimeChannel | null = null;
let syncing: Promise<void> = Promise.resolve();

/** Loads the gym's name and prices before sign-in (the login page shows them). */
export async function loadPublicSettings() {
  if (!supabase) return;
  const { data } = await supabase.from('settings').select('*').eq('id', 1).single();
  if (data) { state = { ...state, settings: rowToSettings(data as SettingsRow) }; emit(); }
}

/** Loads everything the signed-in user may see and starts listening for changes. */
export async function loadRemote() {
  if (!supabase) return;
  const [settings, profiles, rows] = await Promise.all([
    supabase.from('settings').select('*').eq('id', 1).single(),
    supabase.from('profiles').select('*'),
    fetchAllRecords(),
  ]);
  if (profiles.error) throw profiles.error;
  const db = emptyDB(settings.data ? rowToSettings(settings.data as SettingsRow) : state.settings);
  db.users = (profiles.data as ProfileRow[]).map(profileToUser);
  for (const r of rows) applyRow(db, r);
  state = db;
  emit();
  listen();
}

async function fetchAllRecords() {
  const out: RecordRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase!.from('records').select('collection,id,user_id,coach_id,doc').range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data as RecordRow[]));
    if (data.length < PAGE) return out;
  }
}

/** Signed out: forget the data (keep the gym's public settings for the login page). */
export function clearRemote() {
  if (channel) { supabase?.removeChannel(channel); channel = null; }
  state = emptyDB(state.settings);
  emit();
}

function listen() {
  if (!supabase || channel) return;
  channel = supabase.channel('db')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, (p) => {
      const next = { ...state };
      if (p.eventType === 'DELETE') applyRow(next, p.old as RecordRow, true);
      else applyRow(next, p.new as RecordRow);
      state = next;
      emit();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (p) => {
      const id = ((p.eventType === 'DELETE' ? p.old : p.new) as ProfileRow).id;
      const users = state.users.filter((u) => u.id !== id);
      if (p.eventType !== 'DELETE') users.push(profileToUser(p.new as ProfileRow));
      state = { ...state, users };
      emit();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'settings' }, (p) => {
      state = { ...state, settings: rowToSettings(p.new as SettingsRow) };
      emit();
    })
    .subscribe();
}

// writes go out one update at a time, in order
function queueSync(prev: DB, next: DB) {
  syncing = syncing.then(() => pushChanges(prev, next)).catch(async (e) => {
    console.error(e);
    toast(e?.message?.includes('owner') ? e.message : "Couldn't save that change. Reloading the latest data.", 'error');
    await loadRemote().catch(() => undefined);
  });
}

async function pushChanges(prev: DB, next: DB) {
  const sb = supabase!;
  // records
  const before = toRows(prev), after = toRows(next);
  const upserts: RecordRow[] = [];
  const removed = new Map<string, string[]>();
  for (const [k, r] of after) {
    const old = before.get(k);
    if (!old || JSON.stringify(old.doc) !== JSON.stringify(r.doc)) upserts.push(r);
  }
  for (const [k, r] of before) {
    if (!after.has(k)) removed.set(r.collection, [...(removed.get(r.collection) ?? []), r.id]);
  }
  if (upserts.length) {
    const { error } = await sb.from('records').upsert(upserts);
    if (error) throw error;
  }
  for (const [col, ids] of removed) {
    const { error } = await sb.from('records').delete().eq('collection', col).in('id', ids);
    if (error) throw error;
  }
  // profiles (accounts themselves are created / deleted by createAccount / deleteAccount)
  const oldUsers = new Map(prev.users.map((u) => [u.id, JSON.stringify(userToProfile(u))]));
  for (const u of next.users) {
    const row = userToProfile(u), was = oldUsers.get(u.id);
    if (was && was !== JSON.stringify(row)) {
      const { id, created_at: _c, ...fields } = row;
      const { error } = await sb.from('profiles').update(fields).eq('id', id);
      if (error) throw error;
    }
  }
  // settings
  if (JSON.stringify(prev.settings) !== JSON.stringify(next.settings)) {
    const { error } = await sb.from('settings').update(settingsToRow(next.settings)).eq('id', 1);
    if (error) throw error;
  }
}

if (remote) loadPublicSettings();

// keep tabs in sync (local mode; remote mode syncs through realtime)
window.addEventListener('storage', (e) => {
  if (!remote && e.key === KEY && e.newValue) {
    state = JSON.parse(e.newValue);
    emit();
  }
});
