import { createContext, useContext, useState, type ReactNode } from 'react';
import { getDB, useDB } from './db';
import type { User } from './types';

const SESSION = 'ironpulse-session';

interface AuthValue {
  user: User | null;
  login: (email: string, password: string) => string | null;
  logout: () => void;
}

const Ctx = createContext<AuthValue>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const db = useDB();
  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem(SESSION));
  const user = db.users.find((u) => u.id === userId) ?? null;

  const login = (email: string, password: string) => {
    const u = getDB().users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u || u.password !== password) return 'Incorrect email or password.';
    localStorage.setItem(SESSION, u.id);
    setUserId(u.id);
    return null;
  };

  const logout = () => {
    localStorage.removeItem(SESSION);
    setUserId(null);
  };

  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

/** For pages that only render once logged in. */
export const useMe = () => useContext(Ctx).user!;

export const homeFor = (u: User) => (u.role === 'admin' ? '/admin' : u.role === 'instructor' ? '/coach' : '/app');
