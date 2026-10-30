/*
 * Online payments through PayMongo Checkout (GCash, Maya, cards, QR Ph).
 * The member is sent to PayMongo's hosted page; the paymongo-webhook function records the payment, and
 * confirmCheckout() double-checks when they return. Without Supabase (local mode) payments are simulated.
 */
import { fnError, update } from './db';
import { supabase } from './supabase';
import type { DB } from './types';
import { addDays, dayKey, parseDay, uid } from './utils';

export type PayKind = 'monthly' | 'daypass';
export const PAY_METHODS = [
  { value: 'gcash', label: 'GCash' }, { value: 'paymaya', label: 'Maya' }, { value: 'card', label: 'Card' }, { value: 'qrph', label: 'QR Ph' },
];
export const methodLabel = (m?: string) => PAY_METHODS.find((x) => x.value === m)?.label ?? (m ? m[0].toUpperCase() + m.slice(1) : 'Front desk');
/** PayMongo test mode: no real money moves (switch off with VITE_PAYMENTS_LIVE=true once the gym is verified). */
export const paymentsTestMode = import.meta.env.VITE_PAYMENTS_LIVE !== 'true';

const PENDING = 'ironpulse-checkout';

/** Opens PayMongo's checkout page for this payment (redirects away from the app). */
export async function startCheckout(kind: PayKind) {
  if (!supabase) throw new Error('Online payments need the online (Supabase) mode.');
  const returnUrl = `${location.origin}/app/upgrade`;
  const { data, error } = await supabase.functions.invoke('create-checkout', { body: { kind, returnUrl } });
  if (error || !data?.url) throw new Error(await fnError(error, data));
  sessionStorage.setItem(PENDING, data.id);
  location.assign(data.url);
}

/** After returning from PayMongo: makes sure the payment is recorded. */
export async function confirmCheckout(): Promise<{ status: 'paid' | 'pending' | 'expired'; kind?: PayKind } | null> {
  const id = sessionStorage.getItem(PENDING);
  if (!supabase || !id) return null;
  const { data, error } = await supabase.functions.invoke('confirm-checkout', { body: { id } });
  if (error) throw new Error(await fnError(error, data));
  if (data.status !== 'pending') sessionStorage.removeItem(PENDING);
  return data;
}

/** Records a payment and, for a monthly plan, 30 more days of Premium (front desk, or local-mode demo). */
export function applyPayment(d: DB, userId: string, kind: PayKind, extra: { method?: string; online?: boolean } = {}) {
  const today = dayKey();
  d.payments.push({ id: uid(), userId, amount: kind === 'monthly' ? d.settings.monthlyPrice : d.settings.dayPassPrice, date: today, kind, ...extra });
  if (kind !== 'monthly') return;
  const u = d.users.find((x) => x.id === userId)!;
  const base = u.subscriptionEnd && u.subscriptionEnd >= today ? parseDay(u.subscriptionEnd) : new Date();
  u.plan = 'monthly';
  u.subscriptionEnd = dayKey(addDays(base, 30));
  d.requests.forEach((r) => { if (r.userId === userId && r.status === 'pending') r.status = 'approved'; });
}

/** Local mode: a pretend checkout (no network). */
export function simulatePayment(userId: string, kind: PayKind, method: string) {
  update((d) => applyPayment(d, userId, kind, { method, online: true }));
}
