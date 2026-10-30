import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { clearRemote, getDB, loadRemote, remote, useDB } from './db';
import { supabase } from './supabase';
import type { User } from './types';

const SESSION = 'ironpulse-session';

interface AuthValue {
  user: User | null;
  /** false while a saved session is being restored (remote mode) */
  ready: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => void;
}

const Ctx = createContext<AuthValue>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const db = useDB();
  const [userId, setUserId] = useState<string | null>(() => (remote ? null : localStorage.getItem(SESSION)));
  const [ready, setReady] = useState(!remote);
  const user = db.users.find((u) => u.id === userId) ?? null;

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        try { await loadRemote(); if (alive) setUserId(data.session.user.id); } catch { await supabase!.auth.signOut(); }
      }
      if (alive) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { clearRemote(); setUserId(null); }
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  const login = async (email: string, password: string) => {
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.user) return 'Incorrect email or password.';
      try { await loadRemote(); } catch { return "Signed in, but couldn't load your data. Try again."; }
      if (!getDB().users.some((u) => u.id === data.user.id)) {
        await supabase.auth.signOut();
        return 'This account has no gym profile. Ask the front desk.';
      }
      setUserId(data.user.id);
      return null;
    }
    const u = getDB().users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u || u.password !== password) return 'Incorrect email or password.';
    localStorage.setItem(SESSION, u.id);
    setUserId(u.id);
    return null;
  };

  const logout = () => {
    if (supabase) { supabase.auth.signOut(); return; }
    localStorage.removeItem(SESSION);
    setUserId(null);
  };

  return <Ctx.Provider value={{ user, ready, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

/** For pages that only render once logged in. */
export const useMe = () => useContext(Ctx).user!;

export const homeFor = (u: User) => (u.role === 'admin' ? '/admin' : u.role === 'instructor' ? '/coach' : '/app');
